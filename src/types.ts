export type UserRole = 'Super Admin' | 'Admin' | 'Manager' | 'Packer';

export interface AuthUser {
  email: string;
  name: string;
  role: UserRole;
  status: 'Active' | 'Pending' | 'Suspended';
  avatarUrl?: string;
}

export type OrderStatus = 'Pending' | 'Approved' | 'Dispatched' | 'Delivered' | 'Cancelled';

export type OrderChannel = 'Facebook' | 'Instagram' | 'WhatsApp' | 'Website' | 'Showroom';

export interface OrderItem {
  id: string;
  productName: string;
  sku: string;
  color: string;
  size: 'S' | 'M' | 'L' | 'XL' | 'XXL';
  quantity: number;
  unitPrice: number;
  // If overridden during barcode packing
  overriddenFromSku?: string;
  overriddenFromSize?: string;
}

export interface Order {
  id: string; // e.g. VIS-1082
  customerName: string;
  phone: string;
  address: string;
  city: 'Inside Dhaka' | 'Sub-Dhaka' | 'Outside Dhaka';
  district?: string; // 64 Bangladesh Districts (e.g., 'Dhaka', 'Chattogram', 'Cumilla')
  pathaoCityId?: number; // Pre-mapped Pathao City ID
  channel: OrderChannel;
  source?: 'website' | 'messenger' | 'instagram' | 'whatsapp' | 'manual';
  senderId?: string;
  items: OrderItem[];
  totalAmount: number;
  deliveryFee: number;
  paymentMethod: 'Cash on Delivery' | 'bKash' | 'Nagad' | 'Prepaid';
  status: OrderStatus;
  createdAt: string;
  approvedAt?: string;
  dispatchedAt?: string;
  pathaoTrackingId?: string;
  pathaoConsignmentId?: string;
  pathaoStatus?: 'Pickup Requested' | 'In Transit' | 'Delivered' | 'Exchange' | 'Partial Delivery' | 'Return' | 'Paid Return';
  notes?: string;
  productImageUrl?: string;
  rawConversation?: { sender: string; text: string; timestamp?: string; attachmentUrl?: string }[];
  confidence?: 'complete' | 'incomplete';
  missingFields?: string[];
  overrideHistory?: {
    timestamp: string;
    originalSku: string;
    scannedSku: string;
    originalSize: string;
    newSize: string;
    packerName: string;
  }[];
}

export interface ProductVariant {
  size: 'S' | 'M' | 'L' | 'XL' | 'XXL';
  sku: string;
  barcode: string; // EAN-13
  warehouseStock: number; // Final stock in warehouse
  reservedStock: number; // Booked in pending/approved orders
}

export interface Product {
  id: string;
  name: string;
  category: 'Polo' | 'Panjabi' | 'Shirt' | 'Chino' | 'Blazer';
  color: string;
  fabric: string;
  retailPrice: number;
  cogsEstimate: number;
  variants: ProductVariant[];
  thumbnail: string;
}

export interface KnowledgeItem {
  id: string;
  type: 'Bengali Typo' | 'Product Spec' | 'Image Mapping' | 'Sizing Rule';
  triggerPattern: string; // e.g. "pulu t-shart", "panjabi eid"
  canonicalValue: string; // "Supima Luxury Polo - Navy", "Executive Linen Panjabi"
  notes: string;
}

export interface PathaoPayoutRecord {
  id: string;
  invoiceId: string;
  orderId: string;
  trackingId: string;
  customerName: string;
  expectedCod: number;
  courierFee: number;
  returnCharge: number;
  actualPaidAmount: number;
  discrepancy: number; // actualPaid - (expectedCod - fees)
  reconciliationStatus: 'Matched' | 'Discrepancy' | 'Pending Review';
  status: 'Delivered' | 'Exchange' | 'Partial Delivery' | 'Return' | 'Paid Return';
  payoutDate: string;
}

export interface ExpenseRecord {
  id: string;
  date: string;
  category: 'Production' | 'Packaging' | 'Transport' | 'Food' | 'Monthly' | 'Marketing';
  shipmentTag?: string; // e.g. "Polo Shipment #5"
  amount: number;
  description: string;
  loggedBy: string;
}

