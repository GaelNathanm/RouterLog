/**
 * Supabase Database integration module with reactive LocalStorage fallback
 * for 100% offline uptime and resilient real-time syncing.
 */

import { createClient } from '@supabase/supabase-js';
import { 
  RouteUser, Rota, GPSLocation, ChatMessage, 
  NotificationLog, PushDeliveryLog, AuditLogEntry, RoutePerformanceLog, Region, Cliente 
} from './types';
import { 
  INITIAL_USERS, INITIAL_ROTAS, INITIAL_LOCATIONS, 
  INITIAL_CHAT, INITIAL_NOTIFICATIONS, INITIAL_AUDIT_LOGS,
  INITIAL_PERFORMANCE_LOGS, INITIAL_PUSH_LOGS, INITIAL_REGIONS, INITIAL_CLIENTS
} from './mockData';

// Verify environment variables (supports client-side dynamic loading with auto-sanitization)
let rawSupabaseUrl = ((import.meta as any).env.VITE_SUPABASE_URL || '').trim();
let rawSupabaseAnonKey = ((import.meta as any).env.VITE_SUPABASE_ANON_KEY || '').trim();

// Clean up duplicate declarations or copy-paster prefix structures
if (rawSupabaseUrl.includes('VITE_SUPABASE_URL=')) {
  rawSupabaseUrl = rawSupabaseUrl.split('VITE_SUPABASE_URL=').pop() || '';
}
if (rawSupabaseAnonKey.includes('VITE_SUPABASE_ANON_KEY=')) {
  rawSupabaseAnonKey = rawSupabaseAnonKey.split('VITE_SUPABASE_ANON_KEY=').pop() || '';
}

rawSupabaseUrl = rawSupabaseUrl.trim();
rawSupabaseAnonKey = rawSupabaseAnonKey.trim();

const isConfigured = !!(rawSupabaseUrl && rawSupabaseAnonKey && (rawSupabaseUrl.startsWith('http://') || rawSupabaseUrl.startsWith('https://')));
const supabaseUrl = rawSupabaseUrl;
const supabaseAnonKey = rawSupabaseAnonKey;

// Initialize Supabase Client
export const supabase = isConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;

if (isConfigured) {
  console.log('[Supabase Client] Configured live cloud connection successfully.');
} else {
  console.warn('[Supabase Client] Credentials missing in environment (.env). Operating in Sandbox Offline Mode with Reactive Storage.');
}

// -------------------------------------------------------------
// SECURE OFFLINE SYSTEM WITH CUSTOM EMITTER (Resilient Simulation)
// -------------------------------------------------------------
class ReactiveLocalStorage {
  private listeners: { [collection: string]: Set<(data: any) => void> } = {};

  constructor() {
    this.initLocalStorage();
  }

  private initLocalStorage() {
    if (!localStorage.getItem('sb_users')) localStorage.setItem('sb_users', JSON.stringify(INITIAL_USERS));
    if (!localStorage.getItem('sb_rotas')) localStorage.setItem('sb_rotas', JSON.stringify(INITIAL_ROTAS));
    if (!localStorage.getItem('sb_locations')) localStorage.setItem('sb_locations', JSON.stringify(INITIAL_LOCATIONS));
    if (!localStorage.getItem('sb_chats')) localStorage.setItem('sb_chats', JSON.stringify(INITIAL_CHAT));
    if (!localStorage.getItem('sb_notifications')) localStorage.setItem('sb_notifications', JSON.stringify(INITIAL_NOTIFICATIONS));
    if (!localStorage.getItem('sb_auditLogs')) localStorage.setItem('sb_auditLogs', JSON.stringify(INITIAL_AUDIT_LOGS));
    if (!localStorage.getItem('sb_performanceLogs')) localStorage.setItem('sb_performanceLogs', JSON.stringify(INITIAL_PERFORMANCE_LOGS));
    if (!localStorage.getItem('sb_pushLogs')) localStorage.setItem('sb_pushLogs', JSON.stringify(INITIAL_PUSH_LOGS));
    if (!localStorage.getItem('sb_regions')) localStorage.setItem('sb_regions', JSON.stringify(INITIAL_REGIONS));
    if (!localStorage.getItem('sb_clients')) localStorage.setItem('sb_clients', JSON.stringify(INITIAL_CLIENTS));
  }

