// metaIntegrationService.ts
// -----------------------------------------------------------------------
// Unified Meta Order Integration Engine (Messenger, Instagram & WhatsApp)
//
// Automatically captures customer conversations, extracts order details using
// Gemini AI (Bengali/English), buffers multi-message chats, creates Pending
// orders in the Unified Order Engine, and sends automated confirmation replies.

import crypto from 'crypto';
import type { Express, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { detectDistrict } from './src/utils/districtDetector';
import { db } from './firebaseAdmin';

const META_COLLECTION = 'metaConfig';

export interface MetaConfig {
  metaAppId: string;
  metaAppSecret: string;
  metaVerifyToken: string;
  pageAccessToken: string;
  pageId: string;
  instagramBusinessAccountId: string;
  whatsappPhoneNumberId: string;
  whatsappBusinessAccountId: string;
  whatsappAccessToken: string;
}

export interface ConversationMessage {
  sender: 'customer' | 'bot';
  text: string;
  timestamp: string;
  attachmentUrl?: string;
}

export interface ConversationBuffer {
  senderId: string;
  senderName?: string;
  channel: 'messenger' | 'instagram' | 'whatsapp';
  messages: ConversationMessage[];
  lastUpdated: string;
}

export interface ExtractedOrderInfo {
  customer_name: string | null;
  phone_number: string | null;
  address: string | null;
  city: 'Inside Dhaka' | 'Sub-Dhaka' | 'Outside Dhaka';
  product_name: string | null;
  quantity: number;
  size: 'S' | 'M' | 'L' | 'XL' | 'XXL' | null;
  color: string | null;
  payment_method: 'Cash on Delivery' | 'bKash' | 'Nagad';
  confidence: 'complete' | 'incomplete';
  missing_fields: string[];
  suggested_reply: string;
}

// In-memory conversation session buffers keyed by sender ID
const conversationBuffers = new Map<string, ConversationBuffer>();

// Default fallback verify token
const DEFAULT_VERIFY_TOKEN = 'vistoosa_meta_secret_token_2026';

// Callback hook to insert orders into the Unified Order Engine (inboundWebsiteOrders)
let orderCreationHook: ((order: any) => void) | null = null;

export function registerOrderCreationHook(hook: (order: any) => void) {
  orderCreationHook = hook;
}

// -----------------------------------------------------------------------
// 1. Config Persistence in Firestore
// -----------------------------------------------------------------------

export async function loadMetaConfig(docId: string = 'global'): Promise<MetaConfig> {
  let dbConfig: Partial<MetaConfig> = {};
  try {
    const docRef = db.collection(META_COLLECTION).doc(docId);
    const doc = await docRef.get();
    if (doc.exists) {
      dbConfig = doc.data() as Partial<MetaConfig>;
    }
  } catch (err) {
    console.warn('[Meta Config]: Failed to read metaConfig from Firestore, using defaults/env', err);
  }

  return {
    metaAppId: dbConfig.metaAppId || process.env.META_APP_ID || '',
    metaAppSecret: dbConfig.metaAppSecret || process.env.META_APP_SECRET || '',
    metaVerifyToken: dbConfig.metaVerifyToken || process.env.META_VERIFY_TOKEN || DEFAULT_VERIFY_TOKEN,
    pageAccessToken: dbConfig.pageAccessToken || process.env.PAGE_ACCESS_TOKEN || '',
    pageId: dbConfig.pageId || process.env.PAGE_ID || '',
    instagramBusinessAccountId: dbConfig.instagramBusinessAccountId || process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || '',
    whatsappPhoneNumberId: dbConfig.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    whatsappBusinessAccountId: dbConfig.whatsappBusinessAccountId || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
    whatsappAccessToken: dbConfig.whatsappAccessToken || process.env.WHATSAPP_ACCESS_TOKEN || '',
  };
}

export async function saveMetaConfig(config: Partial<MetaConfig>, docId: string = 'global'): Promise<MetaConfig> {
  const current = await loadMetaConfig(docId);
  const merged: MetaConfig = {
    metaAppId: config.metaAppId !== undefined ? String(config.metaAppId).trim() : current.metaAppId,
    metaAppSecret: config.metaAppSecret !== undefined ? String(config.metaAppSecret).trim() : current.metaAppSecret,
    metaVerifyToken: config.metaVerifyToken !== undefined && String(config.metaVerifyToken).trim() !== ''
      ? String(config.metaVerifyToken).trim()
      : current.metaVerifyToken || DEFAULT_VERIFY_TOKEN,
    pageAccessToken: config.pageAccessToken !== undefined ? String(config.pageAccessToken).trim() : current.pageAccessToken,
    pageId: config.pageId !== undefined ? String(config.pageId).trim() : current.pageId,
    instagramBusinessAccountId: config.instagramBusinessAccountId !== undefined ? String(config.instagramBusinessAccountId).trim() : current.instagramBusinessAccountId,
    whatsappPhoneNumberId: config.whatsappPhoneNumberId !== undefined ? String(config.whatsappPhoneNumberId).trim() : current.whatsappPhoneNumberId,
    whatsappBusinessAccountId: config.whatsappBusinessAccountId !== undefined ? String(config.whatsappBusinessAccountId).trim() : current.whatsappBusinessAccountId,
    whatsappAccessToken: config.whatsappAccessToken !== undefined ? String(config.whatsappAccessToken).trim() : current.whatsappAccessToken,
  };

  try {
    await db.collection(META_COLLECTION).doc(docId).set({ ...merged, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err: any) {
    console.error('[Meta Config]: Failed to save metaConfig to Firestore:', err?.message || err);
  }

  return merged;
}

// -----------------------------------------------------------------------
// 2. Conversation Buffer Management
// -----------------------------------------------------------------------

export function appendToConversationBuffer(
  senderId: string,
  channel: 'messenger' | 'instagram' | 'whatsapp',
  message: { sender: 'customer' | 'bot'; text: string; attachmentUrl?: string },
  senderName?: string
): ConversationBuffer {
  let buffer = conversationBuffers.get(senderId);
  if (!buffer) {
    buffer = {
      senderId,
      senderName,
      channel,
      messages: [],
      lastUpdated: new Date().toISOString(),
    };
    conversationBuffers.set(senderId, buffer);
  }

  if (senderName && !buffer.senderName) {
    buffer.senderName = senderName;
  }

  buffer.messages.push({
    sender: message.sender,
    text: message.text,
    attachmentUrl: message.attachmentUrl,
    timestamp: new Date().toISOString(),
  });

  // Keep last 15 messages in sliding window to avoid unbounded growth
  if (buffer.messages.length > 15) {
    buffer.messages = buffer.messages.slice(-15);
  }

  buffer.lastUpdated = new Date().toISOString();
  return buffer;
}

export function getConversationBuffer(senderId: string): ConversationBuffer | undefined {
  return conversationBuffers.get(senderId);
}

// -----------------------------------------------------------------------
// 3. AI Order Parser with Gemini (@google/genai)
// -----------------------------------------------------------------------

function getGemini(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export async function parseOrderWithGemini(
  conversation: ConversationMessage[],
  knownSenderName?: string
): Promise<ExtractedOrderInfo> {
  const customerMessages = conversation.filter((m) => m.sender === 'customer');
  const fullTranscript = conversation
    .map((m) => `${m.sender.toUpperCase()}: ${m.text}${m.attachmentUrl ? ` [Image: ${m.attachmentUrl}]` : ''}`)
    .join('\n');

  const gemini = getGemini();

  if (gemini) {
    try {
      const prompt = `You are the AI Order Parser for Vistoosa Haute Couture, a luxury Bangladeshi male fashion brand (Polo shirts, Linen Panjabi, Oxford formal shirts, Stretch chinos, Italian blazers).
Analyze the conversation below between a customer and our sales bot on Facebook Messenger, Instagram DM, or WhatsApp.
Extract all order information and return strictly valid JSON matching this schema:

{
  "customer_name": "string or null",
  "phone_number": "string or null (valid 11-digit Bangladeshi number like 017xxxxxxxx, 018..., 019..., 016..., 013..., 014...)",
  "address": "string or null (delivery road, house, area, thana, district)",
  "city": "Inside Dhaka" | "Sub-Dhaka" | "Outside Dhaka",
  "product_name": "string or null (e.g. Supima Cotton Pique Polo, Luxury Linen Panjabi, Oxford Shirt, etc.)",
  "quantity": number,
  "size": "S" | "M" | "L" | "XL" | "XXL" or null,
  "color": "string or null",
  "payment_method": "Cash on Delivery" | "bKash" | "Nagad",
  "confidence": "complete" | "incomplete",
  "missing_fields": ["array of missing critical fields from 'phone_number', 'address', 'customer_name', 'product_name', 'size'"],
  "suggested_reply": "A courteous response in polite Bengali. If confidence is 'complete', warmly thank the customer, summarize the order details, and confirm that the order has been received. If confidence is 'incomplete', politely ask specifically for the missing details (e.g. phone number, full address, or preferred size)."
}

CRITICAL RULES:
1. An order is "complete" ONLY IF BOTH a valid Bangladeshi phone number AND a delivery address are present.
2. If known customer sender name is "${knownSenderName || ''}", use it if customer didn't specify another name.
3. If the customer sent an image attachment, note it in the suggested reply or product.
4. Default quantity is 1 if unspecified. Default payment_method is "Cash on Delivery".
5. For city:
   - If within Dhaka city (Dhanmondi, Gulshan, Banani, Mirpur, Uttara, Mohammadpur, Badda, etc.), use "Inside Dhaka".
   - If Gazipur, Savar, Narayanganj, Keraniganj, use "Sub-Dhaka".
   - If Chittagong, Sylhet, Rajshahi, Khulna, Barisal, Rangpur, etc., use "Outside Dhaka".

CONVERSATION TRANSCRIPT:
${fullTranscript}
`;

      const response = await gemini.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const text = response.text?.trim() || '';
      if (text) {
        const parsed = JSON.parse(text) as ExtractedOrderInfo;
        // Verify mandatory fields
        const hasPhone = !!(parsed.phone_number && parsed.phone_number.replace(/\D/g, '').length >= 10);
        const hasAddress = !!(parsed.address && parsed.address.trim().length >= 5);

        if (hasPhone && hasAddress) {
          parsed.confidence = 'complete';
          parsed.missing_fields = [];
        } else {
          parsed.confidence = 'incomplete';
          const missing: string[] = [];
          if (!hasPhone) missing.push('phone_number');
          if (!hasAddress) missing.push('address');
          if (!parsed.product_name) missing.push('product_name');
          if (!parsed.size) missing.push('size');
          parsed.missing_fields = missing;
        }

        return parsed;
      }
    } catch (err) {
      console.warn('[Gemini Order Parser]: AI extraction error, falling back to rule-based parser:', err);
    }
  }

  // Fallback Rule-Based Parser (Works even without Gemini API key or on quota limits)
  return fallbackHeuristicParser(fullTranscript, knownSenderName);
}

function fallbackHeuristicParser(transcript: string, knownSenderName?: string): ExtractedOrderInfo {
  // Extract Bangladeshi phone number (e.g. 01712345678 or +8801812345678)
  const phoneMatch = transcript.match(/(?:\+?88\s*)?(01[3-9]\d{8})\b/);
  const phone_number = phoneMatch ? phoneMatch[1] : null;

  // Extract Size
  const sizeMatch = transcript.match(/\b(XXL|XL|L|M|S)\b/i);
  let size: 'S' | 'M' | 'L' | 'XL' | 'XXL' | null = null;
  if (sizeMatch) {
    size = sizeMatch[1].toUpperCase() as any;
  }

  // Extract Quantity
  const qtyMatch = transcript.match(/\b(\d+)\s*(?:ta|piece|pcs|টি|টা)?\b/i);
  const quantity = qtyMatch && Number(qtyMatch[1]) > 0 && Number(qtyMatch[1]) < 20 ? Number(qtyMatch[1]) : 1;

  // Extract Product keywords
  let product_name: string | null = null;
  const lower = transcript.toLowerCase();
  if (lower.includes('polo') || lower.includes('পোলো') || lower.includes('t-shirt') || lower.includes('টি শার্ট')) {
    product_name = 'Supima Cotton Pique Polo';
  } else if (lower.includes('panjabi') || lower.includes('পাঞ্জাবি') || lower.includes('punjabi')) {
    product_name = 'Luxury Linen Panjabi';
  } else if (lower.includes('shirt') || lower.includes('শার্ট')) {
    product_name = 'Oxford Tailored Shirt';
  } else if (lower.includes('chino') || lower.includes('প্যান্ট')) {
    product_name = 'Stretch Tailored Chinos';
  } else if (lower.includes('blazer') || lower.includes('ব্লেজার')) {
    product_name = 'Italian Wool Blend Blazer';
  } else {
    product_name = 'Supima Cotton Pique Polo';
  }

  // Extract Address clues
  let address: string | null = null;
  let city: 'Inside Dhaka' | 'Sub-Dhaka' | 'Outside Dhaka' = 'Inside Dhaka';

  const addressPatterns = [
    /(?:address|ঠিকানা|বাসা|location|delivery address|address\s*is|ডেলিভারি ঠিকানা)[:\s]+([^\n,]+(?:,[^\n,]+){0,3})/i,
    /(?:road|rd|house|বাড়ি|রোড|ধানমন্ডি|মিরপুর|উত্তরা|গুলশান|বনানী|mohammadpur|chittagong|sylhet|rajshahi)[^\n]+/i,
  ];

  for (const pat of addressPatterns) {
    const match = transcript.match(pat);
    if (match) {
      address = match[0].trim();
      break;
    }
  }

  if (address) {
    const addrLower = address.toLowerCase();
    if (
      addrLower.includes('savar') ||
      addrLower.includes('gazipur') ||
      addrLower.includes('narayanganj') ||
      addrLower.includes('keraniganj')
    ) {
      city = 'Sub-Dhaka';
    } else if (
      addrLower.includes('chittagong') ||
      addrLower.includes('sylhet') ||
      addrLower.includes('khulna') ||
      addrLower.includes('rajshahi') ||
      addrLower.includes('barisal') ||
      addrLower.includes('rangpur') ||
      addrLower.includes('cumilla') ||
      addrLower.includes('bogura')
    ) {
      city = 'Outside Dhaka';
    } else {
      city = 'Inside Dhaka';
    }
  }

  // Customer Name
  let customer_name: string | null = knownSenderName || null;
  const nameMatch = transcript.match(/(?:name|নাম|amar nam|my name)[:\s]+([A-Za-z\u0980-\u09FF\s]{3,25})/i);
  if (nameMatch) {
    customer_name = nameMatch[1].trim();
  }

  const isComplete = !!(phone_number && address && address.length >= 6);
  const missing_fields: string[] = [];
  if (!phone_number) missing_fields.push('phone_number');
  if (!address) missing_fields.push('address');
  if (!size) missing_fields.push('size');

  let suggested_reply = '';
  if (isComplete) {
    suggested_reply = `ধন্যবাদ ${customer_name || 'স্যার'}! আপনার ${product_name} (${size || 'M'} সাইজ) অর্ডারটি সফলভাবে রিসিভ করা হয়েছে ✅। আমাদের টিম খুব শীঘ্রই ডেলিভারির জন্য কল করে কনফার্ম করবে।`;
  } else {
    const missingBangla = [];
    if (!phone_number) missingBangla.push('মোবাইল নম্বর');
    if (!address) missingBangla.push('ডেলিভারি ঠিকানা');
    if (!size) missingBangla.push('সাইজ (M, L, XL)');
    suggested_reply = `আসসালামু আলাইকুম! আপনার অর্ডারটি নিশ্চিত করতে অনুগ্রহ করে আপনার ${missingBangla.join(' ও ')} প্রদান করুন।`;
  }

  return {
    customer_name: customer_name || 'Valued Customer',
    phone_number,
    address,
    city,
    product_name,
    quantity,
    size: size || 'M',
    color: 'Midnight Navy',
    payment_method: 'Cash on Delivery',
    confidence: isComplete ? 'complete' : 'incomplete',
    missing_fields,
    suggested_reply,
  };
}

// -----------------------------------------------------------------------
// 4. Send Confirmation / Follow-Up Reply via Meta Graph API
// -----------------------------------------------------------------------

export async function sendMetaReply(
  channel: 'messenger' | 'instagram' | 'whatsapp',
  recipientId: string,
  messageText: string
): Promise<{ success: boolean; data?: any; error?: any }> {
  const config = await loadMetaConfig();

  try {
    if (channel === 'whatsapp') {
      const phoneNumberId = config.whatsappPhoneNumberId;
      const token = config.whatsappAccessToken;

      if (!phoneNumberId || !token) {
        console.log(`[Meta Reply Simulation]: WhatsApp token not configured. Logged reply for ${recipientId}: "${messageText}"`);
        return { success: true, data: { simulated: true, channel: 'whatsapp', text: messageText } };
      }

      // Format recipient phone number
      const cleanPhone = recipientId.replace(/\D/g, '');
      const formattedPhone = cleanPhone.startsWith('88') ? cleanPhone : `88${cleanPhone.replace(/^0/, '')}`;

      const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: formattedPhone,
          type: 'text',
          text: { preview_url: false, body: messageText },
        }),
      });

      const data = await res.json();
      return { success: res.ok, data };
    } else {
      // Messenger & Instagram DM use Facebook Page Access Token
      const token = config.pageAccessToken;
      if (!token) {
        console.log(`[Meta Reply Simulation]: Page Access Token not configured. Logged reply for ${recipientId}: "${messageText}"`);
        return { success: true, data: { simulated: true, channel, text: messageText } };
      }

      const res = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text: messageText },
        }),
      });

      const data = await res.json();
      return { success: res.ok, data };
    }
  } catch (err: any) {
    console.error(`[Meta Reply Error]: Failed to send reply to ${recipientId} via ${channel}:`, err?.message || err);
    return { success: false, error: err?.message || err };
  }
}

