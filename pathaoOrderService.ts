// pathaoOrderService.ts
// -----------------------------------------------------------------------
// REAL Pathao Courier API integration (Per-User Configuration in Firestore).
//
// Reads credentials from `await loadPathaoConfig(userId)` saved via Settings UI in Firestore.

import { loadPathaoConfig } from './pathaoConfigStore';

async function getCredentials(userId: string) {
  const fileConfig = await loadPathaoConfig(userId);
  const baseUrl = fileConfig?.baseUrl || process.env.PATHAO_BASE_URL || 'https://api-hermes.pathao.com';
  const clientId = fileConfig?.clientId || process.env.PATHAO_CLIENT_ID;
  const clientSecret = fileConfig?.clientSecret || process.env.PATHAO_CLIENT_SECRET;
  const username = fileConfig?.username || process.env.PATHAO_USERNAME;
  const password = fileConfig?.password || process.env.PATHAO_PASSWORD;
  const storeId = fileConfig?.storeId || process.env.PATHAO_STORE_ID;

  return { baseUrl, clientId, clientSecret, username, password, storeId };
}

// Cached token per user ID
const tokenCacheMap = new Map<string, { accessToken: string; refreshToken: string; expiresAt: number }>();

async function fetchNewToken(userId: string) {
  const creds = await getCredentials(userId);
  if (!creds.clientId || !creds.clientSecret || !creds.username || !creds.password) {
    throw new Error('Pathao credentials missing for your account. Please set them in Settings > Connect Channels > Pathao Courier.');
  }

  const res = await fetch(`${creds.baseUrl}/aladdin/api/v1/issue-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      username: creds.username,
      password: creds.password,
      grant_type: 'password',
    }),
  });
  if (!res.ok) throw new Error(`Pathao token request failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const tokenObj = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000, // refresh 60s early
  };
  tokenCacheMap.set(userId, tokenObj);
  return tokenObj.accessToken;
}

async function getAccessToken(userId: string): Promise<string> {
  const cachedToken = tokenCacheMap.get(userId);
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.accessToken;
  return fetchNewToken(userId);
}

export interface PathaoOrderInput {
  merchantOrderId: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  recipientCityId: number;   // from "Get List of Cities" API
  recipientZoneId: number;   // from "Get zones inside a particular city" API
  amountToCollect: number;
  itemDescription: string;
  itemQuantity?: number;
  itemWeight?: number;       // kg, e.g. 0.5
  specialInstruction?: string;
}

export async function createPathaoOrder(userId: string, order: PathaoOrderInput) {
  const token = await getAccessToken(userId);
  const creds = await getCredentials(userId);

  if (!creds.storeId) {
    throw new Error('Pathao Store ID is required for your account. Please set it in Settings > Connect Channels > Pathao Courier.');
  }

  const res = await fetch(`${creds.baseUrl}/aladdin/api/v1/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      store_id: Number(creds.storeId),
      merchant_order_id: order.merchantOrderId,
      recipient_name: order.recipientName,
      recipient_phone: order.recipientPhone,
      recipient_address: order.recipientAddress,
      recipient_city: order.recipientCityId,
      recipient_zone: order.recipientZoneId,
      delivery_type: 48, // 48 = Normal Delivery
      item_type: 2,      // 2 = Parcel
      special_instruction: order.specialInstruction || '',
      item_quantity: order.itemQuantity || 1,
      item_weight: order.itemWeight || 0.5,
      item_description: order.itemDescription,
      amount_to_collect: order.amountToCollect,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Pathao order creation failed: ${res.status} ${JSON.stringify(data)}`);

  return data.data;
}

// Fallback Cities Dataset for Pathao Integration
const DEFAULT_PATHAO_CITIES = [
  { city_id: 1, city_name: 'Dhaka' },
  { city_id: 2, city_name: 'Gazipur' },
  { city_id: 3, city_name: 'Narayanganj' },
  { city_id: 4, city_name: 'Chittagong' },
  { city_id: 5, city_name: 'Sylhet' },
  { city_id: 6, city_name: 'Rajshahi' },
  { city_id: 7, city_name: 'Khulna' },
  { city_id: 8, city_name: 'Bogra' },
  { city_id: 9, city_name: 'Barisal' },
  { city_id: 10, city_name: 'Cumilla' },
  { city_id: 11, city_name: 'Rangpur' },
  { city_id: 12, city_name: 'Mymensingh' },
  { city_id: 13, city_name: 'Jessore' },
  { city_id: 14, city_name: 'Narsingdi' },
  { city_id: 15, city_name: 'Coxs Bazar' },
  { city_id: 16, city_name: 'Feni' },
  { city_id: 17, city_name: 'Noakhali' },
  { city_id: 18, city_name: 'Pabna' },
  { city_id: 19, city_name: 'Kushtia' },
  { city_id: 20, city_name: 'Dinajpur' },
  { city_id: 21, city_name: 'Brahmanbaria' },
  { city_id: 22, city_name: 'Chandpur' },
  { city_id: 23, city_name: 'Lakshmipur' },
  { city_id: 24, city_name: 'Tangail' },
  { city_id: 25, city_name: 'Moulvibazar' },
  { city_id: 26, city_name: 'Habiganj' },
  { city_id: 27, city_name: 'Sunamganj' },
];

export async function getPathaoCities(userId: string) {
  try {
    const creds = await getCredentials(userId);
    if (!creds.clientId || !creds.clientSecret) {
      return DEFAULT_PATHAO_CITIES;
    }
    const token = await getAccessToken(userId);
    const res = await fetch(`${creds.baseUrl}/aladdin/api/v1/countries/1/city-list`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return DEFAULT_PATHAO_CITIES;
    const json = await res.json();
    return json?.data?.data || json?.data || DEFAULT_PATHAO_CITIES;
  } catch (err) {
    console.warn('[Pathao Cities Fetch Fallback]:', err);
    return DEFAULT_PATHAO_CITIES;
  }
}

export async function getPathaoZones(userId: string, cityId: number) {
  try {
    const creds = await getCredentials(userId);
    if (!creds.clientId || !creds.clientSecret || !cityId) {
      return [];
    }
    const token = await getAccessToken(userId);
    const res = await fetch(`${creds.baseUrl}/aladdin/api/v1/cities/${cityId}/zone-list`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json?.data?.data || json?.data || [];
  } catch (err) {
    console.warn('[Pathao Zones Fetch Fallback]:', err);
    return [];
  }
}
