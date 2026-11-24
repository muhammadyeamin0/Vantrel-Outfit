import type { FirebaseApp } from 'firebase/app';
import type { Auth, User as FirebaseUser } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { isSearchCrawler } from './utils/crawlerDetect';

export const IS_GOOGLE_CLOUD_CONNECTED = true;

let appPromise: Promise<FirebaseApp> | null = null;
let authPromise: Promise<Auth> | null = null;
let dbPromise: Promise<Firestore> | null = null;
let firestoreModPromise: Promise<typeof import('firebase/firestore')> | null = null;
let authModPromise: Promise<typeof import('firebase/auth')> | null = null;

let cachedAuthInstance: Auth | null = null;
let cachedDbInstance: Firestore | null = null;

export function getFirestoreModule(): Promise<typeof import('firebase/firestore')> {
  if (!firestoreModPromise) {
    firestoreModPromise = import('firebase/firestore');
  }
  return firestoreModPromise;
}

export function getAuthModule(): Promise<typeof import('firebase/auth')> {
  if (!authModPromise) {
    authModPromise = import('firebase/auth');
  }
  return authModPromise;
}

export async function getFirebaseApp(): Promise<FirebaseApp> {
  if (!appPromise) {
    appPromise = import('firebase/app').then(({ initializeApp, getApps, getApp }) =>
      getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
    );
  }
  return appPromise;
}

/**
 * Lazily initializes Firebase Auth WITHOUT eager popupRedirectResolver iframe injection,
 * eliminating the 92.8 KiB __/auth/iframe.js network request on initial page loads.
 */
export async function getFirebaseAuth(): Promise<Auth> {
  if (cachedAuthInstance) return cachedAuthInstance;
  if (!authPromise) {
    authPromise = (async () => {
      const [app, authMod] = await Promise.all([getFirebaseApp(), getAuthModule()]);
      let instance: Auth;
      if (typeof window !== 'undefined') {
        try {
          instance = authMod.initializeAuth(app, {
            persistence: [
              authMod.browserLocalPersistence,
              authMod.indexedDBLocalPersistence,
              authMod.browserSessionPersistence,
              authMod.inMemoryPersistence
            ]
          });
        } catch {
          instance = authMod.getAuth(app);
          void authMod.setPersistence(instance, authMod.browserLocalPersistence).catch(() => {});
        }
      } else {
        instance = authMod.getAuth(app);
      }
      cachedAuthInstance = instance;
      return instance;
    })();
  }
  return authPromise;
}

/**
 * Lazily initializes Cloud Firestore against the configured named database ID.
 */
export async function getFirebaseDb(): Promise<Firestore> {
  if (cachedDbInstance) return cachedDbInstance;
  if (!dbPromise) {
    dbPromise = (async () => {
      const [app, firestoreMod] = await Promise.all([getFirebaseApp(), getFirestoreModule()]);
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

      let instance: Firestore;
      try {
        instance = firebaseConfig.firestoreDatabaseId
          ? firestoreMod.initializeFirestore(app, firestoreSettings, firebaseConfig.firestoreDatabaseId)
          : firestoreMod.initializeFirestore(app, firestoreSettings);
      } catch {
        instance = firebaseConfig.firestoreDatabaseId
          ? firestoreMod.getFirestore(app, firebaseConfig.firestoreDatabaseId)
          : firestoreMod.getFirestore(app);
      }
      cachedDbInstance = instance;
      return instance;
    })();
  }
  return dbPromise;
}

/**
 * Synchronous accessor returning cached Firebase user only if Auth has already initialized.
 */
export function getCurrentFirebaseUserSync(): FirebaseUser | null {
  return cachedAuthInstance?.currentUser ?? null;
}

/**
 * Performs Google Sign-In Popup, loading browserPopupRedirectResolver ONLY on user click.
 */
export async function signInWithGooglePopup(selectAccountPrompt = false) {
  const [fbAuth, authMod] = await Promise.all([getFirebaseAuth(), getAuthModule()]);
  await authMod.setPersistence(fbAuth, authMod.browserLocalPersistence).catch(() => {});
  const gProvider = new authMod.GoogleAuthProvider();
  if (selectAccountPrompt) {
    gProvider.setCustomParameters({ prompt: 'select_account' });
  }
  return authMod.signInWithPopup(fbAuth, gProvider, authMod.browserPopupRedirectResolver);
}

export async function signOutFirebase(): Promise<void> {
  if (!cachedAuthInstance && !authPromise) return;
  const [fbAuth, authMod] = await Promise.all([getFirebaseAuth(), getAuthModule()]);
  await authMod.signOut(fbAuth);
}

/**
 * Sanitizes object by removing undefined keys and ensuring plain JSON payload for Firestore
 */
export function sanitizeFirestoreData<T>(obj: T): T {
  if (obj === undefined || obj === null) return null as unknown as T;
  return JSON.parse(JSON.stringify(obj, (_key, value) => (value === undefined ? null : value)));
}
