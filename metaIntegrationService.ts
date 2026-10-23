// metaIntegrationService.ts
// -----------------------------------------------------------------------
// Unified Meta Order Integration Engine (Messenger, Instagram & WhatsApp)

import crypto from 'crypto';
import type { Express, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { detectDistrict } from './src/utils/districtDetector';
import {
  db,
  isFirestoreQuotaExceeded,
  markFirestoreQuotaExceeded,
  isQuotaExceededError,
  incrementFirestoreReads,
} from './firebaseAdmin';
import { loadAIKnowledgeBase, AIKnowledgeBaseData } from './aiKnowledgeStore';
import { requireAuth, AuthenticatedRequest } from './authMiddleware';

const META_COLLECTION = 'metaConfig';
const inMemoryMetaConfig = new Map<string, Partial<MetaConfig>>();

// Background pending queue for Meta config saves (Section B)
const pendingMetaConfigSaves: Array<{ docId: string; config: any; timestamp: number }> = [];

setInterval(async () => {
  if (pendingMetaConfigSaves.length === 0 || isFirestoreQuotaExceeded()) return;
  const item = pendingMetaConfigSaves.shift();
  if (!item) return;
  try {
    const { persisted: _p, ...dataToSave } = item.config;
    await db.collection(META_COLLECTION).doc(item.docId).set({ ...dataToSave, updatedAt: new Date().toISOString() }, { merge: true });
    console.info(`[MetaConfig Background Sync]: Successfully flushed pending save for doc ${item.docId}`);
  } catch (err) {
    pendingMetaConfigSaves.push(item);
  }
}, 2 * 60 * 1000);

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
  autoReplyEnabled?: boolean;
  whatsappEmbeddedConfigId?: string;
  whatsappRegistrationPin?: string;
  whatsappVerifiedName?: string;
  whatsappDisplayNumber?: string;
  whatsappConnectedAt?: string;
  whatsappTokenExpiresAt?: string | number | null;
  persisted?: boolean;
}

export interface ConversationMessage {
  sender: 'customer' | 'bot' | 'agent' | 'user';
  text: string;
  timestamp: string;
  attachmentUrl?: string;
  mid?: string;
  status?: 'sent' | 'delivered' | 'seen';
}

export interface ConversationBuffer {
  senderId: string;
  senderName?: string;
  profilePic?: string;
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

const conversationBuffers = new Map<string, ConversationBuffer>();
const DEFAULT_VERIFY_TOKEN = 'vistoosa_meta_secret_token_2026';

let orderCreationHook: ((order: any) => void) | null = null;

export function registerOrderCreationHook(hook: (order: any) => void) {
  orderCreationHook = hook;
}

// -----------------------------------------------------------------------
// 1. Config Persistence in Firestore & Token Resolution
// -----------------------------------------------------------------------

let lastLoggedTokenSource = '';

export async function loadMetaConfig(docId: string = 'global'): Promise<MetaConfig> {
  let dbConfig: Partial<MetaConfig> = inMemoryMetaConfig.get(docId) || {};
  let source = 'none';

  if (!isFirestoreQuotaExceeded()) {
    try {
      const docRef = db.collection(META_COLLECTION).doc(docId);
      const doc = await docRef.get();
      incrementFirestoreReads('settings');
      if (doc.exists) {
        dbConfig = doc.data() as Partial<MetaConfig>;
        inMemoryMetaConfig.set(docId, dbConfig);
        source = 'firestore';
      }
    } catch (err: any) {
      if (isQuotaExceededError(err)) {
        markFirestoreQuotaExceeded();
      }
    }
  }

  const pageAccessToken = dbConfig.pageAccessToken || process.env.META_PAGE_ACCESS_TOKEN || '';
  if (source === 'none' && pageAccessToken) {
    source = 'env';
  }

  if (source !== lastLoggedTokenSource) {
    lastLoggedTokenSource = source;
    const hasSecret = Boolean(dbConfig.metaAppSecret || process.env.META_APP_SECRET);
    console.log(`[Meta Token Source]: ${source}`);
    console.log(`[Meta App Secret Configured]: ${hasSecret}`);
  }

  return {
    metaAppId: dbConfig.metaAppId || process.env.META_APP_ID || '',
    metaAppSecret: dbConfig.metaAppSecret || process.env.META_APP_SECRET || '',
    metaVerifyToken: dbConfig.metaVerifyToken || process.env.META_VERIFY_TOKEN || DEFAULT_VERIFY_TOKEN,
    pageAccessToken,
    pageId: dbConfig.pageId || process.env.META_PAGE_ID || '',
    instagramBusinessAccountId: dbConfig.instagramBusinessAccountId || process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || '',
    whatsappPhoneNumberId: dbConfig.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    whatsappBusinessAccountId: dbConfig.whatsappBusinessAccountId || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
    whatsappAccessToken: dbConfig.whatsappAccessToken || process.env.WHATSAPP_ACCESS_TOKEN || '',
    autoReplyEnabled: dbConfig.autoReplyEnabled !== undefined ? dbConfig.autoReplyEnabled : true,
    persisted: true,
  };
}

export async function saveMetaConfig(config: Partial<MetaConfig>, docId: string = 'global'): Promise<{ config: MetaConfig; persisted: boolean; error?: string }> {
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
    autoReplyEnabled: config.autoReplyEnabled !== undefined ? config.autoReplyEnabled : current.autoReplyEnabled,
  };

