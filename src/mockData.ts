/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  UserRole, RouteUser, Rota, ChatMessage, NotificationLog, 
  AuditLogEntry, GPSLocation, RoutePerformanceLog, PushDeliveryLog, 
  PushNotificationTemplate, Region
} from './types';

export const INITIAL_USERS: RouteUser[] = [
  // Administrador Master
  {
    id: 'admin_master_zto',
    name: 'Administrador Master ZTO',
    email: 'adminzto@email.com',
    phone: '+55 (31) 98888-9999',
    address: 'Av. Afonso Pena, 1500 - Belo Horizonte, MG',
    role: UserRole.ADMIN,
    status: 'active',
    createdAt: '2026-06-18T00:00:00Z'
  }
];

export const INITIAL_ROTAS: Rota[] = [];

export const INITIAL_LOCATIONS: { [driverId: string]: GPSLocation } = {};

export const INITIAL_CHAT: ChatMessage[] = [];

export const INITIAL_NOTIFICATIONS: NotificationLog[] = [];

export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [];

export const INITIAL_REGIONS: Region[] = [
  { id: 'GV1', name: 'GV1 (Cariacica)', description: 'Grande Vitória - Cariacica, Espírito Santo', lat: -18.85, lng: -41.94, radius: 1500 },
  { id: 'GV2', name: 'GV2 (Vila Velha)', description: 'Grande Vitória - Vila Velha, Espírito Santo', lat: -18.865, lng: -41.940, radius: 1000 },
  { id: 'GV3', name: 'GV3 (Grande Serra)', description: 'Grande Vitória - Serra, Espírito Santo', lat: -18.80, lng: -41.90, radius: 2000 },
  { id: 'ES/MG', name: 'ES/MG (Sul de Minas)', description: 'Espírito Santo / Região Sul de Minas Gerais', lat: -19.93, lng: -43.94, radius: 800 },
  { id: '262', name: '262 (Rod. 262-ES)', description: 'Corredor Logístico da Rodovia BR-262 ES', lat: -20.35, lng: -40.65, radius: 3000 },
  { id: 'Norte', name: 'Norte', description: 'Região Norte do Espírito Santo', lat: -19.50, lng: -40.10, radius: 5000 },
  { id: 'Sul', name: 'Sul', description: 'Região Sul do Espírito Santo', lat: -20.80, lng: -40.80, radius: 5000 }
];

export const REGIONS_LIST = ['GV1', 'GV2', 'GV3', 'ES/MG', 'Norte', 'Sul', '262'];

export const INITIAL_NOTIF_TEMPLATES: PushNotificationTemplate[] = [
  {
    id: 'tpl_nova_rota',
    type: 'nova_rota',
    title: 'Nova Rota Atribuída 📦',
    bodyTemplate: 'Olá, {driverName}! Uma nova rota "{routeName}" foi atribuída a você na região {region}. Toque para revisar o itinerário no mapa.'
  },
  {
    id: 'tpl_rota_iniciada',
    type: 'rota_iniciada',
    title: 'Motorista em Trânsito 🚚',
    bodyTemplate: 'O motorista {driverName} iniciou a rota "{routeName}" às {time}. Rastreamento de geolocalização e telemetria ativado!'
  },
  {
    id: 'tpl_status_parada',
    type: 'status_parada',
    title: 'Entrega Concluída Checklist ✅',
    bodyTemplate: 'A parada #{stopIndex} ({clientName}) da rota "{routeName}" foi concluída. Tempo de permanência no local: {timeSpent} minutos.'
  },
  {
    id: 'tpl_urgente_chat',
    type: 'urgente_chat',
    title: 'Mensagem Urgente da Central ⚠️',
    bodyTemplate: 'Atenção, operadores da região {region}: {message}'
  }
];

export const INITIAL_PERFORMANCE_LOGS: RoutePerformanceLog[] = [];

export const INITIAL_PUSH_LOGS: PushDeliveryLog[] = [];

