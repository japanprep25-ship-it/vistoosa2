export interface FAQItem {
  id: string;
  category: 'delivery' | 'payment' | 'size' | 'order' | 'general' | 'custom';
  question: string;
  answer: string;
  active: boolean;
}

export interface TrainedProductItem {
  id: string;
  name: string;
  category: string;
  price: number;
  sizes: string[];
  colors: string[];
  description: string;
  fabricDetails?: string;
  keywords: string[];
  imageUrl?: string;
  active: boolean;
}

export interface OrderCollectionFormatConfig {
  formatTemplate: string;
  requiredFields: string[];
  confirmationMessageTemplate: string;
  followUpPromptTemplate: string;
  defaultPaymentMethod: string;
}

export interface StorePolicyConfig {
  insideDhakaDeliveryFee: number;
  subDhakaDeliveryFee: number;
  outsideDhakaDeliveryFee: number;
  deliveryTimeInsideDhaka: string;
  deliveryTimeOutsideDhaka: string;
  codAvailableAllBangladesh: boolean;
  exchangePolicyDays: number;
  hotlinePhone: string;
  operatingHours: string;
  currentPromoNotice?: string;
}

export interface AIKnowledgeBaseData {
  faqs: FAQItem[];
  products: TrainedProductItem[];
  orderFormat: OrderCollectionFormatConfig;
  policies: StorePolicyConfig;
  customSystemPromptExtra?: string;
  updatedAt: string;
}

