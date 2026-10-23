import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

// Read config explicitly
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};

const TARGET_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId || 'ai-studio-vistoosa2';
const TARGET_DB_ID = process.env.FIRESTORE_DATABASE_ID || firebaseConfig.firestoreDatabaseId || '(default)';

console.log(`[Firebase Admin Startup]: Initializing with ProjectID: "${TARGET_PROJECT_ID}", DatabaseID: "${TARGET_DB_ID}"`);

let app: any;
if (!getApps().length) {
  const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountRaw) {
    try {
      let serviceAccount = JSON.parse(serviceAccountRaw);
      if (serviceAccount && typeof serviceAccount.private_key === 'string') {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
      app = initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id || TARGET_PROJECT_ID,
      });
    } catch (err: any) {
      console.error('[Firebase Admin Error]: Failed to parse service account JSON from environment variables.');
      app = initializeApp({ projectId: TARGET_PROJECT_ID });
    }
  } else {
    app = initializeApp({ projectId: TARGET_PROJECT_ID });
  }
} else {
  app = getApps()[0];
}

export const db = getFirestore(app, TARGET_DB_ID);

try {
  db.settings({ ignoreUndefinedProperties: true });
} catch (err) {}

let firestoreQuotaExceeded = false;
let lastQuotaExceededAt = 0;

// Firestore Read Counter Tracking for Section G
const readCounters: Record<string, number> = {
  orders: 0,
  conversations: 0,
  messages: 0,
  products: 0,
  settings: 0,
  others: 0,
};

export function incrementFirestoreReads(collectionName: string = 'others') {
  const key = readCounters[collectionName] !== undefined ? collectionName : 'others';
  readCounters[key]++;
}

export function getFirestoreReadStats() {
  const total = Object.values(readCounters).reduce((a, b) => a + b, 0);
  return { total, ...readCounters };
}

export function isQuotaExceededError(err: any): boolean {
  if (!err) return false;
  return (
    err?.code === 8 ||
    err?.code === 'RESOURCE_EXHAUSTED' ||
    (typeof err?.message === 'string' &&
      (err.message.includes('RESOURCE_EXHAUSTED') ||
        err.message.includes('Quota exceeded') ||
        err.message.includes('quota has been exhausted')))
  );
}

export function isPermissionDeniedError(err: any): boolean {
  if (!err) return false;
  return (
    err?.code === 7 ||
    err?.code === 'PERMISSION_DENIED' ||
    (typeof err?.message === 'string' && err.message.includes('PERMISSION_DENIED'))
  );
}

export function isFirestoreQuotaExceeded(): boolean {
  return firestoreQuotaExceeded;
}

export function markFirestoreQuotaExceeded(): void {
  if (!firestoreQuotaExceeded) {
    firestoreQuotaExceeded = true;
    lastQuotaExceededAt = Date.now();
    console.info('[Firestore Status]: Daily cloud quota reached; seamlessly running in high-performance local memory mode.');
  }
}

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    const docRef = db.collection('_healthcheck').doc('ping');
    await docRef.set({ timestamp: new Date().toISOString() });
    await docRef.get();
    incrementFirestoreReads('others');
    if (firestoreQuotaExceeded) {
      firestoreQuotaExceeded = false;
      console.info('[Firestore Status]: Firestore recovered');
    }
    return true;
  } catch (err: any) {
    console.error(`[Firebase Admin Startup]: Firestore Error:`, err.message || err);
    if (isQuotaExceededError(err)) {
      markFirestoreQuotaExceeded();
    }
    return false;
  }
}

// Automatic background check/retry every 10 minutes to clear quota flag if recovered
setInterval(async () => {
  if (firestoreQuotaExceeded) {
    const recovered = await testFirestoreConnection();
    if (recovered) {
      firestoreQuotaExceeded = false;
      console.info('[Firestore Status]: Firestore recovered after 10-minute retry check.');
    }
  }
}, 10 * 60 * 1000);

testFirestoreConnection();
export default app;