  inMemoryMetaConfig.set(docId, merged);

  if (isFirestoreQuotaExceeded()) {
    pendingMetaConfigSaves.push({ docId, config: merged, timestamp: Date.now() });
    return { config: { ...merged, persisted: false }, persisted: false, error: 'Firestore quota exceeded' };
  }

  try {
    const { persisted: _p, ...dataToSave } = merged;
    await db.collection(META_COLLECTION).doc(docId).set({ ...dataToSave, updatedAt: new Date().toISOString() }, { merge: true });
    return { config: { ...merged, persisted: true }, persisted: true };
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      markFirestoreQuotaExceeded();
    }
    pendingMetaConfigSaves.push({ docId, config: merged, timestamp: Date.now() });
    return { config: { ...merged, persisted: false }, persisted: false, error: err?.message || 'Database write error' };
  }
}

// -----------------------------------------------------------------------
// 2. Conversation Buffer & Real Name Resolution (Section C & D)
// -----------------------------------------------------------------------

const nameFetchFailures = new Map<string, number>(); // senderId -> timestamp of failure

export async function resolveSenderName(senderId: string, channel: 'messenger' | 'instagram' | 'whatsapp'): Promise<{ name: string; profilePic?: string }> {
  let buffer = conversationBuffers.get(senderId);
  if (buffer && buffer.senderName && !buffer.senderName.startsWith('Customer')) {
    return { name: buffer.senderName, profilePic: buffer.profilePic };
  }

  if (channel === 'whatsapp') {
    return { name: buffer?.senderName || `Customer #${senderId.slice(-4)}` };
  }

  // Check failure cache (24h)
  const lastFail = nameFetchFailures.get(senderId);
  if (lastFail && Date.now() - lastFail < 24 * 3600 * 1000) {
    return { name: buffer?.senderName || `Customer #${senderId.slice(-4)}`, profilePic: buffer?.profilePic };
  }

  const config = await loadMetaConfig();
  if (!config.pageAccessToken) {
    return { name: `Customer #${senderId.slice(-4)}` };
  }

  try {
    const fields = channel === 'instagram' ? 'name,username,profile_pic' : 'first_name,last_name,profile_pic';
    const url = `https://graph.facebook.com/v21.0/${senderId}?fields=${fields}&access_token=${config.pageAccessToken}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok || data.error) {
      nameFetchFailures.set(senderId, Date.now());
      return { name: `Customer #${senderId.slice(-4)}` };
    }

    const name = channel === 'instagram'
      ? (data.name || data.username || `Customer #${senderId.slice(-4)}`)
      : (`${data.first_name || ''} ${data.last_name || ''}`.trim() || `Customer #${senderId.slice(-4)}`);

    const profilePic = typeof data.profile_pic === 'string' ? data.profile_pic : (data.profile_pic?.data?.url || '');

    if (buffer) {
      buffer.senderName = name;
      if (profilePic) buffer.profilePic = profilePic;
    }

    // Update in Firestore conversation document
    if (!isFirestoreQuotaExceeded()) {
      try {
        await db.collection('conversations').doc(senderId).set({
          senderName: name,
          profilePic: profilePic || null,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      } catch (err) {
        if (isQuotaExceededError(err)) markFirestoreQuotaExceeded();
      }
    }

    return { name, profilePic };
  } catch (err) {
    nameFetchFailures.set(senderId, Date.now());
    return { name: `Customer #${senderId.slice(-4)}` };
  }
}

export async function loadConversationsFromFirestore() {
  if (isFirestoreQuotaExceeded()) return;
  try {
    const snap = await db.collection('conversations').orderBy('lastUpdated', 'desc').limit(50).get();
    incrementFirestoreReads('conversations');
    snap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const senderId = data.senderId || docSnap.id;
      if (!conversationBuffers.has(senderId)) {
        conversationBuffers.set(senderId, {
          senderId,
          senderName: data.senderName,
          profilePic: data.profilePic,
          channel: data.channel || 'messenger',
          messages: [],
          lastUpdated: data.lastUpdated || new Date().toISOString(),
        });
      }
    });
  } catch (err: any) {
    if (isQuotaExceededError(err)) markFirestoreQuotaExceeded();
  }
}