// 50 Preloaded Questions directly categorized as requested by the user
export const DEFAULT_FAQS: FAQItem[] = [
  // 1. Delivery & Time (ডেলিভারি ও সময় সংক্রান্ত)
  {
    id: 'faq-del-1',
    category: 'delivery',
    question: 'ডেলিভারি পেতে কত দিন সময় লাগে?',
    answer: 'সাধারণত ঢাকার ভেতরে ৪৮ ঘণ্টা এবং ঢাকার বাইরে ও সাব-ডোমেইনে ৭২ ঘণ্টার মধ্যে ডেলিভারি সম্পন্ন হয়ে থাকে।',
    active: true,
  },
  {
    id: 'faq-del-2',
    category: 'delivery',
    question: 'আপনাদের ডেলিভারি চার্জ কত?',
    answer: 'আমাদের ডেলিভারি চার্জ: ঢাকার ভেতরে ৳৬০, সাব-ঢাকা (সাভার, গাজীপুর, নারায়ণগঞ্জ, কেরানীগঞ্জ) ৳১০০ এবং ঢাকার বাইরে সারা বাংলাদেশে ৳১৫০।',
    active: true,
  },
  {
    id: 'faq-del-3',
    category: 'delivery',
    question: 'আমি কি হোম ডেলিভারি পাবো?',
    answer: 'হ্যাঁ, আমরা সারা বাংলাদেশে হোম ডেলিভারি দিয়ে থাকি।',
    active: true,
  },
  {
    id: 'faq-del-4',
    category: 'delivery',
    question: 'আপনারা কোন কুরিয়ার সার্ভিস ব্যবহার করেন?',
    answer: 'আমরা মূলত পাঠাও কুরিয়ার এবং স্টিডফাস্ট কুরিয়ার সার্ভিসের মাধ্যমে পণ্য ডেলিভারি করে থাকি।',
    active: true,
  },
  {
    id: 'faq-del-5',
    category: 'delivery',
    question: 'অর্ডার করার কতক্ষণ পর আপনারা পার্সেল হ্যান্ডওভার করেন?',
    answer: 'সাধারণত অর্ডার কনফার্ম হওয়ার ২৪ ঘণ্টার মধ্যে পার্সেল কুরিয়ারে হ্যান্ডওভার করে দেওয়া হয়।',
    active: true,
  },
  {
    id: 'faq-del-6',
    category: 'delivery',
    question: 'আমি কি অর্ডারটি নিজে গিয়ে কোনো শোরুম থেকে পিকআপ করতে পারব?',
    answer: 'বর্তমানে আমাদের অনলাইন ভিত্তিক কার্যক্রম পরিচালিত হচ্ছে, তাই আমরা শুধু হোম ডেলিভারি ও কুরিয়ার সার্ভিস সুবিধা দিচ্ছি।',
    active: true,
  },
  {
    id: 'faq-del-7',
    category: 'delivery',
    question: 'জরুরি ভিত্তিতে (Same Day Delivery) পণ্য পাওয়ার কোনো ব্যবস্থা আছে কি?',
    answer: 'বিশেষ অনুরোধে এবং শর্তসাপেক্ষে ঢাকার ভেতরে আর্জেন্ট ডেলিভারির ব্যবস্থা করা সম্ভব, এর জন্য অতিরিক্ত চার্জ প্রযোজ্য হতে পারে।',
    active: true,
  },
  {
    id: 'faq-del-8',
    category: 'delivery',
    question: 'আমার এলাকার কুরিয়ার অফিস থেকে কি পার্সেল কালেক্ট করা যাবে?',
    answer: 'হ্যাঁ, আপনি চাইলে কুরিয়ার অফিস (Branch Pickup) থেকেও আপনার পার্সেল সংগ্রহ করতে পারেন।',
    active: true,
  },
  {
    id: 'faq-del-9',
    category: 'delivery',
    question: 'ছুটির দিনে কি ডেলিভারি হয়?',
    answer: 'সাধারণত শুক্রবার বা সরকারি ছুটির দিনে কুরিয়ার কোম্পানির নিয়ম অনুযায়ী ডেলিভারি বন্ধ থাকে বা পরের কার্যদিবসে সম্পন্ন হয়।',
    active: true,
  },
  {
    id: 'faq-del-10',
    category: 'delivery',
    question: 'ডেলিভারি ম্যান আসার আগে কি কল করা হয়?',
    answer: 'হ্যাঁ, ডেলিভারি ম্যান পার্সেল নিয়ে আপনার ঠিকানায় পৌঁছানোর আগে অবশ্যই আপনাকে ফোন করবেন।',
    active: true,
  },

  // 2. Payment & COD (পেমেন্ট সংক্রান্ত)
  {
    id: 'faq-pay-1',
    category: 'payment',
    question: 'ক্যাশ অন ডেলিভারি (COD) সুবিধা আছে কি?',
    answer: 'হ্যাঁ, আমাদের কাছে সারা বাংলাদেশে ক্যাশ অন ডেলিভারি (পণ্য হাতে পেয়ে মূল্য পরিশোধ) সুবিধা রয়েছে।',
    active: true,
  },
  {
    id: 'faq-pay-2',
    category: 'payment',
    question: 'আপনারা কি কোনো অগ্রিম পেমেন্ট নেন?',
    answer: 'সাধারণত পুরো ক্যাশ অন ডেলিভারিতে কোনো অগ্রিম পেমেন্ট নেওয়া হয় না। তবে ঢাকার বাইরের কিছু দূরবর্তী এলাকার ক্ষেত্রে আংশিক ডেলিভারি চার্জ অগ্রিম নেওয়া হতে পারে।',
    active: true,
  },
  {
    id: 'faq-pay-3',
    category: 'payment',
    question: 'বিকাশ বা নগদের মাধ্যমে পেমেন্ট করা যাবে কি?',
    answer: 'হ্যাঁ, আপনি বিকাশ, নগদ, রকেট অথবা যেকোনো মোবাইল ব্যাংকিং ও কার্ডের মাধ্যমে পেমেন্ট করতে পারবেন।',
    active: true,
  },
  {
    id: 'faq-pay-4',
    category: 'payment',
    question: 'ব্যাংক ট্রান্সফার বা ক্রেডিট কার্ডে পেমেন্ট করা যাবে?',
    answer: 'হ্যাঁ, আমাদের অনলাইন চেকআউট পেজে কার্ড ও ব্যাংক পেমেন্টের অপশন রয়েছে।',
    active: true,
  },
  {
    id: 'faq-pay-5',
    category: 'payment',
    question: 'পেমেন্ট করার পর কোনো সমস্যা হলে কী করব?',
    answer: 'পেমেন্টের ট্রানজ্যাকশন আইডি (TrxID) সহ আমাদের ইনবক্সে মেসেজ করলে আমরা দ্রুত বিষয়টি যাচাই করে দেখব।',
    active: true,
  },
  {
    id: 'faq-pay-6',
    category: 'payment',
    question: 'ইনস্টলমেন্ট বা কিস্তিতে কেনার কোনো সুযোগ আছে কি?',
    answer: 'দুঃখিত, বর্তমানে আমাদের কোনো কিস্তি বা ইনস্টলমেন্ট সুবিধা নেই, সম্পূর্ণ ক্যাশ বা অনলাইন পেমেন্টে কিনতে হবে।',
    active: true,
  },
  {
    id: 'faq-pay-7',
    category: 'payment',
    question: 'ক্যাশ অন ডেলিভারিতে কি অতিরিক্ত কোনো চার্জ কাটে?',
    answer: 'না, ক্যাশ অন ডেলিভারির জন্য কোনো অতিরিক্ত বা লুকায়িত চার্জ নেই, শুধু নির্দিষ্ট পণ্যের দাম ও ডেলিভারি চার্জ প্রযোজ্য।',
    active: true,
  },
  {
    id: 'faq-pay-8',
    category: 'payment',
    question: 'পেমেন্ট করার সময় ভুল নাম্বারে টাকা চলে গেলে করণীয় কী?',
    answer: 'দয়া করে আপনার মোবাইল ব্যাংকিং প্রোভাইডারের সাথে যোগাযোগ করুন, কারণ এটি আমাদের সিস্টেমের আওতাভুক্ত নয়।',
    active: true,
  },
  {
    id: 'faq-pay-9',
    category: 'payment',
    question: 'অগ্রিম পেমেন্ট করলে কি কোনো ডিসকাউন্ট পাওয়া যায়?',
    answer: 'বিশেষ কোনো ক্যাম্পেইন চলাকালীন সময়ে বিকাশ বা অনলাইন পেমেন্টে ডিসকাউন্ট অফার থাকতে পারে।',
    active: true,
  },
  {
    id: 'faq-pay-10',
    category: 'payment',
    question: 'ভ্যাট (VAT) কি দামের সাথে যুক্ত?',
    answer: 'আমাদের প্রোডাক্টের গায়ে বা প্রাইস লিস্টে উল্লিখিত মূল্যের সাথেই সকল প্রযোজ্য ট্যাক্স অন্তর্ভুক্ত থাকে।',
    active: true,
  },

  // 3. Size & Exchange (সাইজ ও এক্সচেঞ্জ সংক্রান্ত)
  {
    id: 'faq-sz-1',
    category: 'size',
    question: 'আমার সাইজ কোনটি হবে কীভাবে বুঝব?',
    answer: 'আমাদের প্রতিটি পণ্যের সাথেই একটি নির্দিষ্ট সাইজ চার্ট (Chest & Length) দেওয়া থাকে। আপনি আপনার উচ্চতা ও ওজন জানালে আমরা সঠিক সাইজ সাজেস্ট করে দেব।',
    active: true,
  },
  {
    id: 'faq-sz-2',
    category: 'size',
    question: 'সাইজ ফিটিং না হলে কি পরিবর্তন (Exchange) করা যাবে?',
    answer: 'হ্যাঁ, সাইজ বা ফিটিংয়ের সমস্যায় পণ্য পাওয়ার ৭ দিনের মধ্যে খুব সহজেই এক্সচেঞ্জ করার সুবিধা রয়েছে।',
    active: true,
  },
  {
    id: 'faq-sz-3',
    category: 'size',
    question: 'সাইজ পরিবর্তনের ক্ষেত্রে কুরিয়ার চার্জ কে বহন করবে?',
    answer: 'সাইজ পরিবর্তনের ক্ষেত্রে কুরিয়ার চার্জ কাস্টমারকে বহন করতে হবে, তবে আমাদের কোনো ভুল থাকলে চার্জ আমরা বহন করব।',
    active: true,
  },
  {
    id: 'faq-sz-4',
    category: 'size',
    question: 'পণ্য ব্যবহারের পর কি এক্সচেঞ্জ করা যাবে?',
    answer: 'না, পণ্য অবশ্যই ট্যাগসহ অক্ষত, অব্যবহৃত এবং পরিষ্কার থাকতে হবে। ব্যবহার করা বা ধোয়া পণ্য এক্সচেঞ্জযোগ্য নয়।',
    active: true,
  },
  {
    id: 'faq-sz-5',
    category: 'size',
    question: 'রিটার্ন বা রিফান্ডের কি কোনো সুযোগ আছে?',
    answer: 'পণ্যে কোনো ত্রুটি বা ড্যামেজ থাকলে আমরা ৭ দিনের মধ্যে রিটার্ন বা রিফান্ড গ্রহণ করে থাকি।',
    active: true,
  },
  {
    id: 'faq-sz-6',
    category: 'size',
    question: 'এক্সচেঞ্জ করতে কত দিন সময় লাগে?',
    answer: 'পার্সেল আমাদের হাতে পৌঁছানোর পর ৩ থেকে ৫ কার্যদিবসের মধ্যে নতুন সাইজ আপনার ঠিকানায় পাঠিয়ে দেওয়া হয়।',
    active: true,
  },
  {
    id: 'faq-sz-7',
    category: 'size',
    question: 'শার্ট বা পলোর কাপড়ের সুতা কি উঠে যায় বা রঙ ওঠে?',
    answer: 'আমাদের প্রিমিয়াম সুপিমা কটন ও ফেব্রিকসে রঙ ওঠার কোনো সম্ভাবনা নেই, এগুলো কালার গ্যারান্টিযুক্ত।',
    active: true,
  },
  {
    id: 'faq-sz-8',
    category: 'size',
    question: 'কাপড় কীভাবে ওয়াশ করতে হবে?',
    answer: 'নরমাল ওয়াশ (Cold wash) এবং উল্টো করে আয়রন করার পরামর্শ দেওয়া হচ্ছে, গরম পানিতে ধোয়া থেকে বিরত থাকুন।',
    active: true,
  },
  {
    id: 'faq-sz-9',
    category: 'size',
    question: 'কাস্টমাইজড বা নিজের মাপে কি কোনো পোশাক তৈরি করে দেওয়া হয়?',
    answer: 'দুঃখিত, বর্তমানে আমাদের শুধুমাত্র রেডিমেড স্টক পণ্যই বিক্রি করা হয়, কাস্টম মাপে তৈরির সুযোগ নেই।',
    active: true,
  },
  {
    id: 'faq-sz-10',
    category: 'size',
    question: 'স্টক শেষ হয়ে গেলে পণ্যটি কবে আবার পাওয়া যাবে?',
    answer: 'জনপ্রিয় পণ্যগুলো সাধারণত ২-৩ সপ্তাহের মধ্যে আবার রি-স্টক করা হয়। আপনি আমাদের পেজে আপডেট পেতে চোখ রাখতে পারেন।',
    active: true,
  },

  // 4. Order & Tracking (অর্ডার ট্র্যাকিং ও ম্যানেজমেন্ট)
  {
    id: 'faq-ord-1',
    category: 'order',
    question: 'আমি অর্ডার করেছি কিন্তু কোনো কনফার্মেশন মেসেজ বা কল পাইনি, কী করব?',
    answer: 'চিন্তা করবেন না! আপনার ফোন নাম্বার ও অর্ডার ডিটেইলস আমাদের ইনবক্সে দিন, আমরা চেক করে এখনই কনফার্ম করে দিচ্ছি।',
    active: true,
  },
  {
    id: 'faq-ord-2',
    category: 'order',
    question: 'অর্ডার করার পর কি তা বাতিল (Cancel) করা যাবে?',
    answer: 'পার্সেল কুরিয়ারে হ্যান্ডওভার করার আগে আপনি যেকোনো সময় অর্ডার বাতিল করতে পারেন।',
    active: true,
  },
  {
    id: 'faq-ord-3',
    category: 'order',
    question: 'আমার অর্ডারের ট্র্যাকিং লিংক কোথায় পাবো?',
    answer: 'অর্ডারটি কুরিয়ারে বুকিং হওয়ার সাথে সাথেই আমরা আপনার ফোনে ট্র্যাকিং লিংক এসএমএস বা ইনবক্সের মাধ্যমে পাঠিয়ে দেব।',
    active: true,
  },
  {
    id: 'faq-ord-4',
    category: 'order',
    question: 'আমি অর্ডার করার পর ঠিকানা বা ফোন নাম্বার পরিবর্তন করতে চাই, উপায় আছে কি?',
    answer: 'পার্সেল পাঠানোর আগে আমাদের ইনবক্সে যোগাযোগ করলে আমরা ঠিকানা ও ফোন নাম্বার আপডেট করে দিতে পারব।',
    active: true,
  },
  {
    id: 'faq-ord-5',
    category: 'order',
    question: 'একই অর্ডারে একাধিক ভিন্ন ভিন্ন পণ্য কি নিতে পারব?',
    answer: 'হ্যাঁ, আপনি কার্টে বা একটি অর্ডারের সাথেই একাধিক পণ্য যোগ করতে পারেন।',
    active: true,
  },
  {
    id: 'faq-ord-6',
    category: 'order',
    question: 'আমার অর্ডারটি এখন কোথায় আছে কীভাবে জানব?',
    answer: 'প্রদত্ত ট্র্যাকিং লিংকে ক্লিক করে অথবা আমাদের কাছে অর্ডার আইডি দিয়ে লাইভ আপডেট জেনে নিতে পারেন।',
    active: true,
  },
  {
    id: 'faq-ord-7',
    category: 'order',
    question: 'ভুল পণ্য ডেলিভারি পেলে কী করব?',
    answer: 'আমাদের ভুলের কারণে ভুল পণ্য পেয়ে থাকলে আমরা সম্পূর্ণ নিজ দায়িত্বে তা দ্রুত পরিবর্তন করে সঠিক পণ্য পৌঁছে দেব।',
    active: true,
  },
  {
    id: 'faq-ord-8',
    category: 'order',
    question: 'পার্সেল ভাঙা বা ড্যামেজ অবস্থায় পেলে কী করব?',
    answer: 'ডেলিভারি ম্যানের সামনেই পার্সেল চেক করে নিন। ড্যামেজ পেলে পার্সেল রিসিভ না করে আমাদের সাথে সাথে কল বা ইনবক্সে জানান।',
    active: true,
  },
  {
    id: 'faq-ord-9',
    category: 'order',
    question: 'উপহার দেওয়ার জন্য কি সুন্দর গিফট র্যাপিং করে পাঠানো সম্ভব?',
    answer: 'হ্যাঁ, অর্ডার করার সময় নোট বা ইনবক্সে জানিয়ে দিলে আমরা বিশেষ উপহারের জন্য গিফট র্যাপ করে দিতে পারি।',
    active: true,
  },
  {
    id: 'faq-ord-10',
    category: 'order',
    question: 'পাইকারি বা হোলসেল রেটে কি পণ্য নেওয়া যাবে?',
    answer: 'পাইকারি ক্রয়ের জন্য আমাদের হটলাইন নাম্বারে বা বিজনেস পেজে আলাদাভাবে যোগাযোগ করতে পারেন।',
    active: true,
  },

  // 5. General & Offers (অফার, ডিসকাউন্ট ও সাধারণ জিজ্ঞাসা)
  {
    id: 'faq-gen-1',
    category: 'general',
    question: 'আপনাদের শোরুম বা ঠিকানা কোথায়?',
    answer: 'আমাদের মূল অফিস ও অনলাইন স্টোর ঢাকায় অবস্থিত। তবে আমাদের কার্যক্রম সম্পূর্ণ অনলাইনভিত্তিক পরিচালিত হয়।',
    active: true,
  },
  {
    id: 'faq-gen-2',
    category: 'general',
    question: 'বর্তমানে কি কোনো ডিসকাউন্ট বা অফার চলছে?',
    answer: 'আমাদের চলমান সকল অফার ও ডিসকাউন্টের আপডেট জানতে আমাদের ফেসবুক পেজের পিন পোস্ট বা স্টোর ভিজিট করতে পারেন।',
    active: true,
  },
  {
    id: 'faq-gen-3',
    category: 'general',
    question: 'নতুন কোনো কালেকশন আসলে কীভাবে জানতে পারব?',
    answer: 'আমাদের পেজে লাইক ও ফলো দিয়ে নোটিফিকেশন অন করে রাখলে নতুন কালেকশন আসার সাথে সাথেই দেখতে পাবেন।',
    active: true,
  },
  {
    id: 'faq-gen-4',
    category: 'general',
    question: 'আপনাদের পণ্যের মান কেমন?',
    answer: 'আমরা শতভাগ প্রিমিয়াম কোয়ালিটি ফেব্রিক ও নিখুঁত ফিনিশিংয়ের গ্যারান্টি দিয়ে আমাদের প্রোডাক্টগুলো তৈরি করি।',
    active: true,
  },
  {
    id: 'faq-gen-5',
    category: 'general',
    question: 'কাস্টমার কেয়ারে কখন কথা বলা যাবে?',
    answer: 'আমাদের কাস্টমার সাপোর্ট টিম প্রতিদিন সকাল ১০টা থেকে রাত ১০টা পর্যন্ত আপনাদের সেবায় নিয়োজিত থাকে।',
    active: true,
  },
  {
    id: 'faq-gen-6',
    category: 'general',
    question: 'হোয়াটসঅ্যাপে কি আপনাদের সাথে যোগাযোগ করা যাবে?',
    answer: 'হ্যাঁ, জরুরি যোগাযোগ বা অর্ডার সংক্রান্ত তথ্যের জন্য আমাদের অফিশিয়াল WhatsApp নাম্বারে মেসেজ করতে পারেন।',
    active: true,
  },
  {
    id: 'faq-gen-7',
    category: 'general',
    question: 'আমি বিদেশে পণ্য পাঠাতে চাই, আপনারা কি ইন্টারন্যাশনাল ডেলিভারি করেন?',
    answer: 'দুঃখিত, বর্তমানে আমরা শুধুমাত্র বাংলাদেশের ভেতরেই ডেলিভারি সার্ভিস দিয়ে থাকি।',
    active: true,
  },
  {
    id: 'faq-gen-8',
    category: 'general',
    question: 'কুপন কোড (Coupon Code) কীভাবে ব্যবহার করব?',
    answer: 'চেকআউট করার সময় Apply Coupon বক্সে কোডটি লিখলেই আপনার মোট মূল্য থেকে ডিসকাউন্ট কেটে নেওয়া হবে।',
    active: true,
  },
  {
    id: 'faq-gen-9',
    category: 'general',
    question: 'ফ্রি ডেলিভারি পাওয়ার কোনো সুযোগ আছে কি?',
    answer: 'নির্দিষ্ট পরিমাণ কেনাকাটা বা বিশেষ ক্যাম্পেইন চলাকালীন সময়ে আমরা ফ্রি ডেলিভারি অফার দিয়ে থাকি।',
    active: true,
  },
  {
    id: 'faq-gen-10',
    category: 'general',
    question: 'আপনাদের সাথে যোগাযোগের ফোন নম্বরটি কত?',
    answer: 'আমাদের হটলাইন ও কাস্টমার কেয়ার নম্বর: ০১৯২২৪৪২২৯৬ (01922442296)। আপনি পেজের বায়ো বা Contact Us সেকশনেও এটি পেয়ে যাবেন।',
    active: true,
  },
];

