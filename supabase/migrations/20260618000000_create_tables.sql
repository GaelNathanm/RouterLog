-- ROUTELOG POSTGRESQL MIGRATION SCHEMA FOR SUPABASE
-- Execute this SQL migration script in your Supabase SQL Editor to bootstrap all relational tables and enable real-time replication.

-- 1. Create Regions Table
CREATE TABLE IF NOT EXISTS public.regions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius DOUBLE PRECISION
);

-- 2. Create Users (Profiles) Table with reference to Region
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role INTEGER NOT NULL,
  region TEXT REFERENCES public.regions(id) ON DELETE SET NULL,
  plate TEXT,
  phone TEXT,
  address TEXT,
  status TEXT DEFAULT 'active',
  "createdAt" TEXT,
  cnh TEXT,
  "cnhCategory" TEXT,
  "cnhExpiration" TEXT,
  "vehicleModel" TEXT,
  "isOnline" BOOLEAN DEFAULT false
);

-- 3. Create Rotas (Routes) Table with reference to drivers and regions
CREATE TABLE IF NOT EXISTS public.rotas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  origin TEXT NOT NULL,
  "originLat" DOUBLE PRECISION NOT NULL,
  "originLng" DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL,
  "driverId" TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  "driverName" TEXT,
  "driverPlate" TEXT,
  "currentStopIndex" INTEGER DEFAULT 0,
  region TEXT REFERENCES public.regions(id) ON DELETE SET NULL,
  "createdAt" TEXT,
  stops JSONB
);

-- 4. Create Locations Tracking Table with reference to driver
CREATE TABLE IF NOT EXISTS public.locations (
  "driverId" TEXT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  heading DOUBLE PRECISION DEFAULT 0,
  speed DOUBLE PRECISION DEFAULT 0,
  "isSharing" BOOLEAN DEFAULT true,
  "lastUpdated" TEXT
);

-- 5. Create Chats Table with relations to sender and region
CREATE TABLE IF NOT EXISTS public.chats (
  id TEXT PRIMARY KEY,
  "senderName" TEXT NOT NULL,
  "senderId" TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  region TEXT REFERENCES public.regions(id) ON DELETE SET NULL,
  "audioUrl" TEXT
);

-- 6. Create Notifications Table with reference to region
CREATE TABLE IF NOT EXISTS public.notifications (
  id TEXT PRIMARY KEY,
  region TEXT REFERENCES public.regions(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  "senderName" TEXT
);

-- 7. Create Audit Logs (logs_audit) Table with reference to region
CREATE TABLE IF NOT EXISTS public.logs_audit (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  action TEXT NOT NULL,
  "userName" TEXT NOT NULL,
  details TEXT,
  region TEXT REFERENCES public.regions(id) ON DELETE SET NULL
);

-- 8. Create Performance Logs Table with references
CREATE TABLE IF NOT EXISTS public.performance_logs (
  id TEXT PRIMARY KEY,
  "routeId" TEXT REFERENCES public.rotas(id) ON DELETE SET NULL,
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
  region TEXT REFERENCES public.regions(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  "stopTelemetry" JSONB
);

-- 9. Create Push Logs Table with reference to region
CREATE TABLE IF NOT EXISTS public.push_logs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  "targetRole" TEXT,
  "targetRegion" TEXT REFERENCES public.regions(id) ON DELETE SET NULL,
  "sentCount" INTEGER DEFAULT 1,
  timestamp TEXT NOT NULL,
  success BOOLEAN DEFAULT true,
  type TEXT
);

-- 10. Enable Real-Time Publications dynamically using pg channels safely (idempotent)
DO $$
DECLARE
  table_names text[] := ARRAY['users', 'regions', 'rotas', 'locations', 'chats', 'notifications', 'logs_audit', 'performance_logs', 'push_logs'];
  t text;
BEGIN
  FOREACH t IN ARRAY table_names LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_rel pr
      JOIN pg_class c ON pr.prrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      JOIN pg_publication p ON pr.prpubid = p.oid
      WHERE p.pubname = 'supabase_realtime'
        AND n.nspname = 'public'
        AND c.relname = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
