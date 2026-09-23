import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let app;
const TARGET_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'vistoosa-8ce3f';

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

// Explicitly target the "(default)" database ID in Native mode
export const db = getFirestore(app, '(default)');

try {
  db.settings({ ignoreUndefinedProperties: true });
} catch (err) {
  // Ignore if settings already initialized
}

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    // Test ping query against Firestore database "(default)"
    await db.collection('_healthcheck').doc('ping').get();
    console.log(`Firebase Firestore connected successfully to database "(default)" in project "${TARGET_PROJECT_ID}"`);
    return true;
  } catch (err: any) {
    console.error('Firebase Firestore connection test failed:', err?.message || err, err);
    return false;
  }
}

// Perform initial connection test on module load
testFirestoreConnection();

export default app;