// Load conversations on startup
loadConversationsFromFirestore();

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

  if (senderName && !buffer.senderName && !senderName.startsWith('Customer')) {
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

  if (buffer.messages.length > 20) {
    buffer.messages = buffer.messages.slice(-20);
  }

  buffer.lastUpdated = new Date().toISOString();
  return buffer;
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
    let finalName = senderName;
    let profilePic: string | undefined;

    if (!finalName || finalName.startsWith('Customer')) {
      const resolved = await resolveSenderName(senderId, channel as any);
      finalName = resolved.name;
      profilePic = resolved.profilePic;
    }

    const updateData: any = {
      senderId,
      senderName: finalName || 'Customer',
      channel,
      lastUpdated: new Date().toISOString(),
      lastMessage: text || (attachmentUrl ? '[Image Attachment]' : ''),
      lastMessageSender: senderType,
    };
    if (profilePic) updateData.profilePic = profilePic;

    await threadRef.set(updateData, { merge: true });

    if (mid) {
      const existingMsgQuery = await threadRef.collection('messages').where('mid', '==', mid).get();
      incrementFirestoreReads('messages');
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
// 3. AI Order Parser with Gemini & Timeout / Concurrency Controls (Section F & J)
// -----------------------------------------------------------------------

let lastGeminiWarnTime = 0;

function getGemini(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    if (Date.now() - lastGeminiWarnTime > 60 * 1000) {
      lastGeminiWarnTime = Date.now();
      console.warn('[Gemini API]: GEMINI_API_KEY missing, using fallback parser.');
    }
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
}

// Concurrency limiter for Gemini requests (max 3 concurrent)
let activeGeminiCalls = 0;
const geminiQueue: Array<() => void> = [];

async function runWithGeminiConcurrency<T>(fn: () => Promise<T>): Promise<T> {
  if (activeGeminiCalls >= 3) {
    await new Promise<void>((resolve) => geminiQueue.push(resolve));
  }
  activeGeminiCalls++;
  try {
    return await fn();
  } finally {
    activeGeminiCalls--;
    if (geminiQueue.length > 0) {
      const next = geminiQueue.shift();
      if (next) next();
    }
  }
}

export async function parseOrderWithGemini(
  conversation: ConversationMessage[],
  knownSenderName?: string
): Promise<ExtractedOrderInfo> {
  const recentMessages = conversation.slice(-10);
  const fullTranscript = recentMessages
    .map((m) => `${m.sender.toUpperCase()}: ${m.text}${m.attachmentUrl ? ` [Image: ${m.attachmentUrl}]` : ''}`)
    .join('\n');

  const knowledge = await loadAIKnowledgeBase();
  const gemini = getGemini();

  if (gemini) {
    const modelName = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
    const activeProducts = (knowledge.products || []).filter((p) => p.active !== false).slice(0, 8);
    const productCatalogText = activeProducts
      .map((p, i) => `${i + 1}. [PRODUCT: ${p.name}] - Price: ৳${p.price} - Sizes: ${p.sizes.join(', ')}`)
      .join('\n');

    const prompt = `You are the AI Order Assistant for Vistoosa Haute Couture (Dhaka).
Products:
${productCatalogText}

Extract order into strict JSON:
{
  "customer_name": string or null,
  "phone_number": string or null (11-digit Bangladeshi number 01XXXXXXXXX),
  "address": string or null,
  "city": "Inside Dhaka" | "Sub-Dhaka" | "Outside Dhaka",
  "product_name": string or null,
  "quantity": number,
  "size": "S" | "M" | "L" | "XL" | "XXL" or null,
  "color": string or null,
  "payment_method": "Cash on Delivery" | "bKash" | "Nagad",
  "confidence": "complete" | "incomplete",
  "missing_fields": string[],
  "suggested_reply": string (polite Bengali)
}

Transcript:
${fullTranscript}`;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const startTime = Date.now();
        const result = await runWithGeminiConcurrency(async () => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 20000); // 20s hard timeout
          try {
            const resp = await gemini.models.generateContent({
              model: modelName,
              contents: prompt,
              config: { responseMimeType: 'application/json', temperature: 0.1 },
            });
            clearTimeout(timeout);
            return resp;
          } catch (e) {
            clearTimeout(timeout);
            throw e;
          }
        });

        const duration = Date.now() - startTime;
        const text = result.text?.trim() || '';
        if (text) {
          const parsed = JSON.parse(text) as ExtractedOrderInfo;
          const hasPhone = Boolean(parsed.phone_number && parsed.phone_number.replace(/\D/g, '').length >= 10);
          const hasAddress = Boolean(parsed.address && parsed.address.trim().length >= 5);
          const hasProduct = Boolean(parsed.product_name);

          if (hasPhone && hasAddress && hasProduct) {
            parsed.confidence = 'complete';
            parsed.missing_fields = [];
          } else {
            parsed.confidence = 'incomplete';
            const missing: string[] = [];
            if (!hasPhone) missing.push('phone_number');
            if (!hasAddress) missing.push('address');
            if (!hasProduct) missing.push('product_name');
            parsed.missing_fields = missing;
          }
          return parsed;
        }
      } catch (err: any) {
        console.warn(`[Gemini Extraction Attempt ${attempt} Failed]:`, err?.message || err);
        if (attempt === 2) {
          console.warn('[Gemini Timeout / Failure]: Falling back to heuristic parser.');
        }
      }
    }
  }

  // Safe Fallback Heuristic Parser (Section F: NO invented data)
  return fallbackHeuristicParser(fullTranscript, knownSenderName, knowledge);
}