// -----------------------------------------------------------------------
// 5. Test Meta Connection
// -----------------------------------------------------------------------

export async function testMetaConnection(overrideConfig?: Partial<MetaConfig>) {
  const currentConfig = await loadMetaConfig();
  const config = { ...currentConfig, ...overrideConfig };
  const results: {
    pageAccess: { ok: boolean; pageName?: string; pageId?: string; error?: string };
    whatsapp: { ok: boolean; verifiedName?: string; phoneNumber?: string; error?: string };
    overall: boolean;
  } = {
    pageAccess: { ok: false },
    whatsapp: { ok: false },
    overall: false,
  };

  // Test Page Access Token
  if (config.pageAccessToken && config.pageAccessToken !== '••••••••') {
    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${config.pageAccessToken}`);
      const data = await res.json();
      if (res.ok && data.id) {
        results.pageAccess = { ok: true, pageName: data.name, pageId: data.id };
      } else {
        results.pageAccess = { ok: false, error: data.error?.message || 'Invalid Page Access Token' };
      }
    } catch (err: any) {
      results.pageAccess = { ok: false, error: err?.message || 'Connection failed' };
    }
  } else {
    results.pageAccess = { ok: false, error: 'Page Access Token not configured' };
  }

  // Test WhatsApp
  if (config.whatsappAccessToken && config.whatsappPhoneNumberId && config.whatsappAccessToken !== '••••••••') {
    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/${config.whatsappPhoneNumberId}?access_token=${config.whatsappAccessToken}`);
      const data = await res.json();
      if (res.ok && data.id) {
        results.whatsapp = { ok: true, verifiedName: data.verified_name || 'Vistoosa Official', phoneNumber: data.display_phone_number };
      } else {
        results.whatsapp = { ok: false, error: data.error?.message || 'Invalid WhatsApp Token / Phone ID' };
      }
    } catch (err: any) {
      results.whatsapp = { ok: false, error: err?.message || 'WhatsApp connection failed' };
    }
  } else {
    results.whatsapp = { ok: false, error: 'WhatsApp credentials not configured' };
  }

  results.overall = results.pageAccess.ok || results.whatsapp.ok;
  return results;
}