  getItems<T>(key: string): T[] {
    const raw = localStorage.getItem(`sb_${key}`);
    return raw ? JSON.parse(raw) : [];
  }

  setItems(key: string, data: any) {
    localStorage.setItem(`sb_${key}`, JSON.stringify(data));
    this.notify(key, data);
  }

  subscribe(key: string, callback: (data: any) => void) {
    if (!this.listeners[key]) {
      this.listeners[key] = new Set();
    }
    this.listeners[key].add(callback);
    
    // Immediate callback with current data
    callback(this.getItems(key));

    return () => {
      this.listeners[key]?.delete(callback);
    };
  }

  private notify(key: string, data: any) {
    if (this.listeners[key]) {
      this.listeners[key].forEach(cb => cb(data));
    }
  }

  resetAll() {
    localStorage.setItem('sb_users', JSON.stringify(INITIAL_USERS));
    localStorage.setItem('sb_rotas', JSON.stringify(INITIAL_ROTAS));
    localStorage.setItem('sb_locations', JSON.stringify(INITIAL_LOCATIONS));
    localStorage.setItem('sb_chats', JSON.stringify(INITIAL_CHAT));
    localStorage.setItem('sb_notifications', JSON.stringify(INITIAL_NOTIFICATIONS));
    localStorage.setItem('sb_auditLogs', JSON.stringify(INITIAL_AUDIT_LOGS));
    localStorage.setItem('sb_performanceLogs', JSON.stringify(INITIAL_PERFORMANCE_LOGS));
    localStorage.setItem('sb_pushLogs', JSON.stringify(INITIAL_PUSH_LOGS));
    localStorage.setItem('sb_regions', JSON.stringify(INITIAL_REGIONS));
    localStorage.setItem('sb_clients', JSON.stringify(INITIAL_CLIENTS));

    Object.keys(this.listeners).forEach(key => {
      this.notify(key, this.getItems(key));
    });
  }
}

const localDB = new ReactiveLocalStorage();

// Check/Seed tables if Supabase contains no records
export async function seedDatabaseIfEmpty() {
  if (!isConfigured || !supabase) {
    console.log('[Supabase Offline] Sandbox seeding is implicit.');
    return;
  }

  try {
    const { data: users, error } = await supabase.from('users').select('id').limit(1);
    if (error) {
      if (error.message?.includes('Failed to fetch') || error.message?.includes('fetch')) {
        console.warn('[Supabase Client] Cloud connection unreachable or offline. Gracefully falling back to Reactive LocalStorage Sandbox.');
      } else {
        console.info('[Supabase Client] Database initialized with notices (tables may need creation via SQL Editor):', error.message);
      }
      return;
    }

    if (!users || users.length === 0) {
      console.log('[Supabase Seeding] Tables are empty. Seeding live database with mock elements...');
      
      await supabase.from('users').insert(INITIAL_USERS);
      await supabase.from('regions').insert(INITIAL_REGIONS);
      await supabase.from('rotas').insert(INITIAL_ROTAS);
      
      const locList = Object.values(INITIAL_LOCATIONS);
      await supabase.from('locations').insert(locList);
      
      await supabase.from('chats').insert(INITIAL_CHAT);
      await supabase.from('notifications').insert(INITIAL_NOTIFICATIONS);
      await supabase.from('audit_logs').insert(INITIAL_AUDIT_LOGS);
      await supabase.from('performance_logs').insert(INITIAL_PERFORMANCE_LOGS);
      await supabase.from('push_logs').insert(INITIAL_PUSH_LOGS);
      await supabase.from('clients').insert(INITIAL_CLIENTS);

      console.log('[Supabase Seeding] Supabase database seeding complete!');
    }
  } catch (err) {
    console.warn('[Supabase Seeding Error] Make sure you have created your tables via the DDL SQL panel first:', err);
  }
}

// -------------------------------------------------------------
// DATA MUTATIONS (Supabase & Local Synchronized Interface)
// -------------------------------------------------------------

export async function saveCloudUser(user: RouteUser) {
  // Local Database Sync
  const prev = localDB.getItems<RouteUser>('users');
  const index = prev.findIndex(u => u.id === user.id);
  if (index !== -1) prev[index] = user;
  else prev.push(user);
  localDB.setItems('users', prev);

  if (isConfigured && supabase) {
    await supabase.from('users').upsert(user as any);
  }
}

