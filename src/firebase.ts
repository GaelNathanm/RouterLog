/**
 * Real-time Reactive Database persistence Layer powered by Firebase Firestore.
 * Seamlessly acts as the single source of truth for high-precision logistics sync.
 */

import { 
  doc, collection, setDoc as firestoreSetDoc, deleteDoc, getDocs, onSnapshot, query, arrayUnion,
  getDoc, where, limit
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
import { db, auth } from './firebaseConfig';
export { db, auth };

// Export null supabase to avoid compiler errors on legacy checks
export const supabase = null;

/**
 * Recursively scrubs objects to replace undefined values with null
 * to prevent Firestore "Unsupported field value: undefined" errors.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) return null as any;
  if (data === null) return null as any;
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForFirestore(item)) as any;
  }
  if (typeof data === 'object') {
    const clean: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        clean[key] = sanitizeForFirestore(value);
      }
    }
    return clean;
  }
  return data;
}

/**
 * Wrapped setDoc that automatically sanitizes inputs.
 */
export async function setDoc(reference: any, data: any, options?: any) {
  const sanitized = sanitizeForFirestore(data);
  if (options) {
    return firestoreSetDoc(reference, sanitized, options);
  }
  return firestoreSetDoc(reference, sanitized);
}

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

// -------------------------------------------------------------
// SELF-HEALING PERSISTENT LOCAL STORAGE ENGINE FOR QUOTA OVERFLOWS
// -------------------------------------------------------------
let isQuotaExceeded = false;
try {
  if (sessionStorage.getItem('routelog_quota_exceeded') === 'true') {
    isQuotaExceeded = true;
    console.warn('[Firestore] App initialized in persistent offline/local fallback mode due to prior quota limit.');
  }
} catch (e) {}

function markQuotaExceeded() {
  if (!isQuotaExceeded) {
    isQuotaExceeded = true;
    console.warn('[Firestore] Quota or connection limit reached! Swapping active database to reactive LocalStorage fallback.');
    try {
      sessionStorage.setItem('routelog_quota_exceeded', 'true');
    } catch (e) {}
    
    // Broadcast active fallback values to all active subscribers instantly
    for (const table of subscribersMap.keys()) {
      notifySubscribers(table, getLocalCollection(table));
    }
  }
}

function checkQuotaError(err: any): boolean {
  const errMsg = err instanceof Error ? err.message : String(err);
  const errMsgLower = errMsg.toLowerCase();
  
  // These are true, permanent quota or billing errors for this session
  const isGenuineQuotaError = 
    errMsgLower.includes('quota') || 
    errMsgLower.includes('exhausted') || 
    errMsgLower.includes('billing') ||
    (err && err.code === 'resource-exhausted');

  // These are temporary network/offline issues or failed preconditions
  const isTransientNetworkError = 
    errMsgLower.includes('unavailable') ||
    errMsgLower.includes('offline') ||
    errMsgLower.includes('network') ||
    errMsgLower.includes('failed to get document') ||
    errMsgLower.includes('failed-precondition') ||
    (err && (
      err.code === 'unavailable' || 
      err.code === 'failed-precondition'
    ));

  if (isGenuineQuotaError) {
    markQuotaExceeded();
    return true;
  }

  if (isTransientNetworkError) {
    // Return true to dynamically fall back to local storage for the failing call,
    // but do NOT call markQuotaExceeded() to prevent permanent session-level lockups.
    return true;
  }

  return false;
}

function getInitialData(table: string): any[] {
  switch (table) {
    case 'users': return INITIAL_USERS;
    case 'regions': return INITIAL_REGIONS;
    case 'rotas': return INITIAL_ROTAS;
    case 'locations': return Object.values(INITIAL_LOCATIONS);
    case 'chats': return INITIAL_CHAT;
    case 'notifications': return INITIAL_NOTIFICATIONS;
    case 'audit_logs': return INITIAL_AUDIT_LOGS;
    case 'performance_logs': return INITIAL_PERFORMANCE_LOGS;
    case 'push_logs': return INITIAL_PUSH_LOGS;
    case 'clients': return INITIAL_CLIENTS;
    default: return [];
  }
}

function getLocalCollection(table: string): any[] {
  const key = `routelog_db_${table}`;
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {}
  const initial = getInitialData(table);
  try {
    localStorage.setItem(key, JSON.stringify(initial));
  } catch (e) {}
  return initial;
}

function setLocalCollection(table: string, data: any[]) {
  const key = `routelog_db_${table}`;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {}
  notifySubscribers(table, data);
}

function saveLocalItem(table: string, item: any, idKey: string = 'id') {
  const list = getLocalCollection(table);
  const itemId = item[idKey];
  const idx = list.findIndex((x: any) => x[idKey] === itemId);
  if (idx > -1) {
    list[idx] = { ...list[idx], ...item };
  } else {
    list.push(item);
  }
  setLocalCollection(table, list);
}

function deleteLocalItem(table: string, itemId: string, idKey: string = 'id') {
  const list = getLocalCollection(table);
  const filtered = list.filter((x: any) => x[idKey] !== itemId);
  setLocalCollection(table, filtered);
}

// Subscription Hub for reactive Local Storage events
type LocalSubscriber = (data: any[]) => void;
const subscribersMap = new Map<string, Set<LocalSubscriber>>();

function addSubscriber(table: string, callback: LocalSubscriber): () => void {
  if (!subscribersMap.has(table)) {
    subscribersMap.set(table, new Set());
  }
  subscribersMap.get(table)!.add(callback);
  
  // Deliver current local state immediately
  callback(getLocalCollection(table));

  return () => {
    const subs = subscribersMap.get(table);
    if (subs) {
      subs.delete(callback);
      if (subs.size === 0) {
        subscribersMap.delete(table);
      }
    }
  };
}

function notifySubscribers(table: string, data: any[]) {
  const subs = subscribersMap.get(table);
  if (subs) {
    subs.forEach(cb => {
      try {
        cb(data);
      } catch (e) {}
    });
  }
}

// Connection Validation
async function testConnection() {
  try {
    // Attempt a silent cache-first fetch to ensure SDK is initialized
    await getDoc(doc(db, 'test', 'connection'));
    console.log('[Firestore] Local database cache initialized successfully.');
    
    // Self-healing: Connection succeeded, clear any prior transient quota/offline flag
    if (isQuotaExceeded) {
      isQuotaExceeded = false;
      try {
        sessionStorage.removeItem('routelog_quota_exceeded');
        console.log('[Firestore] Connection established successfully! Cleared prior persistent offline/quota exceeded flags.');
      } catch (e) {}
    }
  } catch (error) {
    checkQuotaError(error);
    console.log('[Firestore] Initialized with persistent offline local cache.');
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

    if (isQuotaExceeded) {
      for (const coll of collectionsToSeed) {
        getLocalCollection(coll.name);
      }
      return;
    }

    for (const coll of collectionsToSeed) {
      try {
        const snap = await getDocs(collection(db, coll.name));
        if (snap.empty) {
          console.log(`[Firestore Seeding] Collection '${coll.name}' is empty. Seeding baseline data...`);
          for (const item of coll.data) {
            const docId = (item as any)[coll.idKey];
            if (docId) {
              await setDoc(doc(db, coll.name, docId), item);
            }
          }
        } else {
          // Sync successful firestore fetch back to localStorage
          const list: any[] = [];
          snap.forEach((docSnap) => {
            list.push({ id: docSnap.id, ...docSnap.data() });
          });
          const key = `routelog_db_${coll.name}`;
          localStorage.setItem(key, JSON.stringify(list));
        }
      } catch (err) {
        if (checkQuotaError(err)) {
          for (const c of collectionsToSeed) {
            getLocalCollection(c.name);
          }
          return;
        }
        throw err;
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
  if (isQuotaExceeded) {
    saveLocalItem('users', user);
    return;
  }
  try {
    await setDoc(doc(db, 'users', user.id), user);
    saveLocalItem('users', user);
  } catch (err) {
    if (checkQuotaError(err)) {
      saveLocalItem('users', user);
      return;
    }
    handleFirestoreError(err, OperationType.WRITE, `users/${user.id}`);
  }
}

export async function deleteCloudUser(userId: string) {
  if (isQuotaExceeded) {
    deleteLocalItem('users', userId);
    return;
  }
  try {
    await deleteDoc(doc(db, 'users', userId));
    deleteLocalItem('users', userId);
  } catch (err) {
    if (checkQuotaError(err)) {
      deleteLocalItem('users', userId);
      return;
    }
    handleFirestoreError(err, OperationType.DELETE, `users/${userId}`);
  }
}

export async function getCloudUser(userId: string): Promise<RouteUser | null> {
  if (isQuotaExceeded) {
    const list = getLocalCollection('users');
    return list.find((u: any) => u.id === userId) || null;
  }
  try {
    const docSnap = await getDoc(doc(db, 'users', userId));
    if (docSnap.exists()) {
      const u = { id: docSnap.id, ...docSnap.data() } as RouteUser;
      saveLocalItem('users', u);
      return u;
    }
    return null;
  } catch (err) {
    if (checkQuotaError(err)) {
      const list = getLocalCollection('users');
      return list.find((u: any) => u.id === userId) || null;
    }
    handleFirestoreError(err, OperationType.GET, `users/${userId}`);
    return null;
  }
}

export async function getCloudUserByEmail(email: string): Promise<RouteUser | null> {
  if (isQuotaExceeded) {
    const list = getLocalCollection('users');
    return list.find((u: any) => u.email === email) || null;
  }
  try {
    const q = query(collection(db, 'users'), where('email', '==', email), limit(1));
    const querySnap = await getDocs(q);
    if (!querySnap.empty) {
      const docSnap = querySnap.docs[0];
      const u = { id: docSnap.id, ...docSnap.data() } as RouteUser;
      saveLocalItem('users', u);
      return u;
    }
    return null;
  } catch (err) {
    if (checkQuotaError(err)) {
      const list = getLocalCollection('users');
      return list.find((u: any) => u.email === email) || null;
    }
    handleFirestoreError(err, OperationType.GET, `users`);
    return null;
  }
}

export async function saveCloudRoute(rota: Rota) {
  if (isQuotaExceeded) {
    saveLocalItem('rotas', rota);
    return;
  }
  try {
    await setDoc(doc(db, 'rotas', rota.id), rota);
    saveLocalItem('rotas', rota);
  } catch (err) {
    if (checkQuotaError(err)) {
      saveLocalItem('rotas', rota);
      return;
    }
    handleFirestoreError(err, OperationType.WRITE, `rotas/${rota.id}`);
  }
}

export async function deleteCloudRoute(routeId: string) {
  if (isQuotaExceeded) {
    deleteLocalItem('rotas', routeId);
    return;
  }
  try {
    await deleteDoc(doc(db, 'rotas', routeId));
    deleteLocalItem('rotas', routeId);
  } catch (err) {
    if (checkQuotaError(err)) {
      deleteLocalItem('rotas', routeId);
      return;
    }
    handleFirestoreError(err, OperationType.DELETE, `rotas/${routeId}`);
  }
}

export async function saveCloudGPSLocation(location: GPSLocation) {
  if (isQuotaExceeded) {
    saveLocalItem('locations', location, 'driverId');
    return;
  }
  try {
    await setDoc(doc(db, 'locations', location.driverId), location);
    saveLocalItem('locations', location, 'driverId');

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
    if (checkQuotaError(err)) {
      saveLocalItem('locations', location, 'driverId');
      return;
    }
    handleFirestoreError(err, OperationType.WRITE, `locations/${location.driverId}`);
  }
}

export async function saveCloudChat(chat: ChatMessage) {
  if (isQuotaExceeded) {
    saveLocalItem('chats', chat);
    return;
  }
  try {
    await setDoc(doc(db, 'chats', chat.id), chat);
    saveLocalItem('chats', chat);
  } catch (err) {
    if (checkQuotaError(err)) {
      saveLocalItem('chats', chat);
      return;
    }
    handleFirestoreError(err, OperationType.WRITE, `chats/${chat.id}`);
  }
}

export async function saveCloudNotification(notif: NotificationLog) {
  if (isQuotaExceeded) {
    saveLocalItem('notifications', notif);
    return;
  }
  try {
    await setDoc(doc(db, 'notifications', notif.id), notif);
    saveLocalItem('notifications', notif);
  } catch (err) {
    if (checkQuotaError(err)) {
      saveLocalItem('notifications', notif);
      return;
    }
    handleFirestoreError(err, OperationType.WRITE, `notifications/${notif.id}`);
  }
}

export async function saveCloudAuditLog(audit: AuditLogEntry) {
  if (isQuotaExceeded) {
    saveLocalItem('audit_logs', audit);
    return;
  }
  try {
    await setDoc(doc(db, 'audit_logs', audit.id), audit);
    saveLocalItem('audit_logs', audit);
  } catch (err) {
    if (checkQuotaError(err)) {
      saveLocalItem('audit_logs', audit);
      return;
    }
    handleFirestoreError(err, OperationType.WRITE, `audit_logs/${audit.id}`);
  }
}

export async function saveCloudPerformanceLog(perf: RoutePerformanceLog) {
  if (isQuotaExceeded) {
    saveLocalItem('performance_logs', perf);
    return;
  }
  try {
    await setDoc(doc(db, 'performance_logs', perf.id), perf);
    saveLocalItem('performance_logs', perf);
  } catch (err) {
    if (checkQuotaError(err)) {
      saveLocalItem('performance_logs', perf);
      return;
    }
    handleFirestoreError(err, OperationType.WRITE, `performance_logs/${perf.id}`);
  }
}

export async function saveCloudPushLog(push: PushDeliveryLog) {
  if (isQuotaExceeded) {
    saveLocalItem('push_logs', push);
    return;
  }
  try {
    await setDoc(doc(db, 'push_logs', push.id), push);
    saveLocalItem('push_logs', push);
  } catch (err) {
    if (checkQuotaError(err)) {
      saveLocalItem('push_logs', push);
      return;
    }
    handleFirestoreError(err, OperationType.WRITE, `push_logs/${push.id}`);
  }
}

export async function saveCloudRegion(region: Region) {
  if (isQuotaExceeded) {
    saveLocalItem('regions', region);
    return;
  }
  try {
    await setDoc(doc(db, 'regions', region.id), region);
    saveLocalItem('regions', region);
  } catch (err) {
    if (checkQuotaError(err)) {
      saveLocalItem('regions', region);
      return;
    }
    handleFirestoreError(err, OperationType.WRITE, `regions/${region.id}`);
  }
}

export async function deleteCloudRegion(regionId: string) {
  if (isQuotaExceeded) {
    deleteLocalItem('regions', regionId);
    return;
  }
  try {
    await deleteDoc(doc(db, 'regions', regionId));
    deleteLocalItem('regions', regionId);
  } catch (err) {
    if (checkQuotaError(err)) {
      deleteLocalItem('regions', regionId);
      return;
    }
    handleFirestoreError(err, OperationType.DELETE, `regions/${regionId}`);
  }
}

export async function saveCloudClient(client: Cliente) {
  if (isQuotaExceeded) {
    saveLocalItem('clients', client);
    return;
  }
  try {
    await setDoc(doc(db, 'clients', client.id), client);
    saveLocalItem('clients', client);
  } catch (err) {
    if (checkQuotaError(err)) {
      saveLocalItem('clients', client);
      return;
    }
    handleFirestoreError(err, OperationType.WRITE, `clients/${client.id}`);
  }
}

export async function deleteCloudClient(clientId: string) {
  if (isQuotaExceeded) {
    deleteLocalItem('clients', clientId);
    return;
  }
  try {
    await deleteDoc(doc(db, 'clients', clientId));
    deleteLocalItem('clients', clientId);
  } catch (err) {
    if (checkQuotaError(err)) {
      deleteLocalItem('clients', clientId);
      return;
    }
    handleFirestoreError(err, OperationType.DELETE, `clients/${clientId}`);
  }
}

export async function resetCloudDatabaseAll() {
  const collectionsToClear = [
    'users', 'regions', 'rotas', 'locations', 'chats', 
    'notifications', 'audit_logs', 'performance_logs', 'push_logs', 'clients', 'breadcrumbs'
  ];
  for (const coll of collectionsToClear) {
    try {
      localStorage.removeItem(`routelog_db_${coll}`);
    } catch (e) {}
  }

  if (isQuotaExceeded) {
    for (const coll of collectionsToClear) {
      getLocalCollection(coll);
    }
    console.log('[Firestore Fallback] Local database reset complete.');
    return;
  }

  try {
    console.log('[Firestore] Initiating complete database purge...');
    for (const collName of collectionsToClear) {
      const snap = await getDocs(collection(db, collName));
      for (const docSnap of snap.docs) {
        await deleteDoc(doc(db, collName, docSnap.id));
      }
    }

    console.log('[Firestore] Re-seeding baseline configurations...');
    for (const user of INITIAL_USERS) {
      await setDoc(doc(db, 'users', user.id), user);
      saveLocalItem('users', user);
    }
    for (const reg of INITIAL_REGIONS) {
      await setDoc(doc(db, 'regions', reg.id), reg);
      saveLocalItem('regions', reg);
    }
    for (const rota of INITIAL_ROTAS) {
      await setDoc(doc(db, 'rotas', rota.id), rota);
      saveLocalItem('rotas', rota);
    }
    for (const loc of Object.values(INITIAL_LOCATIONS)) {
      await setDoc(doc(db, 'locations', loc.driverId), loc);
      saveLocalItem('locations', loc, 'driverId');
    }
    for (const chat of INITIAL_CHAT) {
      await setDoc(doc(db, 'chats', chat.id), chat);
      saveLocalItem('chats', chat);
    }
    for (const notif of INITIAL_NOTIFICATIONS) {
      await setDoc(doc(db, 'notifications', notif.id), notif);
      saveLocalItem('notifications', notif);
    }
    for (const audit of INITIAL_AUDIT_LOGS) {
      await setDoc(doc(db, 'audit_logs', audit.id), audit);
      saveLocalItem('audit_logs', audit);
    }
    for (const perf of INITIAL_PERFORMANCE_LOGS) {
      await setDoc(doc(db, 'performance_logs', perf.id), perf);
      saveLocalItem('performance_logs', perf);
    }
    for (const push of INITIAL_PUSH_LOGS) {
      await setDoc(doc(db, 'push_logs', push.id), push);
      saveLocalItem('push_logs', push);
    }
    for (const client of INITIAL_CLIENTS) {
      await setDoc(doc(db, 'clients', client.id), client);
      saveLocalItem('clients', client);
    }
    console.log('[Firestore] Database has been reset and seeded successfully.');
  } catch (err) {
    if (checkQuotaError(err)) {
      for (const coll of collectionsToClear) {
        getLocalCollection(coll);
      }
      return;
    }
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
  // If we already know quota is exceeded, subscribe purely locally
  if (isQuotaExceeded) {
    return addSubscriber(table, (data) => callback(data as T[]));
  }

  let localUnsubscribe: (() => void) | null = null;
  let isSwitchedToLocal = false;

  const collRef = collection(db, table);
  const q = query(collRef);

  const firestoreUnsubscribe = onSnapshot(q, (snapshot) => {
    if (isSwitchedToLocal) return;
    const list: T[] = [];
    snapshot.forEach((docSnap) => {
      const item = { id: docSnap.id, ...docSnap.data() } as T;
      list.push(item);
    });

    // Mirror to local storage for dynamic sync/offline preservation
    try {
      const key = `routelog_db_${table}`;
      localStorage.setItem(key, JSON.stringify(list));
    } catch (e) {}

    callback(list);
  }, (error) => {
    if (isSwitchedToLocal) return;

    if (checkQuotaError(error)) {
      console.warn(`[Firestore onSnapshot] Switching table '${table}' to offline fallback subscription.`);
      isSwitchedToLocal = true;
      try {
        firestoreUnsubscribe();
      } catch (e) {}
      localUnsubscribe = addSubscriber(table, (data) => callback(data as T[]));
      return;
    }

    if (onError) onError(new Error(error.message));
  });

  return () => {
    if (isSwitchedToLocal && localUnsubscribe) {
      localUnsubscribe();
    } else {
      try {
        firestoreUnsubscribe();
      } catch (e) {}
    }
  };
}

// SQL description placeholder to keep legacy panels functional
export const SUPABASE_SQL_DDL = ``;
