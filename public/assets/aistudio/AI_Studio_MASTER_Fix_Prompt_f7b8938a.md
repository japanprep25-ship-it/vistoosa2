# MASTER TASK: Permanent server fixes for Meta (Messenger/Instagram) replies, saved settings, customer names, Pathao dispatch and Firestore quota

## How to work
- Do the sections in this order: A, B, G, H, C, D, E, F. Make the smallest change that fixes each problem.
- Do NOT redesign the UI and do NOT remove existing features. Do not touch anything that is not listed here.
- Never hardcode secrets, never log them, never return them to the browser.
- At the end, give me the final report asked for in the last section.


Files involved: metaIntegrationService.ts, firebaseAdmin.ts, integrationsConfigStore.ts, server.ts and the Social Inbox / Connect Channels frontend.
Do NOT change: webhook verification (/webhook/meta GET), HMAC signature check, the UI design, or any feature not listed here.
Never log or return secrets (tokens, app secret, private keys).

## Problems found in my code

1. `/api/messages/send` returns a FAKE success.
   - If no pageAccessToken: it logs "[Meta Simulator]..." and returns success with `simulated: true` (UI shows "Message sent in simulation sandbox").
   - If Meta Graph API returns an error (expired token, 24h window, bad PSID), it only does console.warn and STILL returns success:true and saves the message as sent.
2. Meta settings are lost on every redeploy and the UI still says "saved permanently".
   - `saveMetaConfig` swallows every Firestore error; `isFirestoreQuotaExceeded()` makes it skip Firestore completely, so the token stays only in server memory.
   - The quota flag is never reset until the server restarts.
3. Customer real names never load, the inbox shows "Customer #1116".
   - In `persistMessageToFirestore` the name is fetched only if `!finalSenderName || finalSenderName.startsWith('Customer #')`, but callers pass `buffer.senderName || 'Customer'`, so the condition is never true and `fetchMetaUserInfo` is never called.
   - Even when fetched, the name is saved to Firestore only, `conversationBuffers` (used by GET /api/conversations) keeps `senderName` empty.
   - `fetchMetaUserInfo` reads `data.profile_pic?.data?.url`, but the User Profile API returns `profile_pic` as a plain URL string.
   - For Instagram the IGSID must use fields `name,username,profile_pic`, not `first_name,last_name`.
4. Conversation list lives only in memory (`conversationBuffers`), so all history disappears on every deploy/restart, and `ensureSeedConversations()` inserts fake demo customers (Karim Ahmed, Tanvir Ahmed, Sadia Rahman, Kamrul Hasan with fake PSIDs) into the real inbox.
5. Security: `GET /api/settings/meta-order` returns the real metaAppSecret, pageAccessToken and whatsappAccessToken to the browser, and these routes have no authentication: GET/POST /api/settings/meta-order, POST /api/settings/meta-order/test-connection, POST /api/messages/send, POST /api/meta/messages/send, POST /api/meta/simulate-message, POST /api/meta/toggle-autoreply.
6. If `GEMINI_API_KEY` is missing (on Render) or the Gemini call fails, `fallbackHeuristicParser` runs and INVENTS data: default product "Supima Cotton Pique Polo", size "M", color "Midnight Navy", and it can take words like "Mobile No" as the customer name. Auto-reply then sends confident wrong confirmations ("order received") and can create Pending orders with fake product data.
7. Firestore daily read quota (Spark: 50K reads/day) is exceeded because the frontend polls the server every 2-3 seconds and each poll reads Firestore (workspace, orders, conversations).

## Fixes

### A. Reply sending must never fake success (metaIntegrationService.ts)
- In POST `/api/messages/send` and `/api/meta/messages/send`:
  - Simulation is allowed ONLY for fake test recipients: recipient ids starting with `psid_`. For these return `{ success: true, simulated: true }`.
  - For real recipient ids: if the token is missing, return HTTP 400 `{ success: false, error: "Page Access Token not found" }`. Do not save the message.
  - Call Graph API `https://graph.facebook.com/v21.0/me/messages` with `messaging_type: "RESPONSE"`. If the response is not ok or has `error`, return `{ success: false, error: <mapped message>, code, subcode }` and do NOT append the message as sent. Mapped messages: code 190 = "Page Access Token is invalid or expired"; code 200 or 10 = "Missing permission (pages_messaging)"; code 100 = "Invalid recipient id for this customer"; code 551 = "Customer cannot be reached"; subcode 2018278 or text containing "outside of allowed window" = "24 hour reply window is over, the customer must message first". Always include the original Meta error code in the response.
  - Only when Graph API returns `message_id`: save the message with that `mid`, status `sent`.
