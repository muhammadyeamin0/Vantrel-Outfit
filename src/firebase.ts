import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  setPersistence,
  browserLocalPersistence,
  indexedDBLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  browserPopupRedirectResolver,
  type Auth
} from 'firebase/auth';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { isSearchCrawler } from './utils/crawlerDetect';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let authInstance: Auth;
if (typeof window !== 'undefined') {
  try {
    authInstance = initializeAuth(app, {
      persistence: [
        browserLocalPersistence,
        indexedDBLocalPersistence,
        browserSessionPersistence,
        inMemoryPersistence
      ],
      popupRedirectResolver: browserPopupRedirectResolver
    });
  } catch {
    authInstance = getAuth(app);
    void setPersistence(authInstance, browserLocalPersistence).catch(() => {});
  }
} else {
  authInstance = getAuth(app);
}

export const auth = authInstance;

// For real users, enable long-polling fallback behind restrictive mobile/proxy networks.
// For search engine crawlers, avoid long-polling streaming overrides so one-time getDocs completes cleanly.
const isCrawlerSession = typeof window !== 'undefined' && isSearchCrawler();

const firestoreSettings =
  typeof window !== 'undefined' && !isCrawlerSession
    ? {
        ignoreUndefinedProperties: true,
        experimentalForceLongPolling: true,
        experimentalLongPollingOptions: { timeoutSeconds: 20 }
      }
    : {
        ignoreUndefinedProperties: true
      };

let dbInstance;
try {
  dbInstance = firebaseConfig.firestoreDatabaseId
    ? initializeFirestore(app, firestoreSettings, firebaseConfig.firestoreDatabaseId)
    : initializeFirestore(app, firestoreSettings);
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
