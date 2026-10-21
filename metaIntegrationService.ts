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
import {
  db,
  isFirestoreQuotaExceeded,
  markFirestoreQuotaExceeded,
  isQuotaExceededError,
} from './firebaseAdmin';

const META_COLLECTION = 'metaConfig';
const inMemoryMetaConfig = new Map<string, Partial<MetaConfig>>();

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
  sender: 'customer' | 'bot' | 'agent' | 'user';
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
  let dbConfig: Partial<MetaConfig> = inMemoryMetaConfig.get(docId) || {};

  if (!isFirestoreQuotaExceeded()) {
    try {
      const docRef = db.collection(META_COLLECTION).doc(docId);
      const doc = await docRef.get();
      if (doc.exists) {
        dbConfig = doc.data() as Partial<MetaConfig>;
        inMemoryMetaConfig.set(docId, dbConfig);
      }
    } catch (err: any) {
      if (isQuotaExceededError(err)) {
        markFirestoreQuotaExceeded();
      }
    }
  }

  return {
    metaAppId: dbConfig.metaAppId || process.env.META_APP_ID || '',
    metaAppSecret: dbConfig.metaAppSecret || process.env.META_APP_SECRET || '',
    metaVerifyToken: dbConfig.metaVerifyToken || process.env.META_VERIFY_TOKEN || DEFAULT_VERIFY_TOKEN,
    pageAccessToken: dbConfig.pageAccessToken || process.env.META_PAGE_ACCESS_TOKEN || '',
    pageId: dbConfig.pageId || process.env.META_PAGE_ID || '',
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

  inMemoryMetaConfig.set(docId, merged);

  if (!isFirestoreQuotaExceeded()) {
    try {
      await db.collection(META_COLLECTION).doc(docId).set({ ...merged, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (err: any) {
      if (isQuotaExceededError(err)) {
        markFirestoreQuotaExceeded();
      }
    }
  }

  return merged;
}

// -----------------------------------------------------------------------
// 2. Conversation Buffer Management
// -----------------------------------------------------------------------

export function appendToConversationBuffer(
  senderId: string,
  channel: 'messenger' | 'instagram' | 'whatsapp',
  message: { sender: 'customer' | 'bot' | 'agent' | 'user'; text: string; attachmentUrl?: string; timestamp?: string; mid?: string; status?: 'sent' | 'delivered' | 'seen' },
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

  if (message.mid) {
    const existingIndex = buffer.messages.findIndex(m => m.mid && m.mid === message.mid);
    if (existingIndex !== -1) {
      if (message.status) {
        buffer.messages[existingIndex].status = message.status;
      }
      return buffer;
    }
  }

  buffer.messages.push({
    sender: message.sender,
    text: message.text,
    attachmentUrl: message.attachmentUrl,
    mid: message.mid,
    status: message.status || 'sent',
    timestamp: message.timestamp || new Date().toISOString(),
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

async function persistMessageToFirestore(
  senderId: string,
  senderName: string,
  channel: string,
  senderType: 'customer' | 'bot' | 'agent' | 'user',
  text: string,
  attachmentUrl?: string,
  mid?: string,
  status: 'sent' | 'delivered' | 'seen' = 'sent'
) {
  if (isFirestoreQuotaExceeded()) return;
  try {
    const threadRef = db.collection('conversations').doc(senderId);
    
    // Fetch real name if we don't have it yet
    let finalSenderName = senderName;
    let profilePic: string | undefined;
    
    if (!finalSenderName || finalSenderName.startsWith('Customer #')) {
      const metaInfo = await fetchMetaUserInfo(senderId);
      if (metaInfo) {
        finalSenderName = metaInfo.name;
        profilePic = metaInfo.profilePic;
      }
    }

    const updateData: any = {
      senderId,
      senderName: finalSenderName || 'Customer',
      channel,
      lastUpdated: new Date().toISOString(),
      lastMessage: text || (attachmentUrl ? '[Image Attachment]' : ''),
      lastMessageSender: senderType,
    };
    
    if (profilePic) {
      updateData.profilePic = profilePic;
    }

    await threadRef.set(updateData, { merge: true });

    if (mid) {
      const existingMsgQuery = await threadRef.collection('messages').where('mid', '==', mid).get();
      if (!existingMsgQuery.empty) {
        await existingMsgQuery.docs[0].ref.update({ status });
        return;
      }
    }

    await threadRef.collection('messages').add({
      sender: senderType,
      text: text || '',
      attachmentUrl: attachmentUrl || null,
      mid: mid || null,
      status,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      markFirestoreQuotaExceeded();
    }
  }
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

// Helper to fetch real name and profile picture from Meta
export async function fetchMetaUserInfo(psid: string): Promise<{name: string, profilePic: string} | null> {
  const config = await loadMetaConfig();
  if (!config.pageAccessToken) return null;

  try {
    const url = `https://graph.facebook.com/v21.0/${psid}?fields=first_name,last_name,profile_pic&access_token=${config.pageAccessToken}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok || data.error) {
      console.warn(`[Meta API]: Failed to fetch user info for ${psid}:`, data.error?.message || 'Unknown error');
      return null;
    }

    const name = `${data.first_name || ''} ${data.last_name || ''}`.trim();
    const profilePic = data.profile_pic?.data?.url || '';

    return { name: name || 'Customer', profilePic };
  } catch (err) {
    console.error(`[Meta API]: Exception fetching user info for ${psid}:`, err);
    return null;
  }
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
    const isSimulation = recipientId.startsWith('psid_tanvir_');

    if (channel === 'whatsapp') {
      const phoneNumberId = config.whatsappPhoneNumberId;
      const token = config.whatsappAccessToken;

      if (!phoneNumberId || !token) {
        return { success: false, error: 'WhatsApp configuration missing.' };
      }

      if (isSimulation) {
        console.log(`[Meta Reply Simulation]: WhatsApp reply for ${recipientId}: "${messageText}"`);
        return { success: true, data: { simulated: true, channel: 'whatsapp', text: messageText } };
      }

      const cleanPhone = recipientId.replace(/\D/g, '');
      const formattedPhone = cleanPhone.startsWith('88') ? cleanPhone : `88${cleanPhone.replace(/^0/, '')}`;

      const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
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
      if (!res.ok) {
        return { success: false, error: data.error?.message || 'Failed to send WhatsApp message' };
      }
      return { success: true, data };
    } else {
      const token = config.pageAccessToken;
      if (!token) {
        return { success: false, error: 'Page Access Token missing.' };
      }

      if (isSimulation) {
        console.log(`[Meta Reply Simulation]: ${channel} reply for ${recipientId}: "${messageText}"`);
        return { success: true, data: { simulated: true, channel, text: messageText } };
      }

      const res = await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text: messageText },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error?.message || 'Failed to send Meta message' };
      }
      return { success: true, data };
    }
  } catch (err: any) {
    console.error(`[Meta Reply Error]: Failed to send reply to ${recipientId} via ${channel}:`, err?.message || err);
    return { success: false, error: err?.message || err };
  }

}

// -----------------------------------------------------------------------
// 5. Test Meta Connection
// -----------------------------------------------------------------------

// -----------------------------------------------------------------------
// 5. Test Meta Connection
// -----------------------------------------------------------------------

export interface MetaCheckItem {
  id: 'token_validity' | 'page_match' | 'webhook_subscription' | 'whatsapp';
  name: string;
  nameBn: string;
  status: 'ok' | 'warning' | 'fail' | 'neutral';
  message: string;
  hintBn: string;
}

export interface MetaConnectionResults {
  overall: boolean;
  checks: {
    tokenValidity: MetaCheckItem;
    pageMatch: MetaCheckItem;
    webhookSubscription: MetaCheckItem;
    whatsapp: MetaCheckItem;
  };
  checklist: MetaCheckItem[];
  pageAccess: { ok: boolean; pageName?: string; pageId?: string; error?: string; warning?: string };
  whatsapp: { ok: boolean; verifiedName?: string; phoneNumber?: string; error?: string };
}

/**
 * Sanitizes Meta API error messages to keep them short and plain English,
 * completely stripping URLs, documentation references, and raw codes.
 */
export function cleanMetaErrorMessage(rawError: any): string {
  if (!rawError) return 'Meta API error';
  let message = '';
  if (typeof rawError === 'string') {
    message = rawError;
  } else if (rawError.message) {
    message = String(rawError.message);
  } else if (rawError.error_user_msg) {
    message = String(rawError.error_user_msg);
  } else {
    message = 'Meta API error';
  }

  // Remove URLs & documentation links
  message = message.replace(/https?:\/\/\S+/gi, '').trim();

  // Remove trailing documentation instructions
  message = message.replace(/(please\s+)?(refer to|see|visit|check).*$/i, '').trim();

  // Strip trailing punctuation / parentheses / brackets left by stripping URLs
  message = message.replace(/[\(\)\[\]]+$/g, '').trim();

  // Strip error code prefix e.g. "(#100) "
  message = message.replace(/^\(#\d+\)\s*/, '');

  // Truncate to first sentence if long
  if (message.length > 80 && message.includes('.')) {
    const firstSentence = message.split('.')[0].trim();
    if (firstSentence.length > 10) {
      message = firstSentence;
    }
  }

  // Truncate if still over 90 characters
  if (message.length > 90) {
    message = message.slice(0, 87) + '...';
  }

  return message || 'Meta API error';
}

export async function testMetaConnection(overrideConfig?: Partial<MetaConfig>): Promise<MetaConnectionResults> {
  const currentConfig = await loadMetaConfig();
  const config = { ...currentConfig, ...overrideConfig };

  const metaAppId = String(config.metaAppId || '').trim();
  const metaAppSecret = (config.metaAppSecret && config.metaAppSecret !== '••••••••' ? config.metaAppSecret : currentConfig.metaAppSecret || '').trim();
  const pageAccessToken = (config.pageAccessToken && config.pageAccessToken !== '••••••••' ? config.pageAccessToken : currentConfig.pageAccessToken || '').trim();
  const pageId = String(config.pageId || '').trim();
  const whatsappAccessToken = (config.whatsappAccessToken && config.whatsappAccessToken !== '••••••••' ? config.whatsappAccessToken : currentConfig.whatsappAccessToken || '').trim();
  const whatsappPhoneNumberId = String(config.whatsappPhoneNumberId || '').trim();

  let tokenCheck: MetaCheckItem;
  let pageMatchCheck: MetaCheckItem;
  let webhookCheck: MetaCheckItem;
  let whatsappCheck: MetaCheckItem;

  let debugProfileId = '';

  // -------------------------------------------------------------------------
  // Check 1: Token Validity
  // Call: GET https://graph.facebook.com/v21.0/debug_token?input_token=<pageAccessToken>&access_token=<metaAppId>|<metaAppSecret>
  // Show: is_valid, token type, expiry ('never expires' or formatted), and 'pages_messaging' scope.
  // -------------------------------------------------------------------------
  if (!pageAccessToken) {
    tokenCheck = {
      id: 'token_validity',
      name: 'Token Validity',
      nameBn: 'টোকেন মেয়াদ ও সক্ষমতা',
      status: 'fail',
      message: 'Page Access Token not configured',
      hintBn: 'পেজ এক্সেস টোকেন প্রদান করুন',
    };
  } else if (!metaAppId || !metaAppSecret) {
    tokenCheck = {
      id: 'token_validity',
      name: 'Token Validity',
      nameBn: 'টোকেন মেয়াদ ও সক্ষমতা',
      status: 'fail',
      message: 'Meta App ID & Secret required to inspect token',
      hintBn: 'টোকেন যাচাইয়ের জন্য App ID ও App Secret প্রয়োজন',
    };
  } else {
    try {
      const appAccessToken = `${metaAppId}|${metaAppSecret}`;
      const debugUrl = `https://graph.facebook.com/v21.0/debug_token?input_token=${encodeURIComponent(pageAccessToken)}&access_token=${encodeURIComponent(appAccessToken)}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000);
      const res = await fetch(debugUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      const data = await res.json();

      if (!res.ok || data.error) {
        const shortErr = cleanMetaErrorMessage(data?.error);
        const isExpiredOrInvalid = data?.error?.code === 190 || /access token|expired|invalid/i.test(shortErr);
        tokenCheck = {
          id: 'token_validity',
          name: 'Token Validity',
          nameBn: 'টোকেন মেয়াদ ও সক্ষমতা',
          status: 'fail',
          message: isExpiredOrInvalid ? 'Token invalid or expired' : shortErr,
          hintBn: 'টোকেন মেয়াদোত্তীর্ণ বা অকার্যকর',
        };
      } else if (data.data) {
        const d = data.data;
        const isValid = Boolean(d.is_valid);
        const tokenType = d.type ? String(d.type).toUpperCase() : 'PAGE';
        const expiresAt = typeof d.expires_at === 'number' ? d.expires_at : 0;
        const scopes: string[] = Array.isArray(d.scopes) ? d.scopes : [];
        const hasMessaging = scopes.includes('pages_messaging');
        debugProfileId = String(d.profile_id || d.target_id || (tokenType === 'PAGE' ? d.user_id : '') || '').trim();

        let expiryStr = 'never expires';
        if (expiresAt > 0) {
          const diffSec = expiresAt - Math.floor(Date.now() / 1000);
          if (diffSec <= 0) {
            expiryStr = 'expired';
          } else {
            const diffDays = Math.floor(diffSec / 86400);
            expiryStr = diffDays > 0 ? `expires in ${diffDays}d` : 'expires today';
          }
        }

        if (!isValid) {
          tokenCheck = {
            id: 'token_validity',
            name: 'Token Validity',
            nameBn: 'টোকেন মেয়াদ ও সক্ষমতা',
            status: 'fail',
            message: 'Token invalid or expired',
            hintBn: 'টোকেন মেয়াদোত্তীর্ণ বা অকার্যকর',
          };
        } else if (!hasMessaging) {
          tokenCheck = {
            id: 'token_validity',
            name: 'Token Validity',
            nameBn: 'টোকেন মেয়াদ ও সক্ষমতা',
            status: 'fail',
            message: 'pages_messaging permission missing',
            hintBn: 'pages_messaging পারমিশন দেওয়া নেই',
          };
        } else {
          tokenCheck = {
            id: 'token_validity',
            name: 'Token Validity',
            nameBn: 'টোকেন মেয়াদ ও সক্ষমতা',
            status: 'ok',
            message: `Valid ${tokenType} token (${expiryStr}), pages_messaging granted`,
            hintBn: 'টোকেন বৈধ এবং মেসেজিং পারমিশন সক্রিয়',
          };
        }
      } else {
        tokenCheck = {
          id: 'token_validity',
          name: 'Token Validity',
          nameBn: 'টোকেন মেয়াদ ও সক্ষমতা',
          status: 'fail',
          message: 'Token invalid or expired',
          hintBn: 'টোকেন মেয়াদোত্তীর্ণ বা অকার্যকর',
        };
      }
    } catch {
      tokenCheck = {
        id: 'token_validity',
        name: 'Token Validity',
        nameBn: 'টোকেন মেয়াদ ও সক্ষমতা',
        status: 'fail',
        message: 'Could not connect to Meta Graph API',
        hintBn: 'মেটা সার্ভারের সাথে সংযোগ করা যায়নি',
      };
    }
  }

  // -------------------------------------------------------------------------
  // Check 2: Page Match
  // Compare profile_id / granted page id from debug_token with saved Page ID
  // -------------------------------------------------------------------------
  if (!pageId) {
    pageMatchCheck = {
      id: 'page_match',
      name: 'Page Match',
      nameBn: 'পেজ আইডি ম্যাচিং',
      status: 'warning',
      message: 'Page ID not configured in settings',
      hintBn: 'পেজ আইডি কনফিগার করা নেই',
    };
  } else if (debugProfileId && debugProfileId !== pageId) {
    pageMatchCheck = {
      id: 'page_match',
      name: 'Page Match',
      nameBn: 'পেজ আইডি ম্যাচিং',
      status: 'warning',
      message: `Page ID mismatch (token is for ${debugProfileId}, saved is ${pageId})`,
      hintBn: 'টোকেনের পেজ আইডি ও কনফিগার করা পেজ আইডি ভিন্ন',
    };
  } else if (debugProfileId && debugProfileId === pageId) {
    pageMatchCheck = {
      id: 'page_match',
      name: 'Page Match',
      nameBn: 'পেজ আইডি ম্যাচিং',
      status: 'ok',
      message: `Page ID matches token profile (${pageId})`,
      hintBn: 'পেজ আইডি সঠিক ও টোকেনের সাথে মিলেছে',
    };
  } else {
    if (tokenCheck.status === 'ok') {
      pageMatchCheck = {
        id: 'page_match',
        name: 'Page Match',
        nameBn: 'পেজ আইডি ম্যাচিং',
        status: 'ok',
        message: `Page ID configured (${pageId})`,
        hintBn: 'পেজ আইডি সফলভাবে কনফিগার করা আছে',
      };
    } else {
      pageMatchCheck = {
        id: 'page_match',
        name: 'Page Match',
        nameBn: 'পেজ আইডি ম্যাচিং',
        status: 'warning',
        message: 'Could not verify Page match (token invalid)',
        hintBn: 'টোকেন যাচাই না হওয়ায় পেজ মিলানো যায়নি',
      };
    }
  }

  // -------------------------------------------------------------------------
  // Check 3: Webhook Subscription
  // GET https://graph.facebook.com/v21.0/<pageId>/subscribed_apps?access_token=<pageAccessToken>
  // Show whether this app is subscribed and which fields ('messages' should be present).
  // If it fails, show 'Could not verify webhook subscription' as a neutral warning, not an error.
  // -------------------------------------------------------------------------
  if (!pageId || !pageAccessToken) {
    webhookCheck = {
      id: 'webhook_subscription',
      name: 'Webhook Subscription',
      nameBn: 'ওয়েবহুক সাবস্ক্রিপশন',
      status: 'warning',
      message: 'Could not verify webhook subscription',
      hintBn: 'ওয়েবহুক সাবস্ক্রিপশন যাচাই করা যায়নি',
    };
  } else {
    try {
      const subUrl = `https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}/subscribed_apps?access_token=${encodeURIComponent(pageAccessToken)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const subRes = await fetch(subUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      const subData = await subRes.json();
      if (!subRes.ok || subData.error || !Array.isArray(subData.data)) {
        webhookCheck = {
          id: 'webhook_subscription',
          name: 'Webhook Subscription',
          nameBn: 'ওয়েবহুক সাবস্ক্রিপশন',
          status: 'warning',
          message: 'Could not verify webhook subscription',
          hintBn: 'ওয়েবহুক সাবস্ক্রিপশন যাচাই করা যায়নি',
        };
      } else {
        const apps = subData.data;
        if (apps.length === 0) {
          webhookCheck = {
            id: 'webhook_subscription',
            name: 'Webhook Subscription',
            nameBn: 'ওয়েবহুক সাবস্ক্রিপশন',
            status: 'warning',
            message: 'App not subscribed to Page webhooks',
            hintBn: 'পেজে অ্যাপটি সাবস্ক্রাইব করা নেই',
          };
        } else {
          const targetApp = (metaAppId ? apps.find((a: any) => String(a.id) === String(metaAppId)) : null) || apps[0];
          const fields: string[] = Array.isArray(targetApp?.subscribed_fields)
            ? targetApp.subscribed_fields
            : (Array.isArray(targetApp?.fields) ? targetApp.fields : []);
          const hasMessages = fields.includes('messages');

          if (hasMessages) {
            webhookCheck = {
              id: 'webhook_subscription',
              name: 'Webhook Subscription',
              nameBn: 'ওয়েবহুক সাবস্ক্রিপশন',
              status: 'ok',
              message: `Subscribed (fields: ${fields.join(', ')})`,
              hintBn: 'মেসেঞ্জার ওয়েবহুক সফলভাবে সংযুক্ত',
            };
          } else {
            webhookCheck = {
              id: 'webhook_subscription',
              name: 'Webhook Subscription',
              nameBn: 'ওয়েবহুক সাবস্ক্রিপশন',
              status: 'warning',
              message: `Subscribed, missing 'messages' (fields: ${fields.length ? fields.join(', ') : 'none'})`,
              hintBn: 'messages ফিল্ড সাবস্ক্রাইব করা নেই',
            };
          }
        }
      }
    } catch {
      webhookCheck = {
        id: 'webhook_subscription',
        name: 'Webhook Subscription',
        nameBn: 'ওয়েবহুক সাবস্ক্রিপশন',
        status: 'warning',
        message: 'Could not verify webhook subscription',
        hintBn: 'ওয়েবহুক সাবস্ক্রিপশন যাচাই করা যায়নি',
      };
    }
  }

  // -------------------------------------------------------------------------
  // Check 4: WhatsApp
  // Show a neutral grey note 'WhatsApp not configured (optional)' when not configured, never a red error.
  // -------------------------------------------------------------------------
  if (!whatsappAccessToken || !whatsappPhoneNumberId) {
    whatsappCheck = {
      id: 'whatsapp',
      name: 'WhatsApp',
      nameBn: 'হোয়াটসঅ্যাপ সংযোগ',
      status: 'neutral',
      message: 'WhatsApp not configured (optional)',
      hintBn: 'হোয়াটসঅ্যাপ কনফিগার করা নেই (ঐচ্ছিক)',
    };
  } else {
    try {
      const waUrl = `https://graph.facebook.com/v21.0/${encodeURIComponent(whatsappPhoneNumberId)}?access_token=${encodeURIComponent(whatsappAccessToken)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const waRes = await fetch(waUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      const waData = await waRes.json();

      if (waRes.ok && waData.id) {
        whatsappCheck = {
          id: 'whatsapp',
          name: 'WhatsApp',
          nameBn: 'হোয়াটসঅ্যাপ সংযোগ',
          status: 'ok',
          message: `WhatsApp active: ${waData.verified_name || waData.display_phone_number || 'Connected'}`,
          hintBn: 'হোয়াটসঅ্যাপ সফলভাবে সংযুক্ত',
        };
      } else {
        const shortErr = cleanMetaErrorMessage(waData?.error);
        whatsappCheck = {
          id: 'whatsapp',
          name: 'WhatsApp',
          nameBn: 'হোয়াটসঅ্যাপ সংযোগ',
          status: 'warning', // Never a red error!
          message: `WhatsApp check: ${shortErr}`,
          hintBn: 'হোয়াটসঅ্যাপ সংযোগ পরীক্ষা সমস্যা',
        };
      }
    } catch {
      whatsappCheck = {
        id: 'whatsapp',
        name: 'WhatsApp',
        nameBn: 'হোয়াটসঅ্যাপ সংযোগ',
        status: 'warning', // Never a red error!
        message: 'WhatsApp connection check timed out',
        hintBn: 'হোয়াটসঅ্যাপ সংযোগ সময়োত্তীর্ণ',
      };
    }
  }

  // -------------------------------------------------------------------------
  // Overall Status
  // "The overall status is green when checks 1 and 2 pass."
  // -------------------------------------------------------------------------
  const overall = tokenCheck.status === 'ok' && pageMatchCheck.status === 'ok';
  const checklist = [tokenCheck, pageMatchCheck, webhookCheck, whatsappCheck];

  return {
    overall,
    checks: {
      tokenValidity: tokenCheck,
      pageMatch: pageMatchCheck,
      webhookSubscription: webhookCheck,
      whatsapp: whatsappCheck,
    },
    checklist,
    pageAccess: {
      ok: overall,
      pageId: pageId || debugProfileId,
      error: tokenCheck.status !== 'ok' ? tokenCheck.message : (pageMatchCheck.status !== 'ok' ? pageMatchCheck.message : undefined),
      warning: pageMatchCheck.status === 'warning' ? pageMatchCheck.message : (webhookCheck.status === 'warning' ? webhookCheck.message : undefined),
    },
    whatsapp: {
      ok: whatsappCheck.status === 'ok',
      error: whatsappCheck.status === 'warning' ? whatsappCheck.message : undefined,
    },
  };
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

    console.log(`[Meta Webhook GET]: Params=`, JSON.stringify(req.query));

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
    console.log(`[Meta Webhook POST]: Path=${req.path}, Body=`, JSON.stringify(req.body));
    const config = await loadMetaConfig();

    // Verify HMAC signature if secret is present
    if (config.metaAppSecret && !verifyMetaSignature(req, config.metaAppSecret)) {
      console.warn('[Meta Webhook]: Signature verification failed.');
      return res.status(401).send('Unauthorized: Invalid Signature');
    }

    const payload = req.body || {};

    // 1. Respond 200 OK immediately
    res.status(200).json({ status: 'EVENT_RECEIVED' });

    // 2. Process message asynchronously in background job
    setImmediate(async () => {
      try {
        console.log('[Meta Webhook]: Processing payload asynchronously');
        await processIncomingMetaPayload(payload);
        console.log('[Meta Webhook]: Processing completed');
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

    await persistMessageToFirestore(cleanSenderId, buffer.senderName || 'Customer', cleanChannel, 'customer', cleanText, attachmentUrl);

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
    await persistMessageToFirestore(cleanSenderId, buffer.senderName || 'Customer', cleanChannel, 'bot', parsed.suggested_reply);

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
        metaAppSecret: config.metaAppSecret || '',
        metaVerifyToken: config.metaVerifyToken,
        pageAccessToken: config.pageAccessToken || '',
        pageId: config.pageId,
        instagramBusinessAccountId: config.instagramBusinessAccountId,
        whatsappPhoneNumberId: config.whatsappPhoneNumberId,
        whatsappBusinessAccountId: config.whatsappBusinessAccountId,
        whatsappAccessToken: config.whatsappAccessToken || '',
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

  // -----------------------------------------------------------------------
  // In-App Chat Inbox API Endpoints
  // -----------------------------------------------------------------------

  // Helper to ensure demo conversation data exists if database/buffer is fresh
  function ensureSeedConversations() {
    if (conversationBuffers.size === 0) {
      const now = Date.now();
      const time1 = new Date(now - 18 * 60 * 1000).toISOString();
      const time2 = new Date(now - 12 * 60 * 1000).toISOString();
      const time3 = new Date(now - 3 * 60 * 1000).toISOString();

      // Seed Karim Ahmed (Facebook Messenger)
      const timeK1 = new Date(now - 28 * 60 * 1000).toISOString();
      const timeK2 = new Date(now - 22 * 60 * 1000).toISOString();
      const timeK3 = new Date(now - 6 * 60 * 1000).toISOString();
      conversationBuffers.set('psid_karim_8821', {
        senderId: 'psid_karim_8821',
        senderName: 'Karim Ahmed',
        channel: 'messenger',
        messages: [
          { sender: 'customer', text: 'Salam bhai, ami Supima Cotton Polo Midnight Navy L size ta order korte chai. Delivery kobe pabo?', timestamp: timeK1 },
          { sender: 'bot', text: 'Walaikum Assalam Karim bhai! Supima Cotton Polo L size ready stock e ache. Price ৳1,650 ebong inside Dhaka delivery charge ৳60 (Total ৳1,710)। 24-48 hours er moddhe delivery hoye jabe. Order confirm korte apnar thikana ebong phone number din.', timestamp: timeK2 },
          { sender: 'customer', text: 'Amar number 01811223344, Flat 4A, Green Road, Dhanmondi, Dhaka. Cash on Delivery te pathiye din.', timestamp: timeK3 },
        ],
        lastUpdated: timeK3,
      });

      conversationBuffers.set('psid_tanvir_4491', {
        senderId: 'psid_tanvir_4491',
        senderName: 'Tanvir Ahmed',
        channel: 'messenger',
        messages: [
          { sender: 'customer', text: 'Salam bhai, black polo shirt L size available ache ki?', timestamp: time1 },
          { sender: 'bot', text: 'Walaikum Assalam Tanvir bhai! Ji, Onyx Black Supima Cotton Polo L size stock e ache. Price ৳1,650. Order korte phone number ebong delivery address din.', timestamp: time2 },
          { sender: 'customer', text: 'Amar number 01711223344, House 12, Road 5, Dhanmondi, Dhaka. Ekta pathiye din cash on delivery.', timestamp: time3 },
        ],
        lastUpdated: time3,
      });

      const time4 = new Date(now - 55 * 60 * 1000).toISOString();
      const time5 = new Date(now - 32 * 60 * 1000).toISOString();
      conversationBuffers.set('psid_sadia_8820', {
        senderId: 'psid_sadia_8820',
        senderName: 'Sadia Rahman',
        channel: 'instagram',
        messages: [
          { sender: 'customer', text: 'Hi! White Embroidered Panjabi er delivery charge koto outside Dhaka?', timestamp: time4 },
          { sender: 'bot', text: 'Hello Sadia! Outside Dhaka delivery charge ৳150 Pathao express courier er madhyome. Delivery time 48-72 hours.', timestamp: time5 },
        ],
        lastUpdated: time5,
      });

      const time6 = new Date(now - 110 * 60 * 1000).toISOString();
      conversationBuffers.set('psid_kamrul_1092', {
        senderId: 'psid_kamrul_1092',
        senderName: 'Kamrul Hasan',
        channel: 'whatsapp',
        messages: [
          { sender: 'customer', text: 'Bro, amar order #VIS-9021 er Pathao tracking number ta deben please? Uttara theke order korechilam.', timestamp: time6 },
        ],
        lastUpdated: time6,
      });
    }
  }

  // 1. POST /api/messages/send
  // Uses Meta Graph API (https://graph.facebook.com/v19.0/me/messages) to send reply
  app.post(['/api/messages/send', '/api/meta/messages/send'], async (req: Request, res: Response) => {
    try {
      const recipient_psid = String(req.body.recipient_psid || req.body.recipientId || req.body.psid || '').trim();
      const message_text = String(req.body.message_text || req.body.messageText || req.body.text || '').trim();
      const requestedChannel = req.body.channel;

      if (!recipient_psid) {
        return res.status(400).json({ success: false, error: 'recipient_psid is required.' });
      }
      if (!message_text) {
        return res.status(400).json({ success: false, error: 'message_text is required.' });
      }

      ensureSeedConversations();
      const existingBuffer = conversationBuffers.get(recipient_psid);
      const channel: 'messenger' | 'instagram' | 'whatsapp' =
        requestedChannel || existingBuffer?.channel || 'messenger';

      const config = await loadMetaConfig();
      let metaResponse: any = null;
      let simulated = false;

      if (channel === 'whatsapp') {
        const phoneNumberId = config.whatsappPhoneNumberId;
        const waToken = config.whatsappAccessToken;

        if (phoneNumberId && waToken) {
          const cleanPhone = recipient_psid.replace(/\D/g, '');
          const formattedPhone = cleanPhone.startsWith('88') ? cleanPhone : `88${cleanPhone.replace(/^0/, '')}`;
          const waRes = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${waToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: formattedPhone,
              type: 'text',
              text: { preview_url: false, body: message_text },
            }),
          });
          metaResponse = await waRes.json();
        } else {
          simulated = true;
        }
      } else {
        // Messenger & Instagram DM -> POST https://graph.facebook.com/v19.0/me/messages
        const token = config.pageAccessToken;
        if (token) {
          try {
            const metaRes = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${token}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                recipient: { id: recipient_psid },
                message: { text: message_text },
              }),
            });
            metaResponse = await metaRes.json();
            if (!metaRes.ok) {
              console.warn('[Meta Graph API Error]:', metaResponse);
            }
          } catch (fetchErr: any) {
            console.error('[Meta Graph Network Error]:', fetchErr);
            simulated = true;
          }
        } else {
          simulated = true;
          console.info(`[Meta Simulator]: Page Access Token not configured. Simulated send to ${recipient_psid}: "${message_text}"`);
        }
      }

      const mid = metaResponse?.message_id;
      // Append outgoing message to thread buffer
      const newMsg: ConversationMessage = {
        sender: 'bot',
        text: message_text,
        timestamp: new Date().toISOString(),
        mid,
        status: 'sent',
      };

      const senderName = req.body.customer_name || req.body.customerName || req.body.senderName;
      const updatedBuffer = appendToConversationBuffer(recipient_psid, channel, newMsg, senderName);

      // Persist conversation and message to Firestore database
      if (!isFirestoreQuotaExceeded()) {
        try {
          const threadRef = db.collection('conversations').doc(recipient_psid);
          await threadRef.set(
            {
              senderId: recipient_psid,
              senderName: senderName || updatedBuffer.senderName || 'Customer',
              channel,
              lastUpdated: newMsg.timestamp,
              lastMessage: newMsg.text,
              lastMessageSender: newMsg.sender,
            },
            { merge: true }
          );

          await persistMessageToFirestore(recipient_psid, senderName || updatedBuffer.senderName || 'Customer', channel, 'bot', newMsg.text, undefined, mid, 'sent');
        } catch (dbErr: any) {
          if (isQuotaExceededError(dbErr)) {
            markFirestoreQuotaExceeded();
          } else {
            console.warn('[Firestore Save Message Warning]:', dbErr?.message);
          }
        }
      }

      return res.json({
        success: true,
        recipient_psid,
        channel,
        message: newMsg,
        simulated,
        metaResult: metaResponse,
        messageId: metaResponse?.message_id || `msg-${Date.now()}`,
        lastUpdated: updatedBuffer.lastUpdated,
      });
    } catch (err: any) {
      console.error('[Send Message Route Error]:', err);
      return res.status(500).json({
        success: false,
        error: err?.message || 'Internal server error while sending message via Meta Graph API',
      });
    }
  });

  // 2. GET /api/conversations
  // Fetch list of customer conversation threads with last message & timestamps
  app.get(['/api/conversations', '/api/meta/conversations'], (_req: Request, res: Response) => {
    ensureSeedConversations();

    const conversations = Array.from(conversationBuffers.values())
      .map((b) => {
        const lastMsg = b.messages[b.messages.length - 1];
        return {
          psid: b.senderId,
          senderId: b.senderId,
          senderName: b.senderName || `Customer #${b.senderId.slice(-4)}`,
          channel: b.channel,
          lastMessage: lastMsg?.text || (lastMsg?.attachmentUrl ? '[Image Attachment]' : 'No message content'),
          lastMessageSender: lastMsg?.sender || 'customer',
          lastUpdated: b.lastUpdated,
          messageCount: b.messages.length,
          unreadCount: b.messages.length > 0 && b.messages[b.messages.length - 1].sender === 'customer' ? 1 : 0,
        };
      })
      .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());

    return res.json({
      success: true,
      count: conversations.length,
      conversations,
    });
  });

  // 3. GET /api/messages/:psid
  // Fetch detailed chat message history for a specific customer PSID
  app.get(['/api/messages/:psid', '/api/meta/messages/:psid'], async (req: Request, res: Response) => {
    ensureSeedConversations();
    const psid = req.params.psid;
    let buffer = conversationBuffers.get(psid);

    // If not found by exact PSID, attempt fuzzy lookup by name or partial PSID
    if (!buffer) {
      for (const [key, b] of conversationBuffers.entries()) {
        if (
          key.includes(psid) ||
          psid.includes(key) ||
          (b.senderName && b.senderName.toLowerCase().includes(psid.toLowerCase())) ||
          (b.senderName && psid.toLowerCase().includes(b.senderName.toLowerCase()))
        ) {
          buffer = b;
          break;
        }
      }
    }

    // If still not found, initialize a fresh thread buffer so admin can chat immediately
    if (!buffer) {
      const customerName = (req.query.customerName as string) || (req.query.name as string) || `Customer #${psid.slice(-4)}`;
      const channel = ((req.query.channel as string)?.toLowerCase() as any) || 'messenger';
      buffer = {
        senderId: psid,
        senderName: customerName,
        channel: channel === 'instagram' ? 'instagram' : channel === 'whatsapp' ? 'whatsapp' : 'messenger',
        messages: [],
        lastUpdated: new Date().toISOString(),
      };
      conversationBuffers.set(psid, buffer);
    }

    // If buffer is empty, attempt to load previously stored messages from Firestore database
    if (buffer.messages.length === 0 && !isFirestoreQuotaExceeded()) {
      try {
        const msgsSnap = await db
          .collection('conversations')
          .doc(buffer.senderId)
          .collection('messages')
          .orderBy('timestamp', 'asc')
          .limit(40)
          .get();

        if (!msgsSnap.empty) {
          const dbMsgs = msgsSnap.docs.map((docSnap) => docSnap.data() as ConversationMessage);
          buffer.messages = dbMsgs;
        }
      } catch (dbErr: any) {
        if (isQuotaExceededError(dbErr)) {
          markFirestoreQuotaExceeded();
        }
      }
    }

    return res.json({
      success: true,
      psid: buffer.senderId,
      senderName: buffer.senderName || `Customer #${buffer.senderId.slice(-4)}`,
      channel: buffer.channel,
      lastUpdated: buffer.lastUpdated,
      messages: buffer.messages,
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
        // 1. Handle Message Deliveries
        if (msgEvent.delivery) {
          const mids = msgEvent.delivery.mids || [];
          for (const mid of mids) {
            for (const buf of conversationBuffers.values()) {
              const msg = buf.messages.find(m => m.mid === mid);
              if (msg) {
                msg.status = 'delivered';
              }
            }
          }
          continue;
        }

        // 2. Handle Message Reads
        if (msgEvent.read) {
          const watermark = msgEvent.read.watermark;
          if (watermark) {
            for (const buf of conversationBuffers.values()) {
              for (const msg of buf.messages) {
                if ((msg.sender === 'bot' || msg.sender === 'agent' || msg.sender === 'user') && new Date(msg.timestamp).getTime() <= watermark) {
                  msg.status = 'seen';
                }
              }
            }
          }
          continue;
        }

        // 3. Handle Message Echoes (message.is_echo === true)
        if (msgEvent.message && msgEvent.message.is_echo === true) {
          const recipientId = msgEvent.recipient?.id;
          const message = msgEvent.message;
          if (!recipientId || !message) continue;

          const text = message.text || '';
          const mid = message.mid;
          let attachmentUrl: string | undefined;
          if (Array.isArray(message.attachments) && message.attachments.length > 0) {
            attachmentUrl = message.attachments[0]?.payload?.url;
          }

          console.log(`[Meta Echo ${channel.toUpperCase()}]: Page sent to recipient ${recipientId}: "${text}" (mid: ${mid})`);

          const buffer = appendToConversationBuffer(recipientId, channel, {
            sender: 'agent',
            text,
            attachmentUrl,
            mid,
            status: 'sent',
          });

          await persistMessageToFirestore(
            recipientId,
            buffer.senderName || 'Customer',
            channel,
            'agent',
            text,
            attachmentUrl,
            mid,
            'sent'
          );
          continue;
        }

        const senderId = msgEvent.sender?.id;
        const message = msgEvent.message;

        if (!senderId || !message) continue;

        const text = message.text || '';
        const mid = message.mid;
        let attachmentUrl: string | undefined;

        if (Array.isArray(message.attachments) && message.attachments.length > 0) {
          attachmentUrl = message.attachments[0]?.payload?.url;
        }

        console.log(`[Meta Inbound ${channel.toUpperCase()}]: Sender ${senderId} sent: "${text}"`);

        // 1. Buffer conversation with mid deduplication
        const buffer = appendToConversationBuffer(senderId, channel, {
          sender: 'customer',
          text,
          attachmentUrl,
          mid,
        });

        await persistMessageToFirestore(senderId, buffer.senderName || 'Customer', channel, 'customer', text, attachmentUrl, mid);

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
        if (parsed.suggested_reply && config.meta?.autoReplyEnabled !== false) {
          const replyRes = await sendMetaReply(channel, senderId, parsed.suggested_reply);
          const replyMid = replyRes.data?.message_id;

          appendToConversationBuffer(senderId, channel, {
            sender: 'bot',
            text: parsed.suggested_reply,
            mid: replyMid,
          });

          await persistMessageToFirestore(senderId, buffer.senderName || 'Customer', channel, 'bot', parsed.suggested_reply, undefined, replyMid);
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

          await persistMessageToFirestore(senderId, senderName || buffer.senderName || 'Customer', 'whatsapp', 'customer', text, attachmentUrl);

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

            await persistMessageToFirestore(senderId, senderName || buffer.senderName || 'Customer', 'whatsapp', 'bot', parsed.suggested_reply);
            await sendMetaReply('whatsapp', senderId, parsed.suggested_reply);
          }
        }
      }
    }
  }
}
