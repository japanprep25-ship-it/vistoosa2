import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  ShoppingBag,
  CheckCircle2,
  Sparkles,
  User,
  Phone,
  MapPin,
  RefreshCw,
  ArrowRight,
  Send,
  Building2,
  Search,
  Plus,
  Clock,
  Check,
  CheckCheck,
  ExternalLink,
  ShieldCheck,
  Bot,
  SlidersHorizontal,
  ChevronLeft,
} from 'lucide-react';
import { Order, Product, OrderChannel } from '../types';
import { detectDistrict } from '../utils/districtDetector';

interface SocialMediaInboxViewProps {
  products: Product[];
  onCreateOrder: (order: Order) => void;
}

export interface ConversationItem {
  psid: string;
  senderId: string;
  senderName?: string;
  channel: 'messenger' | 'instagram' | 'whatsapp' | 'Facebook' | 'Instagram' | 'WhatsApp';
  lastMessage: string;
  lastMessageSender?: 'customer' | 'bot' | 'agent' | 'user';
  lastUpdated: string;
  messageCount: number;
  unreadCount?: number;
}

export interface ChatMessage {
  sender: 'customer' | 'bot' | 'agent' | 'user';
  text: string;
  timestamp: string;
  attachmentUrl?: string;
}

const QUICK_REPLIES = [
  'আসসালামু আলাইকুম! Vistoosa-তে আপনাকে স্বাগতম। আমরা কীভাবে আপনাকে সাহায্য করতে পারি?',
  'জি আমাদের ক্যাশ অন ডেলিভারি (Cash on Delivery) সুবিধা সারা বাংলাদেশে চালু রয়েছে।',
  'আপনার সঠিক সাইজ, ফোন নম্বর ও পূর্ণ ডেলিভারি ঠিকানা দিলে আমরা এখনই অর্ডার কনফার্ম করে দিচ্ছি।',
  'আমাদের ডেলিভারি চার্জ: ঢাকার ভেতরে ৳৬০, সাব-ঢাকা ৳১০০, ঢাকার বাইরে ৳১৫০। ডেলিভারি সময় ৪৮-৭২ ঘণ্টা।',
  'আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে! আমরা কুরিয়ারে হ্যান্ডওভার করে ট্র্যাকিং লিঙ্ক পাঠিয়ে দেব।',
];

