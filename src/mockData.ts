/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  UserRole, RouteUser, Rota, ChatMessage, NotificationLog, 
  AuditLogEntry, GPSLocation, RoutePerformanceLog, PushDeliveryLog, 
  PushNotificationTemplate 
} from './types';

export const INITIAL_USERS: RouteUser[] = [
  // Super Admin
  {
    id: 'admin_1',
    name: 'Carlos Oliveira (Super Admin)',
    email: 'admin@routelog.com',
    phone: '+55 (31) 98888-1111',
    address: 'Av. Afonso Pena, 1500 - Belo Horizonte, MG',
    role: UserRole.ADMIN,
    status: 'active',
    createdAt: '2026-01-10T08:00:00Z'
  },
  // Gerentes de Logística
  {
    id: 'gerente_gv',
    name: 'Mariana Souza',
    email: 'mariana.souza@routelog.com',
    phone: '+55 (33) 99111-2222',
    address: 'Rua Dom Pedro II, 450 - Governador Valadares, MG',
    role: UserRole.GERENTE,
    region: 'GV1',
    status: 'active',
    createdAt: '2026-02-15T09:30:00Z'
  },
  {
    id: 'gerente_bh',
    name: 'Rodrigo Costa',
    email: 'rodrigo.costa@routelog.com',
    phone: '+55 (31) 99222-3333',
    address: 'Av. do Contorno, 4000 - Belo Horizonte, MG',
    role: UserRole.GERENTE,
    region: 'ES/MG',
    status: 'active',
    createdAt: '2026-02-20T10:00:00Z'
  },
  // Motoristas
  {
    id: 'driver_lucas',
    name: 'Lucas Silva (Motorista)',
    email: 'lucas.motorista@routelog.com',
    phone: '+55 (33) 98444-5555',
    address: 'Rua Sete de Setembro, 820 - Governador Valadares, MG',
    role: UserRole.MOTORISTA,
    region: 'GV1',
    status: 'active',
    createdAt: '2026-03-01T07:15:00Z',
    cnh: '12345678910',
    cnhCategory: 'D',
    cnhExpiration: '2030-05-20',
    vehicleModel: 'Mercedes-Benz Sprinter 315',
    plate: 'RTL-4G21'
  } as any,
  {
    id: 'driver_andre',
    name: 'André Santos (Motorista)',
    email: 'andre.motorista@routelog.com',
    phone: '+55 (31) 98777-6666',
    address: 'Av. Amazonas, 3200 - Belo Horizonte, MG',
    role: UserRole.MOTORISTA,
    region: 'ES/MG',
    status: 'active',
    createdAt: '2026-03-05T08:00:00Z',
    cnh: '98765432100',
    cnhCategory: 'C',
    cnhExpiration: '2029-11-14',
    vehicleModel: 'Iveco Daily 35-150',
    plate: 'LOG-9X82'
  } as any,
  // Vendedores
  {
    id: 'vendedor_gv',
    name: 'Paula Reis (Vendedora GV1)',
    email: 'paula.vendedor@routelog.com',
    phone: '+55 (33) 98999-7777',
    address: 'Rua Marechal Deodoro, 120 - Governador Valadares, MG',
    role: UserRole.VENDEDOR,
    region: 'GV1',
    status: 'active',
    createdAt: '2026-03-10T11:00:00Z'
  },
  {
    id: 'vendedor_bh',
    name: 'Thiago Neves (Vendedor MG)',
    email: 'thiago.vendedor@routelog.com',
    phone: '+55 (31) 98555-8888',
    address: 'Rua Paraíba, 550 - Belo Horizonte, MG',
    role: UserRole.VENDEDOR,
    region: 'ES/MG',
    status: 'active',
    createdAt: '2026-03-12T14:30:00Z'
  }
];