export const DEFAULT_TRAINED_PRODUCTS: TrainedProductItem[] = [
  {
    id: 'prod-polo-1',
    name: 'Supima Cotton Pique Polo',
    category: 'Polo Shirts',
    price: 1650,
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colors: ['Midnight Navy', 'Pure White', 'Jet Black', 'Burgundy Wine'],
    description: '100% আমেরিকান সুপিমা কটন দিয়ে তৈরি লাক্সারি পোলো শার্ট। কালার গ্যারান্টিযুক্ত, ব্রিদেবল ফেব্রিক।',
    fabricDetails: '220 GSM 100% Supima Combed Cotton Pique',
    keywords: ['polo', 'পোলো', 'pique', 't-shirt', 'টি শার্ট', 'supima', 'শার্ট'],
    imageUrl: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=600&auto=format&fit=crop&q=80',
    active: true,
  },
  {
    id: 'prod-panjabi-1',
    name: 'Luxury Linen Panjabi',
    category: 'Traditional & Festive',
    price: 2850,
    sizes: ['38', '40', '42', '44', '46', 'M', 'L', 'XL', 'XXL'],
    colors: ['Off-White', 'Sage Green', 'Royal Navy', 'Charcoal Grey'],
    description: '১০০% পিওর কটন-লিনেন ফেব্রিকের প্রিমিয়াম পাঞ্জাবি। অত্যন্ত আরামদায়ক ও নিখুঁত কলার স্টিচ।',
    fabricDetails: '100% Organic Linen Blend with Cotton Weave',
    keywords: ['panjabi', 'পাঞ্জাবি', 'punjabi', 'linen', 'লিনেন', 'eid', 'কুর্তা'],
    imageUrl: 'https://images.unsplash.com/photo-1621786030685-2e8f11f9e65c?w=600&auto=format&fit=crop&q=80',
    active: true,
  },
  {
    id: 'prod-shirt-1',
    name: 'Oxford Tailored Shirt',
    category: 'Formal & Semi-Formal',
    price: 1850,
    sizes: ['15 (M)', '15.5 (L)', '16 (XL)', '16.5 (XXL)'],
    colors: ['Sky Blue', 'Crisp White', 'Soft Pink'],
    description: 'প্রিমিয়াম অক্সফোর্ড কটন ফেব্রিক দিয়ে নিখুঁত টেইলরড কাট শার্ট। অফিস ও ক্যাজুয়াল উভয় ব্যবহারের জন্য মানানসই।',
    fabricDetails: '100% Two-ply Oxford Cotton',
    keywords: ['shirt', 'শার্ট', 'oxford', 'formal', 'অক্সফোর্ড', 'button-down'],
    imageUrl: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&auto=format&fit=crop&q=80',
    active: true,
  },
  {
    id: 'prod-chinos-1',
    name: 'Stretch Tailored Chinos',
    category: 'Trousers & Chinos',
    price: 1950,
    sizes: ['30', '32', '34', '36', '38'],
    colors: ['Khaki Beige', 'Midnight Navy', 'Slate Grey', 'Jet Black'],
    description: 'ফোর-ওয়ে স্ট্রেচ আরামদায়ক চিনো প্যান্ট। সারাদিনের স্বাচ্ছন্দ্যে প্রিমিয়াম ফিনিশিং।',
    fabricDetails: '98% Cotton, 2% Spandex Stretch Twill',
    keywords: ['chino', 'chinos', 'চিনো', 'pant', 'প্যান্ট', 'trouser', 'টেইলারড'],
    imageUrl: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=600&auto=format&fit=crop&q=80',
    active: true,
  },
  {
    id: 'prod-blazer-1',
    name: 'Italian Wool Blend Blazer',
    category: 'Suits & Outerwear',
    price: 6500,
    sizes: ['38', '40', '42', '44'],
    colors: ['Midnight Navy', 'Charcoal Herringbone', 'Camel Tan'],
    description: 'ইতালীয় উল ব্লেন্ডের স্লিম ফিট লাক্সারি ব্লেজার। ফরমাল ইভেন্ট ও বিয়ে-উৎসবের সেরা পোশাক।',
    fabricDetails: '70% Wool, 30% Silk-Touch Polyester Microfiber',
    keywords: ['blazer', 'ব্লেজার', 'coat', 'কোট', 'suit', 'স্যুট'],
    imageUrl: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600&auto=format&fit=crop&q=80',
    active: true,
  },
];

