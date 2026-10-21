import type { Express, Request, Response } from 'express';
import {
  db,
  isFirestoreQuotaExceeded,
  markFirestoreQuotaExceeded,
  isQuotaExceededError,
} from './firebaseAdmin';
import type {
  FAQItem,
  TrainedProductItem,
  OrderCollectionFormatConfig,
  StorePolicyConfig,
  AIKnowledgeBaseData,
} from './src/types/aiKnowledge';
import {
  DEFAULT_FAQS,
  DEFAULT_TRAINED_PRODUCTS,
  DEFAULT_ORDER_FORMAT,
  DEFAULT_POLICIES,
} from './src/types/aiKnowledge';

export const AI_KNOWLEDGE_COLLECTION = 'aiKnowledgeBase';
export const GLOBAL_KNOWLEDGE_DOC = 'global';

export type {
  FAQItem,
  TrainedProductItem,
  OrderCollectionFormatConfig,
  StorePolicyConfig,
  AIKnowledgeBaseData,
};
export {
  DEFAULT_FAQS,
  DEFAULT_TRAINED_PRODUCTS,
  DEFAULT_ORDER_FORMAT,
  DEFAULT_POLICIES,
};

export function getDefaultAIKnowledge(): AIKnowledgeBaseData {
  return {
    faqs: JSON.parse(JSON.stringify(DEFAULT_FAQS)),
    products: JSON.parse(JSON.stringify(DEFAULT_TRAINED_PRODUCTS)),
    orderFormat: JSON.parse(JSON.stringify(DEFAULT_ORDER_FORMAT)),
    policies: JSON.parse(JSON.stringify(DEFAULT_POLICIES)),
    customSystemPromptExtra: '',
    updatedAt: new Date().toISOString(),
  };
}

// In-memory cache for high resilience during Cloud Quota limits
let inMemoryKnowledge: AIKnowledgeBaseData = getDefaultAIKnowledge();

export async function loadAIKnowledgeBase(): Promise<AIKnowledgeBaseData> {
  if (isFirestoreQuotaExceeded()) {
    return inMemoryKnowledge;
  }

  try {
    const docRef = db.collection(AI_KNOWLEDGE_COLLECTION).doc(GLOBAL_KNOWLEDGE_DOC);
    const doc = await docRef.get();
    if (doc.exists) {
      const data = doc.data() as Partial<AIKnowledgeBaseData>;
      inMemoryKnowledge = {
        faqs: Array.isArray(data.faqs) && data.faqs.length > 0 ? data.faqs : DEFAULT_FAQS,
        products: Array.isArray(data.products) && data.products.length > 0 ? data.products : DEFAULT_TRAINED_PRODUCTS,
        orderFormat: data.orderFormat ? { ...DEFAULT_ORDER_FORMAT, ...data.orderFormat } : DEFAULT_ORDER_FORMAT,
        policies: data.policies ? { ...DEFAULT_POLICIES, ...data.policies } : DEFAULT_POLICIES,
        customSystemPromptExtra: data.customSystemPromptExtra || '',
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
      return inMemoryKnowledge;
    } else {
      // Seed default on first run
      const initial = getDefaultAIKnowledge();
      await docRef.set(initial);
      inMemoryKnowledge = initial;
      return initial;
    }
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      markFirestoreQuotaExceeded();
    }
    console.warn('[AI Knowledge Load Warning]: Using in-memory fallback:', err?.message);
    return inMemoryKnowledge;
  }
}

export async function saveAIKnowledgeBase(
  updates: Partial<AIKnowledgeBaseData>
): Promise<AIKnowledgeBaseData> {
  const current = await loadAIKnowledgeBase();
  const merged: AIKnowledgeBaseData = {
    faqs: updates.faqs ? updates.faqs : current.faqs,
    products: updates.products ? updates.products : current.products,
    orderFormat: updates.orderFormat ? { ...current.orderFormat, ...updates.orderFormat } : current.orderFormat,
    policies: updates.policies ? { ...current.policies, ...updates.policies } : current.policies,
    customSystemPromptExtra: updates.customSystemPromptExtra !== undefined ? updates.customSystemPromptExtra : current.customSystemPromptExtra,
    updatedAt: new Date().toISOString(),
  };

  inMemoryKnowledge = merged;

  if (!isFirestoreQuotaExceeded()) {
    try {
      const docRef = db.collection(AI_KNOWLEDGE_COLLECTION).doc(GLOBAL_KNOWLEDGE_DOC);
      await docRef.set(merged, { merge: true });
    } catch (err: any) {
      if (isQuotaExceededError(err)) {
        markFirestoreQuotaExceeded();
      }
      console.warn('[AI Knowledge Save Warning]:', err?.message);
    }
  }

  return merged;
}

export function mountAIKnowledgeRoutes(app: Express) {
  // GET /api/ai-knowledge -> Retrieve all knowledge base, FAQs, products, and scripts
  app.get('/api/ai-knowledge', async (_req: Request, res: Response) => {
    try {
      const data = await loadAIKnowledgeBase();
      return res.json({
        success: true,
        knowledge: data,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to load AI knowledge' });
    }
  });

  // POST /api/ai-knowledge -> Save entire or partial knowledge updates
  app.post('/api/ai-knowledge', async (req: Request, res: Response) => {
    try {
      const updates = req.body || {};
      const saved = await saveAIKnowledgeBase(updates);
      return res.json({
        success: true,
        message: 'AI Training & Knowledge Base সফলভাবে সংরক্ষণ করা হয়েছে ✅',
        knowledge: saved,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to save AI knowledge' });
    }
  });

  // POST /api/ai-knowledge/reset-default -> Reset to official 50 FAQs and default catalog
  app.post('/api/ai-knowledge/reset-default', async (_req: Request, res: Response) => {
    try {
      const defaultData = getDefaultAIKnowledge();
      const saved = await saveAIKnowledgeBase(defaultData);
      return res.json({
        success: true,
        message: 'সকল ৫০টি প্রশ্ন-উত্তর ও স্ট্যান্ডার্ড প্রোডাক্ট নলেজ রিস্টোর করা হয়েছে ✅',
        knowledge: saved,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to reset AI knowledge' });
    }
  });
}