export const INITIAL_ROTAS: Rota[] = [
  {
    id: 'rota_gv_01',
    driverId: 'driver_lucas',
    driverName: 'Lucas Silva',
    driverPlate: 'RTL-4G21',
    name: 'Entrega Matinal GV - Centro e Esplanada',
    origin: 'Centro de Distribuição GV1 - Rodovia BR-116, Km 410',
    originLat: -18.845,
    originLng: -41.945,
    region: 'GV1',
    status: 'draft',
    currentStopIndex: 0,
    createdAt: '2026-06-14T08:00:00Z',
    optimized: false,
    stops: [
      {
        id: 'stop_1',
        clientName: 'Mercadinho do Bairro',
        clientWhatsApp: '5533999991111',
        address: 'Rua Israel Pinheiro, 2500 - Centro, GV',
        lat: -18.852,
        lng: -41.952,
        status: 'pending'
      },
      {
        id: 'stop_2',
        clientName: 'Farmácia Preço Baixo',
        clientWhatsApp: '5533999992222',
        address: 'Av. Minas Gerais, 980 - Nossa Senhora das Graças, GV',
        lat: -18.858,
        lng: -41.939,
        status: 'pending'
      },
      {
        id: 'stop_3',
        clientName: 'Panificadora GV Delícia',
        clientWhatsApp: '5533999993333',
        address: 'Rua Quintino Bocaiúva, 450 - Esplanada, GV',
        lat: -18.865,
        lng: -41.947,
        status: 'pending'
      }
    ]
  },
  {
    id: 'rota_bh_01',
    driverId: 'driver_andre',
    driverName: 'André Santos',
    driverPlate: 'LOG-9X82',
    name: 'Rota Expresso BH - Savassi & Lourdes',
    origin: 'CD Central BH - Anel Rodoviário, Km 5',
    originLat: -19.925,
    originLng: -43.945,
    region: 'ES/MG',
    status: 'active',
    currentStopIndex: 1,
    createdAt: '2026-06-14T09:15:00Z',
    optimized: true,
    stops: [
      {
        id: 'stop_4',
        clientName: 'Supermercado Savassi',
        clientWhatsApp: '5531999994444',
        address: 'Rua Pernambuco, 1100 - Savassi, BH',
        lat: -19.938,
        lng: -43.936,
        status: 'completed'
      },
      {
        id: 'stop_5',
        clientName: 'Restaurante Sabor de Lourdes',
        clientWhatsApp: '5531999995555',
        address: 'Rua Bahia, 1800 - Lourdes, BH',
        lat: -19.931,
        lng: -43.944,
        status: 'pending'
      },
      {
        id: 'stop_6',
        clientName: 'Hotel BH Colonial',
        clientWhatsApp: '5531999996666',
        address: 'Av. João Pinheiro, 320 - Centro, BH',
        lat: -19.923,
        lng: -43.937,
        status: 'pending'
      }
    ]
  }
];

export const INITIAL_LOCATIONS: { [driverId: string]: GPSLocation } = {
  driver_lucas: {
    driverId: 'driver_lucas',
    lat: -18.845,
    lng: -41.945,
    heading: 120,
    speed: 0,
    lastUpdated: '2026-06-14T14:35:00Z'
  },
  driver_andre: {
    driverId: 'driver_andre',
    lat: -19.932,
    lng: -43.942,
    heading: 215,
    speed: 45,
    lastUpdated: '2026-06-14T14:41:00Z'
  }
};

export const INITIAL_CHAT: ChatMessage[] = [
  {
    id: 'msg_1',
    senderId: 'driver_andre',
    senderName: 'André Santos (Motorista)',
    senderRole: UserRole.MOTORISTA,
    region: 'ES/MG',
    message: 'Fala pessoal, acabei de sair do CD com a carga fechada. Indo em direção à Savassi.',
    timestamp: '2026-06-14T09:20:00Z'
  },
  {
    id: 'msg_2',
    senderId: 'vendedor_bh',
    senderName: 'Thiago Neves (Vendedor)',
    senderRole: UserRole.VENDEDOR,
    region: 'ES/MG',
    message: 'Show André! O cliente da Savassi está agoniado esperando as caixas de bebida. Que bom que já tá indo.',
    timestamp: '2026-06-14T09:22:00Z'
  },
  {
    id: 'msg_3',
    senderId: 'gerente_bh',
    senderName: 'Rodrigo Costa (Gerente)',
    senderRole: UserRole.GERENTE,
    region: 'ES/MG',
    message: 'Excelente, André. Dirija com cuidado. Qualquer problema na entrega me dê um alô aqui.',
    timestamp: '2026-06-14T09:25:00Z'
  },
  {
    id: 'msg_4',
    senderId: 'driver_andre',
    senderName: 'André Santos (Motorista)',
    senderRole: UserRole.MOTORISTA,
    region: 'ES/MG',
    message: 'Deu tudo certo na Savassi, acabei de marcar como entregue e estou me deslocando para o Lourdes.',
    timestamp: '2026-06-14T10:11:00Z'
  }
];

