/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum UserRole {
  ADMIN = 0,
  GERENTE = 1,
  MOTORISTA = 2,
  VENDEDOR = 3
}

export interface BaseUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  role: UserRole;
  status: 'active' | 'suspended' | 'banned';
  createdAt: string;
  photoUrl?: string;
}

export interface AdminUser extends BaseUser {
  role: UserRole.ADMIN;
}

export interface GerenteUser extends BaseUser {
  role: UserRole.GERENTE;
  region: string; // Norte, Sul, 262, ES/MG, GV1, GV2, GV3
}

export interface MotoristaUser extends BaseUser {
  role: UserRole.MOTORISTA;
  region: string;
  cnh: string;
  cnhCategory: string;
  cnhExpiration: string;
  vehicleModel: string;
  plate: string;
}

export interface VendedorUser extends BaseUser {
  role: UserRole.VENDEDOR;
  region: string;
}

export type RouteUser = AdminUser | GerenteUser | MotoristaUser | VendedorUser;

export interface Parada {
  id: string;
  clientName: string;
  clientWhatsApp: string;
  address: string;
  lat: number;
  lng: number;
  status: 'pending' | 'completed' | 'Chegando';
  signatureUrl?: string; // base64 interactive canvas digital signature
  photoUrl?: string;     // base64 device camera photo proof (fotoconferência)
  photoUrls?: string[];    // up to 5 digital photos for delivery conference
  canhotoPhotoUrl?: string; // base64 photo of the invoice/receipt receipt (canhoto nota fiscal)
  localPhotoUrl?: string;   // base64 photo of the delivery site/establishment
  completedAt?: string;  // completion ISO timestamp
}

export interface Rota {
  id: string;
  driverId: string;
  driverName: string;
  driverPlate: string;
  name: string;
  origin: string;
  originLat: number;
  originLng: number;
  stops: Parada[];
  status: 'draft' | 'active' | 'completed';
  currentStopIndex: number;
  region: string;
  createdAt: string;
  optimized: boolean;
  sentByGerente?: boolean;
}

export interface GPSLocation {
  driverId: string;
  lat: number;
  lng: number;
  heading: number;
  speed: number;
  lastUpdated: string;
  isSharing?: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  region: string; // Chat is scoped to region (or global for admin)
  message: string;
  audioUrl?: string;
  timestamp: string;
}

export interface NotificationLog {
  id: string;
  region: string;
  title: string;
  body: string;
  timestamp: string;
  senderName: string;
}

export interface StopTelemetry {
  stopId: string;
  clientName: string;
  plannedLat: number;
  plannedLng: number;
  arrivalTimestamp: string;
  departureTimestamp: string;
  timeSpentMinutes: number; // minutes spent at stop
}

export interface RoutePerformanceLog {
  id: string; // performance record ID
  routeId: string;
  routeName: string;
  driverId: string;
  driverName: string;
  driverPlate: string;
  region: string;
  plannedDistanceKm: number;
  actualDistanceKm: number;
  plannedStopsCount: number;
  completedStopsCount: number;
  startTimestamp: string;
  endTimestamp: string | null;
  stopTelemetry: StopTelemetry[];
  routeDeviations: number; // count of GPS path deviations
  averageTimePerStopMinutes: number;
  status: 'active' | 'completed';
}

export interface PushNotificationTemplate {
  id: string;
  type: 'nova_rota' | 'rota_iniciada' | 'status_parada' | 'urgente_chat' | 'custom';
  title: string;
  bodyTemplate: string;
}

export interface PushConfig {
  fcmToken: string;
  fcmServerKey: string;
  apnsSandbox: boolean;
  status: 'connected' | 'reconnecting' | 'failed';
}

export interface PushDeliveryLog {
  id: string;
  title: string;
  body: string;
  targetRole: 'all' | UserRole;
  targetRegion: string; // 'all' or specific region
  sentCount: number;
  timestamp: string;
  success: boolean;
  type: string;
}

export interface AuditLogEntry {
  id: string;
  adminId: string;
  adminName: string;
  action: string; // e.g., "Bloquear Conta", "Banimento Permanente", "Impersonation"
  targetUserId: string;
  targetUserName: string;
  details: string;
  timestamp: string;
}

export interface Region {
  id: string;
  name: string;
  description?: string;
  lat?: number;
  lng?: number;
  radius?: number; // Geofence radius in meters
}

export interface Cliente {
  id: string;
  name: string;
  whatsApp: string;
  address: string;
  lat: number;
  lng: number;
  region: string;
  createdAt: string;
  status?: string; // 'active' | 'inactive' | 'pending' or similar for visual indicators
}


