/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  setDoc, 
  doc, 
  onSnapshot, 
  writeBatch,
  query,
  orderBy,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { 
  RouteUser, Rota, GPSLocation, ChatMessage, 
  NotificationLog, PushDeliveryLog, AuditLogEntry, RoutePerformanceLog 
} from './types';
import { 
  INITIAL_USERS, INITIAL_ROTAS, INITIAL_LOCATIONS, 
  INITIAL_CHAT, INITIAL_NOTIFICATIONS, INITIAL_AUDIT_LOGS,
  INITIAL_PERFORMANCE_LOGS, INITIAL_PUSH_LOGS 
} from './mockData';

// Fetch the platform configuration inside the workspace environment
const firebaseConfig = {
  projectId: "dlojinha",
  appId: "1:841386070930:web:978edb41c30235c1db274b",
  apiKey: "AIzaSyCKrrww2NhinEq2a3OEEydfBrkovUrYxuI",
  authDomain: "dlojinha.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-e2c2a647-eccf-4dd5-a051-f6a02c26de31",
  storageBucket: "dlojinha.firebasestorage.app",
  messagingSenderId: "841386070930",
  measurementId: ""
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore with the custom database ID designed for isolation in the sandbox environment
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

/**
 * Seeds Database Collections if Firestore is currently empty,
 * ensuring the operator always starts with a fully populated workspace.
 */
export async function seedDatabaseIfEmpty() {
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    if (usersSnap.empty) {
      console.log('[Firebase Storage] Database empty. Seeding initial mockup rosters...');
      
      const batch = writeBatch(db);

      // Seed Users
      INITIAL_USERS.forEach(user => {
        const uRef = doc(db, 'users', user.id);
        batch.set(uRef, user);
      });

      // Seed Routes
      INITIAL_ROTAS.forEach(rota => {
        const rRef = doc(db, 'rotas', rota.id);
        batch.set(rRef, rota);
      });

      // Seed Locations
      Object.entries(INITIAL_LOCATIONS).forEach(([drvId, loc]) => {
        const lRef = doc(db, 'locations', drvId);
        batch.set(lRef, loc);
      });

      // Seed Chats
      INITIAL_CHAT.forEach(chat => {
        const cRef = doc(db, 'chats', chat.id);
        batch.set(cRef, chat);
      });

      // Seed Notifications
      INITIAL_NOTIFICATIONS.forEach(notif => {
        const nRef = doc(db, 'notifications', notif.id);
        batch.set(nRef, notif);
      });

      // Seed Audit Logs
      INITIAL_AUDIT_LOGS.forEach(audit => {
        const aRef = doc(db, 'auditLogs', audit.id);
        batch.set(aRef, audit);
      });

      // Seed Performance Logs
      INITIAL_PERFORMANCE_LOGS.forEach(perf => {
        const pRef = doc(db, 'performanceLogs', perf.id);
        batch.set(pRef, perf);
      });

      // Seed Push Logs
      INITIAL_PUSH_LOGS.forEach(push => {
        const pLogRef = doc(db, 'pushLogs', push.id);
        batch.set(pLogRef, push);
      });

      await batch.commit();
      console.log('[Firebase Storage] Database seeding completed successfully.');
    } else {
      console.log('[Firebase Storage] Cloud database already configured. No seeding required.');
    }
  } catch (err) {
    console.error('[Firebase Storage] Error checking/seeding database:', err);
  }
}

// -------------------------------------------------------------
// REAL-TIME MUTATION API (Writes modifications to Cloud Storage)
// -------------------------------------------------------------

export async function saveCloudUser(user: RouteUser) {
  try {
    await setDoc(doc(db, 'users', user.id), user);
  } catch (err) {
    console.error('Error saving user to Firestore:', err);
  }
}

export async function saveCloudRoute(rota: Rota) {
  try {
    await setDoc(doc(db, 'rotas', rota.id), rota);
  } catch (err) {
    console.error('Error saving rota to Firestore:', err);
  }
}

export async function deleteCloudRoute(routeId: string) {
  try {
    await deleteDoc(doc(db, 'rotas', routeId));
  } catch (err) {
    console.error('Error deleting rota in Firestore:', err);
  }
}

export async function saveCloudGPSLocation(location: GPSLocation) {
  try {
    await setDoc(doc(db, 'locations', location.driverId), location);
  } catch (err) {
    console.error('Error saving location to Firestore:', err);
  }
}

export async function saveCloudChat(chat: ChatMessage) {
  try {
    await setDoc(doc(db, 'chats', chat.id), chat);
  } catch (err) {
    console.error('Error saving chat message to Firestore:', err);
  }
}

export async function saveCloudNotification(notif: NotificationLog) {
  try {
    await setDoc(doc(db, 'notifications', notif.id), notif);
  } catch (err) {
    console.error('Error saving notification to Firestore:', err);
  }
}

export async function saveCloudAuditLog(audit: AuditLogEntry) {
  try {
    await setDoc(doc(db, 'auditLogs', audit.id), audit);
  } catch (err) {
    console.error('Error saving audit log to Firestore:', err);
  }
}

export async function saveCloudPerformanceLog(perf: RoutePerformanceLog) {
  try {
    await setDoc(doc(db, 'performanceLogs', perf.id), perf);
  } catch (err) {
    console.error('Error saving performance log to Firestore:', err);
  }
}

export async function saveCloudPushLog(push: PushDeliveryLog) {
  try {
    await setDoc(doc(db, 'pushLogs', push.id), push);
  } catch (err) {
    console.error('Error saving push log to Firestore:', err);
  }
}

/**
 * Resets Firestore database collections to baseline mockups
 */
export async function resetCloudDatabaseAll() {
  try {
    console.log('[Firebase Storage] Resetting all collections to baseline mockups...');
    
    // Clear Existing (We'll fetch and delete because Firestore doesn't have a direct clear)
    const collectionsToClear = ['users', 'rotas', 'locations', 'chats', 'notifications', 'auditLogs', 'performanceLogs', 'pushLogs'];
    
    for (const collName of collectionsToClear) {
      const gSnap = await getDocs(collection(db, collName));
      const batch = writeBatch(db);
      gSnap.docs.forEach(d => {
        batch.delete(doc(db, collName, d.id));
      });
      await batch.commit();
    }

    // Now Seed
    const batch = writeBatch(db);
    
    INITIAL_USERS.forEach(user => {
      batch.set(doc(db, 'users', user.id), user);
    });

    INITIAL_ROTAS.forEach(rota => {
      batch.set(doc(db, 'rotas', rota.id), rota);
    });

    Object.entries(INITIAL_LOCATIONS).forEach(([drvId, loc]) => {
      batch.set(doc(db, 'locations', drvId), loc);
    });

    INITIAL_CHAT.forEach(chat => {
      batch.set(doc(db, 'chats', chat.id), chat);
    });

    INITIAL_NOTIFICATIONS.forEach(notif => {
      batch.set(doc(db, 'notifications', notif.id), notif);
    });

    INITIAL_AUDIT_LOGS.forEach(audit => {
      batch.set(doc(db, 'auditLogs', audit.id), audit);
    });

    INITIAL_PERFORMANCE_LOGS.forEach(perf => {
      batch.set(doc(db, 'performanceLogs', perf.id), perf);
    });

    INITIAL_PUSH_LOGS.forEach(push => {
      batch.set(doc(db, 'pushLogs', push.id), push);
    });

    await batch.commit();
    console.log('[Firebase Storage] Database reset successfully completed.');
  } catch (err) {
    console.error('[Firebase Storage] Error resetting database:', err);
  }
}