export const INITIAL_NOTIFICATIONS: NotificationLog[] = [
  {
    id: 'notif_1',
    region: 'ES/MG',
    title: 'Rota Iniciada - André Santos',
    body: 'O motorista André Santos iniciou a rota "Rota Expresso BH - Savassi & Lourdes". Acompanhe no mapa.',
    timestamp: '2026-06-14T09:15:00Z',
    senderName: 'André Santos'
  }
];

export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'audit_1',
    adminId: 'admin_1',
    adminName: 'Carlos Oliveira',
    action: 'Criação de Conta',
    targetUserId: 'driver_lucas',
    targetUserName: 'Lucas Silva',
    details: 'Aprovou o cadastro inicial do motorista Lucas Silva para a região GV1.',
    timestamp: '2026-06-14T08:00:00Z'
  },
  {
    id: 'audit_2',
    adminId: 'admin_1',
    adminName: 'Carlos Oliveira',
    action: 'Visualizar Como (Impersonation)',
    targetUserId: 'gerente_gv',
    targetUserName: 'Mariana Souza',
    details: 'Visualizou o painel regional de GV1 para verificar status do mapa regional.',
    timestamp: '2026-06-14T10:30:00Z'
  }
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

export const INITIAL_PERFORMANCE_LOGS: RoutePerformanceLog[] = [
  {
    id: 'perf_1',
    routeId: 'rota_past_1',
    routeName: 'Distribuição Express Centro',
    driverId: 'driver_lucas',
    driverName: 'Lucas Silva',
    driverPlate: 'RTL-4G21',
    region: 'GV1',
    plannedDistanceKm: 34.0,
    actualDistanceKm: 35.8,
    plannedStopsCount: 3,
    completedStopsCount: 3,
    startTimestamp: '2026-06-12T08:00:00Z',
    endTimestamp: '2026-06-12T10:15:00Z',
    routeDeviations: 1,
    averageTimePerStopMinutes: 18.0,
    status: 'completed',
    stopTelemetry: [
      {
        stopId: 'pst_1',
        clientName: 'Mercadinho do Bairro',
        plannedLat: -18.852,
        plannedLng: -41.952,
        arrivalTimestamp: '2026-06-12T08:20:00Z',
        departureTimestamp: '2026-06-12T08:38:00Z',
        timeSpentMinutes: 18
      },
      {
        stopId: 'pst_2',
        clientName: 'Farmácia Preço Baixo',
        plannedLat: -18.858,
        plannedLng: -41.939,
        arrivalTimestamp: '2026-06-12T08:55:00Z',
        departureTimestamp: '2026-06-12T09:15:00Z',
        timeSpentMinutes: 20
      },
      {
        stopId: 'pst_3',
        clientName: 'Panificadora GV Delícia',
        plannedLat: -18.865,
        plannedLng: -41.947,
        arrivalTimestamp: '2026-06-12T09:35:00Z',
        departureTimestamp: '2026-06-12T09:51:00Z',
        timeSpentMinutes: 16
      }
    ]
  },
  {
    id: 'perf_2',
    routeId: 'rota_past_2',
    routeName: 'Inter CD Savassi - Lourdes',
    driverId: 'driver_andre',
    driverName: 'André Santos',
    driverPlate: 'LOG-9X82',
    region: 'ES/MG',
    plannedDistanceKm: 55.0,
    actualDistanceKm: 61.2,
    plannedStopsCount: 3,
    completedStopsCount: 3,
    startTimestamp: '2026-06-12T13:30:00Z',
    endTimestamp: '2026-06-12T16:40:00Z',
    routeDeviations: 3,
    averageTimePerStopMinutes: 27.3,
    status: 'completed',
    stopTelemetry: [
      {
        stopId: 'pst_4',
        clientName: 'Supermercado Savassi',
        plannedLat: -19.938,
        plannedLng: -43.936,
        arrivalTimestamp: '2026-06-12T13:58:00Z',
        departureTimestamp: '2026-06-12T14:31:00Z',
        timeSpentMinutes: 33
      },
      {
        stopId: 'pst_5',
        clientName: 'Restaurante Sabor de Lourdes',
        plannedLat: -19.931,
        plannedLng: -43.944,
        arrivalTimestamp: '2026-06-12T14:55:00Z',
        departureTimestamp: '2026-06-12T15:20:00Z',
        timeSpentMinutes: 25
      },
      {
        stopId: 'pst_6',
        clientName: 'Hotel BH Colonial',
        plannedLat: -19.923,
        plannedLng: -43.937,
        arrivalTimestamp: '2026-06-12T15:48:00Z',
        departureTimestamp: '2026-06-12T16:12:00Z',
        timeSpentMinutes: 24
      }
    ]
  },
  {
    id: 'perf_3',
    routeId: 'rota_past_3',
    routeName: 'Logística Regional Alimentos',
    driverId: 'driver_lucas',
    driverName: 'Lucas Silva',
    driverPlate: 'RTL-4G21',
    region: 'GV1',
    plannedDistanceKm: 28.5,
    actualDistanceKm: 28.9,
    plannedStopsCount: 2,
    completedStopsCount: 2,
    startTimestamp: '2026-06-11T09:00:00Z',
    endTimestamp: '2026-06-11T10:35:00Z',
    routeDeviations: 0,
    averageTimePerStopMinutes: 14.5,
    status: 'completed',
    stopTelemetry: [
      {
        stopId: 'pst_7',
        clientName: 'Mercantil São Francisco',
        plannedLat: -18.848,
        plannedLng: -41.954,
        arrivalTimestamp: '2026-06-11T09:22:00Z',
        departureTimestamp: '2026-06-11T09:37:00Z',
        timeSpentMinutes: 15
      },
      {
        stopId: 'pst_8',
        clientName: 'Drogaria do Povo',
        plannedLat: -18.850,
        plannedLng: -41.946,
        arrivalTimestamp: '2026-06-11T09:55:00Z',
        departureTimestamp: '2026-06-11T10:09:00Z',
        timeSpentMinutes: 14
      }
    ]
  },
  {
    id: 'perf_4',
    routeId: 'rota_past_4',
    routeName: 'Savassi Rápida Frutas',
    driverId: 'driver_andre',
    driverName: 'André Santos',
    driverPlate: 'LOG-9X82',
    region: 'ES/MG',
    plannedDistanceKm: 18.0,
    actualDistanceKm: 18.5,
    plannedStopsCount: 2,
    completedStopsCount: 2,
    startTimestamp: '2026-06-11T14:00:00Z',
    endTimestamp: '2026-06-11T15:10:00Z',
    routeDeviations: 1,
    averageTimePerStopMinutes: 12.0,
    status: 'completed',
    stopTelemetry: [
      {
        stopId: 'pst_9',
        clientName: 'Supermercado Savassi',
        plannedLat: -19.938,
        plannedLng: -43.936,
        arrivalTimestamp: '2026-06-11T14:18:00Z',
        departureTimestamp: '2026-06-11T14:30:00Z',
        timeSpentMinutes: 12
      },
      {
        stopId: 'pst_10',
        clientName: 'Restaurante Sabor de Lourdes',
        plannedLat: -19.931,
        plannedLng: -43.944,
        arrivalTimestamp: '2026-06-11T14:48:00Z',
        departureTimestamp: '2026-06-11T15:00:00Z',
        timeSpentMinutes: 12
      }
    ]
  }
];

export const INITIAL_PUSH_LOGS: PushDeliveryLog[] = [
  {
    id: 'pl_1',
    title: 'Nova Rota Atribuída 📦',
    body: 'Olá, Lucas Silva! Uma nova rota "Entrega Matinal GV" foi atribuída a você na região GV1.',
    targetRole: UserRole.MOTORISTA,
    targetRegion: 'GV1',
    sentCount: 1,
    timestamp: '2026-06-14T08:02:00Z',
    success: true,
    type: 'nova_rota'
  },
  {
    id: 'pl_2',
    title: 'Motorista em Trânsito 🚚',
    body: 'O motorista André Santos iniciou a rota "Rota Expresso BH" às 09:15. Rastreamento ativo!',
    targetRole: UserRole.GERENTE,
    targetRegion: 'ES/MG',
    sentCount: 1,
    timestamp: '2026-06-14T09:15:20Z',
    success: true,
    type: 'rota_iniciada'
  }
];

