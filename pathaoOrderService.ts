import { loadPathaoConfig, resolveOwnerUserId } from './pathaoConfigStore';
import { detectDistrict } from './src/utils/districtDetector';

function cleanPhoneNumber(rawPhone: string): string {
  let cleaned = String(rawPhone || '').replace(/\D/g, '');
  if (cleaned.startsWith('880')) {
    cleaned = cleaned.substring(2);
  }
  if (cleaned.length === 10 && cleaned.startsWith('1')) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
}

async function getCredentials(userId: string) {
  const conf = await loadPathaoConfig(userId);
  const fallbackConf = userId !== 'usr_vistoosa_mother' ? await loadPathaoConfig('usr_vistoosa_mother') : null;

  const baseUrl = conf?.baseUrl || fallbackConf?.baseUrl || process.env.PATHAO_BASE_URL || 'https://api-hermes.pathao.com';
  const clientId = conf?.clientId || fallbackConf?.clientId || process.env.PATHAO_CLIENT_ID;
  const clientSecret = conf?.clientSecret || fallbackConf?.clientSecret || process.env.PATHAO_CLIENT_SECRET;
  const username = conf?.username || fallbackConf?.username || process.env.PATHAO_USERNAME;
  const password = conf?.password || fallbackConf?.password || process.env.PATHAO_PASSWORD;
  const storeId = conf?.storeId || fallbackConf?.storeId || process.env.PATHAO_STORE_ID;

  const hasCredentials = Boolean(clientId && clientSecret && username && password);
  console.log(`[Pathao Credentials Check]: UserId="${userId}", foundCredentials=${hasCredentials}`);

  return { baseUrl, clientId, clientSecret, username, password, storeId, hasCredentials };
}

const tokenCacheMap = new Map<string, { accessToken: string; refreshToken: string; expiresAt: number }>();

async function fetchNewToken(userId: string) {
  const creds = await getCredentials(userId);
  if (!creds.hasCredentials) {
    throw new Error('Pathao credentials missing: set them in Settings > Connect Channels > Pathao Courier.');
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
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Pathao token request failed (${res.status}): ${errText}`);
  }
  const data = await res.json();
  const tokenObj = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
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
  recipientCityId?: number;
  recipientZoneId?: number;
  recipientCity?: string;
  amountToCollect: number;
  itemDescription: string;
  itemQuantity?: number;
  itemWeight?: number;
  specialInstruction?: string;
}

export async function createPathaoOrder(userId: string, order: PathaoOrderInput) {
  const resolvedUserId = userId || 'usr_vistoosa_mother';
  console.log(`[Pathao Dispatch]: Using userId="${resolvedUserId}" for order "${order.merchantOrderId}"`);

  const phone = cleanPhoneNumber(order.recipientPhone);
  if (!phone || phone.length !== 11 || !phone.startsWith('01')) {
    throw new Error('Dispatch rejected: Order has no valid 11-digit Bangladeshi phone number (01XXXXXXXXX).');
  }
  if (!order.recipientAddress || order.recipientAddress.trim().length < 5) {
    throw new Error('Dispatch rejected: Order has no valid delivery address.');
  }

  const creds = await getCredentials(resolvedUserId);
  if (!creds.hasCredentials) {
    throw new Error('Pathao credentials missing: set them in Settings > Connect Channels > Pathao Courier.');
  }

  const token = await getAccessToken(resolvedUserId);

  let storeIdNum = Number(creds.storeId || 0);
  if (!storeIdNum || isNaN(storeIdNum)) {
    const storesRes = await fetch(`${creds.baseUrl}/aladdin/api/v1/stores`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (storesRes.ok) {
      const storesData = await storesRes.json();
      const storeList = storesData?.data?.data || storesData?.data || [];
      if (storeList.length > 0) {
        storeIdNum = Number(storeList[0].store_id || storeList[0].id || 1);
      }
    }
  }
  if (!storeIdNum || isNaN(storeIdNum)) {
    storeIdNum = 1;
  }

  let cityIdNum = Number(order.recipientCityId || 0);
  if (!cityIdNum || isNaN(cityIdNum)) {
    const detected = detectDistrict(order.recipientAddress, order.recipientCity || '');
    cityIdNum = detected.pathaoCityId || 1;
  }

  let zoneIdNum = Number(order.recipientZoneId || 0);
  if (!zoneIdNum || isNaN(zoneIdNum)) {
    const zones = await getPathaoZones(resolvedUserId, cityIdNum);
    if (zones && zones.length > 0) {
      zoneIdNum = Number(zones[0].zone_id || zones[0].id || 1);
    }
  }
  if (!zoneIdNum || isNaN(zoneIdNum)) {
    zoneIdNum = 1;
  }

  const payload = {
    store_id: storeIdNum,
    merchant_order_id: order.merchantOrderId,
    recipient_name: order.recipientName,
    recipient_phone: phone,
    recipient_address: order.recipientAddress,
    recipient_city: cityIdNum,
    recipient_zone: zoneIdNum,
    delivery_type: 48,
    item_type: 2,
    special_instruction: order.specialInstruction || '',
    item_quantity: Number(order.itemQuantity || 1),
    item_weight: Number(order.itemWeight || 0.5),
    item_description: order.itemDescription || 'Vistoosa Luxury Apparel',
    amount_to_collect: Number(order.amountToCollect || 0),
  };

  const res = await fetch(`${creds.baseUrl}/aladdin/api/v1/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (res.ok && data?.data) {
    return data.data;
  }

  const errDetail = data?.message || JSON.stringify(data?.errors || data) || 'Unknown Pathao API error';
  throw new Error(`Pathao API Dispatch Error: ${errDetail}`);
}

export async function getPathaoOrderStatus(userId: string, consignmentId: string) {
  const creds = await getCredentials(userId);
  const token = await getAccessToken(userId);

  const res = await fetch(`${creds.baseUrl}/aladdin/api/v1/orders/${consignmentId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();
  if (res.ok && data?.data) {
    return data.data;
  }
  throw new Error(data?.message || 'Failed to fetch Pathao order status');
}

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
    if (!creds.hasCredentials) return DEFAULT_PATHAO_CITIES;
    const token = await getAccessToken(userId);
    const res = await fetch(`${creds.baseUrl}/aladdin/api/v1/countries/1/city-list`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return DEFAULT_PATHAO_CITIES;
    const json = await res.json();
    return json?.data?.data || json?.data || DEFAULT_PATHAO_CITIES;
  } catch (err) {
    return DEFAULT_PATHAO_CITIES;
  }
}

export async function getPathaoZones(userId: string, cityId: number) {
  try {
    const creds = await getCredentials(userId);
    if (!creds.hasCredentials || !cityId) return [];
    const token = await getAccessToken(userId);
    const res = await fetch(`${creds.baseUrl}/aladdin/api/v1/cities/${cityId}/zone-list`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json?.data?.data || json?.data || [];
  } catch (err) {
    return [];
  }
}
