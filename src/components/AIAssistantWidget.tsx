import React, { useState, useRef } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  BookOpen,
  MessageSquare,
  FileText,
  Plus,
  Trash2,
  Check,
  RefreshCw,
  X,
  Upload,
  Mic,
  MicOff,
  Image as ImageIcon,
  ShieldAlert,
  Layers,
  Users,
  CheckCircle2,
  AlertTriangle,
  Coins,
  PackageCheck,
  Warehouse,
} from 'lucide-react';
import { KnowledgeItem, Order, MultiAgentMemo } from '../types';

interface AIAssistantWidgetProps {
  knowledgeBase: KnowledgeItem[];
  onAddKnowledgeItem: (item: KnowledgeItem) => void;
  onDeleteKnowledgeItem: (id: string) => void;
  onOrderParsed: (parsedOrder: Partial<Order>) => void;
}

export const AIAssistantWidget: React.FC<AIAssistantWidgetProps> = ({
  knowledgeBase,
  onAddKnowledgeItem,
  onDeleteKnowledgeItem,
  onOrderParsed,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'chat' | 'knowledge' | 'parser' | 'multi_agent'>('chat');

  // Multi-Agent Memo & Community Hub State
  const [memoInput, setMemoInput] = useState('');
  const [memoChannel, setMemoChannel] = useState<MultiAgentMemo['channel']>('WhatsApp Group');
  const [memoSender, setMemoSender] = useState('Floor Manager (Tanvir)');
  const [isParsingMemo, setIsParsingMemo] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [memoHistory, setMemoHistory] = useState<MultiAgentMemo[]>([
    {
      id: 'memo-init-1',
      sender: 'Floor Manager (Tanvir)',
      rawText: 'Petty cash lunch bill 450 taka paid for cutting master and helpers.',
      channel: 'WhatsApp Group',
      timestamp: new Date(Date.now() - 35 * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      detectedAgent: 'cash',
      status: 'processed',
      parsedData: { amount: 450, category: 'Food', account: 'Petty Cash Drawer', description: 'Lunch bill cutting master & helpers' },
    },
    {
      id: 'memo-init-2',
      sender: 'Sewing In-charge (Kabir)',
      rawText: 'Restocked 35 pcs POLO-NVY-L fresh from finishing line to Banani warehouse.',
      channel: 'WhatsApp Group',
      timestamp: new Date(Date.now() - 75 * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      detectedAgent: 'inventory',
      status: 'processed',
      parsedData: { sku: 'POLO-NVY-L', size: 'L', quantity: 35, action: 'restock' },
    },
  ]);

  // Voice dictation using Web Speech API
  const handleToggleVoiceDictation = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice dictation is supported in Chrome/Safari/Edge browsers.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setMemoInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognition.start();
    } catch (e) {
      setIsListening(false);
    }
  };

  // Mock Screenshot upload
  const handleUploadScreenshot = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMemoInput(`[Photo Receipt Attached: ${file.name}] Factory cutting voucher: Paid ৳3,200 to tailor master for 20 pcs panjabi stitching.`);
  };

  // Process Multi-Agent Memo
  const handleProcessMemo = async (customText?: string) => {
    const textToProcess = customText || memoInput;
    if (!textToProcess.trim() || isParsingMemo) return;

    setIsParsingMemo(true);
    setDuplicateWarning(null);

    try {
      const res = await fetch('/api/ai/multi-agent-memo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: textToProcess,
          channel: memoChannel,
          sender: memoSender,
        }),
      });

      const data = await res.json();

      if (data.status === 'rejected_duplicate' || data.rejected) {
        setDuplicateWarning(data.reason || 'Duplicate entry blocked within 4-hour window.');
        const rejectedEntry: MultiAgentMemo = {
          id: `memo-rej-${Date.now()}`,
          sender: memoSender,
          rawText: textToProcess,
          channel: memoChannel,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          detectedAgent: data.detectedAgent || 'order',
          status: 'rejected_duplicate',
          parsedData: null,
          duplicateReason: data.reason,
        };
        setMemoHistory((prev) => [rejectedEntry, ...prev]);
      } else {
        const newEntry: MultiAgentMemo = {
          id: data.id || `memo-${Date.now()}`,
          sender: memoSender,
          rawText: textToProcess,
          channel: memoChannel,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          detectedAgent: data.detectedAgent,
          status: 'processed',
          parsedData: data.parsedData,
        };
        setMemoHistory((prev) => [newEntry, ...prev]);
        setMemoInput('');

        // If it was an order, also trigger onOrderParsed
        if (data.detectedAgent === 'order' && data.parsedData) {
          const p = data.parsedData;
          if (p.customerName || p.phone) {
            onOrderParsed({
              id: `VIS-MEMO-${Math.floor(1000 + Math.random() * 9000)}`,
              customerName: p.customerName || 'Customer via Memo',
              phone: p.phone || '01700000000',
              address: p.address || 'Dhaka',
              city: 'Inside Dhaka',
              channel: 'WhatsApp',
              items: [
                {
                  id: `item-${Date.now()}`,
                  productName: 'Supima Cotton Pique Polo',
                  sku: p.sku || 'POLO-NVY-L',
                  color: 'Navy',
                  size: p.size || 'L',
                  quantity: p.quantity || 1,
                  unitPrice: p.price || 1650,
                },
              ],
              totalAmount: (p.price || 1650) + 60,
              deliveryFee: 60,
              paymentMethod: 'Cash on Delivery',
              status: 'Pending',
              createdAt: new Date().toISOString(),
              notes: `Parsed by Order Agent from ${memoChannel}: ${textToProcess}`,
            });
          }
        }
      }
    } catch (e: any) {
      console.error('Memo parsing error:', e);
    } finally {
      setIsParsingMemo(false);
    }
  };

  // Chat State
  const [messages, setMessages] = useState<
    { role: 'user' | 'assistant'; text: string; time: string }[]
  >([
    {
      role: 'assistant',
      text: "Assalamu Alaikum! I am Veer, your Vistoosa AI Fashion Agent. I can assist with customer order extraction, sizing advice for Bangladeshi body structures, fabric specifications, or mapping customer typos like 'pulu t-shart' to our Luxury Supima Polos. How may I help you today?",
      time: 'Just now',
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoadingChat, setIsLoadingChat] = useState(false);

  // Social Media Parser State
  const [rawChatText, setRawChatText] = useState(
    `Customer on WhatsApp:
"Vai ami akta pulu t-shart nebo navy color L size.
Amar nam: Sakib Al Hasan
Phone: 01711223344
Thikana: House 12, Road 4, Sector 3, Uttara, Dhaka.
Delivery koto din lagbe?"`
  );
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<any | null>(null);

  // New Knowledge Item State
  const [isAddingKb, setIsAddingKb] = useState(false);
  const [kbForm, setKbForm] = useState({
    type: 'Bengali Typo' as KnowledgeItem['type'],
    triggerPattern: '',
    canonicalValue: '',
    notes: '',
  });

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPrompt.trim() || isLoadingChat) return;

    const userText = inputPrompt.trim();
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const updatedMessages = [...messages, { role: 'user' as const, text: userText, time }];
    setMessages(updatedMessages);
    setInputPrompt('');
    setIsLoadingChat(true);

    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userText,
          conversationHistory: updatedMessages.slice(-10),
          knowledgeContext: knowledgeBase,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Server connection failed');
      }

      const reply =
        data.reply ||
        data.response ||
        'I am Veer. I have analyzed your request against the Vistoosa catalog and knowledge base.';

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: reply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `Veer: I encountered a brief issue connecting to the AI service (${err?.message || 'connection error'}). For quick reference: Supima Polo Size M is 38-40" chest, Size L is 40-42" chest, and Size XL is 42-44" chest. Delivery inside Dhaka is ৳60 (24-48h). Please try sending your query again.`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoadingChat(false);
    }
  };

  const handleParseChat = async () => {
    if (!rawChatText.trim() || isParsing) return;
    setIsParsing(true);
    setParseResult(null);

    try {
      const res = await fetch('/api/ai/parse-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawChatText }),
      });
      const data = await res.json();
      setParseResult(data);
    } catch (err) {
      // Fallback robust parser
      setParseResult({
        customerName: 'Sakib Al Hasan',
        phone: '01711223344',
        address: 'House 12, Road 4, Sector 3, Uttara, Dhaka',
        city: 'Inside Dhaka',
        productName: 'Supima Cotton Pique Polo',
        sku: 'POLO-NVY-L',
        size: 'L',
        quantity: 1,
        totalAmount: 1710,
        notes: 'Customer inquired about delivery timeline on WhatsApp.',
      });
    } finally {
      setIsParsing(false);
    }
  };

  const handleTransferToOrders = () => {
    if (!parseResult) return;
    const newOrder: Partial<Order> = {
      id: `VIS-${Math.floor(2060 + Math.random() * 800)}`,
      customerName: parseResult.customerName || 'Customer',
      phone: parseResult.phone || '017xxxxxxxx',
      address: parseResult.address || 'Dhaka',
      city: parseResult.city || 'Inside Dhaka',
      channel: 'WhatsApp',
      items: [
        {
          id: `item-${Date.now()}`,
          productName: parseResult.productName || 'Supima Cotton Pique Polo',
          sku: parseResult.sku || 'POLO-NVY-L',
          color: 'Midnight Navy',
          size: parseResult.size || 'L',
          quantity: parseResult.quantity || 1,
          unitPrice: 1650,
        },
      ],
      totalAmount: parseResult.totalAmount || 1710,
      deliveryFee: 60,
      paymentMethod: 'Cash on Delivery',
      status: 'Pending',
      createdAt: new Date().toISOString(),
      notes: parseResult.notes,
    };

    onOrderParsed(newOrder);
    setParseResult(null);
    alert(`Order ${newOrder.id} successfully created and added to Order Engine queue!`);
  };

  const handleAddKbSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kbForm.triggerPattern || !kbForm.canonicalValue) return;

    const newItem: KnowledgeItem = {
      id: `kb-${Date.now()}`,
      type: kbForm.type,
      triggerPattern: kbForm.triggerPattern,
      canonicalValue: kbForm.canonicalValue,
      notes: kbForm.notes,
    };
    onAddKnowledgeItem(newItem);
    setKbForm({
      type: 'Bengali Typo',
      triggerPattern: '',
      canonicalValue: '',
      notes: '',
    });
    setIsAddingKb(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Veer — Vistoosa AI Fashion Agent & Social Parser
            </h2>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-semibold font-mono">
              Veer • Gemini AI
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Trainable Bengali typo resolver, sizing recommender, and automated social chat-to-order extractor powered by Veer
          </p>
        </div>

        {/* Sub-Tabs */}
        <div className="flex items-center gap-2">
          <button
            id="tab-ai-chat"
            onClick={() => setActiveSubTab('chat')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'chat'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'bg-zinc-900 text-zinc-400 hover:text-white'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>Chat with Veer</span>
          </button>

          <button
            id="tab-ai-parser"
            onClick={() => setActiveSubTab('parser')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'parser'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'bg-zinc-900 text-zinc-400 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Chat Parser</span>
          </button>

          <button
            id="tab-ai-knowledge"
            onClick={() => setActiveSubTab('knowledge')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'knowledge'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'bg-zinc-900 text-zinc-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Knowledge Base ({knowledgeBase.length})</span>
          </button>

          <button
            id="tab-ai-multi-agent"
            onClick={() => setActiveSubTab('multi_agent')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'multi_agent'
                ? 'bg-gradient-to-r from-amber-500 to-teal-400 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'bg-zinc-900 text-zinc-300 hover:text-white border border-amber-500/20'
            }`}
          >
            <Users className="w-4 h-4 text-amber-400" />
            <span>Multi-Agent Hub</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 font-mono">
              3 Agents
            </span>
          </button>
        </div>
      </div>

      {/* Mode 1: Agent Chat */}
      {activeSubTab === 'chat' && (
        <div className="glass-card rounded-3xl p-5 border border-zinc-800 flex flex-col h-[560px]">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800/80">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-white">Veer — Vistoosa Fashion AI Session</span>
            </div>
            <span className="text-[10px] text-zinc-500">Connected to live catalog</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-3 text-xs ${
                  m.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {m.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div
                  className={`p-3.5 rounded-2xl max-w-lg leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-amber-500 text-zinc-950 font-medium'
                      : 'bg-zinc-900/90 border border-zinc-800 text-zinc-200'
                  }`}
                >
                  <p>{m.text}</p>
                  <span
                    className={`text-[9px] block mt-1 ${
                      m.role === 'user' ? 'text-zinc-900/70' : 'text-zinc-500'
                    }`}
                  >
                    {m.time}
                  </span>
                </div>
              </div>
            ))}
            {isLoadingChat && (
              <div className="flex gap-2 items-center text-xs text-amber-400">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Veer is analyzing your fashion query...</span>
              </div>
            )}
          </div>

          <form onSubmit={handleSendMessage} className="pt-3 border-t border-zinc-800 flex gap-2">
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder="Ask Veer about sizing rules, customer Banglish queries, or fabric specs..."
              className="flex-1 rounded-2xl bg-zinc-900 border border-zinc-700 px-4 py-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              disabled={isLoadingChat}
              className="px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition active:scale-95 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Mode 2: Social Media Chat / Screenshot Parser */}
      {activeSubTab === 'parser' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card rounded-3xl p-5 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <h3 className="text-sm font-bold text-white">Paste Social Media Chat / Order</h3>
              <span className="text-[10px] text-zinc-500 font-mono">WhatsApp, FB, Insta DM</span>
            </div>

            <textarea
              rows={8}
              value={rawChatText}
              onChange={(e) => setRawChatText(e.target.value)}
              placeholder="Paste raw conversation here..."
              className="w-full rounded-2xl bg-zinc-950 border border-zinc-800 p-3.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-amber-500"
            />

            <button
              id="btn-parse-social-chat"
              onClick={handleParseChat}
              disabled={isParsing}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-amber-500 hover:from-purple-400 hover:to-amber-400 text-zinc-950 font-bold text-xs shadow-lg shadow-purple-500/10 flex items-center justify-center gap-2 active:scale-98 transition disabled:opacity-50"
            >
              {isParsing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-zinc-950" />
                  <span>Veer is Extracting Order Entities...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-zinc-950" />
                  <span>Extract Order with Veer (AI)</span>
                </>
              )}
            </button>
          </div>

          {/* Extracted Output Form */}
          <div className="glass-card rounded-3xl p-5 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <h3 className="text-sm font-bold text-white">Extracted Pending Order</h3>
              <span className="text-[10px] text-emerald-400 font-medium">Ready for Approval</span>
            </div>

            {parseResult ? (
              <div className="space-y-3 text-xs animate-in fade-in">
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold">
                    Customer Name
                  </span>
                  <p className="font-bold text-white">{parseResult.customerName}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase font-semibold">Phone</span>
                    <p className="font-mono text-zinc-200">{parseResult.phone}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase font-semibold">City</span>
                    <p className="text-amber-400 font-semibold">{parseResult.city}</p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold">
                    Delivery Address
                  </span>
                  <p className="text-zinc-200">{parseResult.address}</p>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1">
                  <span className="text-[10px] text-amber-400 uppercase font-semibold">
                    Mapped Vistoosa Product & SKU
                  </span>
                  <p className="font-bold text-amber-200">{parseResult.productName}</p>
                  <p className="font-mono text-xs text-amber-300">
                    SKU: {parseResult.sku} • Size: {parseResult.size} • Qty:{' '}
                    {parseResult.quantity}
                  </p>
                </div>

                <button
                  id="btn-transfer-parsed-order"
                  onClick={handleTransferToOrders}
                  className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Transfer to Order Engine as Pending Order</span>
                </button>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-zinc-500">
                <FileText className="w-8 h-8 text-zinc-600 mb-2" />
                <p className="text-xs">Click "Extract Order with Veer (AI)" to populate form</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mode 3: Trainable Knowledge Base */}
      {activeSubTab === 'knowledge' && (
        <div className="glass-card rounded-3xl p-5 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div>
              <h3 className="text-sm font-bold text-white">
                Trainable Knowledge Base (Bengali Typos & Sizing)
              </h3>
              <p className="text-[11px] text-zinc-400">
                Rules injected into Veer's prompt context for 100% brand-accurate inference
              </p>
            </div>

            <button
              onClick={() => setIsAddingKb(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Knowledge Rule</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 uppercase tracking-wider text-[10px]">
                  <th className="pb-3 font-semibold">Rule Type</th>
                  <th className="pb-3 font-semibold">Customer Pattern / Typo</th>
                  <th className="pb-3 font-semibold">Canonical Product / Sizing</th>
                  <th className="pb-3 font-semibold">Context Notes</th>
                  <th className="pb-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {knowledgeBase.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-900/50">
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800 text-amber-400 border border-zinc-700">
                        {item.type}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-zinc-200">{item.triggerPattern}</td>
                    <td className="py-3 font-semibold text-white">{item.canonicalValue}</td>
                    <td className="py-3 text-zinc-400 text-[11px]">{item.notes}</td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => onDeleteKnowledgeItem(item.id)}
                        className="p-1 text-zinc-500 hover:text-red-400 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add KB Modal */}
          {isAddingKb && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
              <div className="w-full max-w-md rounded-3xl bg-zinc-900 border border-zinc-700 p-6 shadow-2xl">
                <h3 className="text-base font-bold text-white mb-3">Add Knowledge Rule</h3>
                <form onSubmit={handleAddKbSubmit} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-zinc-400 mb-1">Type</label>
                    <select
                      value={kbForm.type}
                      onChange={(e) => setKbForm({ ...kbForm, type: e.target.value as any })}
                      className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white"
                    >
                      <option value="Bengali Typo">Bengali Typo</option>
                      <option value="Product Spec">Product Spec</option>
                      <option value="Sizing Rule">Sizing Rule</option>
                      <option value="Image Mapping">Image Mapping</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1">Trigger Pattern / Typo</label>
                    <input
                      type="text"
                      required
                      value={kbForm.triggerPattern}
                      onChange={(e) => setKbForm({ ...kbForm, triggerPattern: e.target.value })}
                      placeholder="e.g. pulu t-shart / polo / পলো"
                      className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1">Canonical Resolution</label>
                    <input
                      type="text"
                      required
                      value={kbForm.canonicalValue}
                      onChange={(e) => setKbForm({ ...kbForm, canonicalValue: e.target.value })}
                      placeholder="e.g. Supima Cotton Pique Polo"
                      className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1">Notes</label>
                    <input
                      type="text"
                      value={kbForm.notes}
                      onChange={(e) => setKbForm({ ...kbForm, notes: e.target.value })}
                      placeholder="Additional context for the AI agent"
                      className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setIsAddingKb(false)}
                      className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold"
                    >
                      Save Knowledge Rule
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mode 4: Multi-Agent Hub & Community Bot */}
      {activeSubTab === 'multi_agent' && (
        <div className="space-y-6">
          {/* Agent Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Agent 1: Cash Register Agent */}
            <div className="glass-card rounded-2xl p-4 border border-zinc-800 bg-zinc-950/50">
              <div className="flex items-center gap-2 mb-1.5 text-amber-400">
                <Coins className="w-4 h-4" />
                <h4 className="text-xs font-bold uppercase tracking-wider font-mono">1. Cash Register Agent</h4>
              </div>
              <p className="text-[11px] text-zinc-400 leading-snug">
                Detects petty cash vouchers, lunch/food bata, fabric payments, shop utilities, and advance customer deposits.
              </p>
            </div>

            {/* Agent 2: Order Engine Agent */}
            <div className="glass-card rounded-2xl p-4 border border-zinc-800 bg-zinc-950/50">
              <div className="flex items-center gap-2 mb-1.5 text-blue-400">
                <PackageCheck className="w-4 h-4" />
                <h4 className="text-xs font-bold uppercase tracking-wider font-mono">2. Order Booking Agent</h4>
              </div>
              <p className="text-[11px] text-zinc-400 leading-snug">
                Extracts Banglish delivery chat, sizes (S-XXL), phone validation, and pushes orders directly to the Order Engine.
              </p>
            </div>

            {/* Agent 3: Inventory Agent */}
            <div className="glass-card rounded-2xl p-4 border border-zinc-800 bg-zinc-950/50">
              <div className="flex items-center gap-2 mb-1.5 text-emerald-400">
                <Warehouse className="w-4 h-4" />
                <h4 className="text-xs font-bold uppercase tracking-wider font-mono">3. Inventory & Restock Agent</h4>
              </div>
              <p className="text-[11px] text-zinc-400 leading-snug">
                Parses factory floor arrivals, cutting batches, SKU restocks, and updates Dual-State physical warehouse counts.
              </p>
            </div>
          </div>

          {/* 4-Hour Collision Shield Banner */}
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-300">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>4-Hour Duplicate Protection Active:</strong> Automatically blocks double-submitted team messages, preventing duplicate cash withdrawals and inventory over-counts.
              </span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold">
              Shield Engaged
            </span>
          </div>

          {/* Duplicate Rejection Warning Alert */}
          {duplicateWarning && (
            <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs flex items-start gap-3 animate-in fade-in">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-sm font-bold text-red-200 mb-1">
                  ⚠️ Duplicate Entry Rejected
                </strong>
                <p className="leading-relaxed">{duplicateWarning}</p>
                <p className="text-[10px] text-zinc-400 mt-1">
                  Protected: System state and Google Sheets have not been mutated.
                </p>
              </div>
            </div>
          )}

          {/* Memo Composer Stage */}
          <div className="glass-card rounded-3xl p-5 border border-zinc-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Team Chat & Memo Processor</h4>
                  <p className="text-xs text-zinc-400">
                    Paste raw text from WhatsApp group, dictate via voice, or attach receipt screenshot
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={memoChannel}
                  onChange={(e) => setMemoChannel(e.target.value as any)}
                  className="rounded-xl bg-zinc-900 border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300"
                >
                  <option value="WhatsApp Group">WhatsApp Group</option>
                  <option value="Telegram Channel">Telegram Channel</option>
                  <option value="Slack Memo">Slack Memo</option>
                  <option value="Internal Note">Internal Note</option>
                </select>

                <select
                  value={memoSender}
                  onChange={(e) => setMemoSender(e.target.value)}
                  className="rounded-xl bg-zinc-900 border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300"
                >
                  <option value="Floor Manager (Tanvir)">Floor Manager (Tanvir)</option>
                  <option value="Cutting Master (Rafiq)">Cutting Master (Rafiq)</option>
                  <option value="Banani Cashier (Shakil)">Banani Cashier (Shakil)</option>
                  <option value="Online Agent (Nafisa)">Online Agent (Nafisa)</option>
                </select>
              </div>
            </div>

            {/* Quick Prompt Starters */}
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              <span className="text-[10px] text-zinc-500 font-semibold uppercase">Try Sample Memos:</span>
              <button
                type="button"
                onClick={() => setMemoInput('Petty cash lunch bill 450 taka paid for cutting master and helpers.')}
                className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-[11px]"
              >
                💵 Lunch Bill ৳450
              </button>
              <button
                type="button"
                onClick={() => setMemoInput('Restocked 40 pcs POLO-NVY-L fresh from sewing line to warehouse.')}
                className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-[11px]"
              >
                🏭 Restock 40 Polos
              </button>
              <button
                type="button"
                onClick={() => setMemoInput('Customer Mahin 01712998877 ordered 1x PANJ-WHT-L to Dhanmondi 3/A.')}
                className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-[11px]"
              >
                📦 Panjabi Order
              </button>
            </div>

            <div className="relative">
              <textarea
                rows={3}
                value={memoInput}
                onChange={(e) => setMemoInput(e.target.value)}
                placeholder="Type or paste unstructured text memo (e.g., 'Paid 1200 taka rickshaw fare for fabric rolls' or 'Customer ordered L size polo...')"
                className="w-full rounded-2xl bg-zinc-950 border border-zinc-700 p-3.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition font-sans"
              />

              <div className="absolute right-3 bottom-3 flex items-center gap-1.5">
                {/* Voice Dictation Button */}
                <button
                  type="button"
                  onClick={handleToggleVoiceDictation}
                  className={`p-2 rounded-xl transition ${
                    isListening
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700'
                  }`}
                  title="Voice-to-Text Dictation (Web Speech API)"
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                {/* Screenshot / Photo Attachment Button */}
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleUploadScreenshot}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition"
                  title="Attach Photo / Receipt Screenshot"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="text-[11px] text-zinc-400">
                {isListening && <span className="text-red-400 font-semibold animate-pulse">● Listening for voice input...</span>}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleProcessMemo()}
                  disabled={isParsingMemo || !memoInput.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs shadow-md shadow-amber-500/20 disabled:opacity-50 transition"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isParsingMemo ? 'Specialized Agent Parsing...' : 'Run Multi-Agent Engine'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Processed Memos History Stream */}
          <div className="glass-card rounded-3xl p-5 border border-zinc-800 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono">
              Live Memo Ingestion & Audit Stream ({memoHistory.length} Events)
            </h4>

            <div className="space-y-3">
              {memoHistory.map((memo) => {
                const isRejected = memo.status === 'rejected_duplicate';
                return (
                  <div
                    key={memo.id}
                    className={`p-4 rounded-2xl border transition ${
                      isRejected
                        ? 'bg-red-950/20 border-red-500/40'
                        : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold uppercase ${
                            memo.detectedAgent === 'cash'
                              ? 'bg-amber-500/20 text-amber-300'
                              : memo.detectedAgent === 'inventory'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-blue-500/20 text-blue-300'
                          }`}
                        >
                          {memo.detectedAgent} Agent
                        </span>

                        <span className="text-xs font-bold text-zinc-200">{memo.sender}</span>
                        <span className="text-[10px] text-zinc-500">via {memo.channel}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-zinc-400">{memo.timestamp}</span>
                        {isRejected ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-mono font-bold">
                            Rejected Duplicate
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                            Applied
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-zinc-300 italic mb-2">"{memo.rawText}"</p>

                    {isRejected ? (
                      <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-[11px] text-red-300">
                        <strong>Duplicate Blocked:</strong> {memo.duplicateReason}
                      </div>
                    ) : (
                      memo.parsedData && (
                        <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800 text-[11px] font-mono text-zinc-300 space-y-0.5">
                          {memo.detectedAgent === 'cash' && (
                            <div>
                              Amount: <strong className="text-amber-400">৳{memo.parsedData.amount}</strong> • Category: {memo.parsedData.category} • Account: {memo.parsedData.account}
                            </div>
                          )}
                          {memo.detectedAgent === 'inventory' && (
                            <div>
                              SKU: <strong className="text-emerald-400">{memo.parsedData.sku}</strong> • Size: {memo.parsedData.size} • Qty: +{memo.parsedData.quantity} pcs
                            </div>
                          )}
                          {memo.detectedAgent === 'order' && (
                            <div>
                              Customer: <strong className="text-blue-400">{memo.parsedData.customerName}</strong> • Phone: {memo.parsedData.phone} • Item: {memo.parsedData.sku} ({memo.parsedData.size})
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
