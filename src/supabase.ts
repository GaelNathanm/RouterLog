/**
 * Real-time Reactive Database persistence Layer powered by Firebase Firestore.
 * Seamlessly acts as the single source of truth for high-precision logistics sync.
 */

import { initializeApp } from 'firebase/app';
import { 
  getFirestore, doc, collection, setDoc, deleteDoc, getDocs, onSnapshot, query, arrayUnion, getDocFromServer
} from 'firebase/firestore';
import { 
  RouteUser, Rota, GPSLocation, ChatMessage, 
  NotificationLog, PushDeliveryLog, AuditLogEntry, RoutePerformanceLog, Region, Cliente 
} from './types';
import { 
  INITIAL_USERS, INITIAL_ROTAS, INITIAL_LOCATIONS, 
  INITIAL_CHAT, INITIAL_NOTIFICATIONS, INITIAL_AUDIT_LOGS,
  INITIAL_PERFORMANCE_LOGS, INITIAL_PUSH_LOGS, INITIAL_REGIONS, INITIAL_CLIENTS
} from './mockData';
import firebaseConfig from '../firebase-applet-config.json';

import { getAuth } from 'firebase/auth';

// Initialize Firebase Core and Firestore Named Database
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Export null supabase to avoid compiler errors on legacy checks
export const supabase = null;

// Error Handling Infrastructure conforming to Firebase Integration Skills
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null
    },
    operationType,
    path
  };
  console.error('[Firestore Error Handled]: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection Validation
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('[Firestore] Connected successfully to named database:', firebaseConfig.firestoreDatabaseId);
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('[Firestore] Please check your Firebase configuration or internet connection.');
    } else {
      console.log('[Firestore] Initialized with endpoint:', firebaseConfig.projectId);
    }
  }
}
testConnection();

// -------------------------------------------------------------
// SEED DATABASE ON BOOTSTRAP
// -------------------------------------------------------------
export async function seedDatabaseIfEmpty() {
  try {
    const collectionsToSeed = [
      { name: 'users', data: INITIAL_USERS, idKey: 'id' },
      { name: 'regions', data: INITIAL_REGIONS, idKey: 'id' },
      { name: 'rotas', data: INITIAL_ROTAS, idKey: 'id' },
      { name: 'locations', data: Object.values(INITIAL_LOCATIONS), idKey: 'driverId' },
      { name: 'chats', data: INITIAL_CHAT, idKey: 'id' },
      { name: 'notifications', data: INITIAL_NOTIFICATIONS, idKey: 'id' },
      { name: 'audit_logs', data: INITIAL_AUDIT_LOGS, idKey: 'id' },
      { name: 'performance_logs', data: INITIAL_PERFORMANCE_LOGS, idKey: 'id' },
      { name: 'push_logs', data: INITIAL_PUSH_LOGS, idKey: 'id' },
      { name: 'clients', data: INITIAL_CLIENTS, idKey: 'id' }
    ];

    for (const coll of collectionsToSeed) {
      const snap = await getDocs(collection(db, coll.name));
      if (snap.empty) {
        console.log(`[Firestore Seeding] Collection '${coll.name}' is empty. Seeding baseline data...`);
        for (const item of coll.data) {
          const docId = (item as any)[coll.idKey];
          if (docId) {
            await setDoc(doc(db, coll.name, docId), item);
          }
        }
      }
    }
    console.log('[Firestore Seeding] Seeding check and verification completed successfully!');
  } catch (err) {
    console.warn('[Firestore Seeding Error]', err);
  }
}

// -------------------------------------------------------------
// DATA MUTATIONS
// -------------------------------------------------------------