- Use the same behaviour inside `sendMetaReply` (use the `psid_` rule instead of only `psid_tanvir_`).
- Frontend Social Inbox: on `success:false` show the real error in a red toast, mark the message "Failed" with a Retry button, and never show the green "sent" state or the "simulation sandbox" text for real customers. The simulation message may only appear for fake test customers.
- Instagram: keep the existing flow (same Page token, `/me/messages`, recipient = IGSID).

### B. Settings must really persist (metaIntegrationService.ts, firebaseAdmin.ts, integrationsConfigStore.ts)
- `saveMetaConfig` and `saveIntegrationsConfig` must return `{ config, persisted: boolean, error? }`. If the Firestore write fails (any error), `persisted` is false.
- POST `/api/settings/meta-order` and `/api/settings/integrations`: respond `success: true, persisted: true` only when the Firestore write really worked. Otherwise respond `success: true, persisted: false, message: "Saved only temporarily in server memory. Database error: <reason>"` and the Connect Channels UI must show this as a red/orange warning, not as "saved permanently".
- Keep retrying unsaved settings in the background every 2 minutes until the write succeeds (keep them in a pending queue in memory).
- Token resolution order in `loadMetaConfig`: Firestore `metaConfig/global`, then env (META_PAGE_ACCESS_TOKEN, META_PAGE_ID, META_APP_ID, META_APP_SECRET, META_VERIFY_TOKEN, and the WhatsApp/Instagram env variables that already exist). Log once at startup and when it changes (no secrets): "Meta token source: firestore | env | none".
- Quota flag in firebaseAdmin.ts: do not keep it forever. Retry a Firestore read/write every 10 minutes and clear the flag when it works ("Firestore recovered").
- Make sure Connect Channels saves Meta values through the same path that `loadMetaConfig` reads (`metaConfig/global`). If the UI also saves into `integrationsConfig.meta`, keep both in sync or remove the duplicate, so there is one source of truth for the Meta token.
- Add GET `/api/health/firestore` returning `{ ok, projectId, databaseId, error }` (no secrets), and show "Database: Connected / NOT connected" in Connect Channels.

### C. Customer real names (metaIntegrationService.ts)
- Create one helper `resolveSenderName(senderId, channel)`:
  - Treat a name as unknown if it is empty, equals "Customer", or starts with "Customer".
  - Messenger: GET `/{PSID}?fields=first_name,last_name,profile_pic`. Instagram: GET `/{IGSID}?fields=name,username,profile_pic`. WhatsApp: name already comes from the webhook contacts.
  - `profile_pic` is a plain string URL.
  - If Meta returns an empty object or an error, keep the name unknown but remember the failure for 24 hours (do not call Graph API again for the same sender on every message).
  - On success, SET `buffer.senderName` in `conversationBuffers` AND save `senderName` and `profilePic` in the Firestore `conversations/{senderId}` document. `GET /api/conversations` and `GET /api/messages/:psid` must return this name.
- The inbox must show: real name if known, else "Customer #<last4>" plus a small pencil icon so the owner can type a name manually. Save the manual name in the conversation document (`senderName`, `nameSource: "manual"`) and never overwrite a manual name automatically.
- "Convert to Order": when the owner enters the customer name there, save it to the conversation too.

### D. Conversations must survive restarts (metaIntegrationService.ts)
- On server start (and lazily on first GET), load the conversation list from Firestore `conversations` (senderId, senderName, profilePic, channel, lastMessage, lastMessageSender, lastUpdated) and merge it with the in-memory buffers. Load message history of a thread from `conversations/{id}/messages` when it is opened (already partly done).
- Keep the Firestore reads small: load only the latest 50 conversations, order by `lastUpdated desc`, cache them in memory and refresh only when a webhook event or a send changes them.
- Remove `ensureSeedConversations()` from production. Run it only if env `DEMO_MODE=true`. Existing demo conversations in Firestore must not be created again.

