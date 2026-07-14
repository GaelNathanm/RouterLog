/// <reference types="vite/client" />

/**
 * RouteLog Enterprise - Clean Firebase Frontend Configuration
 * Uses Vite environment variables with automatic fallback.
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import appletConfig from '../firebase-applet-config.json';

// Configuration prioritizing the local config (which is updated live by the platform)
// with fallbacks to environment variables and exact production credentials.
const firebaseConfig = {
  apiKey: appletConfig.apiKey || import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCKrrww2NhinEq2a3OEEydfBrkovUrYxuI",
  authDomain: appletConfig.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "dlojinha.firebaseapp.com",
  projectId: appletConfig.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || "dlojinha",
  storageBucket: appletConfig.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "dlojinha.firebasestorage.app",
  messagingSenderId: appletConfig.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "841386070930",
  appId: appletConfig.appId || import.meta.env.VITE_FIREBASE_APP_ID || "1:841386070930:web:978edb41c30235c1db274b",
  databaseId: appletConfig.firestoreDatabaseId || import.meta.env.VITE_FIREBASE_DATABASE_ID || "ai-studio-routelog-e2c2a647-eccf-4dd5-a051-f6a02c26de31",
};

// Validate required environment variables at runtime
const envVarsCheck = {
  VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY || (process.env as any).VITE_FIREBASE_API_KEY || appletConfig.apiKey,
  VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || (process.env as any).VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain,
  VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID || (process.env as any).VITE_FIREBASE_PROJECT_ID || appletConfig.projectId,
  VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID || (process.env as any).VITE_FIREBASE_APP_ID || appletConfig.appId,
  VITE_FIREBASE_DATABASE_ID: import.meta.env.VITE_FIREBASE_DATABASE_ID || (process.env as any).VITE_FIREBASE_DATABASE_ID || appletConfig.firestoreDatabaseId,
};

export const missingFirebaseEnvVars = Object.entries(envVarsCheck)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

export const hasFirebaseConfigError = missingFirebaseEnvVars.length > 0;

console.log('[Firebase config] Initializing core with project ID:', firebaseConfig.projectId);

const app = initializeApp(firebaseConfig);

// Initialize Firestore with robust persistent local cache for multi-tab support
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, firebaseConfig.databaseId);

export const auth = getAuth(app);

export default app;