export const SocialMediaInboxView: React.FC<SocialMediaInboxViewProps> = ({
  products,
  onCreateOrder,
}) => {
  // Conversation list & active chat state
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedPsid, setSelectedPsid] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<ChatMessage[]>([]);
  const [activeCustomerName, setActiveCustomerName] = useState<string>('');
  const [activeChannel, setActiveChannel] = useState<'messenger' | 'instagram' | 'whatsapp'>('messenger');

  const [isLoadingConversations, setIsLoadingConversations] = useState<boolean>(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [messageInput, setMessageInput] = useState<string>('');

  // Filtering & search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [channelFilter, setChannelFilter] = useState<'all' | 'messenger' | 'instagram' | 'whatsapp'>('all');
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState<boolean>(true);

  // Modals & Banners
  const [isSortingModalOpen, setIsSortingModalOpen] = useState<boolean>(false);
  const [isSimulateModalOpen, setIsSimulateModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Simulate Message Form State
  const [simName, setSimName] = useState('Rahim Chowdhury');
  const [simChannel, setSimChannel] = useState<'messenger' | 'instagram' | 'whatsapp'>('messenger');
  const [simText, setSimText] = useState('Navy blue polo shirt XL size ekta lagbe. Phone 01819223344, Banani, Dhaka.');

  // Order Conversion Form State
  const [extractedCustomerName, setExtractedCustomerName] = useState('');
  const [extractedPhone, setExtractedPhone] = useState('');
  const [extractedAddress, setExtractedAddress] = useState('');
  const [extractedDistrict, setExtractedDistrict] = useState('Dhaka');
  const [extractedChannel, setExtractedChannel] = useState<OrderChannel>('Facebook');
  const [extractedItems, setExtractedItems] = useState<
    Array<{ productName: string; size: string; quantity: number; unitPrice: number; color: string }>
  >([]);
  const [extractedDeliveryFee, setExtractedDeliveryFee] = useState(60);
  const [extractedPaymentMethod, setExtractedPaymentMethod] = useState<'Cash on Delivery' | 'bKash' | 'Nagad' | 'Prepaid'>('Cash on Delivery');

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Scroll to bottom of message thread internally without scrolling window
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeMessages]);

  // 1. Fetch conversations from GET /api/conversations
  const fetchConversations = async (silent = false) => {
    if (!silent) setIsLoadingConversations(true);
    try {
      const res = await fetch('/api/conversations');
      const data = await res.json();
      if (data && data.success && Array.isArray(data.conversations)) {
        setConversations(data.conversations);
        // If nothing is selected yet, automatically select the first conversation
        if (!selectedPsid && data.conversations.length > 0) {
          setSelectedPsid(data.conversations[0].psid);
        }
      }
    } catch (err) {
      console.warn('[Social Inbox]: Could not fetch conversations:', err);
    } finally {
      if (!silent) setIsLoadingConversations(false);
    }
  };

  // 2. Fetch specific customer chat history from GET /api/messages/:psid
  const fetchChatMessages = async (psid: string, silent = false) => {
    if (!silent) setIsLoadingMessages(true);
    try {
      const res = await fetch(`/api/messages/${encodeURIComponent(psid)}`);
      const data = await res.json();
      if (data && data.success && Array.isArray(data.messages)) {
        setActiveMessages(data.messages);
        setActiveCustomerName(data.senderName || `Customer #${psid.slice(-4)}`);
        setActiveChannel(data.channel || 'messenger');
      }
    } catch (err) {
      console.warn(`[Social Inbox]: Could not fetch messages for ${psid}:`, err);
    } finally {
      if (!silent) setIsLoadingMessages(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchConversations();
  }, []);

  // Check if a specific target order was requested from Order Engine
  useEffect(() => {
    const rawTarget = localStorage.getItem('vistoosa_target_order');
    if (rawTarget) {
      try {
        const target = JSON.parse(rawTarget);
        localStorage.removeItem('vistoosa_target_order');
        if (target) {
          const phoneDigits = target.phone ? target.phone.replace(/\D/g, '') : '';
          const targetPsid = target.senderId || (phoneDigits ? `psid_${phoneDigits}` : `psid_${target.id}`);
          setTimeout(() => {
            setActiveCustomerName(target.customerName || 'Customer');
            setActiveChannel(
              target.channel?.toLowerCase() === 'instagram' || target.source === 'instagram'
                ? 'instagram'
                : target.channel?.toLowerCase() === 'whatsapp' || target.source === 'whatsapp'
                ? 'whatsapp'
                : 'messenger'
            );
            // Ensure selectedPsid matches the conversationId if provided, or the derived targetPsid
            setSelectedPsid(target.conversationId || targetPsid);
          }, 250);
        }
      } catch (e) {
        console.warn('Failed to parse target order from localStorage', e);
      }
    }
  }, []);

  // Poll conversations & active chat every 4 seconds for real-time responsiveness
  useEffect(() => {
    if (!autoRefreshEnabled) return;
    const interval = setInterval(() => {
      fetchConversations(true);
      if (selectedPsid) {
        fetchChatMessages(selectedPsid, true);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [autoRefreshEnabled, selectedPsid]);

  // When selected conversation changes, load its messages
  useEffect(() => {
    if (selectedPsid) {
      fetchChatMessages(selectedPsid);
      chatInputRef.current?.focus();
    }
  }, [selectedPsid]);

  // 3. Send message via POST /api/messages/send (Meta Graph API)
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : messageInput).trim();
    if (!text || !selectedPsid || isSending) return;

    setIsSending(true);
    setMessageInput('');

    // Optimistic UI update
    const optimisticMessage: ChatMessage = {
      sender: 'bot',
      text,
      timestamp: new Date().toISOString(),
    };
    setActiveMessages((prev) => [...prev, optimisticMessage]);

    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_psid: selectedPsid,
          message_text: text,
          channel: activeChannel,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send message via Meta Graph API');
      }

      // Refresh list to update snippet
      fetchConversations(true);
      if (data.simulated) {
        showToast('Message sent in simulation sandbox (Page Access Token not connected).', 'success');
      }
    } catch (err: any) {
      console.error('[Send Message Error]:', err);
      showToast(err.message || 'Error delivering message to Meta Graph API.', 'error');
    } finally {
      setIsSending(false);
      chatInputRef.current?.focus();
    }
  };

  // 4. Simulate inbound customer message
  const handleSimulateInbound = async () => {
    if (!simText.trim()) return;
    try {
      const res = await fetch('/api/meta/simulate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: simChannel,
          senderName: simName.trim() || 'Simulated Customer',
          text: simText.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Inbound customer message simulated! Incoming chat received.', 'success');
        setIsSimulateModalOpen(false);
        await fetchConversations();
        if (data.senderId) {
          setSelectedPsid(data.senderId);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Simulation error', 'error');
    }
  };

  // 5. Open Convert to Order Modal
  const handleOpenConvertModal = () => {
    if (!selectedPsid) return;
    const fullTranscript = activeMessages.map((m) => m.text).join('\n');

    const inferredName = activeCustomerName || 'Social Customer';
    const phoneMatch = fullTranscript.match(/(?:\+?88\s*)?(01[3-9]\d{8})\b/);
    const inferredPhone = phoneMatch ? phoneMatch[1] : '';

    const addressMatch = fullTranscript.match(/(?:address|thikana|House|Road|Sector|Dhanmondi|Gulshan|Banani|Uttara|Mirpur|Mohammadpur|Badda|Chittagong|Sylhet|Rajshahi|Khulna)[^\n]*/i);
    const inferredAddress = addressMatch ? addressMatch[0].replace(/^(address|thikana)\s*[:=-]?\s*/i, '').trim() : '';

    const distDet = detectDistrict(inferredAddress, 'Dhaka');
    const inferredDistrict = distDet.district || 'Dhaka';

    const defaultProd = products[0] || { name: 'Supima Cotton Pique Polo', retailPrice: 1650, color: 'Midnight Navy' };

    setExtractedCustomerName(inferredName);
    setExtractedPhone(inferredPhone);
    setExtractedAddress(inferredAddress);
    setExtractedDistrict(inferredDistrict);
    setExtractedChannel(
      activeChannel === 'instagram' ? 'Instagram' : activeChannel === 'whatsapp' ? 'WhatsApp' : 'Facebook'
    );
    setExtractedItems([
      {
        productName: defaultProd.name,
        size: fullTranscript.toLowerCase().includes(' xl ') || fullTranscript.toLowerCase().includes('size xl') ? 'XL' : 'L',
        quantity: 1,
        unitPrice: defaultProd.retailPrice || 1650,
        color: defaultProd.color || 'Midnight Navy',
      },
    ]);
    setExtractedDeliveryFee(inferredDistrict === 'Dhaka' ? 60 : 150);
    setExtractedPaymentMethod('Cash on Delivery');
    setIsSortingModalOpen(true);
  };

  const handleConfirmOrder = () => {
    if (!extractedCustomerName.trim() || !extractedPhone.trim() || !extractedAddress.trim()) {
      alert('গ্রাহকের নাম, ফোন এবং সম্পূর্ণ ডেলিভারি ঠিকানা প্রদান করা বাধ্যতামূলক।');
      return;
    }

    const orderId = `VIS-SOC-${Math.floor(100000 + Math.random() * 900000)}`;
    const itemsSubtotal = extractedItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const totalAmount = itemsSubtotal + extractedDeliveryFee;
    const cityZone =
      extractedDistrict === 'Dhaka' ? 'Inside Dhaka' : extractedDistrict === 'Gazipur' || extractedDistrict === 'Narayanganj' ? 'Sub-Dhaka' : 'Outside Dhaka';

    const newOrder: Order = {
      id: orderId,
      customerName: extractedCustomerName.trim(),
      phone: extractedPhone.trim(),
      address: extractedAddress.trim(),
      district: extractedDistrict,
      city: cityZone,
      channel: extractedChannel,
      source: extractedChannel === 'Instagram' ? 'instagram' : 'messenger',
      items: extractedItems.map((it, idx) => ({
        id: `item-soc-${Date.now()}-${idx}`,
        productName: it.productName,
        sku: `POLO-SOC-${idx + 1}`,
        color: it.color,
        size: it.size as any,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      })),
      totalAmount,
      deliveryFee: extractedDeliveryFee,
      paymentMethod: extractedPaymentMethod,
      status: 'Pending',
      createdAt: new Date().toISOString(),
      notes: `Captured via In-App Chat Inbox (${extractedChannel}) - PSID: ${selectedPsid}`,
      confidence: 'complete',
    };

    onCreateOrder(newOrder);
    setIsSortingModalOpen(false);
    showToast(`Order #${orderId} created successfully & queued into Pending Orders!`, 'success');
  };

  // Filter conversations based on query and channel
  const filteredConversations = conversations.filter((c) => {
    const matchesSearch =
      !searchQuery ||
      (c.senderName && c.senderName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.lastMessage && c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())) ||
      c.psid.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesChannel =
      channelFilter === 'all' ||
      c.channel.toLowerCase() === channelFilter.toLowerCase() ||
      (channelFilter === 'messenger' && c.channel.toLowerCase() === 'facebook');

    return matchesSearch && matchesChannel;
  });

  const selectedConv = conversations.find((c) => c.psid === selectedPsid);

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-10 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-2xl border text-xs font-bold flex items-center gap-2.5 shadow-2xl transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200 shadow-emerald-950/40'
              : 'bg-rose-950/90 border-rose-500/50 text-rose-200 shadow-rose-950/40'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Banner / Controls Bar */}
      <div className="glass-panel rounded-3xl p-4 sm:p-5 border border-zinc-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-900/30">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span>Customer In-App Live Inbox</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono border border-purple-500/30 uppercase tracking-wider">
                Meta Graph API v19.0
              </span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Facebook Messenger, Instagram DM & WhatsApp গ্রাহকদের সাথে সরাসরি লাইভ চ্যাট করুন।
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setAutoRefreshEnabled((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              autoRefreshEnabled
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400'
            }`}
            title="Toggle live 4-second message polling"
          >
            <span className={`w-2 h-2 rounded-full ${autoRefreshEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
            <span>{autoRefreshEnabled ? 'Live Polling ON' : 'Polling Paused'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              fetchConversations();
              if (selectedPsid) fetchChatMessages(selectedPsid);
            }}
            disabled={isLoadingConversations}
            className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-purple-400 ${isLoadingConversations ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSimulateModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition shadow-md shadow-purple-900/30 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Simulate Customer Chat</span>
          </button>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[720px] max-h-[calc(100vh-190px)] min-h-[580px]">
        {/* ===================================================================
            COLUMN 1: Conversation List (Left, 4 or 5 columns on desktop)
            =================================================================== */}
        <div className={`lg:col-span-4 xl:col-span-4 glass-panel rounded-3xl border border-zinc-800/80 flex-col overflow-hidden shadow-xl ${selectedPsid ? 'hidden lg:flex' : 'flex'}`}>
          {/* List Header: Search & Channel Tabs */}
          <div className="p-3.5 border-b border-zinc-800 space-y-2.5 shrink-0 bg-zinc-950/40">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search customers or messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900/90 border border-zinc-800/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-zinc-500 hover:text-zinc-300 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Channel Tabs */}
            <div className="flex items-center gap-1 bg-zinc-900/60 p-1 rounded-xl border border-zinc-800/80 text-[11px] font-bold">
              {(['all', 'messenger', 'instagram', 'whatsapp'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setChannelFilter(tab)}
                  className={`flex-1 py-1 rounded-lg text-center transition capitalize cursor-pointer ${
                    channelFilter === tab
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                  }`}
                >
                  {tab === 'all' ? 'All' : tab}
                </button>
              ))}
            </div>
          </div>

          {/* Conversations Scrollable List */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/40 divide-solid">
            {filteredConversations.length === 0 ? (
              <div className="py-16 px-4 text-center text-zinc-500 space-y-2">
                <MessageSquare className="w-8 h-8 text-zinc-600 mx-auto" />
                <p className="text-xs font-semibold text-zinc-400">No conversations found</p>
                <p className="text-[11px] text-zinc-600 max-w-xs mx-auto">
                  Try clearing search filters or click 'Simulate Customer Chat' above to test.
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = conv.psid === selectedPsid;
                const channelName = conv.channel.toLowerCase();
                const channelColor =
                  channelName === 'instagram'
                    ? 'bg-pink-500/20 text-pink-300 border-pink-500/30'
                    : channelName === 'whatsapp'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-blue-500/20 text-blue-300 border-blue-500/30';

                return (
                  <div
                    key={conv.psid}
                    onClick={() => setSelectedPsid(conv.psid)}
                    className={`p-3.5 transition-all cursor-pointer flex items-start gap-3 relative ${
                      isSelected
                        ? 'bg-purple-500/15 border-l-4 border-l-purple-500'
                        : 'hover:bg-zinc-900/60'
                    }`}
                  >
                    {/* Avatar with Channel Badge */}
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-sm text-purple-300 uppercase shadow-inner">
                        {conv.senderName ? conv.senderName.charAt(0) : 'C'}
                      </div>
                      <span
                        className={`absolute -bottom-1 -right-1 text-[9px] px-1 py-0.2 rounded-md font-bold uppercase border ${channelColor}`}
                      >
                        {conv.channel.slice(0, 2)}
                      </span>
                    </div>

                    {/* Content Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <h4 className="text-xs font-bold text-white truncate">
                          {conv.senderName || `Customer #${conv.psid.slice(-4)}`}
                        </h4>
                        <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                          {new Date(conv.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <p className="text-[11px] text-zinc-400 line-clamp-1 font-normal">
                        {conv.lastMessageSender === 'bot' || conv.lastMessageSender === 'agent' ? (
                          <span className="text-purple-400 font-semibold mr-1">You:</span>
                        ) : null}
                        {conv.lastMessage || 'Sent attachment'}
                      </p>

                      <div className="flex items-center justify-between mt-1 pt-1">
                        <span className="text-[9px] text-zinc-500 font-mono">
                          PSID: {conv.psid.length > 14 ? `${conv.psid.slice(0, 12)}...` : conv.psid}
                        </span>
                        {conv.unreadCount && conv.unreadCount > 0 ? (
                          <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* List Footer Info */}
          <div className="p-2.5 px-3.5 border-t border-zinc-800/80 bg-zinc-950/60 text-[10px] text-zinc-500 font-mono flex items-center justify-between shrink-0">
            <span>{filteredConversations.length} conversation threads</span>
            <span className="text-purple-400">Synced with Meta</span>
          </div>
        </div>

        {/* ===================================================================
            COLUMN 2: Active Chat Window (Right, 8 columns on desktop)
            =================================================================== */}
        <div className={`lg:col-span-8 xl:col-span-8 glass-panel rounded-3xl border border-zinc-800/80 flex-col overflow-hidden shadow-xl relative bg-zinc-950/40 ${!selectedPsid ? 'hidden lg:flex' : 'flex'}`}>
          {selectedConv ? (
            <>
              {/* Chat Window Header */}
              <div className="p-3.5 px-5 border-b border-zinc-800/80 flex items-center justify-between gap-3 bg-zinc-950/80 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setSelectedPsid(null)}
                    className="lg:hidden p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 transition shrink-0 cursor-pointer"
                    title="Back to conversations"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-700 to-indigo-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-md">
                    {activeCustomerName ? activeCustomerName.charAt(0) : 'C'}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white truncate flex items-center gap-2">
                      <span>{activeCustomerName || `Customer #${selectedPsid}`}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                        Active
                      </span>
                    </h3>
                    <p className="text-[10px] text-zinc-400 font-mono mt-0.5 flex items-center gap-2">
                      <span>Channel: <strong className="text-purple-300 capitalize">{activeChannel}</strong></span>
                      <span>•</span>
                      <span>PSID: {selectedPsid}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleOpenConvertModal}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition shadow-md shadow-emerald-950/40 active:scale-95 cursor-pointer"
                    title="Extract customer information and convert to an order in Pending Orders"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span className="hidden sm:inline">Convert to Order</span>
                    <span className="sm:hidden">Order</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => selectedPsid && fetchChatMessages(selectedPsid)}
                    className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
                    title="Reload message thread"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoadingMessages ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Chat Thread Messages Display */}
              <div key={selectedPsid || 'default'} ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
                {isLoadingMessages && activeMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <RefreshCw className="w-6 h-6 text-purple-400 animate-spin" />
                  </div>
                ) : activeMessages.length === 0 ? (
                  <div className="text-center py-20 text-zinc-500 space-y-2">
                    <MessageSquare className="w-10 h-10 text-zinc-700 mx-auto" />
                    <p className="text-xs">No messages in this conversation yet.</p>
                    <p className="text-[11px] text-zinc-600">Send a greeting below to initiate the chat!</p>
                  </div>
                ) : (
                  activeMessages.map((msg, idx) => {
                    const isOutgoing = msg.sender === 'bot' || msg.sender === 'agent' || msg.sender === 'user';
                    return (
                      <div
                        key={idx}
                        className={`flex flex-col ${isOutgoing ? 'items-end' : 'items-start'} space-y-1`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-md ${
                            isOutgoing
                              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-br-none'
                              : 'bg-zinc-800/90 text-zinc-100 border border-zinc-700/60 rounded-bl-none'
                          }`}
                        >
                          {/* Image Attachment Preview */}
                          {msg.attachmentUrl && (
                            <div className="mb-2 rounded-xl overflow-hidden border border-white/10 max-w-xs">
                              <img
                                src={msg.attachmentUrl}
                                alt="Attachment"
                                className="w-full h-auto object-cover max-h-48"
                              />
                            </div>
                          )}

                          <p className="whitespace-pre-wrap select-text">{msg.text}</p>
                        </div>

                        {/* Timestamp & Delivery Indicator */}
                        <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono px-1">
                          <span>
                            {msg.timestamp
                              ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : 'Just now'}
                          </span>
                          {isOutgoing && <CheckCheck className="w-3 h-3 text-purple-400" />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Quick Reply Template Chips */}
              <div className="px-4 py-2 border-t border-zinc-850 bg-zinc-950/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                <span className="text-[10px] text-zinc-500 uppercase font-mono font-bold shrink-0 mr-1">
                  Quick Replies:
                </span>
                {QUICK_REPLIES.map((reply, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setMessageInput(reply)}
                    className="shrink-0 text-[11px] px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-purple-900/40 border border-zinc-800 hover:border-purple-500/40 text-zinc-300 hover:text-purple-200 transition cursor-pointer max-w-[200px] truncate"
                    title={reply}
                  >
                    {reply}
                  </button>
                ))}
              </div>

              {/* Message Input & Send Bar */}
              <div className="p-3 sm:p-4 border-t border-zinc-800 bg-zinc-950 shrink-0">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    ref={chatInputRef}
                    type="text"
                    placeholder={`Reply to ${activeCustomerName || 'customer'} on Messenger... (Press Enter to send)`}
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    disabled={isSending}
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition"
                  />
                  <button
                    type="submit"
                    disabled={isSending || !messageInput.trim()}
                    className="px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-900/40 transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSending ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Send</span>
                        <Send className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </form>
                <p className="text-[10px] text-zinc-500 mt-2 flex items-center justify-between font-mono">
                  <span>Delivered via Meta Graph API (me/messages) to Customer PSID</span>
                  <span className="text-emerald-400">● Real-time synced</span>
                </p>
              </div>
            </>
          ) : (
            /* Empty State: No conversation selected */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shadow-lg">
                <MessageSquare className="w-8 h-8" />
              </div>
              <div className="max-w-md space-y-1.5">
                <h3 className="text-base font-bold text-white">Select a customer conversation</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Choose a customer thread from the left column to view message bubbles and reply directly via Facebook Messenger, Instagram, or WhatsApp.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSimulateModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Simulate Sample Customer Chat</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================
          MODAL 1: Convert to Order Review & Confirmation Modal
          =================================================================== */}
      {isSortingModalOpen && (
        <div className="fixed inset-0 z-50 bg-zinc-950/95 backdrop-blur-xl flex flex-col p-3 sm:p-6 animate-in fade-in duration-200 overflow-hidden">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-4xl mx-auto h-full rounded-3xl p-5 sm:p-7 shadow-2xl flex flex-col overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Convert Social Chat into Unified Order</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-xs font-bold">
                      Pending Queue
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    মেসেঞ্জার চ্যাট থেকে প্রাপ্ত কাস্টমারের তথ্য ও প্রোডাক্ট সাইজ যাচাই করে অর্ডার কনফার্ম করুন।
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsSortingModalOpen(false)}
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition text-sm font-bold cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            {/* Modal Form */}
            <div className="space-y-4 py-4 flex-1 text-xs">
              {/* Customer Details */}
              <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800 space-y-3">
                <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2 pb-1 border-b border-zinc-800">
                  <User className="w-4 h-4 text-purple-400" />
                  <span>Customer Details</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium">Customer Name</label>
                    <input
                      type="text"
                      value={extractedCustomerName}
                      onChange={(e) => setExtractedCustomerName(e.target.value)}
                      className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2 text-white font-semibold focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium">Phone Number</label>
                    <input
                      type="text"
                      value={extractedPhone}
                      onChange={(e) => setExtractedPhone(e.target.value)}
                      className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2 text-purple-300 font-mono font-bold focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium">Sales Channel</label>
                    <select
                      value={extractedChannel}
                      onChange={(e) => setExtractedChannel(e.target.value as OrderChannel)}
                      className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2 text-white font-semibold focus:outline-none focus:border-purple-500 cursor-pointer"
                    >
                      <option value="Facebook">Facebook Messenger</option>
                      <option value="Instagram">Instagram DM</option>
                      <option value="WhatsApp">WhatsApp Business</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium">Delivery Address</label>
                    <textarea
                      rows={2}
                      value={extractedAddress}
                      onChange={(e) => {
                        setExtractedAddress(e.target.value);
                        const det = detectDistrict(e.target.value, '');
                        if (det.district) setExtractedDistrict(det.district);
                      }}
                      className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2 text-white font-medium focus:outline-none focus:border-purple-500 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium">District</label>
                    <input
                      type="text"
                      value={extractedDistrict}
                      onChange={(e) => setExtractedDistrict(e.target.value)}
                      className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2 text-amber-300 font-bold focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-zinc-800">
                  <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-purple-400" />
                    <span>Ordered Items</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setExtractedItems([
                        ...extractedItems,
                        { productName: products[0]?.name || 'Polo Shirt', size: 'L', quantity: 1, unitPrice: products[0]?.retailPrice || 1650, color: 'Midnight Navy' },
                      ]);
                    }}
                    className="flex items-center gap-1 px-3 py-1 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    Add Item
                  </button>
                </div>

                {extractedItems.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                    <div className="md:col-span-5">
                      <label className="block text-[10px] text-zinc-500 mb-1">Product</label>
                      <input
                        type="text"
                        value={item.productName}
                        onChange={(e) => {
                          const next = [...extractedItems];
                          next[idx].productName = e.target.value;
                          setExtractedItems(next);
                        }}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-white font-semibold"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[10px] text-zinc-500 mb-1">Size</label>
                      <select
                        value={item.size}
                        onChange={(e) => {
                          const next = [...extractedItems];
                          next[idx].size = e.target.value;
                          setExtractedItems(next);
                        }}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-2 py-1.5 text-amber-400 font-bold"
                      >
                        <option value="S">S</option>
                        <option value="M">M</option>
                        <option value="L">L</option>
                        <option value="XL">XL</option>
                        <option value="XXL">XXL</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[10px] text-zinc-500 mb-1">Qty</label>
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => {
                          const next = [...extractedItems];
                          next[idx].quantity = Math.max(1, parseInt(e.target.value, 10) || 1);
                          setExtractedItems(next);
                        }}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-2 py-1.5 text-white text-center font-bold"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-[10px] text-zinc-500 mb-1">Price (৳)</label>
                      <input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) => {
                          const next = [...extractedItems];
                          next[idx].unitPrice = parseInt(e.target.value, 10) || 0;
                          setExtractedItems(next);
                        }}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-emerald-400 font-mono font-bold"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Total Summary */}
              <div className="p-4 rounded-2xl bg-zinc-900/80 border border-purple-500/30 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase font-mono">Payable Total</span>
                  <div className="text-lg font-bold text-purple-400 font-mono">
                    ৳{(extractedItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0) + extractedDeliveryFee).toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSortingModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmOrder}
                    className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs shadow-lg shadow-emerald-500/20"
                  >
                    Confirm Order
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL 2: Simulate Customer Chat (Testing Sandbox)
          =================================================================== */}
      {isSimulateModalOpen && (
        <div className="fixed inset-0 z-50 bg-zinc-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-purple-400" />
                Simulate Inbound Customer Chat
              </h3>
              <button
                type="button"
                onClick={() => setIsSimulateModalOpen(false)}
                className="text-zinc-500 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1">Customer Name</label>
                <input
                  type="text"
                  value={simName}
                  onChange={(e) => setSimName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Channel</label>
                <select
                  value={simChannel}
                  onChange={(e) => setSimChannel(e.target.value as any)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                >
                  <option value="messenger">Facebook Messenger</option>
                  <option value="instagram">Instagram DM</option>
                  <option value="whatsapp">WhatsApp Business</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Incoming Message Text</label>
                <textarea
                  rows={3}
                  value={simText}
                  onChange={(e) => setSimText(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsSimulateModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-400 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSimulateInbound}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md"
              >
                Send Inbound Message
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