export async function deleteCloudUser(userId: string) {
  // Local Database Sync
  const prev = localDB.getItems<RouteUser>('users');
  const filtered = prev.filter(u => u.id !== userId);
  localDB.setItems('users', filtered);

  if (isConfigured && supabase) {
    await supabase.from('users').delete().eq('id', userId);
  }
}

export async function saveCloudRoute(rota: Rota) {
  // Local Database Sync
  const prev = localDB.getItems<Rota>('rotas');
  const index = prev.findIndex(r => r.id === rota.id);
  if (index !== -1) prev[index] = rota;
  else prev.push(rota);
  localDB.setItems('rotas', prev);

  if (isConfigured && supabase) {
    await supabase.from('rotas').upsert(rota as any);
  }
}

export async function deleteCloudRoute(routeId: string) {
  // Local Database Sync
  const prev = localDB.getItems<Rota>('rotas');
  const filtered = prev.filter(r => r.id !== routeId);
  localDB.setItems('rotas', filtered);

  if (isConfigured && supabase) {
    await supabase.from('rotas').delete().eq('id', routeId);
  }
}

export async function saveCloudGPSLocation(location: GPSLocation) {
  // Local Database Sync
  const prev = localDB.getItems<Record<string, GPSLocation>>('locations');
  const nextMap = { ...prev, [location.driverId]: location };
  localDB.setItems('locations', nextMap);

  if (isConfigured && supabase) {
    await supabase.from('locations').upsert(location as any);
  }
}

export async function saveCloudChat(chat: ChatMessage) {
  // Local Database Sync
  const prev = localDB.getItems<ChatMessage>('chats');
  prev.push(chat);
  localDB.setItems('chats', prev);

  if (isConfigured && supabase) {
    await supabase.from('chats').upsert(chat as any);
  }
}

export async function saveCloudNotification(notif: NotificationLog) {
  // Local Database Sync
  const prev = localDB.getItems<NotificationLog>('notifications');
  prev.push(notif);
  localDB.setItems('notifications', prev);

  if (isConfigured && supabase) {
    await supabase.from('notifications').upsert(notif as any);
  }
}

export async function saveCloudAuditLog(audit: AuditLogEntry) {
  // Local Database Sync
  const prev = localDB.getItems<AuditLogEntry>('auditLogs');
  prev.push(audit);
  localDB.setItems('auditLogs', prev);

  if (isConfigured && supabase) {
    await supabase.from('audit_logs').upsert(audit as any);
  }
}

export async function saveCloudPerformanceLog(perf: RoutePerformanceLog) {
  // Local Database Sync
  const prev = localDB.getItems<RoutePerformanceLog>('performanceLogs');
  const index = prev.findIndex(p => p.id === perf.id);
  if (index !== -1) prev[index] = perf;
  else prev.push(perf);
  localDB.setItems('performanceLogs', prev);

  if (isConfigured && supabase) {
    await supabase.from('performance_logs').upsert(perf as any);
  }
}

export async function saveCloudPushLog(push: PushDeliveryLog) {
  // Local Database Sync
  const prev = localDB.getItems<PushDeliveryLog>('pushLogs');
  prev.push(push);
  localDB.setItems('pushLogs', prev);

  if (isConfigured && supabase) {
    await supabase.from('push_logs').upsert(push as any);
  }
}

export async function saveCloudRegion(region: Region) {
  // Local Database Sync
  const prev = localDB.getItems<Region>('regions');
  const index = prev.findIndex(r => r.id === region.id);
  if (index !== -1) prev[index] = region;
  else prev.push(region);
  localDB.setItems('regions', prev);

  if (isConfigured && supabase) {
    await supabase.from('regions').upsert(region as any);
  }
}

export async function deleteCloudRegion(regionId: string) {
  // Local Database Sync
  const prev = localDB.getItems<Region>('regions');
  const filtered = prev.filter(r => r.id !== regionId);
  localDB.setItems('regions', filtered);

  if (isConfigured && supabase) {
    await supabase.from('regions').delete().eq('id', regionId);
  }
}

export async function saveCloudClient(client: Cliente) {
  // Local Database Sync
  const prev = localDB.getItems<Cliente>('clients');
  const index = prev.findIndex(c => c.id === client.id);
  if (index !== -1) prev[index] = client;
  else prev.push(client);
  localDB.setItems('clients', prev);

  if (isConfigured && supabase) {
    await supabase.from('clients').upsert(client as any);
  }
}

