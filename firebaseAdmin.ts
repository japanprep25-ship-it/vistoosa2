import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let app;
if (!getApps().length) {
  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountEnv) {
    try {
      let serviceAccount = typeof serviceAccountEnv === 'string' ? JSON.parse(serviceAccountEnv) : serviceAccountEnv;
      if (serviceAccount && typeof serviceAccount.private_key === 'string') {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
      app = initializeApp({
        credential: cert(serviceAccount),
      });
      console.log('[Firebase Admin]: Initialized via FIREBASE_SERVICE_ACCOUNT env variable.');
    } catch (err: any) {
      console.error('[Firebase Admin Error]: Failed to parse FIREBASE_SERVICE_ACCOUNT JSON string:', err?.message || err, err);
      try {
        app = initializeApp();
      } catch (e) {
        // Fallback initialized
      }
    }
  } else {
    try {
      app = initializeApp();
      console.log('[Firebase Admin]: Initialized via default application credentials.');
    } catch (err: any) {
      console.warn('[Firebase Admin Warning]: No service account found; initializeApp default attempted:', err?.message || err);
    }
  }
} else {
  app = getApps()[0];
}

export const db = getFirestore(app);

try {
  db.settings({ ignoreUndefinedProperties: true });
} catch (err) {
  // Ignore if settings already initialized
}

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    // Test read query against Firestore
    await db.collection('_healthcheck').doc('ping').get();
    console.log('Firebase Firestore connected successfully');
    return true;
  } catch (err: any) {
    console.error('Firebase Firestore connection test failed:', err?.message || err, err);
    return false;
  }
}

// Perform initial connection test on module load
testFirestoreConnection();

export default app;