export const DEFAULT_ORDER_FORMAT: OrderCollectionFormatConfig = {
  formatTemplate: `📦 অর্ডার বিবরণ:
• পণ্য: {product_name} ({size})
• পরিমাণ: {quantity} টি
• মূল্য: ৳{unit_price}
• ডেলিভারি চার্জ: ৳{delivery_fee}
• সর্বমোট: ৳{total_amount}
• কাস্টমার নাম: {customer_name}
• ফোন: {phone_number}
• ডেলিভারি ঠিকানা: {address}`,
  requiredFields: ['product_name', 'size', 'phone_number', 'address'],
  followUpPromptTemplate: `আসসালামু আলাইকুম! আপনার অর্ডারটি নিশ্চিত করতে অনুগ্রহ করে আপনার পছন্দের সাইজ ({available_sizes}), সক্রিয় মোবাইল নম্বর এবং পূর্ণ ডেলিভারি ঠিকানা (বাসা/রোড, এলাকা, থানা, জেলা) জানিয়ে সহায়তা করুন।`,
  confirmationMessageTemplate: `ধন্যবাদ {customer_name}! আপনার {product_name} ({size} সাইজ) অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে ✅। আমাদের টিম খুব শীঘ্রই ডেলিভারির জন্য কল করে কনফার্ম করবে।`,
  defaultPaymentMethod: 'Cash on Delivery',
};

export const DEFAULT_POLICIES: StorePolicyConfig = {
  insideDhakaDeliveryFee: 60,
  subDhakaDeliveryFee: 100,
  outsideDhakaDeliveryFee: 150,
  deliveryTimeInsideDhaka: '৪৮ ঘণ্টা',
  deliveryTimeOutsideDhaka: '৭২ ঘণ্টা',
  codAvailableAllBangladesh: true,
  exchangePolicyDays: 7,
  hotlinePhone: '01922442296',
  operatingHours: 'প্রতিদিন সকাল ১০টা থেকে রাত ১০টা',
  currentPromoNotice: 'সারা দেশে ক্যাশ অন ডেলিভারি সুবিধা চালু রয়েছে। কোনো অগ্রিম পেমেন্ট নেই।',
};