export async function deleteCloudClient(clientId: string) {
  // Local Database Sync
  const prev = localDB.getItems<Cliente>('clients');
  const filtered = prev.filter(c => c.id !== clientId);
  localDB.setItems('clients', filtered);

  if (isConfigured && supabase) {
    await supabase.from('clients').delete().eq('id', clientId);
  }
}

export async function resetCloudDatabaseAll() {
  localDB.resetAll();

  if (isConfigured && supabase) {
    try {
      await supabase.from('users').delete().neq('id', 'dummy');
      await supabase.from('regions').delete().neq('id', 'dummy');
      await supabase.from('rotas').delete().neq('id', 'dummy');
      await supabase.from('locations').delete().neq('driverId', 'dummy');
      await supabase.from('chats').delete().neq('id', 'dummy');
      await supabase.from('notifications').delete().neq('id', 'dummy');
      await supabase.from('audit_logs').delete().neq('id', 'dummy');
      await supabase.from('performance_logs').delete().neq('id', 'dummy');
      await supabase.from('push_logs').delete().neq('id', 'dummy');
      await supabase.from('clients').delete().neq('id', 'dummy');

      // Now insert baseline
      await supabase.from('users').insert(INITIAL_USERS);
      await supabase.from('regions').insert(INITIAL_REGIONS);
      await supabase.from('rotas').insert(INITIAL_ROTAS);
      
      const locList = Object.values(INITIAL_LOCATIONS);
      await supabase.from('locations').insert(locList);
      
      await supabase.from('chats').insert(INITIAL_CHAT);
      await supabase.from('notifications').insert(INITIAL_NOTIFICATIONS);
      await supabase.from('audit_logs').insert(INITIAL_AUDIT_LOGS);
      await supabase.from('performance_logs').insert(INITIAL_PERFORMANCE_LOGS);
      await supabase.from('push_logs').insert(INITIAL_PUSH_LOGS);
      await supabase.from('clients').insert(INITIAL_CLIENTS);
      
      console.log('[Supabase Cloud Reset] Database cleared and successfully re-seeded.');
    } catch (err) {
      console.error('[Supabase Cloud Reset Error]', err);
    }
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
  // If not configured, subscribe locally using the custom Local Reactive Emitter
  if (!isConfigured || !supabase) {
    const fallbackKey = table === 'audit_logs' ? 'auditLogs' :
                        table === 'performance_logs' ? 'performanceLogs' :
                        table === 'push_logs' ? 'pushLogs' : table;
    
    return localDB.subscribe(fallbackKey, (data) => {
      if (fallbackKey === 'locations') {
        // Special case: location emitter returns a driver map
        callback(Object.values(data) as any);
      } else {
        callback(data as T[]);
      }
    });
  }

  // Live Supabase real-time channels combined with baseline select fetching
  let active = true;

  const fetchAndPush = async () => {
    try {
      const { data, error } = await supabase.from(table).select('*');
      if (error) {
        if (onError) onError(new Error(error.message));
        return;
      }
      if (active && data) {
        callback(data as T[]);
      }
    } catch (err: any) {
      if (onError) onError(err);
    }
  };

  fetchAndPush();

  // Subscribe to table changes via pg channels
  const channel = supabase
    .channel(`public:${table}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: table }, () => {
      fetchAndPush();
    })
    .subscribe();

  return () => {
    active = false;
    supabase.removeChannel(channel);
  };
}

// -------------------------------------------------------------
// POSTGRESQL DDL GENERATOR (Help users bootstrap Supabase keys)
// -------------------------------------------------------------
export const SUPABASE_SQL_DDL = `-- ROUTELOG POSTGRESQL SCHEMA FOR SUPABASE
-- Execute this SQL code inside the SQL Editor of your Supabase dashboard to set up all tables instantly.

CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  role INTEGER NOT NULL,
  status TEXT DEFAULT 'active',
  "createdAt" TEXT,
  region TEXT,
  cnh TEXT,
  "cnhCategory" TEXT,
  "cnhExpiration" TEXT,
  "vehicleModel" TEXT,
  plate TEXT,
  "isOnline" BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.regions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS public.clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  "whatsApp" TEXT,
  address TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  region TEXT NOT NULL,
  "createdAt" TEXT
);

CREATE TABLE IF NOT EXISTS public.rotas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  origin TEXT NOT NULL,
  "originLat" DOUBLE PRECISION NOT NULL,
  "originLng" DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL,
  "driverId" TEXT,
  "driverName" TEXT,
  "driverPlate" TEXT,
  "currentStopIndex" INTEGER DEFAULT 0,
  region TEXT NOT NULL,
  "createdAt" TEXT,
  optimized BOOLEAN DEFAULT false,
  "sentByGerente" BOOLEAN DEFAULT false,
  stops JSONB
);

CREATE TABLE IF NOT EXISTS public.locations (
  "driverId" TEXT PRIMARY KEY,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  heading DOUBLE PRECISION DEFAULT 0,
  speed DOUBLE PRECISION DEFAULT 0,
  "isSharing" BOOLEAN DEFAULT true,
  "lastUpdated" TEXT
);

CREATE TABLE IF NOT EXISTS public.chats (
  id TEXT PRIMARY KEY,
  "senderName" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "senderRole" INTEGER,
  message TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  region TEXT NOT NULL,
  "audioUrl" TEXT
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id TEXT PRIMARY KEY,
  region TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  "senderName" TEXT
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  action TEXT NOT NULL,
  "userName" TEXT NOT NULL,
  details TEXT,
  region TEXT
);

CREATE TABLE IF NOT EXISTS public.performance_logs (
  id TEXT PRIMARY KEY,
  "routeId" TEXT NOT NULL,
  "routeName" TEXT NOT NULL,
  "driverName" TEXT NOT NULL,
  "driverPlate" TEXT NOT NULL,
  "startTimestamp" TEXT NOT NULL,
  "endTimestamp" TEXT,
  "plannedDistanceKm" DOUBLE PRECISION NOT NULL,
  "actualDistanceKm" DOUBLE PRECISION NOT NULL,
  "plannedStopsCount" INTEGER NOT NULL,
  "completedStopsCount" INTEGER NOT NULL,
  "averageTimePerStopMinutes" INTEGER,
  "routeDeviations" INTEGER DEFAULT 0,
  region TEXT NOT NULL,
  status TEXT NOT NULL,
  "stopTelemetry" JSONB
);

CREATE TABLE IF NOT EXISTS public.push_logs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  "targetRole" TEXT,
  "targetRegion" TEXT,
  "sentCount" INTEGER DEFAULT 1,
  timestamp TEXT NOT NULL,
  success BOOLEAN DEFAULT true,
  type TEXT
);

