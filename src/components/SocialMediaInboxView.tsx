import React, { useState, useEffect } from 'react';
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
  Bot,
  ExternalLink,
  Plus,
  Send,
  Building2,
} from 'lucide-react';
import { Order, Product, OrderChannel } from '../types';
import { detectDistrict } from '../utils/districtDetector';

interface SocialMediaInboxViewProps {
  products: Product[];
  onCreateOrder: (order: Order) => void;
}

interface ConversationItem {
  senderId: string;
  senderName?: string;
  channel: 'messenger' | 'instagram' | 'whatsapp' | 'Facebook' | 'Instagram' | 'WhatsApp';
  messageCount: number;
  lastUpdated: string;
  lastMessage: string;
  messages?: Array<{ sender: 'customer' | 'bot'; text: string; attachmentUrl?: string }>;
}

export const SocialMediaInboxView: React.FC<SocialMediaInboxViewProps> = ({
  products,
  onCreateOrder,
}) => {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedConversation, setSelectedConversation] = useState<ConversationItem | null>(null);
  const [isSortingModalOpen, setIsSortingModalOpen] = useState<boolean>(false);
  const [isTrainModalOpen, setIsTrainModalOpen] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant', text: string }>>([
    { role: 'assistant', text: 'আমি আপনার অর্ডার প্রসেসিং সহকারী। আমি কি ভুল করেছি দয়া করে জানাবেন?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'memory'>('chat');

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !selectedConversation) return;
    const newMessages = [...chatMessages, { role: 'user', text: chatInput }];
    setChatMessages(newMessages as any);
    setChatInput('');
    setIsSending(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: newMessages,
          context: `Customer: ${selectedConversation.senderName}, Message: ${selectedConversation.lastMessage}`,
          orderData: {
            customer_info: {
              name: extractedCustomerName,
              phone: extractedPhone,
              address: extractedAddress,
              district: extractedDistrict,
              channel: extractedChannel
            },
            items: extractedItems,
            financials: {
              delivery_charge: extractedDeliveryFee,
              payment_method: extractedPaymentMethod
            }
          }
        }),
      });
      const data = await res.json();
      if (data.response) {
        setChatMessages([...newMessages, { role: 'assistant', text: data.response }] as any);
      }
    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setIsSending(false);
    }
  };

  // Extracted Sorting Form State
  const [extractedCustomerName, setExtractedCustomerName] = useState('');
  const [extractedPhone, setExtractedPhone] = useState('');
  const [extractedAddress, setExtractedAddress] = useState('');
  const [extractedDistrict, setExtractedDistrict] = useState('Dhaka');
  const [extractedChannel, setExtractedChannel] = useState<OrderChannel>('Facebook');
  const [extractedItems, setExtractedItems] = useState<Array<{ productName: string; size: string; quantity: number; unitPrice: number; color: string }>>([]);
  const [extractedDeliveryFee, setExtractedDeliveryFee] = useState(70);
  const [extractedPaymentMethod, setExtractedPaymentMethod] = useState<'Cash on Delivery' | 'bKash' | 'Nagad' | 'Prepaid'>('Cash on Delivery');

  const fetchConversations = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/meta/conversations');
      const data = await res.json();
      if (data.success && Array.isArray(data.conversations)) {
        setConversations(data.conversations);
      }
    } catch (e) {
      // Fallback sample conversation if backend offline
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, []);

  // Handle clicking "Convert to Order"
  const handleOpenConvertModal = (conv: ConversationItem) => {
    setSelectedConversation(conv);

    // Smart extraction/sorting heuristics from lastMessage or messages text
    const sampleText = conv.lastMessage || (conv.messages ? conv.messages.map(m => m.text).join('\n') : '');
    
    // Default parsing extraction
    const inferredName = conv.senderName || 'Social Media Customer';
    const phoneMatch = sampleText.match(/01[0-9]{9}/);
    const inferredPhone = phoneMatch ? phoneMatch[0] : '01712345678';
    
    const addressMatch = sampleText.match(/(address|Uttara|Banani|Gulshan|Mirpur|Dhanmondi|Chattogram|Sylhet|Khulna|Rajshahi|Barishal|Rangpur|Mymensingh|Comilla|Gazipur|Narayanganj)[^\n]*/i);
    const inferredAddress = addressMatch ? addressMatch[0].replace(/address\s*:/i, '').trim() : 'House 1, Road 1, Uttara, Dhaka';
    
    const distDet = detectDistrict(inferredAddress, 'Dhaka');
    const inferredDistrict = distDet.district || 'Dhaka';
    
    const channelMap: Record<string, OrderChannel> = {
      messenger: 'Facebook',
      instagram: 'Instagram',
      whatsapp: 'WhatsApp',
      Facebook: 'Facebook',
      Instagram: 'Instagram',
      WhatsApp: 'WhatsApp',
    };

    setExtractedCustomerName(inferredName);
    setExtractedPhone(inferredPhone);
    setExtractedAddress(inferredAddress);
    setExtractedDistrict(inferredDistrict);
    setExtractedChannel(channelMap[conv.channel] || 'Facebook');
    
    // Default product item from catalog or sample text
    const defaultProd = products[0] || { name: 'Supima Cotton Pique Polo', retailPrice: 1650, color: 'Midnight Navy' };
    setExtractedItems([
      {
        productName: defaultProd.name,
        size: sampleText.toLowerCase().includes(' l ') || sampleText.toLowerCase().includes('large') ? 'L' : 'M',
        quantity: 1,
        unitPrice: defaultProd.retailPrice || 1650,
        color: defaultProd.color || 'Midnight Navy',
      },
    ]);
    
    setExtractedDeliveryFee(inferredDistrict === 'Dhaka' ? 70 : 130);
    setExtractedPaymentMethod('Cash on Delivery');
    setIsSortingModalOpen(true);
  };

  const handleConfirmOrderConversion = () => {
    if (!extractedCustomerName.trim() || !extractedPhone.trim() || !extractedAddress.trim()) {
      alert('দয়া করে গ্রাহকের নাম, ফোন ও ঠিকানা সঠিকভাবে প্রদান করুন।');
      return;
    }

    const orderId = `VIS-SOC-${Math.floor(100000 + Math.random() * 900000)}`;
    const itemsSubtotal = extractedItems.reduce((sum, i) => sum + (i.unitPrice * i.quantity), 0);
    const totalAmount = itemsSubtotal + extractedDeliveryFee;

    const cityZone = extractedDistrict === 'Dhaka' ? 'Inside Dhaka' : (extractedDistrict === 'Gazipur' || extractedDistrict === 'Narayanganj' ? 'Sub-Dhaka' : 'Outside Dhaka');

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
      notes: `Converted from Social Media Inbox (${extractedChannel}) - Sender ID: #${selectedConversation?.senderId || 'chat'}`,
      confidence: 'complete',
    };

    onCreateOrder(newOrder);
    setIsSortingModalOpen(false);
    setSuccessMsg(`✅ সফলভাবে অর্ডার #${orderId} কনফার্ম করা হয়েছে এবং Pending Orders এ জমা হয়েছে!`);
    setTimeout(() => setSuccessMsg(''), 6000);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel rounded-3xl p-6 border border-zinc-800/80">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                <span>Social Media Order Inbox</span>
                <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono text-xs font-bold border border-purple-500/30">
                  {conversations.length} Active Chats
                </span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                মেসেঞ্জার, ইনস্টাগ্রাম ও হোয়াটসঅ্যাপ থেকে আসা অর্ডার মেসেজগুলো এখানে জমা হয়। 'Convert to Order' ক্লিক করে ডেটা সর্ট ও কনফার্ম করলেই Pending এ চলে যাবে।
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchConversations}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-bold transition active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-purple-400 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Inbox</span>
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs font-bold flex items-center justify-between shadow-lg shadow-emerald-950/30 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg('')}
            className="p-1.5 rounded-lg text-emerald-400 hover:text-white hover:bg-emerald-900/40 transition cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Conversations Grid */}
      {conversations.length === 0 ? (
        <div className="text-center py-16 glass-panel rounded-3xl border border-zinc-800/80 space-y-3">
          <Bot className="w-12 h-12 text-purple-400 mx-auto animate-pulse" />
          <h3 className="text-sm font-bold text-white">No active social media conversations yet</h3>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            When customers message your Facebook Page, Instagram DM, or WhatsApp Business, their incoming chats and order requests will appear here instantly.
          </p>
          <button
            onClick={() => {
              // Push mock sample conversation for testing
              setConversations([
                {
                  senderId: '9590639920997614',
                  senderName: 'Rabin',
                  channel: 'messenger',
                  messageCount: 3,
                  lastUpdated: new Date().toISOString(),
                  lastMessage: 'Name: Rabin\nMobile No: 01922442296\nAddress: Joynal market rail line, Uttara, Dhaka-1230\nProducts: zipper polo - sage green (L), Off White (XXL), Khaki (XL)',
                  messages: [
                    { sender: 'customer', text: 'ভাই এইটার দাম কত?' },
                    { sender: 'bot', text: 'আসসালামু আলাইকুম! সুপিমা কটন পলো শার্টের দাম ১,৬৫০ টাকা।' },
                    { sender: 'customer', text: 'Name: Rabin\nMobile No: 01922442296\nAddress: Joynal market rail line, Uttara, Dhaka-1230\nProducts: zipper polo - sage green (L), Off White (XXL), Khaki (XL)\nBill: 2,200 tk' },
                  ],
                },
              ]);
            }}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-md cursor-pointer inline-flex items-center gap-2 mt-2"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Load Sample Demo Customer Chat</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {conversations.map((conv) => (
            <div
              key={conv.senderId}
              className="glass-card rounded-3xl p-5 border border-zinc-800/80 hover:border-purple-500/50 transition flex flex-col justify-between space-y-4 shadow-xl relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-purple-500/10 transition" />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30 uppercase tracking-wider">
                    {conv.channel}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {new Date(conv.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div>
                  <h4 className="text-base font-bold text-white flex items-center gap-2">
                    <User className="w-4 h-4 text-purple-400" />
                    <span>{conv.senderName || `Customer #${conv.senderId.slice(-4)}`}</span>
                  </h4>
                  <p className="text-[11px] text-zinc-400 font-mono mt-0.5">PSID: {conv.senderId}</p>
                </div>

                <div className="p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-300 font-mono line-clamp-3">
                  "{conv.lastMessage || 'No text content'}"
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
                <span className="text-[11px] text-zinc-400 font-medium">
                  {conv.messageCount} messages in thread
                </span>
                <button
                  onClick={() => { setSelectedConversation(conv); setIsTrainModalOpen(true); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-bold transition active:scale-95 cursor-pointer"
                >
                  <Bot className="w-3.5 h-3.5 text-blue-400" />
                  <span>Train AI</span>
                </button>
                <button
                  onClick={() => handleOpenConvertModal(conv)}
                  className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-600/25 active:scale-95 transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Convert to Order</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Data Sorting & Review Modal */}
      {isSortingModalOpen && (
        <div className="fixed inset-0 z-50 bg-zinc-950/95 backdrop-blur-xl flex flex-col p-0 sm:p-4 md:p-6 animate-in fade-in duration-200 overflow-hidden">
          <div className="bg-zinc-950 border border-zinc-800/80 w-full h-full sm:rounded-3xl p-4 sm:p-6 shadow-2xl relative flex flex-col overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    <span>AI Order Data Sorting & Verification</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-xs font-bold">
                      Ready to Confirm
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    চ্যাট মেসেজ থেকে এক্সট্রাক্ট করা ডেটা নিচে সর্ট করা হয়েছে। যাচাই করে 'Confirm & Send to Pending' ক্লিক করুন।
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsSortingModalOpen(false)}
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition cursor-pointer text-sm font-bold"
              >
                ✕ Close
              </button>
            </div>

            {/* Sorting Form Body */}
            <div className="space-y-4 py-4 flex-1 text-xs max-w-4xl mx-auto w-full">
              {/* Channel & Customer Info */}
              <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800/80 space-y-3">
                <div className="flex items-center gap-2 font-bold text-zinc-200 text-xs uppercase tracking-wider pb-1 border-b border-zinc-800">
                  <User className="w-4 h-4 text-purple-400" />
                  <span>Customer Sorted Details</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium">Customer Name (নাম)</label>
                    <input
                      type="text"
                      value={extractedCustomerName}
                      onChange={(e) => setExtractedCustomerName(e.target.value)}
                      className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2 text-white font-semibold focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium">Phone Number (ফোন)</label>
                    <input
                      type="text"
                      value={extractedPhone}
                      onChange={(e) => setExtractedPhone(e.target.value)}
                      className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2 text-purple-300 font-mono font-bold focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium">Channel Source</label>
                    <select
                      value={extractedChannel}
                      onChange={(e) => setExtractedChannel(e.target.value as OrderChannel)}
                      className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2 text-white font-semibold focus:outline-none focus:border-purple-500 cursor-pointer"
                    >
                      <option value="Facebook">Facebook Messenger</option>
                      <option value="Instagram">Instagram DM</option>
                      <option value="WhatsApp">WhatsApp</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium">Delivery Address (ঠিকানা)</label>
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
                    <label className="block text-zinc-400 mb-1 font-medium">District (জেলা)</label>
                    <input
                      type="text"
                      value={extractedDistrict}
                      onChange={(e) => setExtractedDistrict(e.target.value)}
                      className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2 text-amber-300 font-bold focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>

              {/* Sorted Product Items */}
              <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800/80 space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-zinc-800">
                  <div className="flex items-center gap-2 font-bold text-zinc-200 text-xs uppercase tracking-wider">
                    <ShoppingBag className="w-4 h-4 text-purple-400" />
                    <span>Extracted Product Items</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setExtractedItems([...extractedItems, { productName: '', size: 'M', quantity: 1, unitPrice: 0, color: 'Default' }]);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold transition cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    Add Item
                  </button>
                </div>

                <div className="space-y-3">
                  {extractedItems.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                      <div className="md:col-span-5">
                        <label className="block text-[10px] text-zinc-500 mb-1">Product Name</label>
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
                        <label className="block text-[10px] text-zinc-500 mb-1">Color</label>
                        <input
                          type="text"
                          value={item.color}
                          onChange={(e) => {
                            const next = [...extractedItems];
                            next[idx].color = e.target.value;
                            setExtractedItems(next);
                          }}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-white"
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
                      <div className="md:col-span-1">
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
                      <div className="md:col-span-2">
                        <label className="block text-[10px] text-zinc-500 mb-1">Unit Price (৳)</label>
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
              </div>

              {/* Delivery & Financial Summary */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-zinc-900 to-zinc-950 border border-purple-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                    Financial Summary (সর্টেড হিসাব)
                  </span>
                  <div className="text-xs text-zinc-300 font-mono flex items-center gap-3">
                    <span>Subtotal: ৳{extractedItems.reduce((s, i) => s + (i.unitPrice * i.quantity), 0).toLocaleString()}</span>
                    <span>+ Delivery Fee: ৳{extractedDeliveryFee}</span>
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider block">
                    Total Payable Amount
                  </span>
                  <div className="text-xl font-bold text-purple-400 font-mono">
                    ৳{(extractedItems.reduce((s, i) => s + (i.unitPrice * i.quantity), 0) + extractedDeliveryFee).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-zinc-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsSortingModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleConfirmOrderConversion}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 font-bold text-zinc-950 shadow-lg shadow-emerald-500/25 active:scale-95 transition cursor-pointer text-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm & Send to Pending Orders</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Train AI Button */}
      {selectedConversation && (
        <button
          type="button"
          onClick={() => setIsTrainModalOpen(true)}
          className="fixed bottom-8 right-8 z-40 flex items-center gap-2 px-6 py-4 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-2xl shadow-blue-500/30 transition-all hover:scale-105 active:scale-95 cursor-pointer"
        >
          <Bot className="w-5 h-5" />
          <span>Train AI Agent</span>
        </button>
      )}

      {/* Train AI Modal */}
      {isTrainModalOpen && selectedConversation && (
        <div className="fixed inset-0 z-50 bg-zinc-950/95 backdrop-blur-xl flex flex-col p-4 sm:p-6 animate-in fade-in duration-200 overflow-hidden">
          <div className="bg-zinc-950 border border-zinc-800/80 w-full max-w-2xl mx-auto h-full rounded-3xl p-6 shadow-2xl relative flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800 shrink-0">
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <Bot className="w-5 h-5 text-blue-400" />
                Train AI Agent
              </h3>
              <button
                type="button"
                onClick={() => setIsTrainModalOpen(false)}
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition cursor-pointer text-sm font-bold"
              >
                ✕ Close
              </button>
            </div>
            {/* Modal Navigation */}
            <div className="flex items-center gap-4 pb-4 border-b border-zinc-800 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                className={`text-sm font-bold transition ${activeTab === 'chat' ? 'text-white border-b-2 border-blue-500 pb-1' : 'text-zinc-500'}`}
              >
                Chat
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('memory')}
                className={`text-sm font-bold transition ${activeTab === 'memory' ? 'text-white border-b-2 border-blue-500 pb-1' : 'text-zinc-500'}`}
              >
                Learned Rules & Memory
              </button>
            </div>

            {/* Modal Content */}
            {activeTab === 'chat' ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto py-4 space-y-4">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`p-3 rounded-2xl text-xs max-w-[80%] ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-200'}`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="pt-4 border-t border-zinc-800 flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Type your message..."
                    className="flex-1 rounded-xl bg-zinc-900 border border-zinc-700 px-4 py-3 text-white text-xs focus:outline-none"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    disabled={isSending}
                  />
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    className="p-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50"
                    disabled={isSending || !chatInput.trim()}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto py-4 text-zinc-400 text-xs">
                <p>No custom rules learned yet.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