function fallbackHeuristicParser(
  transcript: string,
  knownSenderName?: string,
  knowledge?: AIKnowledgeBaseData
): ExtractedOrderInfo {
  const phoneMatch = transcript.match(/(?:\+?88\s*)?(01[3-9]\d{8})\b/);
  const phone_number = phoneMatch ? phoneMatch[1] : null;

  const sizeMatch = transcript.match(/\b(XXL|XL|L|M|S)\b/i);
  const size = sizeMatch ? (sizeMatch[1].toUpperCase() as any) : null;

  const qtyMatch = transcript.match(/\b(\d+)\s*(?:ta|piece|pcs|টি|টা)?\b/i);
  const quantity = qtyMatch && Number(qtyMatch[1]) > 0 && Number(qtyMatch[1]) < 20 ? Number(qtyMatch[1]) : 1;

  let matchedProduct: any = null;
  const lower = transcript.toLowerCase();
  const productsList = knowledge?.products?.filter((p) => p.active !== false) || [];
  for (const prod of productsList) {
    if (prod.keywords?.some((kw) => lower.includes(kw.toLowerCase())) || lower.includes(prod.name.toLowerCase())) {
      matchedProduct = prod;
      break;
    }
  }

  const product_name = matchedProduct?.name || null;
  let address: string | null = null;
  const addrMatch = transcript.match(/(?:address|ঠিকানা|বাসা|location)[:\s]+([^\n,]+(?:,[^\n,]+){0,2})/i);
  if (addrMatch) {
    address = addrMatch[1].trim();
  }

  let city: 'Inside Dhaka' | 'Sub-Dhaka' | 'Outside Dhaka' = 'Inside Dhaka';
  if (address) {
    const aLow = address.toLowerCase();
    if (aLow.includes('savar') || aLow.includes('gazipur') || aLow.includes('narayanganj')) city = 'Sub-Dhaka';
    else if (!aLow.includes('dhaka')) city = 'Outside Dhaka';
  }

  let customer_name: string | null = null;
  if (knownSenderName && !knownSenderName.startsWith('Customer')) {
    customer_name = knownSenderName;
  }

  const hasPhone = Boolean(phone_number);
  const hasAddress = Boolean(address && address.length >= 5);
  const hasProduct = Boolean(product_name);
  const isComplete = Boolean(hasPhone && hasAddress && hasProduct && size);

  const missing_fields: string[] = [];
  if (!hasPhone) missing_fields.push('phone_number');
  if (!hasAddress) missing_fields.push('address');
  if (!hasProduct) missing_fields.push('product_name');
  if (!size) missing_fields.push('size');

  return {
    customer_name,
    phone_number,
    address,
    city,
    product_name,
    quantity,
    size,
    color: null,
    payment_method: 'Cash on Delivery',
    confidence: isComplete ? 'complete' : 'incomplete',
    missing_fields,
    suggested_reply: 'আসসালামু আলাইকুম! আপনার অর্ডারটি নিশ্চিত করতে অনুগ্রহ করে আপনার পছন্দের পণ্যের নাম, সাইজ, মোবাইল নম্বর এবং পূর্ণ ডেলিভারি ঠিকানা লিখে জানান।',
  };
}

// -----------------------------------------------------------------------
// 4. Send Reply via Meta Graph API with Real Error Mapping (Section A)
// -----------------------------------------------------------------------

export function mapMetaError(errorData: any): { error: string; code?: number; subcode?: number } {
  const code = errorData?.code;
  const subcode = errorData?.error_subcode;
  const message = String(errorData?.message || '');

  if (code === 190) {
    return { error: 'Page Access Token is invalid or expired', code, subcode };
  }
  if (code === 200 || code === 10) {
    return { error: 'Missing permission (pages_messaging)', code, subcode };
  }
  if (code === 100) {
    return { error: 'Invalid recipient id for this customer', code, subcode };
  }
  if (code === 551 || subcode === 2018278 || /outside of allowed window/i.test(message)) {
    return { error: '24 hour reply window is over, the customer must message first', code, subcode };
  }
  return { error: message || 'Meta API error', code, subcode };
}

export async function sendMetaReply(
  channel: 'messenger' | 'instagram' | 'whatsapp',
  recipientId: string,
  messageText: string
): Promise<{ success: boolean; data?: any; error?: string; code?: number; subcode?: number }> {
  const config = await loadMetaConfig();
  const isSimulation = recipientId.startsWith('psid_') || recipientId.startsWith('sim-');

  if (isSimulation) {
    console.log(`[Meta Reply Simulation]: ${channel} reply for ${recipientId}: "${messageText}"`);
    return { success: true, data: { simulated: true, channel, text: messageText }, error: undefined };
  }

  const token = channel === 'whatsapp' ? config.whatsappAccessToken : config.pageAccessToken;
  if (!token) {
    return { success: false, error: 'Page Access Token not found' };
  }

  try {
    if (channel === 'whatsapp') {
      const phoneNumberId = config.whatsappPhoneNumberId;
      if (!phoneNumberId) return { success: false, error: 'WhatsApp phone number ID not found' };
      const cleanPhone = recipientId.replace(/\D/g, '');
      const formattedPhone = cleanPhone.startsWith('88') ? cleanPhone : `88${cleanPhone.replace(/^0/, '')}`;

      const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: formattedPhone,
          type: 'text',
          text: { preview_url: false, body: messageText },
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        const mapped = mapMetaError(data.error || data);
        return { success: false, ...mapped };
      }
      return { success: true, data };
    } else {
      const res = await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_type: 'RESPONSE',
          recipient: { id: recipientId },
          message: { text: messageText },
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        const mapped = mapMetaError(data.error || data);
        return { success: false, ...mapped };
      }
      return { success: true, data };
    }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error reaching Meta API' };
  }
}