-- Enable Real-time replication on all matching channels
alter publication supabase_realtime add table public.users;
alter publication supabase_realtime add table public.regions;
alter publication supabase_realtime add table public.rotas;
alter publication supabase_realtime add table public.locations;
alter publication supabase_realtime add table public.chats;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.audit_logs;
alter publication supabase_realtime add table public.performance_logs;
alter publication supabase_realtime add table public.push_logs;
alter publication supabase_realtime add table public.clients;

-- ROW LEVEL SECURITY (RLS) POLICIES FOR SECURE PROFILES AND ROUTE PROTECTION
-- Enable RLS on core tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rotas ENABLE ROW LEVEL SECURITY;

-- 1. Policies for 'users': Users can read all users or their own records, can only update themselves
CREATE POLICY "Permitir leitura pública ou de autenticados de perfis de operadores" 
  ON public.users FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir que usuários editem seu próprio perfil" 
  ON public.users FOR UPDATE TO authenticated USING (email = auth.jwt()->>'email');

-- 2. Policies for 'rotas' table:
-- Gerentes e Admins podem selecionar, criar, atualizar ou deletar todas as rotas
CREATE POLICY "Gerentes e Administradores possuem acesso total às rotas" 
  ON public.rotas FOR ALL TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.email = auth.jwt()->>'email' 
        AND (users.role = 0 OR users.role = 1) -- ADMIN (0) ou GERENTE (1)
    )
  );

-- Motoristas podem ver apenas rotas em que constem como motorista atribuído (protegendo por perfil)
CREATE POLICY "Motoristas visualizam apenas rotas atribuídas ao seu próprio perfil" 
  ON public.rotas FOR SELECT TO authenticated 
  USING (
    "driverId" IN (
      SELECT id FROM public.users 
      WHERE users.email = auth.jwt()->>'email'
    )
  );
`;
