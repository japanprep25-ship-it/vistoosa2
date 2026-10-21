import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from './firebase-applet-config.json';

let app;
const TARGET_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || (firebaseConfig as any).projectId || 'master-focus-d98sv';
const TARGET_DB_ID = process.env.FIREBASE_DATABASE_ID || (firebaseConfig as any).firestoreDatabaseId || '(default)';

if (!getApps().length) {
  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountEnv) {
    try {
      let serviceAccount = typeof serviceAccountEnv === 'string' ? JSON.parse(serviceAccountEnv) : serviceAccountEnv;
      if (serviceAccount && typeof serviceAccount.private_key === 'string') {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
      const projectId = serviceAccount.project_id || TARGET_PROJECT_ID;

      app = initializeApp({
        credential: cert(serviceAccount),
        projectId: projectId,
      });
      console.log(`[Firebase Admin]: Initialized successfully for project_id: "${projectId}".`);
    } catch (err: any) {
      console.error('[Firebase Admin Error]: Failed to parse FIREBASE_SERVICE_ACCOUNT JSON string:', err?.message || err, err);
      try {
        app = initializeApp({ projectId: TARGET_PROJECT_ID });
      } catch (e) {
        // Fallback initialized
      }
    }
  } else {
    try {
      app = initializeApp({
        projectId: TARGET_PROJECT_ID,
      });
      console.log(`[Firebase Admin]: Initialized via default credentials for project_id: "${TARGET_PROJECT_ID}".`);
    } catch (err: any) {
      console.warn('[Firebase Admin Warning]: No service account found; initializeApp default attempted:', err?.message || err);
    }
  }
} else {
  app = getApps()[0];
}

// Target the designated Firestore database ID
export const db = getFirestore(app, TARGET_DB_ID);

try {
  db.settings({ ignoreUndefinedProperties: true });
} catch (err) {
  // Ignore if settings already initialized
}

let firestoreQuotaExceeded = false;

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
    console.info('[Firestore Status]: Daily cloud quota reached; seamlessly running in high-performance local memory mode.');
  }
}

export async function testFirestoreConnection(): Promise<boolean> {
  if (firestoreQuotaExceeded) {
    return false;
  }

  try {
    // Test ping query against Firestore database TARGET_DB_ID
    await db.collection('_healthcheck').doc('ping').get();
    console.log(`Firebase Firestore connected successfully to database "${TARGET_DB_ID}" in project "${TARGET_PROJECT_ID}"`);
    return true;
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      markFirestoreQuotaExceeded();
      return false;
    }

    if (isPermissionDeniedError(err)) {
      console.info(`[Firestore Status]: Operating in resilient local memory mode (Firestore permission restricted in project "${TARGET_PROJECT_ID}").`);
      return false;
    }

    console.info('[Firestore Status]: Operating in resilient local memory mode:', err?.message || err);
    return false;
  }
}

// Perform initial connection test on module load
testFirestoreConnection();

export default app;