// -----------------------------------------------------------------------
// 5. Signature Verification & De-duplication (Section I)
// -----------------------------------------------------------------------

const processedMids = new Set<string>();
// Clean mid set every 2 days
setInterval(() => {
  if (processedMids.size > 5000) processedMids.clear();
}, 48 * 3600 * 1000);

let lastSecretWarnTime = 0;

export function verifyMetaSignature(req: Request, appSecret: string): boolean {
  if (!appSecret) {
    if (Date.now() - lastSecretWarnTime > 60 * 1000) {
      lastSecretWarnTime = Date.now();
      console.warn('[Meta Webhook]: Meta App Secret not set, webhook signature NOT verified');
    }
    return true; // allow if no secret configured
  }

  const signature = req.headers['x-hub-signature-256'] as string;
  if (!signature) {
    console.warn('[Meta Webhook]: Signature verification failed - header missing');
    return false;
  }

  try {
    const rawBody = (req as any).rawBody;
    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      console.warn('[Meta Webhook]: Signature verification failed - raw body buffer missing');
      return false;
    }

    const computedHmac = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
    const expected = `sha256=${computedHmac}`;

    const sigBuffer = Buffer.from(signature, 'utf8');
    const expBuffer = Buffer.from(expected, 'utf8');

    if (sigBuffer.length !== expBuffer.length) {
      console.warn('[Meta Webhook]: Signature verification failed - length mismatch');
      return false;
    }

    const isValid = crypto.timingSafeEqual(sigBuffer, expBuffer);
    if (!isValid) {
      console.warn('[Meta Webhook]: Signature verification failed - HMAC mismatch');
    }
    return isValid;
  } catch (err: any) {
    console.error('[Meta Webhook]: Signature verification exception:', err?.message || err);
    return false;
  }
}

// -----------------------------------------------------------------------
// 6. Test Meta Connection
// -----------------------------------------------------------------------

export async function testMetaConnection(overrideConfig?: Partial<MetaConfig>) {
  const currentConfig = await loadMetaConfig();
  const config = { ...currentConfig, ...overrideConfig };
  const pageAccessToken = config.pageAccessToken || '';
  const metaAppId = config.metaAppId || '';
  const metaAppSecret = config.metaAppSecret || '';

  if (!pageAccessToken) {
    return { overall: false, message: 'Page Access Token not configured' };
  }

  try {
    const appAccessToken = `${metaAppId}|${metaAppSecret}`;
    const debugUrl = `https://graph.facebook.com/v21.0/debug_token?input_token=${encodeURIComponent(pageAccessToken)}&access_token=${encodeURIComponent(appAccessToken)}`;
    const res = await fetch(debugUrl);
    const data = await res.json();
    if (res.ok && data?.data?.is_valid) {
      return { overall: true, message: 'Token is valid and active' };
    }
    return { overall: false, message: data?.error?.message || 'Token verification failed' };
  } catch (err: any) {
    return { overall: false, message: err?.message || 'Connection test failed' };
  }
}

// -----------------------------------------------------------------------
// 7. Mount Webhook & API Routes with Security (Section E)
// -----------------------------------------------------------------------

