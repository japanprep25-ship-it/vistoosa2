import React, { useState, useEffect, useRef } from 'react';
import {
  BrainCircuit,
  X,
  Search,
  Plus,
  Trash2,
  Edit2,
  Save,
  RotateCcw,
  Upload,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Package,
  FileText,
  Sparkles,
  Sliders,
  Eye,
  Check,
  Image as ImageIcon,
} from 'lucide-react';
import {
  FAQItem,
  TrainedProductItem,
  AIKnowledgeBaseData,
  DEFAULT_FAQS,
  DEFAULT_TRAINED_PRODUCTS,
  DEFAULT_ORDER_FORMAT,
  DEFAULT_POLICIES,
} from '../types/aiKnowledge';

interface AITrainingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const AITrainingModal: React.FC<AITrainingModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [activeTab, setActiveTab] = useState<'faqs' | 'products' | 'order_format' | 'rules'>('faqs');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Main Knowledge State
  const [knowledgeData, setKnowledgeData] = useState<AIKnowledgeBaseData>({
    faqs: DEFAULT_FAQS,
    products: DEFAULT_TRAINED_PRODUCTS,
    orderFormat: DEFAULT_ORDER_FORMAT,
    policies: DEFAULT_POLICIES,
    customSystemPromptExtra: '',
    updatedAt: new Date().toISOString(),
  });

  // FAQs Filtering & Editing
  const [faqCategoryFilter, setFaqCategoryFilter] = useState<string>('all');
  const [faqSearch, setFaqSearch] = useState<string>('');
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [newFaqCategory, setNewFaqCategory] = useState<FAQItem['category']>('delivery');
  const [newFaqQuestion, setNewFaqQuestion] = useState('');
  const [newFaqAnswer, setNewFaqAnswer] = useState('');
  const [isAddingFaq, setIsAddingFaq] = useState(false);

  // Products Editing & Picture Upload
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('Polo Shirts');
  const [newProdPrice, setNewProdPrice] = useState(1650);
  const [newProdSizes, setNewProdSizes] = useState('S, M, L, XL, XXL');
  const [newProdColors, setNewProdColors] = useState('Midnight Navy, Pure White, Jet Black');
  const [newProdDesc, setNewProdDesc] = useState('');
  const [newProdKeywords, setNewProdKeywords] = useState('');
  const [newProdImage, setNewProdImage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch Knowledge Base from backend
  const fetchKnowledge = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/ai-knowledge');
      const data = await res.json();
      if (data && data.success && data.knowledge) {
        setKnowledgeData(data.knowledge);
      }
    } catch (err: any) {
      console.warn('[AI Knowledge Fetch Warning]:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchKnowledge();
    }
  }, [isOpen]);

  // Save Knowledge to backend
  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/ai-knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(knowledgeData),
      });
      const data = await res.json();
      if (data.success) {
        showToast('AI Knowledge Base সফলভাবে সংরক্ষণ করা হয়েছে ✅', 'success');
        if (onSaved) onSaved();
      } else {
        throw new Error(data.message || 'সংরক্ষণ ব্যর্থ হয়েছে');
      }
    } catch (err: any) {
      showToast(err.message || 'সংরক্ষণ করতে সমস্যা হয়েছে', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to Default 50 FAQs
  const handleResetToDefault = async () => {
    if (!window.confirm('আপনি কি নিশ্চিত যে সকল ৫০টি স্ট্যান্ডার্ড প্রশ্ন-উত্তর ও প্রোডাক্ট নলেজ রিস্টোর করতে চান?')) {
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/ai-knowledge/reset-default', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.knowledge) {
        setKnowledgeData(data.knowledge);
        showToast('স্ট্যান্ডার্ড ৫০টি প্রশ্ন-উত্তর সফলভাবে রিস্টোর হয়েছে ✅', 'success');
        if (onSaved) onSaved();
      }
    } catch (err: any) {
      showToast(err.message || 'রিস্টোর করা যায়নি', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Image Upload as Base64 Data URL
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('ছবি সাইজ সর্বোচ্চ 2MB হতে হবে', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setNewProdImage(reader.result as string);
      showToast('প্রোডাক্ট ছবি সফলভাবে সিলেক্ট হয়েছে!', 'success');
    };
    reader.readAsDataURL(file);
  };

  // FAQs Handlers
  const handleAddFaq = () => {
    if (!newFaqQuestion.trim() || !newFaqAnswer.trim()) {
      showToast('প্রশ্ন ও উত্তর উভয়ই পূরণ করুন', 'error');
      return;
    }
    const newFaq: FAQItem = {
      id: `faq-custom-${Date.now()}`,
      category: newFaqCategory,
      question: newFaqQuestion.trim(),
      answer: newFaqAnswer.trim(),
      active: true,
    };
    setKnowledgeData((prev) => ({
      ...prev,
      faqs: [newFaq, ...prev.faqs],
    }));
    setNewFaqQuestion('');
    setNewFaqAnswer('');
    setIsAddingFaq(false);
    showToast('নতুন প্রশ্ন সফলভাবে যুক্ত হয়েছে! Save Changes এ ক্লিক করুন।', 'success');
  };

  const handleDeleteFaq = (id: string) => {
    setKnowledgeData((prev) => ({
      ...prev,
      faqs: prev.faqs.filter((f) => f.id !== id),
    }));
    showToast('প্রশ্নটি মুছে ফেলা হয়েছে', 'success');
  };

  const handleToggleFaqActive = (id: string) => {
    setKnowledgeData((prev) => ({
      ...prev,
      faqs: prev.faqs.map((f) => (f.id === id ? { ...f, active: !f.active } : f)),
    }));
  };

  // Product Handlers
  const handleAddProduct = () => {
    if (!newProdName.trim()) {
      showToast('প্রোডাক্ট নাম আবশ্যক', 'error');
      return;
    }
    const newProd: TrainedProductItem = {
      id: `prod-custom-${Date.now()}`,
      name: newProdName.trim(),
      category: newProdCategory.trim() || 'General',
      price: Number(newProdPrice) || 0,
      sizes: newProdSizes.split(',').map((s) => s.trim()).filter(Boolean),
      colors: newProdColors.split(',').map((c) => c.trim()).filter(Boolean),
      description: newProdDesc.trim() || newProdName.trim(),
      keywords: newProdKeywords.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean),
      imageUrl: newProdImage.trim() || undefined,
      active: true,
    };
    setKnowledgeData((prev) => ({
      ...prev,
      products: [newProd, ...prev.products],
    }));
    setNewProdName('');
    setNewProdPrice(1650);
    setNewProdDesc('');
    setNewProdKeywords('');
    setNewProdImage('');
    setIsAddingProduct(false);
    showToast('নতুন প্রোডাক্ট সফলভাবে যুক্ত হয়েছে! Save Changes এ ক্লিক করুন।', 'success');
  };

  const handleDeleteProduct = (id: string) => {
    setKnowledgeData((prev) => ({
      ...prev,
      products: prev.products.filter((p) => p.id !== id),
    }));
    showToast('প্রোডাক্ট মুছে ফেলা হয়েছে', 'success');
  };

  if (!isOpen) return null;

  // Filtered FAQs
  const filteredFaqs = knowledgeData.faqs.filter((f) => {
    const matchesCategory = faqCategoryFilter === 'all' || f.category === faqCategoryFilter;
    const matchesSearch =
      !faqSearch ||
      f.question.toLowerCase().includes(faqSearch.toLowerCase()) ||
      f.answer.toLowerCase().includes(faqSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Toast */}
        {toastMessage && (
          <div
            className={`fixed top-5 right-5 z-50 p-3.5 px-4 rounded-2xl border text-xs font-bold flex items-center gap-2 shadow-2xl ${
              toastMessage.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
                : 'bg-rose-950/90 border-rose-500/50 text-rose-200'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        )}

        {/* Modal Header */}
        <div className="p-4 sm:p-5 px-6 border-b border-zinc-800 bg-zinc-950/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-900/30 shrink-0">
              <BrainCircuit className="w-5 h-5 text-purple-200" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>AI Training & Knowledge Base</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono border border-purple-500/30 uppercase tracking-wider">
                  Gemini 3.8 Flash
                </span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5 truncate">
                ৫০টি অফিসিয়াল প্রশ্নোত্তর, প্রোডাক্ট ছবি ও তথ্য দিয়ে কাস্টমার চ্যাট AI-কে ট্রেনিং দিন।
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition shadow-md shadow-emerald-950/40 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'সংরক্ষণ হচ্ছে...' : 'Save Changes'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-zinc-800 bg-zinc-950/40 px-6 flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('faqs')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition cursor-pointer ${
              activeTab === 'faqs'
                ? 'border-purple-500 text-purple-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>প্রশ্নোত্তর ও নলেজ বেস ({knowledgeData.faqs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('products')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition cursor-pointer ${
              activeTab === 'products'
                ? 'border-purple-500 text-purple-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>প্রোডাক্ট ও ছবি ট্রেনিং ({knowledgeData.products.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('order_format')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition cursor-pointer ${
              activeTab === 'order_format'
                ? 'border-purple-500 text-purple-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>অর্ডার কালেকশন ফরম্যাট</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition cursor-pointer ${
              activeTab === 'rules'
                ? 'border-purple-500 text-purple-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>স্পেশাল পলিসি ও ইনস্ট্রাকশন</span>
          </button>
        </div>

        {/* Modal Body / Tab Contents */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* ===================================================================
              TAB 1: FAQs & Knowledge Base (50 Official Questions Pre-loaded)
              =================================================================== */}
          {activeTab === 'faqs' && (
            <div className="space-y-4">
              {/* Category Filter Pills & Search */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { id: 'all', label: 'সকল ৫০টি' },
                    { id: 'delivery', label: 'ডেলিভারি ও সময় (১০)' },
                    { id: 'payment', label: 'পেমেন্ট ও COD (১০)' },
                    { id: 'size', label: 'সাইজ ও এক্সচেঞ্জ (১০)' },
                    { id: 'order', label: 'অর্ডার ট্র্যাকিং (১০)' },
                    { id: 'general', label: 'অফার ও সাধারণ (১০)' },
                    { id: 'custom', label: 'নিজস্ব যোগ করা' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setFaqCategoryFilter(cat.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        faqCategoryFilter === cat.id
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative w-full md:w-64">
                    <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="প্রশ্ন বা উত্তর খুঁজুন..."
                      value={faqSearch}
                      onChange={(e) => setFaqSearch(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsAddingFaq(true)}
                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Q&A</span>
                  </button>
                </div>
              </div>

              {/* Add New FAQ Form Card */}
              {isAddingFaq && (
                <div className="p-4 rounded-2xl bg-zinc-950 border border-purple-500/40 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      নতুন প্রশ্ন ও উত্তর যুক্ত করুন
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddingFaq(false)}
                      className="text-zinc-500 hover:text-white text-xs"
                    >
                      বাতিল
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">ক্যাটাগরি</label>
                      <select
                        value={newFaqCategory}
                        onChange={(e) => setNewFaqCategory(e.target.value as any)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                      >
                        <option value="delivery">Delivery & Time (ডেলিভারি ও সময়)</option>
                        <option value="payment">Payment & COD (পেমেন্ট সংক্রান্ত)</option>
                        <option value="size">Size & Exchange (সাইজ ও এক্সচেঞ্জ)</option>
                        <option value="order">Order & Tracking (অর্ডার ট্র্যাকিং)</option>
                        <option value="general">General & Offers (অফার ও সাধারণ)</option>
                        <option value="custom">Custom FAQ</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[11px] text-zinc-400 mb-1">প্রশ্ন (Question)</label>
                      <input
                        type="text"
                        placeholder="যেমন: আপনাদের ডেলিভারি চার্জ কত?"
                        value={newFaqQuestion}
                        onChange={(e) => setNewFaqQuestion(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">AI-এর উত্তর (Answer)</label>
                    <textarea
                      rows={2}
                      placeholder="গ্রাহক এই প্রশ্ন করলে AI ঠিক যেভাবে উত্তর দেবে..."
                      value={newFaqAnswer}
                      onChange={(e) => setNewFaqAnswer(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white resize-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAddingFaq(false)}
                      className="px-3 py-1.5 rounded-xl bg-zinc-800 text-zinc-400 text-xs font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddFaq}
                      className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold"
                    >
                      Add Question
                    </button>
                  </div>
                </div>
              )}

              {/* FAQs List */}
              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                {filteredFaqs.length === 0 ? (
                  <div className="p-8 text-center text-zinc-500 text-xs bg-zinc-950/40 rounded-2xl border border-zinc-800/60">
                    কোনো প্রশ্ন পাওয়া যায়নি। ক্যাটাগরি বা সার্চ ফিল্টার পরিবর্তন করুন।
                  </div>
                ) : (
                  filteredFaqs.map((faq, idx) => {
                    const isEditing = editingFaqId === faq.id;
                    return (
                      <div
                        key={faq.id}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          faq.active
                            ? 'bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700'
                            : 'bg-zinc-950/30 border-zinc-900 opacity-60'
                        }`}
                      >
                        {isEditing ? (
                          <div className="space-y-2 text-xs">
                            <input
                              type="text"
                              value={faq.question}
                              onChange={(e) => {
                                const val = e.target.value;
                                setKnowledgeData((prev) => ({
                                  ...prev,
                                  faqs: prev.faqs.map((f) => (f.id === faq.id ? { ...f, question: val } : f)),
                                }));
                              }}
                              className="w-full bg-zinc-900 border border-purple-500/50 rounded-xl px-3 py-1.5 text-white font-bold"
                            />
                            <textarea
                              rows={3}
                              value={faq.answer}
                              onChange={(e) => {
                                const val = e.target.value;
                                setKnowledgeData((prev) => ({
                                  ...prev,
                                  faqs: prev.faqs.map((f) => (f.id === faq.id ? { ...f, answer: val } : f)),
                                }));
                              }}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-zinc-300"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingFaqId(null)}
                                className="px-3 py-1 rounded-lg bg-purple-600 text-white font-bold text-[11px]"
                              >
                                Done
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-800 text-purple-300 border border-zinc-700">
                                  #{idx + 1} • {faq.category}
                                </span>
                                <h4 className="text-xs font-bold text-white">
                                  {faq.question}
                                </h4>
                              </div>
                              <p className="text-xs text-zinc-300 leading-relaxed pl-1 border-l-2 border-purple-500/40 ml-1 mt-1">
                                {faq.answer}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                              <button
                                type="button"
                                onClick={() => handleToggleFaqActive(faq.id)}
                                className={`text-[10px] px-2 py-0.5 rounded-lg border font-bold cursor-pointer transition ${
                                  faq.active
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                    : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                                }`}
                              >
                                {faq.active ? 'Active' : 'Disabled'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingFaqId(faq.id)}
                                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer"
                                title="Edit Question & Answer"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteFaq(faq.id)}
                                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-950 text-rose-400 transition cursor-pointer"
                                title="Delete Question"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ===================================================================
              TAB 2: Product Knowledge & Picture Upload Training
              =================================================================== */}
          {activeTab === 'products' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <div>
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-purple-400" />
                    প্রোডাক্ট ক্যাটালগ ও ছবি রেকগনিশন ট্রেনিং
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    কাস্টমার ছবি পাঠালে বা নাম বললে AI যাতে বুঝতে পারে কোনটি কোন প্রোডাক্ট ("কন্টা কোন প্রোডাক্ট") এবং সঠিক দাম ও সাইজ বলে দিতে পারে।
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddingProduct(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Product & Picture</span>
                </button>
              </div>

              {/* Add New Product Form Card */}
              {isAddingProduct && (
                <div className="p-4 rounded-2xl bg-zinc-950 border border-purple-500/40 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      নতুন প্রোডাক্ট ও ফটো ট্রেনিং যুক্ত করুন
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddingProduct(false)}
                      className="text-zinc-500 hover:text-white text-xs"
                    >
                      বাতিল
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block text-zinc-400 mb-1">পণ্যের নাম (Product Name)</label>
                      <input
                        type="text"
                        placeholder="যেমন: Supima Cotton Polo"
                        value={newProdName}
                        onChange={(e) => setNewProdName(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-zinc-400 mb-1">ক্যাটাগরি</label>
                      <input
                        type="text"
                        placeholder="যেমন: Polo Shirts / Panjabi"
                        value={newProdCategory}
                        onChange={(e) => setNewProdCategory(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-zinc-400 mb-1">মূল্য (Price in ৳)</label>
                      <input
                        type="number"
                        value={newProdPrice}
                        onChange={(e) => setNewProdPrice(Number(e.target.value))}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono font-bold text-emerald-400"
                      />
                    </div>

                    <div>
                      <label className="block text-zinc-400 mb-1">উপলব্ধ সাইজসমূহ (Sizes)</label>
                      <input
                        type="text"
                        placeholder="S, M, L, XL, XXL"
                        value={newProdSizes}
                        onChange={(e) => setNewProdSizes(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-zinc-400 mb-1">রঙসমূহ (Colors)</label>
                      <input
                        type="text"
                        placeholder="Navy Blue, White, Black"
                        value={newProdColors}
                        onChange={(e) => setNewProdColors(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-zinc-400 mb-1">ট্রিগার কীওয়ার্ডসমূহ (Keywords)</label>
                      <input
                        type="text"
                        placeholder="polo, পোলো, t-shirt, navy"
                        value={newProdKeywords}
                        onChange={(e) => setNewProdKeywords(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1 text-xs">বিবরণ ও ফেব্রিক ডিটেইলস (Description)</label>
                    <textarea
                      rows={2}
                      placeholder="১০০% আমেরিকান সুপিমা কটন, কালার গ্যারান্টিযুক্ত প্রিমিয়াম কোয়ালিটি..."
                      value={newProdDesc}
                      onChange={(e) => setNewProdDesc(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white resize-none"
                    />
                  </div>

                  {/* Picture Upload Area */}
                  <div>
                    <label className="block text-zinc-400 mb-1 text-xs font-bold flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
                      প্রোডাক্ট ছবি আপলোড (Train with Picture)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        onChange={handleImageFileChange}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5 text-purple-400" />
                        <span>Choose Image File (JPG/PNG)</span>
                      </button>

                      <input
                        type="text"
                        placeholder="অথবা ছবির অনলাইন URL দিন (https://...)"
                        value={newProdImage}
                        onChange={(e) => setNewProdImage(e.target.value)}
                        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                      />

                      {newProdImage && (
                        <div className="w-10 h-10 rounded-xl border border-purple-500 overflow-hidden shrink-0">
                          <img src={newProdImage} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1 border-t border-zinc-800/80">
                    <button
                      type="button"
                      onClick={() => setIsAddingProduct(false)}
                      className="px-3 py-1.5 rounded-xl bg-zinc-800 text-zinc-400 text-xs font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddProduct}
                      className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold"
                    >
                      Save Product
                    </button>
                  </div>
                </div>
              )}

              {/* Products Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {knowledgeData.products.map((prod) => (
                  <div
                    key={prod.id}
                    className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800 flex gap-3.5 hover:border-zinc-700 transition"
                  >
                    <div className="w-20 h-20 rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden shrink-0 flex items-center justify-center">
                      {prod.imageUrl ? (
                        <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-7 h-7 text-zinc-600" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="text-xs font-bold text-white truncate">{prod.name}</h4>
                        <span className="text-xs font-bold text-emerald-400 font-mono shrink-0">
                          ৳{prod.price.toLocaleString()}
                        </span>
                      </div>

                      <p className="text-[11px] text-zinc-400 line-clamp-2">{prod.description}</p>

                      <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-1.5 flex-wrap pt-0.5">
                        <span className="text-purple-300">Sizes: {prod.sizes.join(', ')}</span>
                        <span>•</span>
                        <span className="text-zinc-400">Keywords: {prod.keywords.slice(0, 3).join(', ')}</span>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(prod.id)}
                          className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 transition"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===================================================================
              TAB 3: Order Collection Format & Scripts
              =================================================================== */}
          {activeTab === 'order_format' && (
            <div className="space-y-4">
              <div className="pb-2 border-b border-zinc-800">
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-purple-400" />
                  অর্ডার সংগ্রহ ও কনফার্মেশন ফরম্যাট (Order Collection Scripts)
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  অর্ডার নেওয়ার সময় AI কীভাবে ফলো-আপ প্রশ্ন করবে এবং অর্ডার কনফার্ম করে কী ফরম্যাটে রিপ্লাই দেবে তা কাস্টমাইজ করুন।
                </p>
              </div>

              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-zinc-300 font-bold mb-1">
                    ১. অর্ডার সারসংক্ষেপ ফরম্যাট (Order Summary Format Template)
                  </label>
                  <textarea
                    rows={4}
                    value={knowledgeData.orderFormat.formatTemplate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setKnowledgeData((prev) => ({
                        ...prev,
                        orderFormat: { ...prev.orderFormat, formatTemplate: val },
                      }));
                    }}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-300 font-mono text-xs"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">
                    ভেরিয়েবল: {'{product_name}'}, {'{size}'}, {'{unit_price}'}, {'{delivery_fee}'}, {'{total_amount}'}, {'{customer_name}'}, {'{phone_number}'}, {'{address}'}
                  </p>
                </div>

                <div>
                  <label className="block text-zinc-300 font-bold mb-1">
                    ২. তথ্য অসম্পূর্ণ থাকলে ফলো-আপ প্রশ্ন স্ক্রিপ্ট (Missing Details Prompt)
                  </label>
                  <textarea
                    rows={3}
                    value={knowledgeData.orderFormat.followUpPromptTemplate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setKnowledgeData((prev) => ({
                        ...prev,
                        orderFormat: { ...prev.orderFormat, followUpPromptTemplate: val },
                      }));
                    }}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-300 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 font-bold mb-1">
                    ৩. অর্ডার নিশ্চিত হলে পাঠানো কনফার্মেশন মেসেজ (Order Confirmed Reply)
                  </label>
                  <textarea
                    rows={3}
                    value={knowledgeData.orderFormat.confirmationMessageTemplate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setKnowledgeData((prev) => ({
                        ...prev,
                        orderFormat: { ...prev.orderFormat, confirmationMessageTemplate: val },
                      }));
                    }}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-300 text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ===================================================================
              TAB 4: Special Store Policies & Custom Instructions
              =================================================================== */}
          {activeTab === 'rules' && (
            <div className="space-y-4">
              <div className="pb-2 border-b border-zinc-800">
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-purple-400" />
                  ডেলিভারি চার্জ ও স্পেশাল স্টোর পলিসি
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
                <div>
                  <label className="block text-zinc-400 mb-1">ঢাকার ভেতর ডেলিভারি চার্জ (৳)</label>
                  <input
                    type="number"
                    value={knowledgeData.policies.insideDhakaDeliveryFee}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setKnowledgeData((prev) => ({
                        ...prev,
                        policies: { ...prev.policies, insideDhakaDeliveryFee: val },
                      }));
                    }}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">সাব-ঢাকা ডেলিভারি চার্জ (৳)</label>
                  <input
                    type="number"
                    value={knowledgeData.policies.subDhakaDeliveryFee}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setKnowledgeData((prev) => ({
                        ...prev,
                        policies: { ...prev.policies, subDhakaDeliveryFee: val },
                      }));
                    }}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">ঢাকার বাইরে ডেলিভারি চার্জ (৳)</label>
                  <input
                    type="number"
                    value={knowledgeData.policies.outsideDhakaDeliveryFee}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setKnowledgeData((prev) => ({
                        ...prev,
                        policies: { ...prev.policies, outsideDhakaDeliveryFee: val },
                      }));
                    }}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">ডেলিভারি সময় (ঢাকার ভেতরে)</label>
                  <input
                    type="text"
                    value={knowledgeData.policies.deliveryTimeInsideDhaka}
                    onChange={(e) => {
                      const val = e.target.value;
                      setKnowledgeData((prev) => ({
                        ...prev,
                        policies: { ...prev.policies, deliveryTimeInsideDhaka: val },
                      }));
                    }}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">ডেলিভারি সময় (ঢাকার বাইরে)</label>
                  <input
                    type="text"
                    value={knowledgeData.policies.deliveryTimeOutsideDhaka}
                    onChange={(e) => {
                      const val = e.target.value;
                      setKnowledgeData((prev) => ({
                        ...prev,
                        policies: { ...prev.policies, deliveryTimeOutsideDhaka: val },
                      }));
                    }}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">কাস্টমার কেয়ার হটলাইন নম্বর</label>
                  <input
                    type="text"
                    value={knowledgeData.policies.hotlinePhone}
                    onChange={(e) => {
                      const val = e.target.value;
                      setKnowledgeData((prev) => ({
                        ...prev,
                        policies: { ...prev.policies, hotlinePhone: val },
                      }));
                    }}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 text-xs font-bold">
                  চলমান ক্যাম্পেইন / স্পেশাল অফার ব্যানার (Promo Notice)
                </label>
                <input
                  type="text"
                  placeholder="যেমন: ২টি পোলো শার্ট অর্ডার করলে ডেলিভারি চার্জ সম্পূর্ণ ফ্রি!"
                  value={knowledgeData.policies.currentPromoNotice || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setKnowledgeData((prev) => ({
                      ...prev,
                      policies: { ...prev.policies, currentPromoNotice: val },
                    }));
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 text-xs font-bold">
                  কাস্টম সিস্টেম প্রম্পট বা অতিরিক্ত নিয়মাবলী (Special Instructions)
                </label>
                <textarea
                  rows={3}
                  placeholder="AI-কে বিশেষ কোনো আচরণ বা নিয়ম শেখাতে চাইলে এখানে লিখুন..."
                  value={knowledgeData.customSystemPromptExtra || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setKnowledgeData((prev) => ({
                      ...prev,
                      customSystemPromptExtra: val,
                    }));
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-white resize-none"
                />
              </div>

              {/* Reset to Default 50 FAQs */}
              <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-between gap-3 mt-4">
                <div>
                  <h4 className="text-xs font-bold text-zinc-300">রিসেট অপশন (Reset to Factory Defaults)</h4>
                  <p className="text-[11px] text-zinc-500">
                    পূর্বের সকল ৫০টি অফিশিয়াল প্রশ্ন-উত্তর ও প্রিসেট ডাটা পুনরায় রিস্টোর করতে চাইলে ব্যবহার করুন।
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  disabled={isSaving}
                  className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-rose-950 text-zinc-400 hover:text-rose-300 border border-zinc-700 text-xs font-bold transition flex items-center gap-1.5 shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore 50 Official FAQs</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 px-6 border-t border-zinc-800 bg-zinc-950/80 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-zinc-500 font-mono flex items-center gap-2">
            <span>Last Updated: {new Date(knowledgeData.updatedAt).toLocaleTimeString()}</span>
            <span>•</span>
            <span className="text-purple-400">Synced with Gemini AI Context</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition shadow-md shadow-purple-900/40 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'সংরক্ষণ হচ্ছে...' : 'Save & Train AI'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
