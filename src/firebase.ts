import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore with ignoreUndefinedProperties: true so undefined fields never reject writes
let dbInstance;
try {
  dbInstance = firebaseConfig.firestoreDatabaseId
    ? initializeFirestore(app, { ignoreUndefinedProperties: true }, firebaseConfig.firestoreDatabaseId)
    : initializeFirestore(app, { ignoreUndefinedProperties: true });
} catch {
  dbInstance = firebaseConfig.firestoreDatabaseId
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);
}

export const db = dbInstance;
export const IS_GOOGLE_CLOUD_CONNECTED = true;

/**
 * Sanitizes object by removing undefined keys and ensuring plain JSON payload for Firestore
 */
export function sanitizeFirestoreData<T>(obj: T): T {
  if (obj === undefined || obj === null) return null as unknown as T;
  return JSON.parse(JSON.stringify(obj, (_key, value) => (value === undefined ? null : value)));
}

export default app;

