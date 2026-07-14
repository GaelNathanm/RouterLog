/// <reference types="vite/client" />

/**
 * RouteLog Enterprise - Clean Firebase Frontend Configuration
 * Uses Vite environment variables with automatic fallback.
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import appletConfig from '../firebase-applet-config.json';

// Configuration utilizing Vite env variables with fallback to applet configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || appletConfig.apiKey || "AIzaSyCKrrww2NhinEq2a3OEEydfBrkovUrYxuI",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain || "dlojinha.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId || "dlojinha",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket || "dlojinha.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId || "841386070930",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || appletConfig.appId || "1:841386070930:web:add53a4948d6b26edb274b",
  databaseId: (() => {
    const envDbId = import.meta.env.VITE_FIREBASE_DATABASE_ID;
    // Ignore Google Analytics measurement ID prefixes (e.g. G-RCXBHG2S7F) or standard .env.example placeholders
    if (!envDbId || envDbId.startsWith('G-') || envDbId.includes('nome_do_banco')) {
      return appletConfig.firestoreDatabaseId || undefined;
    }
    return envDbId;
  })(),
};

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