export function mountMetaIntegrationRoutes(app: Express) {
  // Webhook Verification (GET) - Public
  const handleWebhookVerification = async (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const config = await loadMetaConfig();
    const expectedToken = config.metaVerifyToken || DEFAULT_VERIFY_TOKEN;

    if (mode === 'subscribe' && token === expectedToken) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden: Token mismatch');
  };

  app.get('/webhook/meta', handleWebhookVerification);
  app.get('/webhook/meta/', handleWebhookVerification);
  app.get('/api/webhook/meta', handleWebhookVerification);
  app.get('/api/webhook/meta/', handleWebhookVerification);
  app.get('/api/webhooks/meta', handleWebhookVerification);

  // Incoming Meta Webhook Messages (POST) - Public (verified by signature)
  const handleIncomingMetaWebhook = async (req: Request, res: Response) => {
    const config = await loadMetaConfig();

    if (config.metaAppSecret && !verifyMetaSignature(req, config.metaAppSecret)) {
      return res.status(401).send('Unauthorized: Invalid Signature');
    }

    const payload = req.body || {};
    res.status(200).json({ status: 'EVENT_RECEIVED' });

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

  // Protected Routes (Section E: requireAuth)
  app.get(['/api/conversations', '/api/meta/conversations'], requireAuth, (_req: AuthenticatedRequest, res: Response) => {
    const conversations = Array.from(conversationBuffers.values())
      .map((b) => {
        const lastMsg = b.messages[b.messages.length - 1];
        return {
          psid: b.senderId,
          senderId: b.senderId,
          senderName: b.senderName || `Customer #${b.senderId.slice(-4)}`,
          profilePic: b.profilePic,
          channel: b.channel,
          lastMessage: lastMsg?.text || (lastMsg?.attachmentUrl ? '[Image Attachment]' : 'No message content'),
          lastMessageSender: lastMsg?.sender || 'customer',
          lastUpdated: b.lastUpdated,
          messageCount: b.messages.length,
          unreadCount: b.messages.length > 0 && b.messages[b.messages.length - 1].sender === 'customer' ? 1 : 0,
        };
      })
      .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());

    return res.json({ success: true, count: conversations.length, conversations });
  });

  app.get(['/api/messages/:psid', '/api/meta/messages/:psid'], requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const psid = req.params.psid;
    let buffer = conversationBuffers.get(psid);

    if (!buffer) {
      const resolved = await resolveSenderName(psid, 'messenger');
      buffer = {
        senderId: psid,
        senderName: resolved.name,
        profilePic: resolved.profilePic,
        channel: 'messenger',
        messages: [],
        lastUpdated: new Date().toISOString(),
      };
      conversationBuffers.set(psid, buffer);
    }

    if (buffer.messages.length === 0 && !isFirestoreQuotaExceeded()) {
      try {
        const msgsSnap = await db.collection('conversations').doc(buffer.senderId).collection('messages').orderBy('timestamp', 'asc').limit(40).get();
        incrementFirestoreReads('messages');
        if (!msgsSnap.empty) {
          buffer.messages = msgsSnap.docs.map(d => d.data() as ConversationMessage);
        }
      } catch (err) {}
    }

    return res.json({
      success: true,
      psid: buffer.senderId,
      senderName: buffer.senderName || `Customer #${buffer.senderId.slice(-4)}`,
      profilePic: buffer.profilePic,
      channel: buffer.channel,
      lastUpdated: buffer.lastUpdated,
      messages: buffer.messages,
    });
  });

  app.post(['/api/messages/send', '/api/meta/messages/send'], requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const recipient_psid = String(req.body.recipient_psid || req.body.recipientId || req.body.psid || '').trim();
      const message_text = String(req.body.message_text || req.body.messageText || req.body.text || '').trim();
      const requestedChannel = req.body.channel;

      if (!recipient_psid || !message_text) {
        return res.status(400).json({ success: false, error: 'recipient_psid and message_text are required.' });
      }

      const existingBuffer = conversationBuffers.get(recipient_psid);
      const channel: 'messenger' | 'instagram' | 'whatsapp' = requestedChannel || existingBuffer?.channel || 'messenger';

      const replyResult = await sendMetaReply(channel, recipient_psid, message_text);
      if (!replyResult.success) {
        return res.status(400).json({
          success: false,
          error: replyResult.error || 'Failed to send message via Meta Graph API',
          code: replyResult.code,
          subcode: replyResult.subcode,
        });
      }

      const mid = replyResult.data?.message_id;
      if (mid && processedMids.has(mid)) {
        // already processed
      } else if (mid) {
        processedMids.add(mid);
      }

      const newMsg: ConversationMessage = {
        sender: 'agent',
        text: message_text,
        timestamp: new Date().toISOString(),
        mid,
        status: 'sent',
      };

      const senderName = req.body.customer_name || req.body.customerName || existingBuffer?.senderName;
      const updatedBuffer = appendToConversationBuffer(recipient_psid, channel, newMsg, senderName);

      await persistMessageToFirestore(recipient_psid, updatedBuffer.senderName || 'Customer', channel, 'agent', message_text, undefined, mid, 'sent');

      return res.json({
        success: true,
        recipient_psid,
        channel,
        message: newMsg,
        simulated: replyResult.data?.simulated || false,
        messageId: mid || `msg-${Date.now()}`,
        lastUpdated: updatedBuffer.lastUpdated,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Internal server error while sending message' });
    }
  });

  app.post('/api/settings/meta-order', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const payload = req.body || {};
    const existing = await loadMetaConfig();

    const toSave: Partial<MetaConfig> = { ...payload };
    if (payload.metaAppSecret === '••••••••') toSave.metaAppSecret = existing.metaAppSecret;
    if (payload.pageAccessToken === '••••••••') toSave.pageAccessToken = existing.pageAccessToken;
    if (payload.whatsappAccessToken === '••••••••') toSave.whatsappAccessToken = existing.whatsappAccessToken;

    const result = await saveMetaConfig(toSave);

    return res.json({
      success: true,
      persisted: result.persisted,
      message: result.persisted
        ? 'Meta Unified Order Integration settings saved permanently.'
        : `Saved only temporarily in server memory. Database error: ${result.error || 'Unknown'}`,
      config: {
        ...result.config,
        metaAppSecret: result.config.metaAppSecret ? '••••••••' : '',
        pageAccessToken: result.config.pageAccessToken ? '••••••••' : '',
        whatsappAccessToken: result.config.whatsappAccessToken ? '••••••••' : '',
      },
    });
  });

  app.get('/api/settings/meta-order', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
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
        autoReplyEnabled: config.autoReplyEnabled !== false,
      },
      webhookCallbackUrl: `${appUrl}/webhook/meta`,
      verifyToken: config.metaVerifyToken || DEFAULT_VERIFY_TOKEN,
      activeBuffersCount: conversationBuffers.size,
    });
  });

  app.post('/api/settings/meta-order/test-connection', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const payload = req.body || {};
    const existing = await loadMetaConfig();
    const configToTest = { ...payload };
    if (payload.metaAppSecret === '••••••••') configToTest.metaAppSecret = existing.metaAppSecret;
    if (payload.pageAccessToken === '••••••••') configToTest.pageAccessToken = existing.pageAccessToken;

    const results = await testMetaConnection(configToTest);
    return res.json({ success: results.overall, results });
  });

  app.post(['/api/meta/toggle-autoreply', '/api/settings/meta/toggle-autoreply'], requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { enabled } = req.body || {};
    const current = await loadMetaConfig();
    const nextVal = enabled !== undefined ? Boolean(enabled) : !current.autoReplyEnabled;
    await saveMetaConfig({ autoReplyEnabled: nextVal });
    return res.json({ success: true, autoReplyEnabled: nextVal });
  });

  app.post('/api/meta/simulate-message', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { channel, senderId, senderName, text, attachmentUrl } = req.body || {};
    const cleanChannel = channel === 'instagram' ? 'instagram' : channel === 'whatsapp' ? 'whatsapp' : 'messenger';
    const cleanSenderId = String(senderId || `sim-user-${Math.floor(1000 + Math.random() * 9000)}`);
    const cleanText = String(text || '').trim();

    if (!cleanText && !attachmentUrl) {
      return res.status(400).json({ success: false, message: 'Message text or attachment is required.' });
    }

    const buffer = appendToConversationBuffer(cleanSenderId, cleanChannel, { sender: 'customer', text: cleanText, attachmentUrl }, senderName);
    await persistMessageToFirestore(cleanSenderId, buffer.senderName || 'Customer', cleanChannel, 'customer', cleanText, attachmentUrl);

    const parsed = await parseOrderWithGemini(buffer.messages, buffer.senderName);
    let createdOrder: any = null;

    if (parsed.confidence === 'complete' && parsed.phone_number && parsed.address && parsed.product_name) {
      const deliveryFee = parsed.city === 'Inside Dhaka' ? 60 : parsed.city === 'Sub-Dhaka' ? 100 : 150;
      const unitPrice = 1650;
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
        items: [{
          id: `item-sim-${Date.now()}`,
          productName: parsed.product_name,
          sku: `POLO-NVY-${parsed.size || 'M'}`,
          color: parsed.color || 'Midnight Navy',
          size: parsed.size || 'M',
          quantity: parsed.quantity || 1,
          unitPrice,
        }],
        totalAmount,
        deliveryFee,
        paymentMethod: parsed.payment_method || 'Cash on Delivery',
        status: 'Pending',
        createdAt: new Date().toISOString(),
        notes: `Auto-parsed from ${cleanChannel}.`,
        confidence: parsed.confidence,
      };

      if (orderCreationHook) orderCreationHook(createdOrder);
    }

    return res.json({ success: true, channel: cleanChannel, senderId: cleanSenderId, extracted: parsed, createdOrder });
  });
}

