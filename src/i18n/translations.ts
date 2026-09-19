export type LanguageCode = 'en' | 'bn';

export interface Translations {
  // Navigation & Sidebar
  'nav.dashboard': string;
  'nav.orders': string;
  'nav.cash': string;
  'nav.integrations': string;
  'nav.dispatch': string;
  'nav.inventory': string;
  'nav.reconciliation': string;
  'nav.crm': string;
  'nav.ai': string;
  'nav.gas': string;
  'nav.settings': string;
  'nav.workspaceNav': string;
  'nav.quickActions': string;

  // Header
  'header.pendingOrders': string;
  'header.readyToPack': string;
  'header.openNav': string;
  'header.aiAssistant': string;
  'header.gasApi': string;
  'header.signOut': string;

  // Settings View
  'settings.title': string;
  'settings.subtitle': string;
  'settings.languageSection': string;
  'settings.languageDescription': string;
  'settings.selectLanguage': string;
  'settings.english': string;
  'settings.bangla': string;
  'settings.languageSaved': string;
  'settings.brandIdentity': string;
  'settings.appNameLabel': string;
  'settings.appSubtitleLabel': string;
  'settings.appTaglineLabel': string;
  'settings.appearanceTheme': string;
  'settings.saveSettings': string;

  // Order Engine
  'orders.title': string;
  'orders.subtitle': string;
  'orders.searchPlaceholder': string;
  'orders.allChannels': string;
  'orders.pendingTab': string;
  'orders.approvedTab': string;
  'orders.dispatchedTab': string;
  'orders.deliveredTab': string;
  'orders.cancelledTab': string;
  'orders.editOrder': string;
  'orders.approveDispatch': string;
  'orders.cancelOrder': string;
  'orders.customer': string;
  'orders.phone': string;
  'orders.address': string;
  'orders.city': string;
  'orders.items': string;
  'orders.totalAmount': string;
  'orders.paymentMethod': string;
  'orders.notes': string;
  'orders.actions': string;
  'orders.noOrders': string;

  // Edit Order Modal
  'editOrder.modalTitle': string;
  'editOrder.customerName': string;
  'editOrder.phoneNumber': string;
  'editOrder.deliveryAddress': string;
  'editOrder.cityZone': string;
  'editOrder.productName': string;
  'editOrder.size': string;
  'editOrder.quantity': string;
  'editOrder.unitPrice': string;
  'editOrder.deliveryFee': string;
  'editOrder.specialInstruction': string;
  'editOrder.saveChanges': string;
  'editOrder.cancel': string;

  // Dashboard
  'dashboard.title': string;
  'dashboard.subtitle': string;
  'dashboard.totalOrders': string;
  'dashboard.netRevenue': string;
  'dashboard.cogsExpenses': string;
  'dashboard.pendingApprovals': string;
  'dashboard.recentOrders': string;
  'dashboard.viewAll': string;
  'dashboard.channelPerformance': string;

  // Cash Register
  'cash.title': string;
  'cash.subtitle': string;
  'cash.inflow': string;
  'cash.outflow': string;
  'cash.addEntry': string;
  'cash.balance': string;
  'cash.category': string;
  'cash.description': string;
  'cash.amount': string;

  // Connect Channels
  'channels.title': string;
  'channels.subtitle': string;
  'channels.pathaoCourier': string;
  'channels.whatsappApi': string;
  'channels.websiteSync': string;
  'channels.metaIntegration': string;
  'channels.connected': string;
  'channels.disconnected': string;
  'channels.saveSettings': string;

  // Barcode Dispatch
  'dispatch.title': string;
  'dispatch.subtitle': string;
  'dispatch.scanBarcode': string;
  'dispatch.verifySku': string;
  'dispatch.override': string;
  'dispatch.completeDispatch': string;

  // Inventory
  'inventory.title': string;
  'inventory.subtitle': string;
  'inventory.productName': string;
  'inventory.sku': string;
  'inventory.stockLevel': string;
  'inventory.reservedStock': string;
  'inventory.availableStock': string;

  // Common UI
  'common.save': string;
  'common.cancel': string;
  'common.delete': string;
  'common.edit': string;
  'common.close': string;
  'common.loading': string;
  'common.success': string;
  'common.error': string;
  'common.pending': string;
  'common.approved': string;
  'common.dispatched': string;
  'common.delivered': string;
  'common.cancelled': string;
}

