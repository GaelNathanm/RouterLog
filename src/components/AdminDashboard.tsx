/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  UserRole, RouteUser, Rota, Parada, GPSLocation, ChatMessage, NotificationLog, 
  AuditLogEntry, RoutePerformanceLog, PushDeliveryLog, PushConfig, MotoristaUser, Region, AdminUser 
} from '../types';
import { 
  Users, TrendingUp, AlertTriangle, Globe, MapPin, Eye, ShieldCheck, 
  Trash2, AlertCircle, Share2, Navigation, CheckCircle, Send, MessageSquare, 
  UserCheck, ShieldAlert, Ban, Info, Sparkles, Plus, Map, Play, Check, Phone, ArrowRight, Edit, Pencil,
  Route, Compass, Bell, Settings, Layers, Calendar, BarChart3, Clock, AlertOctagon, HelpCircle, Truck, Signal,
  Download, Printer, Mic, Square, Pause, Volume2, SlidersHorizontal, Camera, RefreshCw, X, FileSpreadsheet
} from 'lucide-react';
import RouteMap from './RouteMap';
import WelcomeTutorial from './WelcomeTutorial';
import { ResponsiveContainer, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

// ==========================================
// CENTRALIZED EXPORT HELPERS (CSV & PDF)
// ==========================================
const exportToCSV = (logs: RoutePerformanceLog[], filename = 'relatorio_desempenho_rotas.csv') => {
  if (logs.length === 0) {
    alert('Nenhum dado de desempenho disponível para exportação.');
    return;
  }

  let csvContent = '\uFEFF'; // UTF-8 BOM
  csvContent += 'ID de Desempenho;ID da Rota;Nome da Rota;Região;Motorista;Placa;Distância Prevista (Km);Distância Realizada (Km);Frequência Prevista;Frequência Concluída;Desvios de Rota;Horário de Início;Horário de Fim;Tempo Médio por Parada (min);Status\n';

  logs.forEach(log => {
    const start = new Date(log.startTimestamp).toLocaleString('pt-BR');
    const end = log.endTimestamp ? new Date(log.endTimestamp).toLocaleString('pt-BR') : 'Em Trânsito';
    const row = [
      log.id,
      log.routeId,
      `"${log.routeName.replace(/"/g, '""')}"`,
      log.region,
      `"${log.driverName.replace(/"/g, '""')}"`,
      log.driverPlate,
      log.plannedDistanceKm,
      log.actualDistanceKm,
      log.plannedStopsCount,
      log.completedStopsCount,
      log.routeDeviations,
      start,
      end,
      log.averageTimePerStopMinutes,
      log.status === 'completed' ? 'Concluido' : 'Ativo'
    ];
    csvContent += row.join(';') + '\n';
  });

  csvContent += '\n\n📊 DETALHAMENTO DE TEMPOS POR PARADA (TELEMETRIA DE CHECK-IN)\n';
  csvContent += 'ID da Rota;Nome da Rota;Motorista;Placa;Cliente;Horário de Chegada;Horário de Saída;Tempo de Permanência (min)\n';

  logs.forEach(log => {
    if (log.stopTelemetry && log.stopTelemetry.length > 0) {
      log.stopTelemetry.forEach(t => {
        const arrival = new Date(t.arrivalTimestamp).toLocaleString('pt-BR');
        const departure = t.departureTimestamp ? new Date(t.departureTimestamp).toLocaleString('pt-BR') : '';
        const row = [
          log.routeId,
          `"${log.routeName.replace(/"/g, '""')}"`,
          `"${log.driverName.replace(/"/g, '""')}"`,
          log.driverPlate,
          `"${t.clientName.replace(/"/g, '""')}"`,
          arrival,
          departure,
          t.timeSpentMinutes
        ];
        csvContent += row.join(';') + '\n';
      });
    }
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const exportToPDF = (logs: RoutePerformanceLog[], viewTitle = 'Relatório Geral de Desempenho Logístico') => {
  if (logs.length === 0) {
    alert('Nenhum dado de desempenho disponível para gerar relatório.');
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Por favor, permita pop-ups no navegador para gerar e imprimir o PDF.');
    return;
  }

  const totalKm = logs.reduce((sum, p) => sum + p.actualDistanceKm, 0);
  const totalDeviations = logs.reduce((sum, p) => sum + p.routeDeviations, 0);
  const totalStops = logs.reduce((acc, p) => acc + p.stopTelemetry.length, 0);
  const totalMinutes = logs.reduce((acc, p) => acc + p.stopTelemetry.reduce((sAcc, s) => sAcc + s.timeSpentMinutes, 0), 0);
  const avgStopMins = totalStops > 0 ? Math.round(totalMinutes / totalStops) : 0;

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>${viewTitle}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          margin: 30px;
          color: #1e293b;
          font-size: 11px;
          line-height: 1.4;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 15px;
          margin-bottom: 20px;
        }
        .header h1 {
          font-size: 18px;
          margin: 0;
          color: #0f172a;
          font-weight: 800;
          letter-spacing: -0.025em;
        }
        .header p {
          margin: 4px 0 0 0;
          color: #64748b;
          font-size: 11px;
        }
        .meta-stamp {
          text-align: right;
          font-family: monospace;
          font-size: 9px;
          color: #94a3b8;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 25px;
        }
        .stat-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px;
          text-align: center;
        }
        .stat-card .label {
          color: #64748b;
          font-size: 9px;
          text-transform: uppercase;
          font-weight: bold;
          letter-spacing: 0.05em;
        }
        .stat-card .value {
          font-size: 18px;
          font-weight: 850;
          color: #0f172a;
          margin-top: 4px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 15px;
        }
        th, td {
          padding: 8px 10px;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
        }
        th {
          background-color: #f1f5f9;
          color: #475569;
          font-weight: bold;
          font-size: 10px;
        }
        tr:nth-child(even) td {
          background-color: #fafafa;
        }
        .badge {
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 9px;
          font-weight: bold;
        }
        .badge-active { background: #dbeafe; color: #1e40af; }
        .badge-completed { background: #d1fae5; color: #065f46; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>${viewTitle}</h1>
          <p>Relatório Consolidado de Telemetria de Viagens e Metas de Check-In</p>
        </div>
        <div class="meta-stamp">
          <div>Emissão: ${new Date().toLocaleString('pt-BR')}</div>
          <div>Sistema RouteLog Enterprise v2.4</div>
        </div>
      </div>

      <div class="stats-grid" style="display: flex; gap: 15px; width: 100%;">
        <div class="stat-card" style="flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px;">
          <div class="label">Km Rodados (Real)</div>
          <div class="value">${Math.round(totalKm * 10) / 10} km</div>
        </div>
        <div class="stat-card" style="flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px;">
          <div class="label">Desvios Logísticos</div>
          <div class="value" style="color: #ef4444;">${totalDeviations}</div>
        </div>
        <div class="stat-card" style="flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px;">
          <div class="label">Permanência Média</div>
          <div class="value">${avgStopMins} min</div>
        </div>
        <div class="stat-card" style="flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px;">
          <div class="label font-mono">Viagens Registradas</div>
          <div class="value">${logs.length}</div>
        </div>
      </div>

      <h2>Desempenho Geral por Operador</h2>
      <table>
        <thead>
          <tr>
            <th>Região</th>
            <th>Motorista</th>
            <th>Placa</th>
            <th>Km Planejado</th>
            <th>Km Percorrido</th>
            <th>Paradas Efetuadas</th>
            <th>Desvios</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${logs.map(log => `
            <tr>
              <td><strong>${log.region}</strong></td>
              <td>${log.driverName}</td>
              <td><code>${log.driverPlate}</code></td>
              <td>${log.plannedDistanceKm} km</td>
              <td>${log.actualDistanceKm} km</td>
              <td>${log.completedStopsCount} de ${log.plannedStopsCount}</td>
              <td style="color: ${log.routeDeviations > 0 ? '#ef4444' : '#64748b'}; font-weight: bold;">${log.routeDeviations}</td>
              <td><span class="badge ${log.status === 'completed' ? 'badge-completed' : 'badge-active'}">${log.status.toUpperCase()}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
};

export interface AdminProps {
  users: RouteUser[];
  rotas: Rota[];
  auditLogs: AuditLogEntry[];
  chats: ChatMessage[];
  locations: { [drvId: string]: GPSLocation };
  breadcrumbs?: { [drvId: string]: { lat: number; lng: number }[] };
  notifications: NotificationLog[];
  performanceLogs: RoutePerformanceLog[];
  pushLogs?: PushDeliveryLog[];
  pushConfig?: PushConfig;
  regions: Region[];
  onImpersonate: (user: RouteUser | null) => void;
  onModerate: (userId: string, action: 'activate' | 'suspend' | 'ban') => void;
  onUpdateUser: (updatedUser: RouteUser) => void;
  onCreateUser: (userData: Partial<RouteUser>) => void;
  onDeleteUser: (userId: string) => void;
  onSaveRegion: (region: Region) => Promise<void>;
  onDeleteRegion: (regionId: string) => Promise<void>;
  onPush: (title: string, body: string, region: string) => void;
  onSendPush?: (
    templateType: 'nova_rota' | 'rota_iniciada' | 'status_parada' | 'urgente_chat' | 'custom',
    profileSegment: 'all' | UserRole,
    regionSegment: string,
    customTitle?: string,
    customBody?: string
  ) => PushDeliveryLog;
}

export function AdminDashboard({ 
  users, 
  rotas, 
  auditLogs, 
  chats, 
  locations, 
  breadcrumbs,
  notifications, 
  performanceLogs, 
  regions,
  onImpersonate, 
  onModerate,
  onUpdateUser,
  onCreateUser,
  onDeleteUser,
  onSaveRegion,
  onDeleteRegion,
  onPush,
  onSendPush
}: AdminProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'analytics' | 'chats' | 'audits' | 'desempenho' | 'mapa' | 'regioes'>('users');
  const [showTutorial, setShowTutorial] = useState(false);
  const [pushTitle, setPushTitle] = useState('');
  const [pushBody, setPushBody] = useState('');
  const [pushRegion, setPushRegion] = useState('all');
  const [pushRoleTarget, setPushRoleTarget] = useState<'all' | UserRole>('all');
  const [pushRegionTarget, setPushRegionTarget] = useState<string>('all');
  const [userToDeleteId, setUserToDeleteId] = useState<string | null>(null);

  // States for Editing Users
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editedName, setEditedName] = useState('');
  const [editedEmail, setEditedEmail] = useState('');
  const [editedPhone, setEditedPhone] = useState('');
  const [editedRegion, setEditedRegion] = useState('');

  // States for Region Administration
  const [regId, setRegId] = useState('');
  const [regName, setRegName] = useState('');
  const [regState, setRegState] = useState('Espírito Santo');
  const [regLat, setRegLat] = useState(-18.85);
  const [regLng, setRegLng] = useState(-41.94);
  const [regRadius, setRegRadius] = useState(1500);
  const [editingRegId, setEditingRegId] = useState<string | null>(null);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);

  // States for Driver specific fields in user editor
  const [editedPlate, setEditedPlate] = useState('');
  const [editedVehicleModel, setEditedVehicleModel] = useState('');
  const [editedCnh, setEditedCnh] = useState('');
  const [editedCnhCategory, setEditedCnhCategory] = useState('');
  const [editedCnhExpiration, setEditedCnhExpiration] = useState('');

  // States for Creating Users
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newRole, setNewRole] = useState<UserRole>(UserRole.MOTORISTA);
  const [newRegion, setNewRegion] = useState('');
  const [newPlate, setNewPlate] = useState('');
  const [newVehicleModel, setNewVehicleModel] = useState('');
  const [newCnh, setNewCnh] = useState('');
  const [newCnhCategory, setNewCnhCategory] = useState('B');
  const [newCnhExpiration, setNewCnhExpiration] = useState('');

  // Diagnostic log trigger
  useEffect(() => {
    console.log('[AdminDashboard] Active view render with data status:', {
      usersCount: users.length,
      routesCount: rotas.length,
      regionsCount: regions.length,
      auditLogsCount: auditLogs.length,
      activeFilters: { pushRegion }
    });
  }, [users, rotas, regions, auditLogs, pushRegion]);

  // Dynamic universal search categories matching
  const searchResults = useMemo(() => {
    if (!searchTerm || searchTerm.trim().length < 2) return null;
    const term = searchTerm.toLowerCase().trim();

    // 1. Matches Drivers
    const drivers = users
      .filter(u => u.role === UserRole.MOTORISTA && (
        u.name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        (u as any).plate?.toLowerCase().includes(term)
      ))
      .slice(0, 4);

    // 2. Matches Routes
    const matchedRoutes = rotas
      .filter(r => (
        r.name.toLowerCase().includes(term) ||
        r.region.toLowerCase().includes(term) ||
        r.driverName.toLowerCase().includes(term)
      ))
      .slice(0, 4);

    // 3. Matches Clients
    const matchedClients: { clientName: string; address: string; routeName: string; whatsApp?: string }[] = [];
    rotas.forEach(r => {
      r.stops.forEach(st => {
        if (
          st.clientName.toLowerCase().includes(term) ||
          st.address.toLowerCase().includes(term) ||
          (st.clientWhatsApp && st.clientWhatsApp.includes(term))
        ) {
          if (!matchedClients.some(c => c.clientName === st.clientName)) {
            matchedClients.push({
              clientName: st.clientName,
              address: st.address,
              routeName: r.name,
              whatsApp: st.clientWhatsApp
            });
          }
        }
      });
    });

    return {
      drivers,
      routes: matchedRoutes,
      clients: matchedClients.slice(0, 4)
    };
  }, [searchTerm, users, rotas]);

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ((u as any).plate && (u as any).plate.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const activeDriversCount = rotas.filter(r => r.status === 'active').length;

  const handleSendPush = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pushTitle || !pushBody) return;
    
    if (onSendPush) {
      onSendPush('custom', pushRoleTarget, pushRegionTarget, pushTitle, pushBody);
    } else {
      onPush(pushTitle, pushBody, pushRegionTarget);
    }

    setPushTitle('');
    setPushBody('');
  };

  return (
    <div id="admin-main-panel" className="space-y-6">
      
      {/* Search and Impersonation Warning Banner */}
      <div className="bg-slate-900 text-white rounded-xl p-5 border border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-rose-400 font-mono text-xs font-bold uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4" />
            Super Admin Gate - Bypass Ativo
          </div>
          <h2 className="text-xl font-bold mt-1">Painel Global de Auditoria e Moderação</h2>
          <p className="text-xs text-slate-400">Total visibilidade de base de dados isolada regionalmente.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTutorial(true)}
            className="bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 border border-slate-700 px-3 py-2 text-xs rounded-lg flex items-center gap-1.5 font-bold cursor-pointer transition-all animate-pulse"
            title="Abrir guia interativo explicativo"
          >
            <HelpCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Guia do Usuário</span>
          </button>
          
          <div className="relative">
            <input
              type="text"
              placeholder="Pesquisa Universal..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-slate-850 border border-slate-700 text-white p-2 text-xs rounded-lg placeholder-slate-500 w-[200px]"
            />
            {searchResults && (
              <div className="absolute right-0 top-full mt-2 w-[320px] md:w-[465px] bg-white border border-slate-200 shadow-2xl rounded-2xl p-4.5 z-50 overflow-y-auto max-h-[380px] space-y-4 text-slate-800 text-left border-t-8 border-t-indigo-600">
                <div className="flex items-center justify-between border-b pb-2 select-none">
                  <span className="font-extrabold text-[10px] text-slate-400 uppercase tracking-widest">Resultado de Busca Rápida</span>
                  <button 
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2.5 py-1 rounded font-black uppercase"
                  >
                    Limpar
                  </button>
                </div>

                {searchResults.drivers.length === 0 && searchResults.routes.length === 0 && searchResults.clients.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 font-medium">Nenhum registro correspondente encontrado para "{searchTerm}"</div>
                ) : (
                  <div className="space-y-4">
                    {/* Drivers category */}
                    {searchResults.drivers.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[9px] font-black text-indigo-600 block uppercase tracking-wider font-mono">Motoristas Ativos 👀</span>
                        <div className="space-y-1">
                          {searchResults.drivers.map(drv => (
                            <div key={drv.id} className="p-2.5 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between transition-all hover:bg-slate-100/50">
                              <div>
                                <strong className="block text-slate-850 text-xs font-semibold">{drv.name}</strong>
                                <span className="text-[10px] text-slate-400 block mt-0.5">E-mail: {drv.email} {(drv as any).region ? `| Região: ${(drv as any).region}` : ''}</span>
                              </div>
                              <span className="bg-indigo-50 border border-indigo-150 text-indigo-700 font-mono text-[9px] font-black uppercase px-2 py-0.5 rounded shrink-0">
                                Placa: {(drv as any).plate || 'RTL-1234'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Routes category */}
                    {searchResults.routes.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[9px] font-black text-indigo-600 block uppercase tracking-wider font-mono">Rotas Logísticas 📦</span>
                        <div className="space-y-1">
                          {searchResults.routes.map(rt => (
                            <div key={rt.id} className="p-2.5 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between transition-all hover:bg-slate-100/50">
                              <div className="min-w-0 pr-2">
                                <strong className="block text-slate-850 text-xs font-semibold truncate">{rt.name}</strong>
                                <span className="text-[10px] text-slate-400 block mt-0.5 truncate">Origem: {rt.origin} | Região: {rt.region}</span>
                              </div>
                              <span className={`font-mono text-[8px] text-white font-black uppercase px-2 py-0.5 rounded shrink-0 ${
                                rt.status === 'completed' ? 'bg-emerald-500' : rt.status === 'active' ? 'bg-indigo-500 animate-pulse' : 'bg-slate-400'
                              }`}>
                                {rt.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Clients category */}
                    {searchResults.clients.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[9px] font-black text-indigo-600 block uppercase tracking-wider font-mono">Clientes / Destinatários 👤</span>
                        <div className="space-y-1">
                          {searchResults.clients.map((cl, cidx) => (
                            <div key={cidx} className="p-2.5 bg-slate-50 border border-slate-150 rounded-xl transition-all hover:bg-slate-100/50">
                              <div className="flex items-center justify-between pr-1 gap-2">
                                <strong className="text-slate-850 text-xs font-semibold truncate">{cl.clientName}</strong>
                                {cl.whatsApp && <span className="text-[9px] font-mono font-bold text-emerald-600 shrink-0">💬 {cl.whatsApp}</span>}
                              </div>
                              <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{cl.address}</p>
                              <span className="text-[8px] text-slate-500 bg-slate-200/60 inline-block mt-1 px-1.5 py-0.5 rounded font-mono font-bold leading-none select-none">
                                Rota associada: {cl.routeName}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Metric Cards Banner Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-sans text-slate-500">Membros Ativos</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-800">{users.length}</div>
          <span className="text-[10px] text-slate-450 font-mono">Contas Registradas</span>
        </div>
        <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-sans text-slate-500">Combos Logísticos</span>
            <Navigation className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-slate-800">{rotas.length}</div>
          <span className="text-[10px] text-slate-450 font-mono">Rotas Totais Criadas</span>
        </div>
        <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-sans text-slate-500 font-medium">Viagens Ativas</span>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-600 font-mono">{activeDriversCount}</div>
          <span className="text-[10px] text-slate-450 font-mono">Telemetria Ativa</span>
        </div>
        <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-sans text-slate-500">Regiões Operando</span>
            <Globe className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-800">{regions.length || 7}</div>
          <span className="text-[10px] text-slate-450 font-mono">GV1, GV2, GV3, ES/MG, etc.</span>
        </div>
      </div>

      {/* Navigation tabs inside Admin panel */}
      <div className="flex items-center border-b border-slate-200 gap-1.5 font-mono text-xs overflow-x-auto whitespace-nowrap scrollbar-none pb-px">
        <button
          onClick={() => setActiveTab('users')}
          className={`py-2.5 px-4 font-semibold border-b-2 -mb-px transition-all ${
            activeTab === 'users' ? 'border-rose-600 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Usuários & Impersonation
        </button>
        <button
          onClick={() => setActiveTab('audits')}
          className={`py-2.5 px-4 font-semibold border-b-2 -mb-px transition-all ${
            activeTab === 'audits' ? 'border-rose-600 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Logs de Auditoria
        </button>
        <button
          onClick={() => setActiveTab('chats')}
          className={`py-2.5 px-4 font-semibold border-b-2 -mb-px transition-all ${
            activeTab === 'chats' ? 'border-rose-600 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Salas de Chat
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`py-2.5 px-4 font-semibold border-b-2 -mb-px transition-all ${
            activeTab === 'analytics' ? 'border-rose-600 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Console FCM Push
        </button>
        <button
          onClick={() => setActiveTab('desempenho')}
          className={`py-2.5 px-4 font-semibold border-b-2 -mb-px transition-all ${
            activeTab === 'desempenho' ? 'border-rose-600 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Desempenho (BI Global)
        </button>
        <button
          onClick={() => setActiveTab('mapa')}
          className={`py-2.5 px-4 font-semibold border-b-2 -mb-px transition-all ${
            activeTab === 'mapa' ? 'border-rose-600 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Google Maps Cobertura
        </button>
        <button
          onClick={() => setActiveTab('regioes')}
          className={`py-2.5 px-4 font-semibold border-b-2 -mb-px transition-all ${
            activeTab === 'regioes' ? 'border-rose-600 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Filiais & Regiões do Brasil
        </button>
      </div>

      {/* TAB 1: USER LIST WITH ENFORCEMENT & IMPERSONATION */}
      {activeTab === 'users' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm animate-fade-in">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-700 font-mono">Fichas Cadastrais ({filteredUsers.length})</span>
              <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-mono uppercase font-bold">Bypass Ativo</span>
            </div>
            
            <button
              onClick={() => {
                setShowCreateForm(!showCreateForm);
                if (!newRegion && regions.length > 0) {
                  setNewRegion(regions[0].id);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow transition-all cursor-pointer select-none"
            >
              {showCreateForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {showCreateForm ? 'Fechar Formulário' : 'Criar Novo Usuário'}
            </button>
          </div>

          <AnimatePresence>
            {showCreateForm && (
              <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowCreateForm(false)}
                  className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
                />

                {/* Modal Box */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 15 }}
                  transition={{ type: 'spring', duration: 0.4 }}
                  className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden max-h-[90vh] z-10 font-sans text-xs"
                >
                  {/* Modal Header */}
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="p-1 px-1.5 bg-rose-600 text-white font-mono rounded font-black text-[9px] uppercase tracking-wider text-center">CADASTRO</div>
                      <span className="font-extrabold text-sm text-slate-800">
                        Cadastrar Novo Operador no Sistema
                      </span>
                    </div>
                    <button
                      onClick={() => setShowCreateForm(false)}
                      className="p-1 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Scrollable Content */}
                  <div className="p-6 overflow-y-auto space-y-4 max-h-[70vh]">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1">Nome Completo <span className="text-rose-500">*</span></label>
                        <input 
                          type="text"
                          required
                          placeholder="Ex: Ana Souza"
                          value={newName}
                          onChange={e => setNewName(e.target.value)}
                          className="w-full border border-slate-200 bg-white rounded-xl p-2.5 font-medium text-[11px] text-slate-800 focus:ring-1 focus:ring-rose-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1">Email de Login <span className="text-rose-500">*</span></label>
                        <input 
                          type="email"
                          required
                          placeholder="Ex: ana.souza@routelog.com"
                          value={newEmail}
                          onChange={e => setNewEmail(e.target.value)}
                          className="w-full border border-slate-200 bg-white rounded-xl p-2.5 font-medium text-[11px] text-slate-800 focus:ring-1 focus:ring-rose-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1">Telefone / WhatsApp</label>
                        <input 
                          type="text"
                          placeholder="Ex: +55 (31) 99999-8888"
                          value={newPhone}
                          onChange={e => setNewPhone(e.target.value)}
                          className="w-full border border-slate-200 bg-white rounded-xl p-2.5 font-mono text-[11px] text-slate-800 focus:ring-1 focus:ring-rose-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1">Endereço Residencial</label>
                        <input 
                          type="text"
                          placeholder="Ex: Av. Principal, 100 - Centro"
                          value={newAddress}
                          onChange={e => setNewAddress(e.target.value)}
                          className="w-full border border-slate-200 bg-white rounded-xl p-2.5 font-medium text-[11px] text-slate-800 focus:ring-1 focus:ring-rose-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 border-t border-slate-100 pt-3.5">
                      <div>
                        <label className="block text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1">Função / Papel do Usuário</label>
                        <select 
                          value={newRole}
                          onChange={e => {
                            const val = Number(e.target.value) as UserRole;
                            setNewRole(val);
                          }}
                          className="w-full border border-slate-200 bg-white rounded-xl p-2.5 font-semibold text-xs text-slate-800 focus:ring-1 focus:ring-rose-500 focus:outline-none"
                        >
                          <option value={UserRole.MOTORISTA}>🚚 MOTORISTA</option>
                          <option value={UserRole.GERENTE}>👔 GERENTE DE FILIAL</option>
                          <option value={UserRole.VENDEDOR}>🛍️ VENDEDOR / PROVISÃO</option>
                          <option value={UserRole.ADMIN}>🛡️ ADMINISTRADOR MASTER</option>
                        </select>
                      </div>

                      {newRole !== UserRole.ADMIN && (
                        <div>
                          <label className="block text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1">Região de Atuação</label>
                          <select 
                            value={newRegion}
                            onChange={e => setNewRegion(e.target.value)}
                            className="w-full border border-slate-200 bg-white rounded-xl p-2.5 font-mono text-xs text-slate-800 focus:ring-1 focus:ring-rose-500 focus:outline-none"
                          >
                            {regions.map(r => (
                              <option key={r.id} value={r.id}>
                                {r.id} - {r.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {newRole === UserRole.MOTORISTA && (
                      <div className="space-y-3.5 border-t border-dashed border-slate-200 pt-3.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-mono uppercase font-bold">Ficha Veicular & CNH</span>
                          <span className="text-[9px] text-slate-450">Específico para o perfil de Motorista</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1">Placa do Veículo</label>
                            <input 
                              type="text"
                              placeholder="Ex: ABC-1234"
                              value={newPlate}
                              onChange={e => setNewPlate(e.target.value.toUpperCase())}
                              className="w-full border border-slate-200 bg-white rounded-xl p-2 font-mono text-[11px] uppercase tracking-wider text-slate-800 focus:ring-1 focus:ring-rose-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1">Modelo do Veículo</label>
                            <input 
                              type="text"
                              placeholder="Ex: Sprinter / Saveiro"
                              value={newVehicleModel}
                              onChange={e => setNewVehicleModel(e.target.value)}
                              className="w-full border border-slate-200 bg-white rounded-xl p-2 font-medium text-[11px] text-slate-800 focus:ring-1 focus:ring-rose-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1">Número CNH</label>
                            <input 
                              type="text"
                              placeholder="Ex: 1234567890"
                              value={newCnh}
                              onChange={e => setNewCnh(e.target.value)}
                              className="w-full border border-slate-200 bg-white rounded-xl p-2 font-mono text-[11px] text-slate-800 focus:ring-1 focus:ring-rose-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1">Categoria CNH</label>
                            <input 
                              type="text"
                              placeholder="Ex: D"
                              value={newCnhCategory}
                              onChange={e => setNewCnhCategory(e.target.value.toUpperCase())}
                              className="w-full border border-slate-200 bg-white rounded-xl p-2 font-mono text-[11px] text-slate-800 focus:ring-1 focus:ring-rose-500 focus:outline-none"
                            />
                          </div>
                          <div className="sm:col-span-2 lg:col-span-1">
                            <label className="block text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1">Validade CNH</label>
                            <input 
                              type="date"
                              value={newCnhExpiration}
                              onChange={e => setNewCnhExpiration(e.target.value)}
                              className="w-full border border-slate-200 bg-white rounded-xl p-1.5 text-[11px] text-slate-800 focus:ring-1 focus:ring-rose-500 focus:outline-none font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Modal Footer */}
                  <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-2.5 justify-end">
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="px-4 py-2 border border-slate-250 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition-all cursor-pointer text-xs select-none"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!newName.trim() || !newEmail.trim()) {
                          alert('Nome Completo e Email de Login são obrigatórios!');
                          return;
                        }
                        const newUserProps: any = {
                          name: newName,
                          email: newEmail,
                          phone: newPhone,
                          address: newAddress,
                          role: newRole,
                        };
                        if (newRole !== UserRole.ADMIN) {
                          newUserProps.region = newRegion || (regions[0]?.id || 'GV1');
                        }
                        if (newRole === UserRole.MOTORISTA) {
                          newUserProps.plate = newPlate;
                          newUserProps.vehicleModel = newVehicleModel;
                          newUserProps.cnh = newCnh;
                          newUserProps.cnhCategory = newCnhCategory;
                          newUserProps.cnhExpiration = newCnhExpiration;
                        }
                        
                        onCreateUser?.(newUserProps);
                        
                        // Reset fields
                        setNewName('');
                        setNewEmail('');
                        setNewPhone('');
                        setNewAddress('');
                        setNewRole(UserRole.MOTORISTA);
                        setNewRegion(regions[0]?.id || 'GV1');
                        setNewPlate('');
                        setNewVehicleModel('');
                        setNewCnh('');
                        setNewCnhCategory('B');
                        setNewCnhExpiration('');
                        setShowCreateForm(false);
                        
                        alert(`Usuário "${newName}" cadastrado com sucesso e registrado no sistema!`);
                      }}
                      className="px-4 py-2 bg-rose-600 hover:bg-slate-900 text-white font-extrabold rounded-xl shadow-md transition-colors cursor-pointer text-xs select-none"
                    >
                      Confirmar Cadastro
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <div className="divide-y divide-slate-100">
            <AnimatePresence initial={false}>
              {filteredUsers.map((user, idx) => (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, delay: Math.min(idx * 0.02, 0.4) }}
                  className="p-4 border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                >
                  {editingUserId === user.id ? (
                    <div className="space-y-3.5 bg-slate-50 border border-slate-200 rounded-2xl p-4 font-sans text-xs shadow-inner">
                      <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                        <span className="font-extrabold text-[11px] uppercase tracking-wider text-indigo-800 flex items-center gap-1">
                          <Pencil className="w-3.5 h-3.5 text-indigo-600 animate-bounce" />
                          Modo Edição: {user.name}
                        </span>
                        <span className="text-[9px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-mono uppercase font-bold">
                          PAPEL: {UserRole[user.role]}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[9px] text-slate-450 uppercase font-black tracking-wider mb-1">Nome Completo</label>
                          <input 
                            type="text"
                            value={editedName}
                            onChange={e => setEditedName(e.target.value)}
                            className="w-full border border-slate-200 bg-white rounded-xl p-2 font-medium text-[11.5px] text-slate-850 focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-slate-450 uppercase font-black tracking-wider mb-1">Email Corporativo</label>
                          <input 
                            type="email"
                            value={editedEmail}
                            onChange={e => setEditedEmail(e.target.value)}
                            className="w-full border border-slate-200 bg-white rounded-xl p-2 font-medium text-[11.5px] text-slate-850 focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-slate-450 uppercase font-black tracking-wider mb-1">Telefone / Whats</label>
                          <input 
                            type="text"
                            value={editedPhone}
                            onChange={e => setEditedPhone(e.target.value)}
                            className="w-full border border-slate-200 bg-white rounded-xl p-2 font-mono text-[11.5px] text-slate-850 focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[9px] text-slate-450 uppercase font-black tracking-wider mb-1">Região Operacional</label>
                          <select 
                            value={editedRegion}
                            onChange={e => setEditedRegion(e.target.value)}
                            className="w-full border border-slate-200 bg-white rounded-xl p-2 font-mono text-xs text-slate-800 focus:ring-1 focus:ring-rose-500"
                          >
                            {regions.map(r => (
                              <option key={r.id} value={r.id}>
                                {r.id} - {r.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {user.role === UserRole.MOTORISTA && (
                          <>
                            <div>
                              <label className="block text-[9px] text-slate-450 uppercase font-black tracking-wider mb-1">Placa do Veículo</label>
                              <input 
                                type="text"
                                value={editedPlate}
                                onChange={e => setEditedPlate(e.target.value)}
                                className="w-full border border-slate-200 bg-white rounded-xl p-2 font-mono text-[11.5px] uppercase tracking-wider text-slate-850 focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] text-slate-450 uppercase font-black tracking-wider mb-1">Modelo do Veículo</label>
                              <input 
                                type="text"
                                value={editedVehicleModel}
                                onChange={e => setEditedVehicleModel(e.target.value)}
                                className="w-full border border-slate-200 bg-white rounded-xl p-2 font-medium text-[11.5px] text-slate-850 focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                          </>
                        )}
                      </div>

                      {user.role === UserRole.MOTORISTA && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-slate-200 pt-2.5">
                          <div>
                            <label className="block text-[9px] text-slate-450 uppercase font-black tracking-wider mb-1">Número CNH</label>
                            <input 
                              type="text"
                              value={editedCnh}
                              onChange={e => setEditedCnh(e.target.value)}
                              className="w-full border border-slate-200 bg-white rounded-xl p-2 font-mono text-[11.5px] text-slate-850 focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] text-slate-450 uppercase font-black tracking-wider mb-1">Categoria CNH</label>
                            <input 
                              type="text"
                              value={editedCnhCategory}
                              onChange={e => setEditedCnhCategory(e.target.value)}
                              className="w-full border border-slate-200 bg-white rounded-xl p-2 font-mono text-[11.5px] text-slate-850 focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] text-slate-450 uppercase font-black tracking-wider mb-1">Validade CNH</label>
                            <input 
                              type="date"
                              value={editedCnhExpiration}
                              onChange={e => setEditedCnhExpiration(e.target.value)}
                              className="w-full border border-slate-200 bg-white rounded-xl p-1.5 text-[11.5px] text-slate-850 focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 justify-end pt-2 border-t border-slate-200">
                        <button
                          type="button"
                          onClick={() => {
                            const updatedUser = {
                              ...user,
                              name: editedName,
                              email: editedEmail,
                              phone: editedPhone,
                              region: editedRegion,
                              plate: editedPlate,
                              vehicleModel: editedVehicleModel,
                              cnh: editedCnh,
                              cnhCategory: editedCnhCategory,
                              cnhExpiration: editedCnhExpiration
                            } as any;
                            onUpdateUser(updatedUser);
                            setEditingUserId(null);
                            alert(`Ficha cadastral de ${editedName} atualizada com sucesso!`);
                          }}
                          className="px-4 py-2 bg-indigo-600 hover:bg-slate-900 text-white font-extrabold rounded-xl shadow-md transition-colors cursor-pointer text-xs"
                        >
                          Confirmar Edição
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingUserId(null)}
                          className="px-3.5 py-2 border border-slate-250 text-slate-550 hover:bg-slate-100 rounded-xl font-bold transition-all cursor-pointer text-xs"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1 text-xs text-left">
                        <div className="flex items-center gap-2">
                          <strong className="text-sm font-bold text-slate-800">{user.name}</strong>
                          <span className="text-[10px] bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono font-bold text-slate-600 uppercase">
                            REG: {(user as any).region || 'GLOBAL'}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono capitalize ${
                            user.status === 'active' ? 'bg-green-50 text-green-700 border border-green-100' :
                            user.status === 'suspended' ? 'bg-yellow-50 text-yellow-700 border border-yellow-100' :
                            'bg-rose-50 text-rose-700 border border-rose-100'
                          }`}>
                            {user.status}
                          </span>
                        </div>
                        <p className="text-slate-500 font-mono">{user.email} • {user.phone}</p>
                        
                        {user.role === UserRole.MOTORISTA && (
                          <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-450 bg-slate-50 p-1.5 rounded border border-slate-100 w-fit">
                            <span>Placa: <strong>{(user as any).plate || 'Não cadastrada'}</strong></span>
                            <span>•</span>
                            <span>CNH: <strong>{(user as any).cnh || 'Não cadastrada'} ({(user as any).cnhCategory || 'B'})</strong></span>
                            <span>•</span>
                            <span>Veículo: <strong>{(user as any).vehicleModel || 'Não cadastrado'}</strong></span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-start md:self-auto">
                        {/* Impersonator selector */}
                        {user.role !== UserRole.ADMIN && (
                          <button
                            onClick={() => onImpersonate(user)}
                            className="flex items-center gap-1 px-3 py-1.5 border border-blue-200 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Visualizar Como
                          </button>
                        )}

                        {user.role !== UserRole.ADMIN && (
                          <button
                            onClick={() => {
                              setEditingUserId(user.id);
                              setEditedName(user.name);
                              setEditedEmail(user.email);
                              setEditedPhone(user.phone);
                              setEditedRegion((user as any).region || (regions[0]?.id || 'GV1'));
                              setEditedPlate((user as any).plate || '');
                              setEditedVehicleModel((user as any).vehicleModel || '');
                              setEditedCnh((user as any).cnh || '');
                              setEditedCnhCategory((user as any).cnhCategory || '');
                              setEditedCnhExpiration((user as any).cnhExpiration || '');
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 border border-amber-250 rounded-lg text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5 text-amber-600" />
                            Editar Usuário
                          </button>
                        )}

                        {/* Actions to Moderate */}
                        {user.role !== UserRole.ADMIN && (
                          <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2">
                            {user.status !== 'active' && (
                              <button
                                onClick={() => onModerate(user.id, 'activate')}
                                className="p-1 px-2 text-[10px] font-bold border border-emerald-200 text-emerald-700 bg-emerald-50 rounded hover:bg-emerald-100 cursor-pointer"
                              >
                                Ativar
                              </button>
                            )}

                            {user.status === 'active' && (
                              <>
                                <button
                                  onClick={() => onModerate(user.id, 'suspend')}
                                  title="Suspender Temporariamente para Averiguação Logística"
                                  className="p-1.5 border border-yellow-200 text-yellow-700 bg-yellow-50 rounded hover:bg-yellow-105 cursor-pointer"
                                >
                                  <AlertCircle className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => onModerate(user.id, 'ban')}
                                  title="Banimento Permanente (Adicionar na Blacklist)"
                                  className="p-1.5 border border-rose-200 text-rose-700 bg-rose-50 rounded hover:bg-rose-105 cursor-pointer"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}

                            {/* Excluir Usuário definitely with inline confirmation */}
                            {userToDeleteId === user.id ? (
                              <div className="flex items-center gap-1 bg-red-50 border border-red-200 p-0.5 px-1.5 rounded animate-pulse">
                                <span className="text-[10px] text-red-700 font-bold">Excluir?</span>
                                <button
                                  onClick={() => {
                                    onDeleteUser(user.id);
                                    setUserToDeleteId(null);
                                  }}
                                  className="text-[9px] bg-red-600 hover:bg-red-700 text-white font-bold p-0.5 px-1.5 rounded cursor-pointer leading-tight"
                                >
                                  Sim
                                </button>
                                <button
                                  onClick={() => setUserToDeleteId(null)}
                                  className="text-[9px] bg-slate-200 hover:bg-slate-300 text-slate-700 p-0.5 px-1.5 rounded cursor-pointer leading-tight"
                                >
                                  Não
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setUserToDeleteId(user.id)}
                                title="Excluir Usuário Definitivamente"
                                className="p-1.5 border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 hover:text-red-700 rounded transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* TAB 2: AUDIT LOG VIEWER */}
      {activeTab === 'audits' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Rastreabilidade Forense</span>
            <span className="text-[10px] text-slate-400 font-mono">Imutável</span>
          </div>

          <div className="p-4 space-y-3.5 max-h-[350px] overflow-y-auto">
            {auditLogs.map(log => (
              <div key={log.id} className="p-3 border border-slate-100 rounded-lg text-xs hover:border-indigo-150 transition-all bg-slate-50/50 text-left">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded font-mono font-bold text-[9px] uppercase">
                      {log.action}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Admin: <strong>{log.adminName}</strong></span>
                </div>
                <p className="text-slate-700 font-sans leading-relaxed">{log.details}</p>
                <div className="text-[10px] text-slate-450 mt-1">Alvo: {log.targetUserName || 'N/A'} (ID: {log.targetUserId || 'N/A'})</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: CHAT SLATE LOGGER */}
      {activeTab === 'chats' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm animate-fade-in">
            <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-slate-700 text-xs">
              Histórico de Conversas Gerais
            </div>
            <div className="p-4 space-y-3 max-h-[300px] overflow-y-auto font-mono text-[11px] text-left">
              {chats.map(chat => (
                <div key={chat.id} className="border-b border-slate-100 pb-2">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="font-bold text-slate-700">{chat.senderName}</span>
                    <span>Região: <strong className="text-blue-600">{chat.region}</strong></span>
                  </div>
                  <p className="text-slate-650 mt-1 leading-relaxed">{chat.message}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 text-slate-100 rounded-xl p-5 border border-slate-950 flex flex-col justify-between">
            <div className="space-y-2 text-xs text-left">
              <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Vantagem do Modificador
              </h3>
              <p className="leading-relaxed opacity-90 font-sans">
                Pelo painel de supervisão consolidada, você pode carregar as salas regionais de chat de qualquer vendedor ou motorista sem a necessidade de reinicializar sessões individuais.
              </p>
              <p className="leading-relaxed opacity-90 pt-3 font-sans">
                Ao selecionar <strong className="text-white">&quot;Visualizar Como&quot;</strong>, você acessa o painel de atendimento direto sob a perspectiva exata daquele operador, permitindo diagnóstico imediato de falhas operacionais e suporte remoto centralizado.
              </p>
            </div>
            
            <div className="border-t border-slate-800 pt-3 mt-4 text-[10px] text-blue-400 font-mono text-left">
              SECURITY LAYER ACTIVE (SSL)
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CONSOLE FCM CUSTOM PUSH */}
      {activeTab === 'analytics' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm max-w-xl text-left">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-4">
            <Globe className="w-4 h-4 text-rose-600" />
            Despachar Push Notification Customizada (FCM Broker API)
          </div>

          <form onSubmit={handleSendPush} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-slate-500 mb-1">Título do Alerta (Popup)</label>
              <input
                type="text"
                value={pushTitle}
                onChange={e => setPushTitle(e.target.value)}
                placeholder="Exco: Urgência Logística!"
                className="w-full border border-slate-200 p-2 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Mensagem (Corpo da notificação)</label>
              <textarea
                value={pushBody}
                onChange={e => setPushBody(e.target.value)}
                rows={3}
                placeholder="Escreva as diretrizes para os motoristas no trânsito comercial..."
                className="w-full border border-slate-200 p-2 rounded-lg"
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-500 mb-1">Público-Alvo (Perfil)</label>
                <select
                  value={pushRoleTarget}
                  onChange={e => {
                    const val = e.target.value;
                    setPushRoleTarget(val === 'all' ? 'all' : Number(val) as UserRole);
                  }}
                  className="w-full border border-slate-200 p-2 rounded-lg bg-white"
                >
                  <option value="all">Todos os Perfis (FCM All Broadcast)</option>
                  <option value={UserRole.MOTORISTA}>Apenas Motoristas (Condutores)</option>
                  <option value={UserRole.GERENTE}>Apenas Gerentes de Logística</option>
                  <option value={UserRole.VENDEDOR}>Apenas Vendedores (Comercial)</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Direcionar para Região</label>
                <select
                  value={pushRegionTarget}
                  onChange={e => setPushRegionTarget(e.target.value)}
                  className="w-full border border-slate-200 p-2 rounded-lg bg-white"
                >
                  <option value="all">Todas as Regiões (Global)</option>
                  {regions.map(r => (
                    <option key={r.id} value={r.id}>Apenas Operadores de {r.id} ({r.name})</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors font-bold cursor-pointer"
            >
              Executar Push Firebase
            </button>
          </form>
        </div>
      )}

      {/* TAB 5: GLOBAL OPERATIONS PERFORMANCE BI */}
      {activeTab === 'desempenho' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5 font-sans text-xs">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
            <div className="text-left">
              <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-rose-600 shrink-0 animate-pulse" />
                BI de Logística Global e Controle Operacional
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Auditoria unificada de tempos de permanência, checklists concluídos, quilometragem e desvios de rota planejada.</p>
            </div>

            {/* Region specific drilldown */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-500 text-[11px] shrink-0 font-mono">Filtro Geológico:</span>
              <select
                value={pushRegion}
                onChange={e => setPushRegion(e.target.value)}
                className="border border-slate-250 p-1.5 rounded-lg bg-slate-50 text-[11px] font-medium"
              >
                <option value="all">Todas as Regiões Combinadas</option>
                {regions.map(r => (
                  <option key={r.id} value={r.id}>Apenas {r.id} ({r.name})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Metrics computation helper */}
          {(() => {
            const filteredPerformance = pushRegion === 'all' 
              ? performanceLogs 
              : performanceLogs.filter(p => p.region === pushRegion);

            const totalKm = filteredPerformance.reduce((sum, p) => sum + p.actualDistanceKm, 0);
            const totalDeviations = filteredPerformance.reduce((sum, p) => sum + p.routeDeviations, 0);
            const completedCount = filteredPerformance.filter(p => p.status === 'completed').length;
            const activeCount = filteredPerformance.filter(p => p.status === 'active').length;

            const totalStopsMeasured = filteredPerformance.reduce((acc, p) => acc + p.stopTelemetry.length, 0);
            const totalMinutesMeasured = filteredPerformance.reduce((acc, p) => {
              return acc + p.stopTelemetry.reduce((stopAcc, s) => stopAcc + s.timeSpentMinutes, 0);
            }, 0);
            const avgStopMins = totalStopsMeasured > 0 ? Math.round(totalMinutesMeasured / totalStopsMeasured) : 17;

            // Chart translation
            const distanceData = filteredPerformance.map(p => ({
              name: p.routeName.replace('Rota ', 'R_') + ` (${p.region})`,
              'Minutos em Trânsito': p.averageTimePerStopMinutes ? p.averageTimePerStopMinutes * p.plannedStopsCount : 45,
              'Desvios': p.routeDeviations,
              'Previsto (km)': p.plannedDistanceKm,
              'Realizado (km)': p.actualDistanceKm,
            }));

            return (
              <>
                {/* Metric boards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase font-mono">QUILOMETRAGEM TOTAL</span>
                    <strong className="text-xl font-bold text-slate-800">{Math.round(totalKm * 10) / 10} km</strong>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase font-mono">DESVIOS DETECTADOS</span>
                    <strong className="text-xl font-bold text-red-655 text-red-600 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse shrink-0" />
                      {totalDeviations}
                    </strong>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase font-mono">PERMANÊNCIA MÉDIA / PARADA</span>
                    <strong className="text-xl font-bold text-indigo-700">{avgStopMins} minutos</strong>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase font-mono">ROTAS COMPUTADAS</span>
                    <strong className="text-xl font-bold text-slate-800">
                      {completedCount} concluídas / {activeCount} ativas
                    </strong>
                  </div>
                </div>

                {filteredPerformance.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Chart distance */}
                      <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                        <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider mb-2 font-mono text-left">
                          Distâncias Percorridas por Rota (Reais vs Planejadas)
                        </span>
                        <div className="h-48 text-[10px] font-mono">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={distanceData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis dataKey="name" stroke="#64748b" />
                              <YAxis stroke="#64748b" unit="km" />
                              <Tooltip />
                              <Legend wrapperStyle={{ fontSize: 9 }} />
                              <Bar dataKey="Previsto (km)" fill="#60a5fa" radius={[3, 3, 0, 0]} />
                              <Bar dataKey="Realizado (km)" fill="#34d399" radius={[3, 3, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Chart deviations */}
                      <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                        <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider mb-2 font-mono text-left">
                          Desvios Críticos e Tempos Operacionais
                        </span>
                        <div className="h-48 text-[10px] font-mono">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={distanceData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis dataKey="name" stroke="#64748b" />
                              <YAxis stroke="#64748b" />
                              <Tooltip />
                              <Legend wrapperStyle={{ fontSize: 9 }} />
                              <Area type="monotone" dataKey="Minutos em Trânsito" stroke="#818cf8" fill="#e0e7ff" />
                              <Area type="monotone" dataKey="Desvios" stroke="#f87171" fill="#fee2e2" />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>

                    {/* Operational Telemetry Tables */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                      <div className="bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2.5 border-b border-slate-200 shrink-0">
                        <div className="flex items-center gap-1.5 justify-start">
                          <span className="font-bold text-slate-700">Painel Global de Telemetria Auditada</span>
                          <span className="font-mono text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-tight">IMUTÁVEL NO BANCO</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => exportToCSV(filteredPerformance, `desempenho_rotas_admin_${pushRegion}.csv`)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[10px] font-bold rounded-lg transition-all shadow-sm cursor-pointer"
                          >
                            <Download className="w-3 h-3 text-slate-500" />
                            Exportar CSV
                          </button>
                          <button
                            type="button"
                            onClick={() => exportToPDF(filteredPerformance, `Relatório Geral de Desempenho - Região: ${pushRegion.toUpperCase()}`)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[10px] font-bold rounded-lg transition-all shadow-sm cursor-pointer"
                          >
                            <Printer className="w-3 h-3 text-slate-500" />
                            Relatório PDF
                          </button>
                        </div>
                      </div>

                      <div className="overflow-x-auto max-h-[220px] overflow-y-auto">
                        <table className="w-full text-left font-sans text-[11px] text-slate-600">
                          <thead className="bg-slate-100 text-slate-600 font-semibold sticky top-0 uppercase text-[9px] tracking-wider border-b border-slate-200 font-mono">
                            <tr>
                              <th className="p-2">Região</th>
                              <th className="p-2">Início da Viagem</th>
                              <th className="p-2">Motorista / Placa</th>
                              <th className="p-2 text-center">Fim / Conclusão</th>
                              <th className="p-2 text-right">Desvios</th>
                              <th className="p-2 text-right font-mono">Paradas</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-150">
                            {filteredPerformance.map(log => {
                              const startTime = new Date(log.startTimestamp).toLocaleTimeString('pt-BR');
                              const endTime = log.endTimestamp ? new Date(log.endTimestamp).toLocaleTimeString('pt-BR') : 'Em Trânsito 🚚';
                              return (
                                <React.Fragment key={log.id}>
                                  <tr className="hover:bg-slate-50 transition-colors font-medium">
                                    <td className="p-2 font-mono text-indigo-700 font-bold uppercase">{log.region}</td>
                                    <td className="p-2 font-mono text-slate-500">{startTime}</td>
                                    <td className="p-2 text-slate-800 font-sans">{log.driverName} <span className="font-mono text-[10px] text-slate-400">[{log.driverPlate}]</span></td>
                                    <td className="p-2 text-center font-mono text-slate-500">{endTime}</td>
                                    <td className={`p-2 text-right font-bold font-mono ${log.routeDeviations > 0 ? 'text-red-600 animate-pulse' : 'text-slate-400'}`}>{log.routeDeviations} desvios</td>
                                    <td className="p-2 text-right font-bold font-mono text-emerald-600">{log.completedStopsCount} / {log.plannedStopsCount}</td>
                                  </tr>
                                  {log.stopTelemetry && log.stopTelemetry.length > 0 && (
                                    <tr>
                                      <td colSpan={6} className="bg-slate-50 p-2 border-b border-slate-200">
                                        <div className="text-[10px] text-slate-500 space-y-1 text-left">
                                          <p className="font-bold text-slate-600 uppercase tracking-widest text-[9px]">Registros GPS por Parada:</p>
                                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                            {log.stopTelemetry.map((t, idx) => (
                                              <div key={t.stopId} className="bg-white rounded p-1.5 border border-slate-200 leading-normal font-mono text-[9px] shadow-sm flex items-center justify-between gap-1">
                                                <div>
                                                  <span className="text-indigo-600 font-bold">#{idx + 1} {t.clientName}</span>
                                                  <span className="block text-slate-400 text-[9px]">Check-In: {new Date(t.arrivalTimestamp).toLocaleTimeString()}</span>
                                                </div>
                                                <div className="text-right shrink-0">
                                                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[8px] font-bold px-1 rounded block">
                                                    Permanência: {t.timeSpentMinutes} min
                                                  </span>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-20 border border-dashed border-slate-150 rounded-2xl select-none">
                    <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2 animate-bounce" />
                    <strong className="text-xs text-slate-600 block font-bold">Aguardando Coleta Satélite</strong>
                    <p className="text-[11px] text-slate-400 max-w-sm mt-1 mx-auto leading-relaxed">
                      Não há medições telemétricas correspondentes à região filtrada. Motoristas precisam iniciar suas viagens para que a inteligência de tráfego colete os benchmarks.
                    </p>
                  </div>
                )}
              </>
            );
          })()}

        </div>
      )}

      {activeTab === 'mapa' && (
        <div className="space-y-4">
          <RouteMap 
            rotas={rotas}
            locations={locations}
            currentUserRegion="all"
            currentUserRole={0} // Admin role matches UserRole.ADMIN
            breadcrumbs={breadcrumbs}
            regions={regions}
          />
        </div>
      )}

      {activeTab === 'regioes' && (
        <div className="space-y-6">
          {/* PAINEL DE METRICAS SUPERIOR: Densidade de Frota por Região */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center gap-4 text-left">
              <div className="p-3 bg-rose-50 rounded-xl text-rose-600">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total de Regiões</span>
                <span className="text-2xl font-black text-slate-900">{regions.length}</span>
                <span className="text-[10px] text-slate-500 block">Setores operacionais ativos</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center gap-4 text-left">
              <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Motoristas Alocados</span>
                <span className="text-2xl font-black text-slate-900">
                  {users.filter(u => u.role === UserRole.MOTORISTA).length}
                </span>
                <span className="text-[10px] text-slate-500 block">Total na base integrada</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center gap-4 text-left">
              <div className="p-3 bg-cyan-50 rounded-xl text-cyan-600">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Motoristas Ativos</span>
                <span className="text-2xl font-black text-slate-900">
                  {users.filter(u => u.role === UserRole.MOTORISTA && u.status === 'active').length}
                </span>
                <span className="text-[10px] text-emerald-600 font-semibold block flex items-center gap-0.5">
                  ● {users.filter(u => u.role === UserRole.MOTORISTA && u.status === 'active').length} prontos para rota
                </span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center gap-4 text-left">
              <div className="p-3 bg-slate-50 rounded-xl text-slate-600">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Média de Frota</span>
                <span className="text-md font-bold text-slate-800">
                  {(users.filter(u => u.role === UserRole.MOTORISTA).length / Math.max(1, regions.length)).toFixed(1)} / reg
                </span>
                <span className="text-[10px] text-slate-500 block">Motoristas por região filial</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Form de Cadastro / Edição (Lado Esquerdo - 4 colunas) */}
            <div className="lg:col-span-4 bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs text-left animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-800 text-xs uppercase tracking-wider block">
                  {editingRegId ? '✏️ Editar Territorialidade' : '➕ Nova Territorialidade'}
                </span>
                {editingRegId && (
                  <span className="text-[10px] font-mono bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                    ID: {regId}
                  </span>
                )}
              </div>

              {/* SISTEMA DE ALERTAS COM VALIDAÇÃO VISUAL */}
              {regError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-start gap-2 animate-pulse">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold block">Erro de Validação:</strong>
                    <span>{regError}</span>
                  </div>
                </div>
              )}

              {regSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold block font-sans">Sucesso!</strong>
                    <span>{regSuccess}</span>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">CÓDIGO ID DA REGIÃO</label>
                  <input
                    type="text"
                    disabled={!!editingRegId}
                    value={regId}
                    onChange={e => {
                      setRegError(null);
                      setRegId(e.target.value.toUpperCase().replace(/[^A-Z0-9_\/]/g, ''));
                    }}
                    placeholder="Ex: SP, RJ-1, CERRADO, GV4"
                    className="w-full text-xs font-mono border border-slate-200 p-2.5 rounded-lg bg-white focus:outline-none focus:border-rose-500 disabled:bg-slate-100 disabled:text-slate-400 focus:ring-1 focus:ring-rose-500 font-bold"
                  />
                  <p className="text-[9px] text-slate-400 mt-0.5">Apenas letras maiúsculas, números e / sem espaços.</p>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">NOME DA REGIÃO / DESCRIÇÃO COMPLETA</label>
                  <input
                    type="text"
                    value={regName}
                    onChange={e => {
                      setRegError(null);
                      setRegName(e.target.value);
                    }}
                    placeholder="Ex: Grande Vitória (Cariacica)"
                    className="w-full text-xs border border-slate-200 p-2.5 rounded-lg bg-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">ESTADO / TERRITÓRIO BRASILEIRO</label>
                  <select
                    value={regState}
                    onChange={e => setRegState(e.target.value)}
                    className="w-full text-xs border border-slate-200 p-2.5 rounded-lg bg-white focus:outline-none focus:border-rose-500 cursor-pointer focus:ring-1 focus:ring-rose-500"
                  >
                    <option value="Espírito Santo">Espírito Santo (ES)</option>
                    <option value="Minas Gerais">Minas Gerais (MG)</option>
                    <option value="Rio de Janeiro">Rio de Janeiro (RJ)</option>
                    <option value="São Paulo">São Paulo (SP)</option>
                    <option value="Bahia">Bahia (BA)</option>
                    <option value="Paraná">Paraná (PR)</option>
                    <option value="Santa Catarina">Santa Catarina (SC)</option>
                    <option value="Rio Grande do Sul">Rio Grande do Sul (RS)</option>
                    <option value="Goiás">Goiás (GO)</option>
                    <option value="Distrito Federal">Distrito Federal (DF)</option>
                    <option value="Outro">Outro Estado Brasileiro</option>
                  </select>
                </div>

                {/* GEOFENCING CONFIGURATION (GPS COORDINATES AND RANGE BOUNDARY) */}
                <div className="bg-slate-50 border border-slate-150 p-3 rounded-lg space-y-2 mt-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block font-mono">Geofence GPS da Base Operacional</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500">LATITUDE 📍</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={regLat}
                        onChange={e => setRegLat(parseFloat(e.target.value) || 0)}
                        placeholder="Ex: -19.93"
                        className="w-full text-xs font-mono border border-slate-200 p-2 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500">LONGITUDE 📍</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={regLng}
                        onChange={e => setRegLng(parseFloat(e.target.value) || 0)}
                        placeholder="Ex: -43.94"
                        className="w-full text-xs font-mono border border-slate-200 p-2 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500">RAIO DO GEOFENCE (METROS) 🎯</label>
                    <input
                      type="number"
                      value={regRadius}
                      onChange={e => setRegRadius(parseInt(e.target.value) || 0)}
                      placeholder="Ex: 1500"
                      className="w-full text-xs font-mono border border-slate-200 p-2 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                    />
                    <p className="text-[8px] text-slate-400 mt-0.5">Disparar notificação quando o condutor cruzar esta distância.</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={async () => {
                    const cleanedId = regId.trim();
                    const cleanedName = regName.trim();

                    // TRATAMENTOS DE VALIDAÇÃO
                    if (!cleanedId) {
                      setRegError('Por favor, informe o Código ID da região.');
                      return;
                    }
                    if (!cleanedName) {
                      setRegError('Por favor, defina um Nome de cobertura descritivo.');
                      return;
                    }
                    if (cleanedId.length < 2) {
                      setRegError('O Código ID da região deve conter ao menos 2 caracteres.');
                      return;
                    }
                    if (cleanedName.length < 4) {
                      setRegError('O Nome da Região deve ser descritivo (mínimo de 4 caracteres).');
                      return;
                    }

                    // Impedir criação duplicada de ID
                    if (!editingRegId && regions.some(r => r.id.toLowerCase() === cleanedId.toLowerCase())) {
                      setRegError(`Código ID "${cleanedId}" já se encontra cadastrado em outra região existente.`);
                      return;
                    }

                    setRegError(null);
                    const payload: Region = {
                      id: cleanedId,
                      name: cleanedName,
                      description: `${cleanedName} - ${regState}`,
                      lat: regLat,
                      lng: regLng,
                      radius: regRadius
                    };

                    try {
                      await onSaveRegion(payload);
                      setRegSuccess(`Sucesso! Região "${cleanedId}" salva com sucesso.`);
                      setTimeout(() => setRegSuccess(null), 4000);
                      
                      // Clear form
                      setRegId('');
                      setRegName('');
                      setEditingRegId(null);
                      setRegLat(-18.85);
                      setRegLng(-41.94);
                      setRegRadius(1500);
                    } catch (err: any) {
                      setRegError(`Ocorreu um erro ao salvar: ${err.message || err}`);
                    }
                  }}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-xs transition-all focus:outline-none flex items-center justify-center gap-1.5 cursor-pointer text-center"
                >
                  <Check className="w-4 h-4 text-white" />
                  {editingRegId ? 'Atualizar Região' : 'Criar Região'}
                </button>

                {editingRegId && (
                  <button
                    onClick={() => {
                      setRegId('');
                      setRegName('');
                      setEditingRegId(null);
                      setRegError(null);
                    }}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs py-2.5 px-3 rounded-xl transition-all focus:outline-none cursor-pointer"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>

            {/* Visualizador de Regiões / Tabela de Regiões (Lado Direito - 8 colunas) */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* VISUALIZADOR GEOGRÁFICO DE REGIOES (INTERATIVO) */}
              <div className="bg-slate-900 border border-slate-950 rounded-xl p-5 shadow-xs text-white relative overflow-hidden">
                <div className="absolute top-4 left-4 z-10 text-left">
                  <span className="bg-slate-800 text-rose-400 border border-slate-700 text-[10px] font-bold px-2 py-1 rounded">
                    SISTEMA DE CORRESPONDÊNCIA TERRESTRE
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-1">Clique em qualquer círculo ou ponto luminoso para abrir o modo de edição rápida.</span>
                </div>

                <div className="absolute top-4 right-4 z-10 flex gap-2 text-[10px] text-slate-400 font-medium whitespace-nowrap overflow-x-auto">
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-500 inline-block"></span> Sem Carros
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-405 bg-cyan-400 inline-block"></span> Baixo Fluxo
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span> Alta Densidade
                  </div>
                </div>

                {/* SVG Visual Map Workspace */}
                <div className="h-[210px] w-full mt-6 bg-slate-950/45 rounded-lg relative border border-slate-800 flex items-center justify-center">
                  
                  {/* Radar Sonar Echoes */}
                  <svg className="w-full h-full absolute inset-0" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <radialGradient id="mapGlow" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity="0.08" />
                        <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
                      </radialGradient>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#mapGlow)" />
                    
                    {/* Concentric Sonar Circles */}
                    <circle cx="50%" cy="50%" r="40" stroke="rgba(244, 63, 94, 0.05)" strokeWidth="1" fill="none" />
                    <circle cx="50%" cy="50%" r="80" stroke="rgba(244, 63, 94, 0.05)" strokeWidth="1" fill="none" />
                    <circle cx="50%" cy="50%" r="120" stroke="rgba(244, 63, 94, 0.03)" strokeWidth="1" fill="none" />
                    
                    {/* Simulated Coordinates Grid */}
                    <line x1="50%" y1="0" x2="50%" y2="100%" stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="3,3" />
                    <line x1="0" y1="50%" x2="100%" y2="50%" stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="3,3" />

                    {/* Regional Geography Labels based on Southeastern Brasil */}
                    <text x="20%" y="25%" fill="rgba(255, 255, 255, 0.2)" fontSize="10" fontWeight="bold" fontFamily="monospace">MINAS GERAIS</text>
                    <text x="75%" y="45%" fill="rgba(255, 255, 255, 0.25)" fontSize="10" fontWeight="bold" fontFamily="monospace">ESPÍRITO SANTO</text>
                    <text x="25%" y="85%" fill="rgba(255, 255, 255, 0.15)" fontSize="10" fontWeight="bold" fontFamily="monospace">SÃO PAULO</text>
                    <text x="45%" y="90%" fill="rgba(255, 255, 255, 0.15)" fontSize="10" fontWeight="bold" fontFamily="monospace">RIO DE JANEIRO</text>

                    {/* Glowing Connections Lines */}
                    {regions.length > 1 && regions.map((rg, idx) => {
                      if (idx === 0) return null;
                      const prevRg = regions[idx - 1];
                      // Helpers to map coordinates
                      const getCoordinates = (r: Region) => {
                        const lookups: { [k: string]: { x: number; y: number } } = {
                          'GV1': { x: 580, y: 100 },
                          'GV2': { x: 620, y: 110 },
                          'GV3': { x: 670, y: 95 },
                          'ES/MG': { x: 280, y: 80 },
                          '262': { x: 440, y: 130 },
                          'Norte': { x: 630, y: 40 },
                          'Sul': { x: 340, y: 160 }
                        };
                        if (lookups[r.id]) return lookups[r.id];
                        // deterministic positioning mock
                        const hash = r.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
                        return { x: 150 + (hash % 450), y: 50 + ((hash >> 2) % 130) };
                      };

                      const ptA = getCoordinates(prevRg);
                      const ptB = getCoordinates(rg);

                      return (
                        <line 
                           key={`line_${prevRg.id}_${rg.id}`}
                           x1={`${(ptA.x / 8).toFixed(1)}%`} 
                           y1={`${(ptA.y * 100 / 210).toFixed(1)}%`} 
                           x2={`${(ptB.x / 8).toFixed(1)}%`} 
                           y2={`${(ptB.y * 100 / 210).toFixed(1)}%`} 
                           stroke="rgba(244, 63, 94, 0.08)"
                           strokeWidth="1.5"
                        />
                      );
                    })}

                    {/* Plots Region Circles */}
                    {regions.map((r) => {
                      // Lookup position helper
                      const getCoordinates = (target: Region) => {
                        const lookups: { [k: string]: { x: number; y: number } } = {
                          'GV1': { x: 580, y: 100 },
                          'GV2': { x: 620, y: 110 },
                          'GV3': { x: 660, y: 95 },
                          'ES/MG': { x: 280, y: 80 },
                          '262': { x: 440, y: 130 },
                          'Norte': { x: 630, y: 40 },
                          'Sul': { x: 340, y: 160 }
                        };
                        if (lookups[target.id]) return lookups[target.id];
                        // Map coordinates based on text descriptions to be precise
                        const d = (target.description || '').toLowerCase();
                        let rx = 500;
                        let ry = 110;
                        if (d.includes('minas')) { rx = 220; ry = 70; }
                        else if (d.includes('são paulo')) { rx = 150; ry = 180; }
                        else if (d.includes('rio de janeiro')) { rx = 310; ry = 190; }
                        else if (d.includes('bahia')) { rx = 720; ry = 50; }
                        else {
                          const h = target.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
                          rx = 200 + (h % 400);
                          ry = 50 + ((h >> 2) % 120);
                        }
                        return { x: rx, y: ry };
                      };

                      const coords = getCoordinates(r);
                      const percentX = coords.x / 8; // Width fits nice in 800 layout scale
                      const percentY = coords.y * 100 / 210;

                      // Derive fleet drivers info
                      const regDrivers = users.filter(u => u.role === UserRole.MOTORISTA && (u as any).region === r.id);
                      const activeDriversCount = regDrivers.filter(u => u.status === 'active').length;

                      // Glow color depending on drivers activity status
                      let glowColor = 'rgba(148, 163, 184, 0.4)'; // Grey slate empty
                      let pulseGlow = 'rgba(148, 163, 184, 0.2)';
                      let mainHex = '#64748b';
                      if (activeDriversCount > 0) {
                        if (activeDriversCount >= 3) {
                          glowColor = 'rgba(16, 185, 129, 0.7)'; // Emerald high flow
                          pulseGlow = 'rgba(16, 185, 129, 0.3)';
                          mainHex = '#10b981';
                        } else {
                          glowColor = 'rgba(34, 211, 238, 0.7)'; // Cyan low flow
                          pulseGlow = 'rgba(34, 211, 238, 0.3)';
                          mainHex = '#22d3ee';
                        }
                      }

                      return (
                        <g 
                          key={`svg_node_${r.id}`}
                          className="cursor-pointer group select-none transition-transform hover:scale-110"
                          onClick={() => {
                            setRegId(r.id);
                            setRegName(r.name);
                            setEditingRegId(r.id);
                            setRegError(null);
                            setRegLat(r.lat !== undefined ? r.lat : -18.85);
                            setRegLng(r.lng !== undefined ? r.lng : -41.94);
                            setRegRadius(r.radius !== undefined ? r.radius : 1500);
                            // Detect state
                            if (r.description?.includes('Minas Gerais')) setRegState('Minas Gerais');
                            else if (r.description?.includes('Rio de Janeiro')) setRegState('Rio de Janeiro');
                            else if (r.description?.includes('São Paulo')) setRegState('São Paulo');
                            else if (r.description?.includes('Bahia')) setRegState('Bahia');
                            else if (r.description?.includes('Paraná')) setRegState('Paraná');
                            else setRegState('Espírito Santo');
                          }}
                        >
                          {/* Pulsing Signal Wave */}
                          {activeDriversCount > 0 && (
                            <circle 
                              cx={`${percentX}%`} 
                              cy={`${percentY}%`} 
                              r="15" 
                              fill="none" 
                              stroke={pulseGlow} 
                              strokeWidth="3"
                              className="animate-ping"
                              style={{ transformOrigin: `${percentX}% ${percentY}%` }}
                            />
                          )}

                          {/* Glow drop-shadow circle overlay */}
                          <circle 
                            cx={`${percentX}%`} 
                            cy={`${percentY}%`} 
                            r="8" 
                            fill={glowColor}
                            className="group-hover:r-[10px] transition-all duration-300"
                          />

                          {/* Solid Core Pointer */}
                          <circle 
                            cx={`${percentX}%`} 
                            cy={`${percentY}%`} 
                            r="4.5" 
                            fill="#FFFFFF" 
                            stroke={mainHex}
                            strokeWidth="1.5"
                          />

                          {/* Text Code Label tag */}
                          <text 
                            x={`${percentX}%`} 
                            y={`${percentY - 11}%`} 
                            textAnchor="middle" 
                            fill={mainHex}
                            fontSize="9" 
                            fontWeight="bold"
                            className="bg-slate-900 px-1 py-0.5 rounded font-mono font-bold"
                          >
                            {r.id} ({activeDriversCount}🏎️)
                          </text>

                          {/* Invisible tooltip zone */}
                          <title>
                            Região: {r.name}&#10;
                            Território: {r.description || 'Nenhum definido'}&#10;
                            Total de Condutores: {regDrivers.length}&#10;
                            Motoristas Ativos Reducionais: {activeDriversCount}
                          </title>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>

              {/* Tabela de Regiões de Atuação */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="bg-slate-50 p-3.5 border-b border-slate-200 text-xs font-bold text-slate-700 flex justify-between items-center text-left">
                  <span>Malha de Cobertura de Filiais Ativas ({regions.length})</span>
                  <span className="text-[10px] text-slate-400 font-mono">Clique em editar para atualizar instantaneamente</span>
                </div>
                
                <div className="divide-y divide-slate-150 max-h-[280px] overflow-y-auto bg-white">
                  {regions.map((r) => {
                    const regDrivers = users.filter(u => u.role === UserRole.MOTORISTA && (u as any).region === r.id);
                    const activeDrivers = regDrivers.filter(u => u.status === 'active');
                    const isSelected = editingRegId === r.id;

                    return (
                      <div 
                        key={r.id} 
                        className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-all ${isSelected ? 'bg-amber-50/40 border-l-4 border-l-amber-500' : ''}`}
                      >
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] font-black bg-slate-900 border border-slate-950 text-white px-2 py-0.5 rounded">
                              {r.id}
                            </span>
                            <span className="font-bold text-slate-800 text-xs">
                              {r.name}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1">
                            {r.description || 'Sem descrição territorial adicional'}
                          </p>
                        </div>

                        <div className="flex items-center gap-4.5">
                          {/* Mini Indicador de Densidade de Frota */}
                          <div className="text-right shrink-0">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">Frota Operacional</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-xs font-black text-slate-750">{activeDrivers.length} / {regDrivers.length}</span>
                              <div className="w-14 bg-slate-100 h-1.5 rounded-full overflow-hidden block">
                                <div 
                                  className="h-full bg-rose-600 rounded-full" 
                                  style={{ width: `${Math.min(100, regDrivers.length > 0 ? (activeDrivers.length / regDrivers.length) * 100 : 0)}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setRegId(r.id);
                                setRegName(r.name);
                                setEditingRegId(r.id);
                                setRegError(null);
                                // Detect state from description
                                if (r.description?.includes('Minas Gerais')) setRegState('Minas Gerais');
                                else if (r.description?.includes('Rio de Janeiro')) setRegState('Rio de Janeiro');
                                else if (r.description?.includes('São Paulo')) setRegState('São Paulo');
                                else if (r.description?.includes('Bahia')) setRegState('Bahia');
                                else if (r.description?.includes('Paraná')) setRegState('Paraná');
                                else setRegState('Espírito Santo');
                              }}
                              className="p-1.5 px-2.5 text-[11px] font-bold text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-lg transition-all flex items-center gap-1 cursor-pointer bg-white shadow-xs"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Editar
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm(`Deseja mesmo excluir a região "${r.id} - ${r.name}"? Motoristas associados a ela ficarão desprovidos de base.`)) {
                                  await onDeleteRegion(r.id);
                                  setRegSuccess(`Sucesso: Região "${r.id}" removida.`);
                                  setTimeout(() => setRegSuccess(null), 3000);
                                  // Clear editing if deleted
                                  if (editingRegId === r.id) {
                                    setRegId('');
                                    setRegName('');
                                    setEditingRegId(null);
                                  }
                                }
                              }}
                              className="p-1.5 px-2 text-[11px] font-bold text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-150 hover:border-transparent rounded-lg transition-all cursor-pointer bg-white"
                              title="Excluir região"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* HISTÓRICO RIGOROSO DE ALTERAÇÕES DE REGIÕES (RASTRO DE AUDITORIA FORENSE) */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-rose-600" />
                    Histórico de Alterações de Regiões (Auditoria Geral)
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Imutável</span>
                </div>

                <div className="p-4 max-h-[220px] overflow-y-auto space-y-3">
                  {auditLogs.filter(log => 
                    log.action?.includes('Região') || 
                    log.targetUserId?.startsWith('region_') || 
                    log.details?.toLowerCase().includes('região')
                  ).length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4 font-mono">Nenhuma alteração registrada em auditoria nesta sessão.</p>
                  ) : (
                    auditLogs.filter(log => 
                      log.action?.includes('Região') || 
                      log.targetUserId?.startsWith('region_') || 
                      log.details?.toLowerCase().includes('região')
                    ).map(log => {
                      // Decorate based on action
                      let badgeStyle = 'bg-rose-50 text-rose-700 border-rose-200';
                      if (log.action?.includes('Alterada')) {
                        badgeStyle = 'bg-amber-50 text-amber-700 border-amber-200';
                      } else if (log.action?.includes('Criada')) {
                        badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                      }

                      return (
                        <div key={log.id} className="p-3 border border-slate-100 rounded-lg text-xs hover:border-rose-100 transition-all bg-slate-50/50 text-left">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className={`px-2 py-0.5 border text-[9px] font-bold uppercase rounded ${badgeStyle}`}>
                                {log.action}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {new Date(log.timestamp).toLocaleTimeString('pt-BR')} do dia {new Date(log.timestamp).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400">Admin: <strong>{log.adminName}</strong></span>
                          </div>
                          <p className="text-slate-700 font-medium font-sans leading-relaxed">{log.details}</p>
                          <div className="text-[10px] text-slate-450 mt-1 block font-mono">
                            Código Alvo: <span className="text-slate-800 font-semibold">{log.targetUserId.replace('region_', '')}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Welcome Tutorial Overlay */}
      <WelcomeTutorial 
        role={UserRole.ADMIN} 
        forceOpen={showTutorial} 
        onClose={() => setShowTutorial(false)} 
      />

    </div>
  );
}