// -----------------------------------------------------------------------
// 6. Signature Verification (HMAC-SHA256)
// -----------------------------------------------------------------------

export function verifyMetaSignature(req: Request, appSecret: string): boolean {
  if (!appSecret) return true; // If secret is not set in dev, allow
  const signature = req.headers['x-hub-signature-256'] as string;
  if (!signature) return false;

  try {
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

// -----------------------------------------------------------------------
// 7. Mount Webhook & API Routes
// -----------------------------------------------------------------------

export function mountMetaIntegrationRoutes(app: Express) {
  // Webhook Verification (GET /webhook/meta and /api/webhook/meta)
  const handleWebhookVerification = async (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const config = await loadMetaConfig();
    const expectedToken = config.metaVerifyToken || DEFAULT_VERIFY_TOKEN;

    if (mode === 'subscribe' && token === expectedToken) {
      console.log('[Meta Webhook Verified]: Challenge accepted from Meta Graph API.');
      return res.status(200).send(challenge);
    } else {
      console.warn(`[Meta Webhook Rejected]: Mode=${mode}, Token mismatch. Expected="${expectedToken}", received="${token}"`);
      return res.status(403).send('Forbidden: Token mismatch');
    }
  };

  app.get('/webhook/meta', handleWebhookVerification);
  app.get('/webhook/meta/', handleWebhookVerification);
  app.get('/api/webhook/meta', handleWebhookVerification);
  app.get('/api/webhook/meta/', handleWebhookVerification);
  app.get('/api/webhooks/meta', handleWebhookVerification);

  // Incoming Meta Webhook Messages (POST /webhook/meta and /api/webhook/meta)
  const handleIncomingMetaWebhook = async (req: Request, res: Response) => {
    const config = await loadMetaConfig();

    // Verify HMAC signature if secret is present
    if (config.metaAppSecret && !verifyMetaSignature(req, config.metaAppSecret)) {
      console.warn('[Meta Webhook]: Signature verification failed.');
      return res.status(401).send('Unauthorized: Invalid Signature');
    }

    const payload = req.body || {};

    // 1. Respond 200 OK immediately so Meta does not timeout or retry
    res.status(200).json({ status: 'EVENT_RECEIVED' });

    // 2. Process message asynchronously in background job
    setImmediate(async () => {
      try {
        await processIncomingMetaPayload(payload);
      } catch (err) {
        console.error('[Meta Webhook Background Processing Error]:', err);
      }
    });
  };

  app.post('/webhook/meta', handleIncomingMetaWebhook);
  app.post('/webhook/meta/', handleIncomingMetaWebhook);
  app.post('/api/webhook/meta', handleIncomingMetaWebhook);
  app.post('/api/webhook/meta/', handleIncomingMetaWebhook);
  app.post('/api/webhooks/meta', handleIncomingMetaWebhook);

  // POST /api/meta/simulate-message -> Interactive test tool for frontend UI
  app.post('/api/meta/simulate-message', async (req: Request, res: Response) => {
    const { channel, senderId, senderName, text, attachmentUrl } = req.body || {};

    const cleanChannel: 'messenger' | 'instagram' | 'whatsapp' =
      channel === 'instagram' ? 'instagram' : channel === 'whatsapp' ? 'whatsapp' : 'messenger';
    const cleanSenderId = String(senderId || `sim-user-${Math.floor(1000 + Math.random() * 9000)}`);
    const cleanText = String(text || '').trim();

    if (!cleanText && !attachmentUrl) {
      return res.status(400).json({ success: false, message: 'Message text or attachment is required.' });
    }

    // Append to conversation buffer
    const buffer = appendToConversationBuffer(
      cleanSenderId,
      cleanChannel,
      { sender: 'customer', text: cleanText, attachmentUrl },
      senderName
    );

    // Run AI Order Parser
    const parsed = await parseOrderWithGemini(buffer.messages, buffer.senderName);

    let createdOrder: any = null;

    if (parsed.confidence === 'complete' && parsed.phone_number && parsed.address) {
      // Build Vistoosa Pending Order
      const deliveryFee = parsed.city === 'Inside Dhaka' ? 60 : parsed.city === 'Sub-Dhaka' ? 100 : 150;
      const unitPrice = parsed.product_name?.includes('Panjabi') ? 2850 : parsed.product_name?.includes('Blazer') ? 6500 : 1650;
      const totalAmount = unitPrice * (parsed.quantity || 1) + deliveryFee;

      const distInfo = detectDistrict(parsed.address, parsed.city);

      createdOrder = {
        id: `VIS-META-${Math.floor(1000 + Math.random() * 9000)}`,
        customerName: parsed.customer_name || buffer.senderName || 'Valued Customer',
        phone: parsed.phone_number,
        address: parsed.address,
        city: parsed.city,
        district: distInfo.district || undefined,
        pathaoCityId: distInfo.pathaoCityId || undefined,
        channel: cleanChannel === 'whatsapp' ? 'WhatsApp' : cleanChannel === 'instagram' ? 'Instagram' : 'Facebook',
        source: cleanChannel,
        senderId: cleanSenderId,
        productImageUrl: attachmentUrl,
        rawConversation: buffer.messages,
        items: [
          {
            id: `item-sim-${Date.now()}`,
            productName: parsed.product_name || 'Supima Cotton Pique Polo',
            sku: `POLO-NVY-${parsed.size || 'M'}`,
            color: parsed.color || 'Midnight Navy',
            size: parsed.size || 'M',
            quantity: parsed.quantity || 1,
            unitPrice,
          },
        ],
        totalAmount,
        deliveryFee,
        paymentMethod: parsed.payment_method || 'Cash on Delivery',
        status: 'Pending',
        createdAt: new Date().toISOString(),
        notes: `AI Order parsed via ${cleanChannel.toUpperCase()} from sender #${cleanSenderId}.`,
        confidence: parsed.confidence,
        missingFields: parsed.missing_fields,
      };

      // Add to unified orders queue hook if registered
      if (orderCreationHook) {
        orderCreationHook(createdOrder);
      }
    }

    // Append bot reply to buffer
    appendToConversationBuffer(cleanSenderId, cleanChannel, {
      sender: 'bot',
      text: parsed.suggested_reply,
    });

    return res.json({
      success: true,
      channel: cleanChannel,
      senderId: cleanSenderId,
      buffer: buffer.messages,
      extracted: parsed,
      createdOrder,
      autoReply: parsed.suggested_reply,
      message: parsed.confidence === 'complete'
        ? `Order successfully extracted and placed in Pending Orders!`
        : `Information incomplete. Bot replied asking for missing details: ${parsed.missing_fields.join(', ')}`,
    });
  });

  // GET /api/settings/meta-order -> Retrieve settings & status
  app.get('/api/settings/meta-order', async (req: Request, res: Response) => {
    const config = await loadMetaConfig();
    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;

    return res.json({
      success: true,
      config: {
        metaAppId: config.metaAppId,
        metaAppSecret: config.metaAppSecret ? '••••••••' : '',
        metaVerifyToken: config.metaVerifyToken,
        pageAccessToken: config.pageAccessToken ? '••••••••' : '',
        pageId: config.pageId,
        instagramBusinessAccountId: config.instagramBusinessAccountId,
        whatsappPhoneNumberId: config.whatsappPhoneNumberId,
        whatsappBusinessAccountId: config.whatsappBusinessAccountId,
        whatsappAccessToken: config.whatsappAccessToken ? '••••••••' : '',
      },
      webhookCallbackUrl: `${appUrl}/webhook/meta`,
      verifyToken: config.metaVerifyToken || DEFAULT_VERIFY_TOKEN,
      activeBuffersCount: conversationBuffers.size,
    });
  });

  // POST /api/settings/meta-order -> Save settings
  app.post('/api/settings/meta-order', async (req: Request, res: Response) => {
    const payload = req.body || {};
    const existing = await loadMetaConfig();

    // Don't overwrite tokens if submitted as '••••••••'
    const toSave: Partial<MetaConfig> = { ...payload };
    if (payload.metaAppSecret === '••••••••') toSave.metaAppSecret = existing.metaAppSecret;
    if (payload.pageAccessToken === '••••••••') toSave.pageAccessToken = existing.pageAccessToken;
    if (payload.whatsappAccessToken === '••••••••') toSave.whatsappAccessToken = existing.whatsappAccessToken;

    const updated = await saveMetaConfig(toSave);

    return res.json({
      success: true,
      message: 'Meta Unified Order Integration settings saved permanently.',
      config: {
        ...updated,
        metaAppSecret: updated.metaAppSecret ? '••••••••' : '',
        pageAccessToken: updated.pageAccessToken ? '••••••••' : '',
        whatsappAccessToken: updated.whatsappAccessToken ? '••••••••' : '',
      },
    });
  });

  // POST /api/settings/meta-order/test-connection -> Live Test Connection
  app.post('/api/settings/meta-order/test-connection', async (req: Request, res: Response) => {
    const payload = req.body || {};
    const existing = await loadMetaConfig();

    const configToTest: Partial<MetaConfig> = { ...payload };
    if (payload.metaAppSecret === '••••••••') configToTest.metaAppSecret = existing.metaAppSecret;
    if (payload.pageAccessToken === '••••••••') configToTest.pageAccessToken = existing.pageAccessToken;
    if (payload.whatsappAccessToken === '••••••••') configToTest.whatsappAccessToken = existing.whatsappAccessToken;

    const results = await testMetaConnection(configToTest);
    return res.json({
      success: results.overall,
      results,
    });
  });

  // GET /api/meta/conversations -> View active conversation buffers
  app.get('/api/meta/conversations', (_req: Request, res: Response) => {
    const buffers = Array.from(conversationBuffers.values()).map((b) => ({
      senderId: b.senderId,
      senderName: b.senderName,
      channel: b.channel,
      messageCount: b.messages.length,
      lastUpdated: b.lastUpdated,
      lastMessage: b.messages[b.messages.length - 1]?.text || '',
    }));

    return res.json({
      success: true,
      count: buffers.length,
      conversations: buffers,
    });
  });
}

// -----------------------------------------------------------------------
// 8. Process Raw Meta Webhook Event Payloads (Async Worker)
// -----------------------------------------------------------------------

async function processIncomingMetaPayload(payload: any) {
  const objectType = payload.object;

  // Case A: Facebook Messenger or Instagram DM (object: 'page' or 'instagram')
  if (objectType === 'page' || objectType === 'instagram') {
    const channel: 'messenger' | 'instagram' = objectType === 'instagram' ? 'instagram' : 'messenger';
    const entries = payload.entry || [];

    for (const entry of entries) {
      const messagings = entry.messaging || [];
      for (const msgEvent of messagings) {
        const senderId = msgEvent.sender?.id;
        const message = msgEvent.message;

        if (!senderId || !message) continue;

        const text = message.text || '';
        let attachmentUrl: string | undefined;

        if (Array.isArray(message.attachments) && message.attachments.length > 0) {
          attachmentUrl = message.attachments[0]?.payload?.url;
        }

        console.log(`[Meta Inbound ${channel.toUpperCase()}]: Sender ${senderId} sent: "${text}"`);

        // 1. Buffer conversation
        const buffer = appendToConversationBuffer(senderId, channel, {
          sender: 'customer',
          text,
          attachmentUrl,
        });

        // 2. Parse with Gemini AI
        const parsed = await parseOrderWithGemini(buffer.messages, buffer.senderName);

        // 3. If complete order, add to Unified Pending Orders!
        if (parsed.confidence === 'complete' && parsed.phone_number && parsed.address) {
          const deliveryFee = parsed.city === 'Inside Dhaka' ? 60 : parsed.city === 'Sub-Dhaka' ? 100 : 150;
          const unitPrice = parsed.product_name?.includes('Panjabi') ? 2850 : parsed.product_name?.includes('Blazer') ? 6500 : 1650;
          const totalAmount = unitPrice * (parsed.quantity || 1) + deliveryFee;

          const distInfo = detectDistrict(parsed.address, parsed.city);

          const newOrder = {
            id: `VIS-META-${Math.floor(1000 + Math.random() * 9000)}`,
            customerName: parsed.customer_name || 'Valued Customer',
            phone: parsed.phone_number,
            address: parsed.address,
            city: parsed.city,
            district: distInfo.district || undefined,
            pathaoCityId: distInfo.pathaoCityId || undefined,
            channel: channel === 'instagram' ? 'Instagram' : 'Facebook',
            source: channel,
            senderId,
            productImageUrl: attachmentUrl,
            rawConversation: buffer.messages,
            items: [
              {
                id: `item-meta-${Date.now()}`,
                productName: parsed.product_name || 'Supima Cotton Pique Polo',
                sku: `POLO-NVY-${parsed.size || 'M'}`,
                color: parsed.color || 'Midnight Navy',
                size: parsed.size || 'M',
                quantity: parsed.quantity || 1,
                unitPrice,
              },
            ],
            totalAmount,
            deliveryFee,
            paymentMethod: parsed.payment_method || 'Cash on Delivery',
            status: 'Pending',
            createdAt: new Date().toISOString(),
            notes: `Auto-parsed from ${channel.toUpperCase()} chat. Customer PSID: ${senderId}`,
            confidence: parsed.confidence,
          };

          if (orderCreationHook) {
            orderCreationHook(newOrder);
          }

          console.log(`[Meta Order Queued into Pending]: Order #${newOrder.id} for ${newOrder.customerName} (${newOrder.phone})`);
        }

        // 4. Send reply back to customer
        if (parsed.suggested_reply) {
          appendToConversationBuffer(senderId, channel, {
            sender: 'bot',
            text: parsed.suggested_reply,
          });

          await sendMetaReply(channel, senderId, parsed.suggested_reply);
        }
      }
    }
  }

  // Case B: WhatsApp Business Account Webhook (object: 'whatsapp_business_account')
  else if (objectType === 'whatsapp_business_account') {
    const entries = payload.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field !== 'messages') continue;
        const val = change.value || {};
        const messages = val.messages || [];
        const contacts = val.contacts || [];

        for (const msg of messages) {
          const senderId = msg.from; // Sender WhatsApp phone number
          const contact = contacts.find((c: any) => c.wa_id === senderId);
          const senderName = contact?.profile?.name;

          let text = '';
          let attachmentUrl: string | undefined;

          if (msg.type === 'text') {
            text = msg.text?.body || '';
          } else if (msg.type === 'image') {
            text = msg.image?.caption || 'Customer sent a product image';
            attachmentUrl = msg.image?.link || msg.image?.id;
          }

          if (!text && !attachmentUrl) continue;

          console.log(`[Meta Inbound WHATSAPP]: ${senderName || senderId} (${senderId}) sent: "${text}"`);

          // 1. Buffer conversation
          const buffer = appendToConversationBuffer(
            senderId,
            'whatsapp',
            { sender: 'customer', text, attachmentUrl },
            senderName
          );

          // 2. Parse with Gemini AI
          const parsed = await parseOrderWithGemini(buffer.messages, buffer.senderName);

          // 3. If complete order, add to Unified Pending Orders!
          if (parsed.confidence === 'complete' && parsed.phone_number && parsed.address) {
            const deliveryFee = parsed.city === 'Inside Dhaka' ? 60 : parsed.city === 'Sub-Dhaka' ? 100 : 150;
            const unitPrice = parsed.product_name?.includes('Panjabi') ? 2850 : parsed.product_name?.includes('Blazer') ? 6500 : 1650;
            const totalAmount = unitPrice * (parsed.quantity || 1) + deliveryFee;

            const distInfo = detectDistrict(parsed.address, parsed.city);

            const newOrder = {
              id: `VIS-WA-${Math.floor(1000 + Math.random() * 9000)}`,
              customerName: parsed.customer_name || senderName || 'Valued Customer',
              phone: parsed.phone_number || senderId,
              address: parsed.address,
              city: parsed.city,
              district: distInfo.district || undefined,
              pathaoCityId: distInfo.pathaoCityId || undefined,
              channel: 'WhatsApp',
              source: 'whatsapp',
              senderId,
              productImageUrl: attachmentUrl,
              rawConversation: buffer.messages,
              items: [
                {
                  id: `item-wa-${Date.now()}`,
                  productName: parsed.product_name || 'Supima Cotton Pique Polo',
                  sku: `POLO-NVY-${parsed.size || 'M'}`,
                  color: parsed.color || 'Midnight Navy',
                  size: parsed.size || 'M',
                  quantity: parsed.quantity || 1,
                  unitPrice,
                },
              ],
              totalAmount,
              deliveryFee,
              paymentMethod: parsed.payment_method || 'Cash on Delivery',
              status: 'Pending',
              createdAt: new Date().toISOString(),
              notes: `Auto-parsed from WhatsApp conversation for ${senderName || senderId}`,
              confidence: parsed.confidence,
            };

            if (orderCreationHook) {
              orderCreationHook(newOrder);
            }

            console.log(`[WhatsApp Order Queued into Pending]: Order #${newOrder.id} for ${newOrder.customerName}`);
          }

          // 4. Send reply back to customer
          if (parsed.suggested_reply) {
            appendToConversationBuffer(senderId, 'whatsapp', {
              sender: 'bot',
              text: parsed.suggested_reply,
            });

            await sendMetaReply('whatsapp', senderId, parsed.suggested_reply);
          }
        }
      }
    }
  }
}
