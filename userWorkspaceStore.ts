import { db } from './firebaseAdmin';

const ORDERS_COLLECTION = 'orders';
const WORKSPACES_COLLECTION = 'workspaces';

export interface UserWorkspaceData {
  orders?: any[];
  cashEntries?: any[];
  expenses?: any[];
  products?: any[];
  settings?: Record<string, any>;
}

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

export async function getUserOrders(userId: string): Promise<any[]> {
  if (!userId) return [];

  try {
    const promises = [
      db.collection(ORDERS_COLLECTION).where('userId', '==', userId).get(),
    ];

    if (userId !== 'usr_admin_default') {
      promises.push(db.collection(ORDERS_COLLECTION).where('userId', '==', 'usr_admin_default').get());
    }

    const snapshots = await Promise.all(promises);
    const orderMap = new Map<string, any>();

    for (const snapshot of snapshots) {
      if (!snapshot.empty) {
        snapshot.docs.forEach((doc) => {
          orderMap.set(doc.id, doc.data());
        });
      }
    }

    if (orderMap.size === 0) {
      // Seed default sample orders for user's fresh workspace in Firestore
      const seedOrders = DEFAULT_SEED_ORDERS.map((o) => ({
        ...o,
        userId,
      }));

      const batch = db.batch();
      for (const order of seedOrders) {
        const docRef = db.collection(ORDERS_COLLECTION).doc(order.id);
        batch.set(docRef, order);
      }
      await batch.commit();

      return seedOrders;
    }

    const orders = Array.from(orderMap.values());
    // Sort orders descending by createdAt timestamp
    return orders.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  } catch (err: any) {
    console.error(`[UserWorkspaceStore]: getUserOrders error for user ${userId}:`, err?.message || err);
    return DEFAULT_SEED_ORDERS.map((o) => ({ ...o, userId }));
  }
}

export async function saveUserOrders(userId: string, orders: any[]): Promise<void> {
  if (!userId || !Array.isArray(orders)) return;

  try {
    const batch = db.batch();
    for (const order of orders) {
      if (!order || !order.id) continue;
      const docRef = db.collection(ORDERS_COLLECTION).doc(String(order.id));
      batch.set(docRef, { ...order, userId }, { merge: true });
    }
    await batch.commit();
  } catch (err: any) {
    console.error(`[UserWorkspaceStore]: saveUserOrders error for user ${userId}:`, err?.message || err);
  }
}

export async function addOrUpdateUserOrder(userId: string, order: any): Promise<void> {
  if (!userId || !order || !order.id) return;

  try {
    const docRef = db.collection(ORDERS_COLLECTION).doc(String(order.id));
    await docRef.set(
      {
        ...order,
        userId,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err: any) {
    console.error(`[UserWorkspaceStore]: addOrUpdateUserOrder error for user ${userId}:`, err?.message || err);
  }
}

export async function getUserWorkspaceData(userId: string): Promise<UserWorkspaceData> {
  if (!userId) return {};

  try {
    const orders = await getUserOrders(userId);

    const docRef = db.collection(WORKSPACES_COLLECTION).doc(userId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return {
        orders,
        cashEntries: [],
        expenses: [],
        products: [],
        settings: {},
      };
    }

    const data = doc.data() as UserWorkspaceData;
    return {
      ...data,
      orders,
    };
  } catch (err: any) {
    console.error(`[UserWorkspaceStore]: getUserWorkspaceData error for user ${userId}:`, err?.message || err);
    return {
      orders: [],
      cashEntries: [],
      expenses: [],
      products: [],
      settings: {},
    };
  }
}

export async function saveUserWorkspaceData(userId: string, data: Partial<UserWorkspaceData>): Promise<void> {
  if (!userId) return;

  try {
    if (data.orders && Array.isArray(data.orders)) {
      await saveUserOrders(userId, data.orders);
    }

    const { orders, ...nonOrderData } = data;
    if (Object.keys(nonOrderData).length > 0) {
      const docRef = db.collection(WORKSPACES_COLLECTION).doc(userId);
      await docRef.set(nonOrderData, { merge: true });
    }
  } catch (err: any) {
    console.error(`[UserWorkspaceStore]: saveUserWorkspaceData error for user ${userId}:`, err?.message || err);
  }
}

export async function getUserLanguage(userId: string): Promise<'en' | 'bn'> {
  if (!userId) return 'en';
  try {
    const workspace = await getUserWorkspaceData(userId);
    return (workspace.settings?.language as 'en' | 'bn') || 'en';
  } catch {
    return 'en';
  }
}

export async function setUserLanguage(userId: string, language: 'en' | 'bn'): Promise<void> {
  if (!userId) return;
  try {
    const workspace = await getUserWorkspaceData(userId);
    const currentSettings = workspace.settings || {};
    await saveUserWorkspaceData(userId, {
      settings: {
        ...currentSettings,
        language,
      },
    });
  } catch (err: any) {
    console.error(`[UserWorkspaceStore]: setUserLanguage error for user ${userId}:`, err?.message || err);
  }
}

export async function softDeleteUserOrders(userId: string, orderIds: string[]): Promise<void> {
  if (!userId || !Array.isArray(orderIds) || orderIds.length === 0) return;
  try {
    const batch = db.batch();
    const deletedAt = new Date().toISOString();
    for (const id of orderIds) {
      if (!id) continue;
      const docRef = db.collection(ORDERS_COLLECTION).doc(String(id));
      batch.update(docRef, { isDeleted: true, deletedAt, updatedAt: deletedAt });
    }
    await batch.commit();
    console.log(`[UserWorkspaceStore]: Soft deleted ${orderIds.length} orders for user ${userId}`);
  } catch (err: any) {
    console.error(`[UserWorkspaceStore]: softDeleteUserOrders error for user ${userId}:`, err?.message || err);
  }
}

export async function restoreUserOrders(userId: string, orderIds: string[]): Promise<void> {
  if (!userId || !Array.isArray(orderIds) || orderIds.length === 0) return;
  try {
    const batch = db.batch();
    const updatedAt = new Date().toISOString();
    for (const id of orderIds) {
      if (!id) continue;
      const docRef = db.collection(ORDERS_COLLECTION).doc(String(id));
      batch.update(docRef, { isDeleted: false, deletedAt: null, updatedAt });
    }
    await batch.commit();
    console.log(`[UserWorkspaceStore]: Restored ${orderIds.length} orders for user ${userId}`);
  } catch (err: any) {
    console.error(`[UserWorkspaceStore]: restoreUserOrders error for user ${userId}:`, err?.message || err);
  }
}

export async function deleteUserOrdersPermanently(userId: string, orderIds: string[]): Promise<void> {
  if (!userId || !Array.isArray(orderIds) || orderIds.length === 0) return;
  try {
    const batch = db.batch();
    for (const id of orderIds) {
      if (!id) continue;
      const docRef = db.collection(ORDERS_COLLECTION).doc(String(id));
      batch.delete(docRef);
    }
    await batch.commit();
    console.log(`[UserWorkspaceStore]: Permanently deleted ${orderIds.length} orders for user ${userId}`);
  } catch (err: any) {
    console.error(`[UserWorkspaceStore]: deleteUserOrdersPermanently error for user ${userId}:`, err?.message || err);
  }
}