### E. Security
- Require login (`requireAuth`) on: GET and POST `/api/settings/meta-order`, POST `/api/settings/meta-order/test-connection`, POST `/api/messages/send`, POST `/api/meta/messages/send`, POST `/api/meta/simulate-message`, POST `/api/meta/toggle-autoreply`, GET `/api/conversations`, GET `/api/messages/:psid`. The frontend must send the same Authorization header it already uses for other protected routes.
- GET `/api/settings/meta-order` must return secrets masked as `••••••••` (metaAppSecret, pageAccessToken, whatsappAccessToken), never the real value. The POST handlers already ignore `••••••••`, so saving without retyping must keep the old value.
- The Meta webhook routes stay public (they are verified by the Meta signature).

### F. Safe fallback when Gemini is not available
- If `GEMINI_API_KEY` is missing or the Gemini call fails: log a warning once per minute (no secrets) "Gemini unavailable, using basic parser".
- `fallbackHeuristicParser` must NOT invent data: remove the defaults product "Supima Cotton Pique Polo", color "Midnight Navy" and size "M" (leave them null), do not take "Mobile No"-like words as the customer name (use the sender name only), and never return `confidence: "complete"` unless a valid 11-digit Bangladeshi phone AND an address AND a matched product from the trained catalog exist.
- Never create a Pending order from the fallback parser unless it is complete as defined above. Unit price must come from the matched product in the trained catalog (aiKnowledgeStore), not from hardcoded 1650 / 2850 / 6500.
- In fallback mode do not send an auto-reply that says the order was received. Send a short neutral reply asking for missing details, or send nothing.
- Check the Gemini model name used in `generateContent` ("gemini-3.8-flash") against the model that really works with my API key, and use a valid model from an env variable `GEMINI_MODEL` with a sensible default.

### G. Reduce Firestore reads (server.ts, UserWorkspaceStore, frontend)
- Serve workspace, orders and conversations from a server memory cache (write-through: write to memory and Firestore together). Read Firestore only at startup and when a document actually changes.
- Frontend polling: not faster than every 15 seconds, pause polling when the browser tab is hidden. Use a "last updated" timestamp so the server answers "no changes" without touching Firestore.
- Log once "Firestore quota exceeded" when it happens and "Firestore recovered" when it works again.

### H. Pathao dispatch must never fake success (server.ts, pathaoOrderService.ts, pathaoConfigStore.ts)
- The routes /api/pathao/pickup, /api/pathao/create-pickup, /api/pathao/cities, /api/pathao/zones use `extractOptionalAuth` and fall back to the hardcoded userId 'usr_admin_default'. The Pathao credentials are saved under the logged-in user (usr_vistoosa_mother). Create one helper `resolveOwnerUserId(req)`: use `req.userId` if present, otherwise the owner/mother account's userId (the same one Settings are saved under). Use it for Pathao, Meta, WhatsApp and orders. Do not use 'usr_admin_default' to read credentials anywhere. The frontend must send the Authorization header on all /api/pathao/* calls.
- Remove the "fallback consignment" generation completely ("Could not issue live token, generating fallback consignment"). If credentials are missing or Pathao returns an error, return a clear error ("Pathao credentials missing: set them in Settings > Connect Channels > Pathao Courier" or the real Pathao message) and do NOT mark the order Approved and do NOT save any consignment id.
- Remove the fake defaults in the pickup handler: recipient phone default `01700000000` and address default `House 12, Road 5, Banani, Dhaka`. Reject the dispatch if the order has no valid 11-digit Bangladeshi phone (01XXXXXXXXX) or no address, and tell the user which field is missing.
- Pathao credentials must be saved in Firestore and the save must follow the same rule as section B (`persisted` true/false, warning if only in memory).
- Log (no secrets): which userId was used and whether Pathao credentials were found (true/false).
- Keep the existing "Test Connection" for Pathao as it is.

## Final report (after you finish, tell me)
1. Which functions return the real Meta error now and the exact JSON the inbox receives on failure.
2. Where the Meta token is loaded from first, and whether Connect Channels and the sender use the same document.
3. How many Firestore reads one poll caused before and after.
4. Which environment variables I should set on Render (for example META_PAGE_ACCESS_TOKEN, META_PAGE_ID, META_APP_ID, META_APP_SECRET, GEMINI_API_KEY, GEMINI_MODEL, FIREBASE_PROJECT_ID, FIRESTORE_DATABASE_ID, FIREBASE_SERVICE_ACCOUNT).
