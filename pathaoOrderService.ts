// pathaoOrderService.ts
// -----------------------------------------------------------------------
// REAL Pathao Courier API integration.
//
// Reads credentials from `loadPathaoConfig()` (saved via Settings UI in pathao-config.json),
// and falls back to environment variables (`process.env.PATHAO_*`) if file config is missing.

import { loadPathaoConfig } from './pathaoConfigStore';

function getCredentials() {
  const fileConfig = loadPathaoConfig();
  const baseUrl = fileConfig?.baseUrl || process.env.PATHAO_BASE_URL || 'https://api-hermes.pathao.com';
  const clientId = fileConfig?.clientId || process.env.PATHAO_CLIENT_ID;
  const clientSecret = fileConfig?.clientSecret || process.env.PATHAO_CLIENT_SECRET;
  const username = fileConfig?.username || process.env.PATHAO_USERNAME;
  const password = fileConfig?.password || process.env.PATHAO_PASSWORD;
  const storeId = fileConfig?.storeId || process.env.PATHAO_STORE_ID;

  return { baseUrl, clientId, clientSecret, username, password, storeId };
}

let cachedToken: { accessToken: string; refreshToken: string; expiresAt: number } | null = null;

async function fetchNewToken() {
  const creds = getCredentials();
  if (!creds.clientId || !creds.clientSecret || !creds.username || !creds.password) {
    throw new Error('Pathao credentials missing. Please set them in Settings > Connect Channels > Pathao or via environment variables.');
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
  cachedToken = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000, // refresh 60s early
  };
  return cachedToken.accessToken;
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.accessToken;
  return fetchNewToken();
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

export async function createPathaoOrder(order: PathaoOrderInput) {
  const token = await getAccessToken();
  const creds = getCredentials();

  if (!creds.storeId) {
    throw new Error('Pathao Store ID is required. Please set it in Settings > Connect Channels > Pathao.');
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

  // data.data contains: consignment_id, merchant_order_id, order_status, delivery_fee
  return data.data;
}