export async function saveCloudUser(user: RouteUser) {
  try {
    await setDoc(doc(db, 'users', user.id), user);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${user.id}`);
  }
}

export async function deleteCloudUser(userId: string) {
  try {
    await deleteDoc(doc(db, 'users', userId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `users/${userId}`);
  }
}

export async function saveCloudRoute(rota: Rota) {
  try {
    await setDoc(doc(db, 'rotas', rota.id), rota);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `rotas/${rota.id}`);
  }
}

export async function deleteCloudRoute(routeId: string) {
  try {
    await deleteDoc(doc(db, 'rotas', routeId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `rotas/${routeId}`);
  }
}

export async function saveCloudGPSLocation(location: GPSLocation) {
  try {
    // 1. Save current active position
    await setDoc(doc(db, 'locations', location.driverId), location);

    // 2. Append to full Telemetry Trail (Breadcrumbs) in Firestore
    const bDocRef = doc(db, 'breadcrumbs', location.driverId);
    await setDoc(bDocRef, {
      driverId: location.driverId,
      trail: arrayUnion({
        lat: location.lat,
        lng: location.lng,
        timestamp: location.lastUpdated || new Date().toISOString()
      })
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `locations/${location.driverId}`);
  }
}

export async function saveCloudChat(chat: ChatMessage) {
  try {
    await setDoc(doc(db, 'chats', chat.id), chat);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `chats/${chat.id}`);
  }
}

export async function saveCloudNotification(notif: NotificationLog) {
  try {
    await setDoc(doc(db, 'notifications', notif.id), notif);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `notifications/${notif.id}`);
  }
}

export async function saveCloudAuditLog(audit: AuditLogEntry) {
  try {
    await setDoc(doc(db, 'audit_logs', audit.id), audit);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `audit_logs/${audit.id}`);
  }
}

export async function saveCloudPerformanceLog(perf: RoutePerformanceLog) {
  try {
    await setDoc(doc(db, 'performance_logs', perf.id), perf);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `performance_logs/${perf.id}`);
  }
}

export async function saveCloudPushLog(push: PushDeliveryLog) {
  try {
    await setDoc(doc(db, 'push_logs', push.id), push);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `push_logs/${push.id}`);
  }
}

export async function saveCloudRegion(region: Region) {
  try {
    await setDoc(doc(db, 'regions', region.id), region);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `regions/${region.id}`);
  }
}

export async function deleteCloudRegion(regionId: string) {
  try {
    await deleteDoc(doc(db, 'regions', regionId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `regions/${regionId}`);
  }
}

export async function saveCloudClient(client: Cliente) {
  try {
    await setDoc(doc(db, 'clients', client.id), client);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `clients/${client.id}`);
  }
}

export async function deleteCloudClient(clientId: string) {
  try {
    await deleteDoc(doc(db, 'clients', clientId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `clients/${clientId}`);
  }
}

export async function resetCloudDatabaseAll() {
  try {
    console.log('[Firestore] Initiating complete database purge...');
    const collectionsToClear = [
      'users', 'regions', 'rotas', 'locations', 'chats', 
      'notifications', 'audit_logs', 'performance_logs', 'push_logs', 'clients', 'breadcrumbs'
    ];

    for (const collName of collectionsToClear) {
      const snap = await getDocs(collection(db, collName));
      for (const docSnap of snap.docs) {
        await deleteDoc(doc(db, collName, docSnap.id));
      }
    }

    console.log('[Firestore] Re-seeding baseline configurations...');
    for (const user of INITIAL_USERS) {
      await setDoc(doc(db, 'users', user.id), user);
    }
    for (const reg of INITIAL_REGIONS) {
      await setDoc(doc(db, 'regions', reg.id), reg);
    }
    for (const rota of INITIAL_ROTAS) {
      await setDoc(doc(db, 'rotas', rota.id), rota);
    }
    for (const loc of Object.values(INITIAL_LOCATIONS)) {
      await setDoc(doc(db, 'locations', loc.driverId), loc);
    }
    for (const chat of INITIAL_CHAT) {
      await setDoc(doc(db, 'chats', chat.id), chat);
    }
    for (const notif of INITIAL_NOTIFICATIONS) {
      await setDoc(doc(db, 'notifications', notif.id), notif);
    }
    for (const audit of INITIAL_AUDIT_LOGS) {
      await setDoc(doc(db, 'audit_logs', audit.id), audit);
    }
    for (const perf of INITIAL_PERFORMANCE_LOGS) {
      await setDoc(doc(db, 'performance_logs', perf.id), perf);
    }
    for (const push of INITIAL_PUSH_LOGS) {
      await setDoc(doc(db, 'push_logs', push.id), push);
    }
    for (const client of INITIAL_CLIENTS) {
      await setDoc(doc(db, 'clients', client.id), client);
    }
    console.log('[Firestore] Database has been reset and seeded successfully.');
  } catch (err) {
    console.error('[Firestore Reset Error]', err);
  }
}

// -------------------------------------------------------------
// REAL-TIME INTEGRATED SUBSCRIPTION LISTENER CHANNELS
// -------------------------------------------------------------
export function subscribeToCollection<T>(
  table: string, 
  callback: (data: T[]) => void, 
  onError?: (err: Error) => void
): () => void {
  const collRef = collection(db, table);
  const q = query(collRef);

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const list: T[] = [];
    snapshot.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as T);
    });
    callback(list);
  }, (error) => {
    if (onError) onError(new Error(error.message));
  });

  return unsubscribe;
}

// SQL description placeholder to keep legacy panels functional
export const SUPABASE_SQL_DDL = ``;