export interface ShipmentCosting {
  id: string;
  shipmentTag: string; // e.g. "Polo Shipment #5"
  productType: string;
  yieldUnits: number;
  expenses: {
    rawMaterials: number;
    packaging: number;
    food: number;
    transport: number;
    labor: number;
    other: number;
  };
  totalCost: number;
  cogsPerUnit: number;
  status: 'In Production' | 'Finished & Yielded';
  notes?: string;
}

export interface CustomerProfile {
  phone: string;
  name: string;
  email?: string;
  address: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: string;
  isVip: boolean;
  isInactive60Days: boolean;
  notes?: string;
}

export type CashTransactionType = 'inflow' | 'outflow';
export type CashAccountType = 'Petty Cash Drawer' | 'City Bank Current' | 'bKash Merchant' | 'Nagad Business';

export type CashCategory =
  | 'Showroom Cash Sale'
  | 'Courier COD Received'
  | 'Bank Deposit/Withdrawal'
  | 'Customer Advance'
  | 'Fabric & Raw Materials'
  | 'Tailoring & Labor'
  | 'Packaging & Garment Bags'
  | 'Shop Rent & Utilities'
  | 'Facebook Ad Billing'
  | 'Staff Lunch & Refreshments'
  | 'Courier Delivery Charges'
  | 'Owner Equity / Injection'
  | 'Production'
  | 'Miscellaneous';

export interface CashEntry {
  id: string;
  date: string;
  time: string;
  type: CashTransactionType;
  account: CashAccountType;
  category: CashCategory;
  amount: number;
  description: string;
  referenceId?: string; // Voucher #, Invoice #, bKash TrxID, Pathao Payout ID
  performedBy: string;
}

export interface CashBalanceSummary {
  pettyCash: number;
  bankBalance: number;
  bkashMerchant: number;
  totalLiquidCash: number;
  pendingCourierCod: number;
}

export interface ChannelIntegrationConfig {
  website: {
    platform: 'WooCommerce' | 'Shopify' | 'Custom Webhook';
    storeUrl: string;
    apiKey: string;
    apiSecret: string;
    webhookUrl: string;
    webhookSecret: string;
    syncOrders: boolean;
    syncInventory: boolean;
    status: 'connected' | 'disconnected' | 'pending';
    lastSync?: string;
  };
  pathao: {
    merchantId: string;
    clientId: string;
    clientSecret: string;
    storeId: string;
    storeName: string;
    baseUrl?: string;
    username?: string;
    password?: string;
    webhookCallbackUrl: string;
    autoConsignment: boolean;
    status: 'connected' | 'disconnected' | 'pending';
    lastSync?: string;
  };
  meta: {
    metaAppId?: string;
    metaAppSecret?: string;
    metaVerifyToken?: string;
    pageAccessToken: string;
    pageId?: string;
    instagramBusinessAccountId?: string;
    whatsappPhoneNumberId?: string;
    whatsappBusinessAccountId?: string;
    whatsappAccessToken?: string;
    webhookCallbackUrl?: string;
    businessSuitePageId: string;
    adAccountId: string;
    conversionsApiPixelId: string;
    conversionsApiToken: string;
    syncMessengerLeads: boolean;
    trackAdSpend: boolean;
    status: 'connected' | 'disconnected' | 'pending';
    lastSync?: string;
  };
}

export type ProfitViewMode = 'gross' | 'net';

export type DatePreset = '3d' | '7d' | '14d' | '30d' | 'this_month' | 'custom';

export interface PreInvestmentAsset {
  id: string;
  name: string;
  category: 'Website & Custom App' | 'Cloud & Hosting' | 'Warehouse Hardware' | 'Studio & Fixtures' | 'Machinery';
  initialCostBDT: number;
  purchaseDate: string;
  amortizationMonths: 12 | 24 | 36;
  notes?: string;
}

export interface MetaAdCampaignSpend {
  campaignId: string;
  campaignName: string;
  spendBDT: number;
  impressions: number;
  clicks: number;
  purchases: number;
  roas: number;
  cpaBDT: number;
}

export interface MultiAgentMemo {
  id: string;
  sender: string;
  rawText: string;
  channel: 'WhatsApp Group' | 'Telegram Channel' | 'Slack Memo' | 'Internal Note';
  timestamp: string;
  detectedAgent: 'cash' | 'order' | 'inventory';
  status: 'processed' | 'rejected_duplicate' | 'pending';
  parsedData: any;
  duplicateOfId?: string;
  duplicateReason?: string;
}
