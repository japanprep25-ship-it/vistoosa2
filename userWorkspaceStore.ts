import fs from 'fs';
import path from 'path';

const WORKSPACE_FILE_PATH = path.join(process.cwd(), 'user-workspaces.json');

export interface UserWorkspaceData {
  orders?: any[];
  cashEntries?: any[];
  expenses?: any[];
  products?: any[];
  settings?: Record<string, any>;
}

type PerUserWorkspaces = Record<string, UserWorkspaceData>;

const DEFAULT_SEED_ORDERS = [
  {
    id: 'VIS-982104',
    customerName: 'Asif Mahmud',
    phone: '01712345678',
    address: 'House 42, Road 11, Block D, Banani, Dhaka',
    city: 'Inside Dhaka',
    channel: 'WhatsApp',
    items: [
      {
        id: 'item-1',
        productName: 'Royal Obsidian Panjabi',
        sku: 'VIS-ROY-M',
        color: 'Obsidian Black',
        size: 'M',
        quantity: 1,
        unitPrice: 3850,
      },
    ],
    status: 'Pending',
    totalAmount: 3910,
    deliveryFee: 60,
    paymentMethod: 'Cash on Delivery',
    createdAt: new Date().toISOString(),
    notes: 'Urgent delivery requested',
  },
  {
    id: 'VIS-982105',
    customerName: 'Tanvir Hossain',
    phone: '01898765432',
    address: 'GEC Circle, Nasirabad, Chattogram',
    city: 'Outside Dhaka',
    channel: 'Facebook',
    items: [
      {
        id: 'item-2',
        productName: 'Supima Pique Polo - Midnight Navy',
        sku: 'VIS-POL-L',
        color: 'Midnight Navy',
        size: 'L',
        quantity: 2,
        unitPrice: 1650,
      },
    ],
    status: 'Approved',
    pathaoTrackingId: 'PTH-629104',
    pathaoStatus: 'Pickup Requested',
    totalAmount: 3450,
    deliveryFee: 150,
    paymentMethod: 'bKash',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
];

function loadAllWorkspaces(): PerUserWorkspaces {
  try {
    if (!fs.existsSync(WORKSPACE_FILE_PATH)) return {};
    const data = fs.readFileSync(WORKSPACE_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(data);
    return (parsed as PerUserWorkspaces) || {};
  } catch (err) {
    console.error('Error loading user workspaces:', err);
    return {};
  }
}

function saveAllWorkspaces(workspaces: PerUserWorkspaces): void {
  try {
    fs.writeFileSync(WORKSPACE_FILE_PATH, JSON.stringify(workspaces, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving user workspaces:', err);
  }
}

export function getUserOrders(userId: string): any[] {
  if (!userId) return [];
  const workspaces = loadAllWorkspaces();
  if (!workspaces[userId]) {
    // Seed default sample orders for user's fresh workspace
    workspaces[userId] = {
      orders: JSON.parse(JSON.stringify(DEFAULT_SEED_ORDERS)),
      cashEntries: [],
      expenses: [],
    };
    saveAllWorkspaces(workspaces);
  }
  return workspaces[userId].orders || [];
}

export function saveUserOrders(userId: string, orders: any[]): void {
  if (!userId) return;
  const workspaces = loadAllWorkspaces();
  if (!workspaces[userId]) {
    workspaces[userId] = {};
  }
  workspaces[userId].orders = orders;
  saveAllWorkspaces(workspaces);
}

export function addOrUpdateUserOrder(userId: string, order: any): void {
  if (!userId || !order) return;
  const currentOrders = getUserOrders(userId);
  const existingIdx = currentOrders.findIndex((o: any) => o.id === order.id);

  if (existingIdx >= 0) {
    currentOrders[existingIdx] = { ...currentOrders[existingIdx], ...order };
  } else {
    currentOrders.unshift(order);
  }

  saveUserOrders(userId, currentOrders);
}

export function getUserWorkspaceData(userId: string): UserWorkspaceData {
  if (!userId) return {};
  const workspaces = loadAllWorkspaces();
  return workspaces[userId] || {};
}

export function saveUserWorkspaceData(userId: string, data: Partial<UserWorkspaceData>): void {
  if (!userId) return;
  const workspaces = loadAllWorkspaces();
  workspaces[userId] = {
    ...workspaces[userId],
    ...data,
  };
  saveAllWorkspaces(workspaces);
}

export function getUserLanguage(userId: string): 'en' | 'bn' {
  if (!userId) return 'en';
  const workspace = getUserWorkspaceData(userId);
  return (workspace.settings?.language as 'en' | 'bn') || 'en';
}

export function setUserLanguage(userId: string, language: 'en' | 'bn'): void {
  if (!userId) return;
  const workspace = getUserWorkspaceData(userId);
  const currentSettings = workspace.settings || {};
  saveUserWorkspaceData(userId, {
    settings: {
      ...currentSettings,
      language,
    },
  });
}