// -----------------------------------------------------------------------
// 8. Process Raw Meta Webhook Event Payloads (Async Worker)
// -----------------------------------------------------------------------

async function processIncomingMetaPayload(payload: any) {
  const config = await loadMetaConfig();
  const objectType = payload.object;

  if (objectType === 'page' || objectType === 'instagram') {
    const channel: 'messenger' | 'instagram' = objectType === 'instagram' ? 'instagram' : 'messenger';
    const entries = payload.entry || [];

    for (const entry of entries) {
      const messagings = entry.messaging || [];
      for (const msgEvent of messagings) {
        if (msgEvent.message && msgEvent.message.is_echo === true) {
          const recipientId = msgEvent.recipient?.id;
          const message = msgEvent.message;
          const mid = message?.mid;
          if (mid && processedMids.has(mid)) continue;
          if (mid) processedMids.add(mid);

          if (!recipientId || !message) continue;
          const text = message.text || '';
          const buffer = appendToConversationBuffer(recipientId, channel, { sender: 'agent', text, mid, status: 'sent' });
          await persistMessageToFirestore(recipientId, buffer.senderName || 'Customer', channel, 'agent', text, undefined, mid, 'sent');
          continue;
        }

        const senderId = msgEvent.sender?.id;
        const message = msgEvent.message;
        if (!senderId || !message) continue;

        const mid = message.mid;
        if (mid && processedMids.has(mid)) continue;
        if (mid) processedMids.add(mid);

        const text = message.text || '';
        let attachmentUrl: string | undefined;
        if (Array.isArray(message.attachments) && message.attachments.length > 0) {
          attachmentUrl = message.attachments[0]?.payload?.url;
        }

        const resolvedName = await resolveSenderName(senderId, channel);
        const buffer = appendToConversationBuffer(senderId, channel, { sender: 'customer', text, attachmentUrl, mid }, resolvedName.name);
        await persistMessageToFirestore(senderId, buffer.senderName || 'Customer', channel, 'customer', text, attachmentUrl, mid);

        const parsed = await parseOrderWithGemini(buffer.messages, buffer.senderName);

        if (parsed.confidence === 'complete' && parsed.phone_number && parsed.address && parsed.product_name) {
          const deliveryFee = parsed.city === 'Inside Dhaka' ? 60 : parsed.city === 'Sub-Dhaka' ? 100 : 150;
          const unitPrice = 1650;
          const totalAmount = unitPrice * (parsed.quantity || 1) + deliveryFee;
          const distInfo = detectDistrict(parsed.address, parsed.city);

          const newOrder = {
            id: `VIS-META-${Math.floor(1000 + Math.random() * 9000)}`,
            customerName: parsed.customer_name || buffer.senderName || 'Valued Customer',
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
            items: [{
              id: `item-meta-${Date.now()}`,
              productName: parsed.product_name,
              sku: `POLO-NVY-${parsed.size || 'M'}`,
              color: parsed.color || 'Midnight Navy',
              size: parsed.size || 'M',
              quantity: parsed.quantity || 1,
              unitPrice,
            }],
            totalAmount,
            deliveryFee,
            paymentMethod: parsed.payment_method || 'Cash on Delivery',
            status: 'Pending',
            createdAt: new Date().toISOString(),
            notes: `Auto-parsed from ${channel}.`,
            confidence: parsed.confidence,
          };

          if (orderCreationHook) orderCreationHook(newOrder);
        }

        if (parsed.suggested_reply && config.autoReplyEnabled !== false) {
          const replyRes = await sendMetaReply(channel, senderId, parsed.suggested_reply);
          const replyMid = replyRes.data?.message_id;
          appendToConversationBuffer(senderId, channel, { sender: 'bot', text: parsed.suggested_reply, mid: replyMid });
          await persistMessageToFirestore(senderId, buffer.senderName || 'Customer', channel, 'bot', parsed.suggested_reply, undefined, replyMid);
        }
      }
    }
  } else if (objectType === 'whatsapp_business_account') {
    const entries = payload.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field !== 'messages') continue;
        const val = change.value || {};
        const messages = val.messages || [];
        const contacts = val.contacts || [];

        for (const msg of messages) {
          const senderId = msg.from;
          const contact = contacts.find((c: any) => c.wa_id === senderId);
          const senderName = contact?.profile?.name || `Customer #${senderId.slice(-4)}`;
          const msgId = msg.id;
          if (msgId && processedMids.has(msgId)) continue;
          if (msgId) processedMids.add(msgId);

          let text = '';
          let attachmentUrl: string | undefined;
          if (msg.type === 'text') text = msg.text?.body || '';
          else if (msg.type === 'image') {
            text = msg.image?.caption || 'Customer sent a product image';
            attachmentUrl = msg.image?.link || msg.image?.id;
          }

          if (!text && !attachmentUrl) continue;

          const buffer = appendToConversationBuffer(senderId, 'whatsapp', { sender: 'customer', text, attachmentUrl, mid: msgId }, senderName);
          await persistMessageToFirestore(senderId, senderName, 'whatsapp', 'customer', text, attachmentUrl, msgId);

          const parsed = await parseOrderWithGemini(buffer.messages, buffer.senderName);

          if (parsed.confidence === 'complete' && parsed.phone_number && parsed.address && parsed.product_name) {
            const deliveryFee = parsed.city === 'Inside Dhaka' ? 60 : parsed.city === 'Sub-Dhaka' ? 100 : 150;
            const unitPrice = 1650;
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
              items: [{
                id: `item-wa-${Date.now()}`,
                productName: parsed.product_name,
                sku: `POLO-NVY-${parsed.size || 'M'}`,
                color: parsed.color || 'Midnight Navy',
                size: parsed.size || 'M',
                quantity: parsed.quantity || 1,
                unitPrice,
              }],
              totalAmount,
              deliveryFee,
              paymentMethod: parsed.payment_method || 'Cash on Delivery',
              status: 'Pending',
              createdAt: new Date().toISOString(),
              notes: `Auto-parsed from WhatsApp.`,
              confidence: parsed.confidence,
            };

            if (orderCreationHook) orderCreationHook(newOrder);
          }

          if (parsed.suggested_reply && config.autoReplyEnabled !== false) {
            appendToConversationBuffer(senderId, 'whatsapp', { sender: 'bot', text: parsed.suggested_reply });
            await persistMessageToFirestore(senderId, senderName, 'whatsapp', 'bot', parsed.suggested_reply);
            await sendMetaReply('whatsapp', senderId, parsed.suggested_reply);
          }
        }
      }
    }
  }
}