export const translations: Record<LanguageCode, Translations> = {
  en: {
    // Navigation & Sidebar
    'nav.dashboard': 'Dashboard',
    'nav.orders': 'Order Engine',
    'nav.cash': 'Cash & Balance',
    'nav.integrations': 'Connect Channels',
    'nav.dispatch': 'Barcode Dispatch',
    'nav.inventory': 'Dual Inventory',
    'nav.reconciliation': 'Courier Reconciliation',
    'nav.crm': 'Conversational CRM',
    'nav.ai': 'Veer AI Fashion Agent',
    'nav.gas': 'Google Sheets DB',
    'nav.settings': 'Settings',
    'nav.workspaceNav': 'Workspace Navigation',
    'nav.quickActions': 'Quick Actions',

    // Header
    'header.pendingOrders': 'Pending Orders',
    'header.readyToPack': 'Ready to Pack',
    'header.openNav': 'Open navigation',
    'header.aiAssistant': 'Veer (AI)',
    'header.gasApi': 'GAS API & Schema',
    'header.signOut': 'Sign Out',

    // Settings View
    'settings.title': 'Workspace Settings',
    'settings.subtitle': 'Configure language preferences, brand identity, and theme presets',
    'settings.languageSection': 'Language Preference',
    'settings.languageDescription': 'Select your preferred language for the Vistoosa OS interface',
    'settings.selectLanguage': 'Select Interface Language',
    'settings.english': 'English (Default)',
    'settings.bangla': 'বাংলা (Bangla)',
    'settings.languageSaved': 'Language preference saved successfully',
    'settings.brandIdentity': 'Brand Identity',
    'settings.appNameLabel': 'App Name',
    'settings.appSubtitleLabel': 'App Subtitle',
    'settings.appTaglineLabel': 'Tagline',
    'settings.appearanceTheme': 'Appearance & Theme',
    'settings.saveSettings': 'Save Settings',

    // Order Engine
    'orders.title': 'Unified Order Engine',
    'orders.subtitle': 'Manage pending orders, edit customer info, and dispatch via Pathao Courier',
    'orders.searchPlaceholder': 'Search by order ID, name, or phone number...',
    'orders.allChannels': 'All Channels',
    'orders.pendingTab': 'Pending Orders',
    'orders.approvedTab': 'Approved / Dispatch',
    'orders.dispatchedTab': 'Dispatched',
    'orders.deliveredTab': 'Delivered',
    'orders.cancelledTab': 'Cancelled',
    'orders.editOrder': 'Edit Order',
    'orders.approveDispatch': 'Approve & Dispatch',
    'orders.cancelOrder': 'Cancel',
    'orders.customer': 'Customer Name',
    'orders.phone': 'Phone Number',
    'orders.address': 'Delivery Address',
    'orders.city': 'City / Zone',
    'orders.items': 'Ordered Items',
    'orders.totalAmount': 'Total Amount',
    'orders.paymentMethod': 'Payment Method',
    'orders.notes': 'Special Notes',
    'orders.actions': 'Actions',
    'orders.noOrders': 'No orders found in this view',

    // Edit Order Modal
    'editOrder.modalTitle': 'Edit Pending Order Details',
    'editOrder.customerName': 'Customer Name',
    'editOrder.phoneNumber': 'Phone Number',
    'editOrder.deliveryAddress': 'Delivery Address',
    'editOrder.cityZone': 'City / Zone Region',
    'editOrder.productName': 'Product Name',
    'editOrder.size': 'Size',
    'editOrder.quantity': 'Quantity',
    'editOrder.unitPrice': 'Unit Price (৳)',
    'editOrder.deliveryFee': 'Delivery Fee (৳)',
    'editOrder.specialInstruction': 'Special Delivery Notes',
    'editOrder.saveChanges': 'Save Changes',
    'editOrder.cancel': 'Cancel',

    // Dashboard
    'dashboard.title': 'Business Dashboard',
    'dashboard.subtitle': 'Real-time overview of orders, revenue, COGS, and channel metrics',
    'dashboard.totalOrders': 'Total Orders',
    'dashboard.netRevenue': 'Net Revenue',
    'dashboard.cogsExpenses': 'COGS & Expenses',
    'dashboard.pendingApprovals': 'Pending Approvals',
    'dashboard.recentOrders': 'Recent Inbound Orders',
    'dashboard.viewAll': 'View All Orders',
    'dashboard.channelPerformance': 'Sales Channel Breakdown',

    // Cash Register
    'cash.title': 'Cash Register & Balance',
    'cash.subtitle': 'Track cash inflows, petty cash expenses, and bKash settlements',
    'cash.inflow': 'Total Inflow',
    'cash.outflow': 'Total Outflow',
    'cash.addEntry': 'Record Cash Transaction',
    'cash.balance': 'Net Account Balance',
    'cash.category': 'Category',
    'cash.description': 'Description / Notes',
    'cash.amount': 'Amount (৳)',

    // Connect Channels
    'channels.title': 'Connect Channels & Integrations',
    'channels.subtitle': 'Configure Pathao Courier, WhatsApp API, Meta Leads, and Website Webhooks',
    'channels.pathaoCourier': 'Pathao Courier API',
    'channels.whatsappApi': 'WhatsApp Cloud API',
    'channels.websiteSync': 'WooCommerce / Website Sync',
    'channels.metaIntegration': 'Meta Messenger & Instagram',
    'channels.connected': 'Connected',
    'channels.disconnected': 'Not Connected',
    'channels.saveSettings': 'Save Credentials',

    // Barcode Dispatch
    'dispatch.title': 'Barcode Scanner Dispatch Hub',
    'dispatch.subtitle': 'Verify SKU and size before packing packages for courier handover',
    'dispatch.scanBarcode': 'Scan Product Barcode / SKU',
    'dispatch.verifySku': 'Verify Product SKU & Size',
    'dispatch.override': 'Override Real-Product',
    'dispatch.completeDispatch': 'Complete Dispatch & Print Label',

    // Inventory
    'inventory.title': 'Dual-Stock Inventory Manager',
    'inventory.subtitle': 'Physical warehouse stock vs. reserved stock tracking',
    'inventory.productName': 'Product Name',
    'inventory.sku': 'SKU / Variant Code',
    'inventory.stockLevel': 'Physical Warehouse Stock',
    'inventory.reservedStock': 'Reserved for Orders',
    'inventory.availableStock': 'Net Available Stock',

    // Common UI
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.close': 'Close',
    'common.loading': 'Loading...',
    'common.success': 'Success',
    'common.error': 'Error',
    'common.pending': 'Pending',
    'common.approved': 'Approved',
    'common.dispatched': 'Dispatched',
    'common.delivered': 'Delivered',
    'common.cancelled': 'Cancelled',
  },

  bn: {
    // Navigation & Sidebar
    'nav.dashboard': 'ড্যাশবোর্ড',
    'nav.orders': 'অর্ডার ইঞ্জিন',
    'nav.cash': 'ক্যাশ ও ব্যালেন্স',
    'nav.integrations': 'কানেক্ট চ্যানেল',
    'nav.dispatch': 'বারকোড ডিসপ্যাচ',
    'nav.inventory': 'ইনভেন্টরি',
    'nav.reconciliation': 'কুরিয়ার রিকনসিলিয়েশন',
    'nav.crm': 'সিআরএম (মেটা কাস্টমার)',
    'nav.ai': 'বীর এআই অ্যাসিস্ট্যান্ট',
    'nav.gas': 'গুগল শিটস ডাটাবেস',
    'nav.settings': 'সেটিংস',
    'nav.workspaceNav': 'ওয়ার্কস্পেস মেনু',
    'nav.quickActions': 'কুইক অ্যাকশন',

    // Header
    'header.pendingOrders': 'পেন্ডিং অর্ডার',
    'header.readyToPack': 'প্যাকিংয়ের জন্য প্রস্তুত',
    'header.openNav': 'মেনু খুলুন',
    'header.aiAssistant': 'বীর (এআই)',
    'header.gasApi': 'জিসিপি / শিটস এপিআই',
    'header.signOut': 'সাইন আউট',

    // Settings View
    'settings.title': 'ওয়ার্কস্পেস সেটিংস',
    'settings.subtitle': 'ভাষা পরিবর্তন, ব্র্যান্ড আইডেন্টিটি এবং থিম কনফিগারেশন',
    'settings.languageSection': 'Language / ভাষা নির্বাচন',
    'settings.languageDescription': 'Vistoosa OS ইন্টারফেসের জন্য আপনার পছন্দের ভাষা নির্বাচন করুন',
    'settings.selectLanguage': 'অ্যাপ্লিকেশন ভাষা পরিবর্তন করুন',
    'settings.english': 'English (ইংরেজি)',
    'settings.bangla': 'বাংলা (Bangla)',
    'settings.languageSaved': 'পছন্দের ভাষা সফলভাবে সংরক্ষিত হয়েছে',
    'settings.brandIdentity': 'ব্র্যান্ড পরিচিতি',
    'settings.appNameLabel': 'অ্যাপ নাম',
    'settings.appSubtitleLabel': 'সাবটাইটেল',
    'settings.appTaglineLabel': 'ট্যাগলাইন',
    'settings.appearanceTheme': 'অ্যাপের থিম ও ডিজাইন',
    'settings.saveSettings': 'সেটিংস সেভ করুন',

    // Order Engine
    'orders.title': 'ইউনিফাইড অর্ডার ইঞ্জিন',
    'orders.subtitle': 'পেন্ডিং অর্ডার ম্যানেজমেন্ট, কাস্টমার ডিটেইলস এডিট ও পাঠাও কুরিয়ার ডিসপ্যাচ',
    'orders.searchPlaceholder': 'অর্ডার আইডি, নাম বা ফোন নম্বর দিয়ে খুঁজুন...',
    'orders.allChannels': 'সবগুলো চ্যানেল',
    'orders.pendingTab': 'পেন্ডিং অর্ডার',
    'orders.approvedTab': 'অনুমোদিত / ডিসপ্যাচ',
    'orders.dispatchedTab': 'ডিসপ্যাচড',
    'orders.deliveredTab': 'ডেলিভার্ড',
    'orders.cancelledTab': 'বাতিলকৃত',
    'orders.editOrder': 'এডিট করুন',
    'orders.approveDispatch': 'অনুমোদন ও পাঠাও ডিসপ্যাচ',
    'orders.cancelOrder': 'বাতিল করুন',
    'orders.customer': 'গ্রাহকের নাম',
    'orders.phone': 'ফোন নম্বর',
    'orders.address': 'ডেলিভারি ঠিকানা',
    'orders.city': 'সিটি / জোন',
    'orders.items': 'অর্ডারকৃত প্রোডাক্ট',
    'orders.totalAmount': 'মোট বিল',
    'orders.paymentMethod': 'পেমেন্ট মেথড',
    'orders.notes': 'বিশেষ নোট',
    'orders.actions': 'অ্যাকশন',
    'orders.noOrders': 'এই সেকশনে কোনো অর্ডার পাওয়া যায়নি',

    // Edit Order Modal
    'editOrder.modalTitle': 'পেন্ডিং অর্ডারের তথ্য এডিট করুন',
    'editOrder.customerName': 'গ্রাহকের নাম',
    'editOrder.phoneNumber': 'ফোন নম্বর',
    'editOrder.deliveryAddress': 'ডেলিভারি সম্পূর্ণ ঠিকানা',
    'editOrder.cityZone': 'সিটি ও জোন রিজিয়ন',
    'editOrder.productName': 'প্রোডাক্টের নাম',
    'editOrder.size': 'সাইজ (Size)',
    'editOrder.quantity': 'পরিমাণ (Qty)',
    'editOrder.unitPrice': 'ইউনিট প্রাইস (৳)',
    'editOrder.deliveryFee': 'ডেলিভারি চার্জ (৳)',
    'editOrder.specialInstruction': 'ডেলিভারি ইনস্ট্রাকশন / নোট',
    'editOrder.saveChanges': 'সেভ করুন',
    'editOrder.cancel': 'বাতিল',

    // Dashboard
    'dashboard.title': 'বিজনেস ড্যাশবোর্ড',
    'dashboard.subtitle': 'অর্ডার, মোট রেভিনিউ, ক্যাশফ্লো এবং সেলস চ্যানেলের সার্বিক চিত্র',
    'dashboard.totalOrders': 'মোট অর্ডার',
    'dashboard.netRevenue': 'নেট রেভিনিউ',
    'dashboard.cogsExpenses': 'পণ্য খরচ ও ব্যয়',
    'dashboard.pendingApprovals': 'অপেক্ষমান অর্ডার',
    'dashboard.recentOrders': 'সর্বশেষ ইনবাউন্ড অর্ডার',
    'dashboard.viewAll': 'সকল অর্ডার দেখুন',
    'dashboard.channelPerformance': 'সেলস চ্যানেল ব্রেকডাউন',

    // Cash Register
    'cash.title': 'ক্যাশ রেজিস্টার ও ব্যালেন্স',
    'cash.subtitle': 'ইনফ্লো, ক্যাশ খরচ, ও বিকাশ কালেকশন ট্র্যাকিং',
    'cash.inflow': 'মোট জমা (Inflow)',
    'cash.outflow': 'মোট খরচ (Outflow)',
    'cash.addEntry': 'নতুন ক্যাশ এন্ট্রি যোগ করুন',
    'cash.balance': 'বর্তমান ক্যাশ ব্যালেন্স',
    'cash.category': 'ক্যাটাগরি',
    'cash.description': 'বিবরণ / নোট',
    'cash.amount': 'পরিমাণ (৳)',

    // Connect Channels
    'channels.title': 'কানেক্ট চ্যানেল ও ইন্টিগ্রেশন',
    'channels.subtitle': 'পাঠাও কুরিয়ার, হোয়াটসঅ্যাপ এপিআই, মেটা লিডস ও ওয়েবসাইট এপিআই কনফিগার করুন',
    'channels.pathaoCourier': 'পাঠাও কুরিয়ার এপিআই',
    'channels.whatsappApi': 'হোয়াটসঅ্যাপ ক্লাউড এপিআই',
    'channels.websiteSync': 'উকমার্স / ওয়েবসাইট সিঙ্ক',
    'channels.metaIntegration': 'মেটা মেসেঞ্জার ও ইনস্টাগ্রাম',
    'channels.connected': 'সংযুক্ত',
    'channels.disconnected': 'সংযুক্ত নয়',
    'channels.saveSettings': 'ক্রেডেনশিয়াল সেভ করুন',

    // Barcode Dispatch
    'dispatch.title': 'বারকোড স্ক্যানার ডিসপ্যাচ হাব',
    'dispatch.subtitle': 'প্যাকিংয়ের আগে প্রোডাক্টের SKU ও সাইজ দ্রুত ভেরিফাই করুন',
    'dispatch.scanBarcode': 'প্রোডাক্ট বারকোড / SKU স্ক্যান করুন',
    'dispatch.verifySku': 'SKU ও সাইজ ভেরিফিকেশন',
    'dispatch.override': 'রিয়েল-প্রোডাক্ট ওভাররাইড',
    'dispatch.completeDispatch': 'ডিসপ্যাচ সম্পন্ন করুন',

    // Inventory
    'inventory.title': 'ডুয়াল-স্টক ইনভেন্টরি ম্যানেজার',
    'inventory.subtitle': 'ওয়্যারহাউজ ফিজিক্যাল স্টক বনাম রিজার্ভড স্টক ট্র্যাকিং',
    'inventory.productName': 'প্রোডাক্টের নাম',
    'inventory.sku': 'SKU / ভ্যারিয়েন্ট কোড',
    'inventory.stockLevel': 'ওয়্যারহাউজ স্টক',
    'inventory.reservedStock': 'রিজার্ভড স্টক',
    'inventory.availableStock': 'প্রকৃত এভেলেবল স্টক',

    // Common UI
    'common.save': 'সংরক্ষণ করুন',
    'common.cancel': 'বাতিল',
    'common.delete': 'মুছে ফেলুন',
    'common.edit': 'এডিট করুন',
    'common.close': 'বন্ধ করুন',
    'common.loading': 'লোড হচ্ছে...',
    'common.success': 'সফল',
    'common.error': 'ত্রুটি',
    'common.pending': 'পেন্ডিং',
    'common.approved': 'অনুমোদিত',
    'common.dispatched': 'ডিসপ্যাচড',
    'common.delivered': 'ডেলিভার্ড',
    'common.cancelled': 'বাতিলকৃত',
  },
};
