-- Migration: RouteLog Enterprise All Tables Initialization
-- Created At: 2026-06-21 18:35:00
-- Target Platform: Supabase / PostgreSQL

-- Enable UUID extension just in case it is needed for automatic fallback
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. REGIONS TABLE
CREATE TABLE IF NOT EXISTS public.regions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    radius DOUBLE PRECISION,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.regions IS 'Geographical operational regions managed by owners or coordinators.';

-- 2. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    role INTEGER NOT NULL, -- 0: Admin, 1: Gerente, 2: Motorista, 3: Vendedor
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned')),
    "createdAt" TEXT NOT NULL,
    region TEXT, -- Scoped operational region for coordinating or driving
    cnh TEXT, -- Driver specific
    "cnhCategory" TEXT, -- Driver specific
    "cnhExpiration" TEXT, -- Driver specific
    "vehicleModel" TEXT, -- Driver specific
    plate TEXT -- Driver specific
);

COMMENT ON TABLE public.users IS 'Platform accounts, supporting different role properties (Driver, Coordinator, Vendor).';
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_region ON public.users(region);

-- 3. CLIENTS TABLE
CREATE TABLE IF NOT EXISTS public.clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    "whatsApp" TEXT,
    address TEXT,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    region TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    status TEXT DEFAULT 'active'
);

COMMENT ON TABLE public.clients IS 'Operational portfolio clients for deliveries and seller route bindings.';
CREATE INDEX IF NOT EXISTS idx_clients_region ON public.clients(region);

-- 4. ROTAS TABLE
CREATE TABLE IF NOT EXISTS public.rotas (
    id TEXT PRIMARY KEY,
    "driverId" TEXT NOT NULL,
    "driverName" TEXT,
    "driverPlate" TEXT,
    name TEXT NOT NULL,
    origin TEXT,
    "originLat" DOUBLE PRECISION,
    "originLng" DOUBLE PRECISION,
    stops JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of Parada object structure
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed')),
    "currentStopIndex" INTEGER NOT NULL DEFAULT 0,
    region TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    optimized BOOLEAN NOT NULL DEFAULT false,
    "sentByGerente" BOOLEAN NOT NULL DEFAULT false
);

COMMENT ON TABLE public.rotas IS 'Delivery itineraries consisting of dynamic state-driven client multi-stops.';
CREATE INDEX IF NOT EXISTS idx_rotas_driver ON public.rotas("driverId");
CREATE INDEX IF NOT EXISTS idx_rotas_region ON public.rotas(region);
CREATE INDEX IF NOT EXISTS idx_rotas_status ON public.rotas(status);

-- 5. LOCATIONS TABLE
CREATE TABLE IF NOT EXISTS public.locations (
    "driverId" TEXT PRIMARY KEY,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    heading DOUBLE PRECISION NOT NULL DEFAULT 0,
    speed DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastUpdated" TEXT NOT NULL,
    "isSharing" BOOLEAN DEFAULT true
);

COMMENT ON TABLE public.locations IS 'Live telemetry feed tracking active GPS positions of drivers.';

-- 6. CHATS TABLE
CREATE TABLE IF NOT EXISTS public.chats (
    id TEXT PRIMARY KEY,
    "senderId" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "senderRole" INTEGER NOT NULL,
    region TEXT NOT NULL, -- Regional scoping or global
    message TEXT NOT NULL,
    "audioUrl" TEXT,
    timestamp TEXT NOT NULL
);

COMMENT ON TABLE public.chats IS 'Secure communication log within operating region bubbles.';
CREATE INDEX IF NOT EXISTS idx_chats_region ON public.chats(region);

-- 7. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id TEXT PRIMARY KEY,
    region TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    "senderName" TEXT NOT NULL
);

COMMENT ON TABLE public.notifications IS 'Platform-wide and regional broadcasted notices.';
CREATE INDEX IF NOT EXISTS idx_notifications_region ON public.notifications(region);

-- 8. AUDIT_LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    "adminId" TEXT NOT NULL,
    "adminName" TEXT NOT NULL,
    action TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "targetUserName" TEXT NOT NULL,
    details TEXT,
    timestamp TEXT NOT NULL
);

COMMENT ON TABLE public.audit_logs IS 'Immutable compliance audit trails logging operations conducted by admins.';

-- 9. PERFORMANCE_LOGS TABLE
CREATE TABLE IF NOT EXISTS public.performance_logs (
    id TEXT PRIMARY KEY,
    "routeId" TEXT NOT NULL,
    "routeName" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "driverName" TEXT NOT NULL,
    "driverPlate" TEXT NOT NULL,
    region TEXT NOT NULL,
    "plannedDistanceKm" DOUBLE PRECISION NOT NULL,
    "actualDistanceKm" DOUBLE PRECISION NOT NULL,
    "plannedStopsCount" INTEGER NOT NULL,
    "completedStopsCount" INTEGER NOT NULL,
    "startTimestamp" TEXT NOT NULL,
    "endTimestamp" TEXT,
    "stopTelemetry" JSONB NOT NULL DEFAULT '[]'::jsonb, -- Detail arrays for StopTelemetry
    "routeDeviations" INTEGER NOT NULL DEFAULT 0,
    "averageTimePerStopMinutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('active', 'completed'))
);

COMMENT ON TABLE public.performance_logs IS 'Post-delivery telemetry records computing exact deviation statistics.';
CREATE INDEX IF NOT EXISTS idx_performance_driver ON public.performance_logs("driverId");
CREATE INDEX IF NOT EXISTS idx_performance_region ON public.performance_logs(region);

-- 10. PUSH_LOGS TABLE
CREATE TABLE IF NOT EXISTS public.push_logs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    "targetRole" TEXT NOT NULL,
    "targetRegion" TEXT NOT NULL,
    "sentCount" INTEGER NOT NULL DEFAULT 1,
    timestamp TEXT NOT NULL,
    success BOOLEAN NOT NULL DEFAULT true,
    type TEXT NOT NULL
);

COMMENT ON TABLE public.push_logs IS 'Comprehensive Firebase Cloud Messaging integration deliveries tracking.';


-- -------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) CONFIGURABILITY
-- By default, for maximum ease of development, we allow raw CRUD,
-- but standard templates are established here so you can restrict them.
-- -------------------------------------------------------------

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_logs ENABLE ROW LEVEL SECURITY;

-- Liberal access policy template for high-speed simulation & development
-- When in production, you can easily restrict actions like DELETE/INSERT.
CREATE POLICY "Allow all public operations for development on users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all public operations for development on regions" ON public.regions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all public operations for development on clients" ON public.clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all public operations for development on rotas" ON public.rotas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all public operations for development on locations" ON public.locations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all public operations for development on chats" ON public.chats FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all public operations for development on notifications" ON public.notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all public operations for development on audit_logs" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all public operations for development on performance_logs" ON public.performance_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all public operations for development on push_logs" ON public.push_logs FOR ALL USING (true) WITH CHECK (true);
