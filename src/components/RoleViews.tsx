/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { UserRole, RouteUser, Rota, Parada, GPSLocation, ChatMessage, NotificationLog, AuditLogEntry, RoutePerformanceLog, PushDeliveryLog, PushConfig, MotoristaUser, Region, Cliente } from '../types';
import { 
  Users, TrendingUp, AlertTriangle, Globe, MapPin, Eye, ShieldCheck, 
  Trash2, AlertCircle, Share2, Navigation, CheckCircle, Send, MessageSquare, 
  UserCheck, ShieldAlert, Ban, Info, Sparkles, Plus, Map, Play, Check, Phone, ArrowRight, Edit, Pencil,
  Route, Compass, Bell, Settings, Layers, Calendar, BarChart3, Clock, AlertOctagon, HelpCircle, Truck, Signal,
  Download, Printer, Mic, Square, Pause, Volume2, SlidersHorizontal, Camera, RefreshCw, X, FileSpreadsheet, Search
} from 'lucide-react';
import InteractiveMap from './InteractiveMap';
import RegionalMap from './RegionalMap';
import RouteMap from './RouteMap';
import ClientImporter from './ClientImporter';
import ClienteManager from './ClienteManager';
import WelcomeTutorial from './WelcomeTutorial';
import { ResponsiveContainer, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { saveCloudGPSLocation, SUPABASE_SQL_DDL } from '../supabase';

// Re-export modular AdminDashboard
export { AdminDashboard } from './AdminDashboard';
export type { AdminProps } from './AdminDashboard';

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
          padding: 10px;
        }
        .stat-card span {
          display: block;
          font-size: 9px;
          color: #64748b;
          text-transform: uppercase;
          font-weight: bold;
          font-family: monospace;
          margin-bottom: 4px;
        }
        .stat-card strong {
          font-size: 15px;
          color: #0f172a;
          font-weight: 700;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 25px;
        }
        th {
          background: #f1f5f9;
          font-weight: 700;
          color: #475569;
          text-transform: uppercase;
          font-size: 8px;
          letter-spacing: 0.05em;
          padding: 8px 10px;
          border-bottom: 1.5px solid #cbd5e1;
          text-align: left;
          font-family: monospace;
        }
        td {
          padding: 8px 10px;
          border-bottom: 1px solid #e2e8f0;
          text-align: left;
        }
        .font-mono {
          font-family: monospace;
          font-size: 10px;
        }
        .text-right {
          text-align: right;
        }
        .text-center {
          text-align: center;
        }
        .text-amber {
          color: #d97706;
          font-weight: bold;
        }
        .text-red {
          color: #dc2626;
          font-weight: bold;
        }
        .text-emerald {
          color: #059669;
          font-weight: bold;
        }
        .section-title {
          font-size: 12px;
          font-weight: 700;
          color: #1e293b;
          text-transform: uppercase;
          letter-spacing: 0.025em;
          margin: 25px 0 10px 0;
          border-left: 3px solid #6366f1;
          padding-left: 8px;
        }
        .stops-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 6px;
        }
        .stop-pill {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          padding: 6px;
          font-size: 9px;
          font-family: monospace;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .footer-print {
          margin-top: 40px;
          border-top: 1px solid #e2e8f0;
          padding-top: 15px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: #94a3b8;
          font-size: 9px;
        }
        @media print {
          body {
            margin: 20px;
          }
          .no-print {
            display: none !important;
          }
        }
        .action-bar {
          margin-bottom: 15px;
          text-align: right;
        }
        .btn-print {
          background: #4f46e5;
          color: #ffffff;
          border: none;
          padding: 6px 14px;
          border-radius: 5px;
          font-size: 11px;
          font-weight: bold;
          cursor: pointer;
          font-family: sans-serif;
        }
      </style>
    </head>
    <body>
      <div class="action-bar no-print">
        <button class="btn-print" onclick="window.print()">Imprimir / Salvar PDF</button>
      </div>

      <div class="header">
        <div>
          <h1>RouteLog Enterprise</h1>
          <p>${viewTitle}</p>
        </div>
        <div class="meta-stamp">
          Gerado em: ${new Date().toLocaleString('pt-BR')}<br>
          Satélite Telemetria Ativo: Sim
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <span>Quilometragem Total</span>
          <strong>${Math.round(totalKm * 10) / 10} km</strong>
        </div>
        <div class="stat-card">
          <span>Desvios Críticos</span>
          <strong class="${totalDeviations > 0 ? 'text-red' : ''}">${totalDeviations}</strong>
        </div>
        <div class="stat-card">
          <span>Tempo Médio / Parada</span>
          <strong>${avgStopMins} min</strong>
        </div>
        <div class="stat-card">
          <span>Total de Rotas</span>
          <strong>${logs.length} (Ativas: ${logs.filter(l => l.status === 'active').length})</strong>
        </div>
      </div>

      <div class="section-title">Resumo do Desempenho Operacional</div>
      <table>
        <thead>
          <tr>
            <th style="width: 8%">Região</th>
            <th style="width: 15%">Início</th>
            <th style="width: 25%">Motorista / Placa</th>
            <th style="width: 15%">Conclusão</th>
            <th style="width: 12%" class="text-right">Distância (Km)</th>
            <th style="width: 10%" class="text-right">Desvios</th>
            <th style="width: 15%" class="text-right">Progresso Paradas</th>
          </tr>
        </thead>
        <tbody>
          ${logs.map(log => {
            const startStr = new Date(log.startTimestamp).toLocaleString('pt-BR');
            const endStr = log.endTimestamp ? new Date(log.endTimestamp).toLocaleString('pt-BR') : 'Em Trânsito';
            return `
              <tr>
                <td class="font-mono"><strong>${log.region}</strong></td>
                <td class="font-mono">${startStr}</td>
                <td><strong>${log.driverName}</strong> <span class="font-mono">[${log.driverPlate}]</span></td>
                <td class="font-mono ${!log.endTimestamp ? 'text-amber' : ''}">${endStr}</td>
                <td class="font-mono text-right">${log.actualDistanceKm} km / ${log.plannedDistanceKm} km</td>
                <td class="font-mono text-right ${log.routeDeviations > 0 ? 'text-red' : ''}">${log.routeDeviations}</td>
                <td class="font-mono text-right text-emerald">${log.completedStopsCount} / ${log.plannedStopsCount}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <div class="section-title">Detalhamento da Linha do Tempo por Parada (GPS)</div>
      ${logs.map(log => {
        if (!log.stopTelemetry || log.stopTelemetry.length === 0) return '';
        return `
          <div style="margin-bottom: 15px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; background: #fafafa; page-break-inside: avoid;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 4px;">
              <strong>Rota: ${log.routeName} (${log.region})</strong>
              <span class="font-mono">Condutor: ${log.driverName} - Placa: ${log.driverPlate}</span>
            </div>
            <div class="stops-grid">
              ${log.stopTelemetry.map((t, idx) => {
                const arr = new Date(t.arrivalTimestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const dep = t.departureTimestamp ? new Date(t.departureTimestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Em serviço';
                return `
                  <div class="stop-pill">
                    <div>
                      <strong>#${idx + 1} ${t.clientName}</strong><br>
                      Chegada: ${arr} | Saída: ${dep}
                    </div>
                    <div class="text-emerald" style="border-left: 1px solid #cbd5e1; margin-left:8px; padding-left: 8px;">
                      ${t.timeSpentMinutes} min
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }).join('')}

      <div class="footer-print">
        <span>Sistemas RouteLog Enterprise - Módulo BI de Auditoria e Logística</span>
        <span>Assinatura do Encarregado: ___________________________</span>
        <span>Página 1</span>
      </div>

      <script>
        setTimeout(() => {
          window.print();
        }, 300);
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
};

// ==========================================
// AUDIO NOTES UTILS (MediaRecorder API)
// ==========================================
export function AudioPlayer({ src }: { src: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => console.warn('Audio playback error:', err));
    }
  };

  return (
    <div className="flex items-center gap-2 mt-2 bg-slate-100 dark:bg-slate-800 p-2 rounded-xl border border-slate-200 select-none">
      <audio 
        ref={audioRef} 
        src={src} 
        onPlay={() => setIsPlaying(true)} 
        onPause={() => setIsPlaying(false)} 
        onEnded={() => setIsPlaying(false)}
        className="hidden" 
      />
      <button 
        type="button" 
        onClick={togglePlay} 
        className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow transition-all cursor-pointer grow-0 shrink-0"
      >
        {isPlaying ? (
          <Pause className="w-3.5 h-3.5 fill-white text-white" />
        ) : (
          <Play className="w-3.5 h-3.5 fill-white text-white ml-0.5" />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold font-mono">
          <span className="flex items-center gap-1">
            <Volume2 className="w-3 h-3 text-slate-400" />
            Nota de Áudio
          </span>
          <span className={isPlaying ? "text-emerald-600 animate-pulse font-bold" : "text-slate-400"}>
            {isPlaying ? "Reproduzindo" : "Ouvir Mensagem"}
          </span>
        </div>
        <div className="h-1 bg-slate-200 rounded-full overflow-hidden mt-1 relative">
          <div className={`h-full bg-indigo-500 transition-all duration-300 ${isPlaying ? 'w-full duration-10000 ease-linear' : 'w-0'}`} />
        </div>
      </div>
    </div>
  );
}

interface AudioRecorderButtonProps {
  onSendAudio: (base64Audio: string) => void;
}

export function AudioRecorderButton({ onSendAudio }: AudioRecorderButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [duration, setDuration] = useState(0);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          onSendAudio(base64Audio);
        };
        
        stream.getTracks().forEach(track => track.stop());
        setDuration(0);
        if (timerRef.current) clearInterval(timerRef.current);
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setDuration(0);
      
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.warn('Microphone permission or support error:', err);
      alert('Não foi possível obter acesso ao microfone. Verifique as configurações de permissões do navegador.');
    }
  };

  const stopRecording = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex items-center gap-1.5 shrink-0 select-none">
      {isRecording && (
        <span className="text-[10px] text-red-500 font-mono font-bold animate-pulse flex items-center gap-1 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-lg shrink-0">
          <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-ping"></span>
          REC {formatTime(duration)}
        </span>
      )}
      <button
        type="button"
        onClick={isRecording ? stopRecording : startRecording}
        className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
          isRecording 
            ? 'bg-red-500 hover:bg-red-600 text-white shadow-md shadow-red-200' 
            : 'bg-slate-100 hover:bg-slate-205 text-slate-500 hover:text-slate-800'
        } cursor-pointer grow-0 shrink-0`}
        title={isRecording ? "Parar gravação e enviar" : "Gravar nota de áudio"}
      >
        {isRecording ? (
          <Square className="w-3.5 h-3.5 fill-white text-white" />
        ) : (
          <Mic className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}

// ==========================================
// REAL-TIME PULSE CARD FOR DRIVERS
// ==========================================
interface DriverStatusCardProps {
  key?: string;
  drv: MotoristaUser;
  driverLoc?: GPSLocation;
  hasActiveRoute: boolean;
}

export function DriverStatusCard({ drv, driverLoc, hasActiveRoute }: DriverStatusCardProps) {
  const [pulseGlow, setPulseGlow] = useState(false);

  useEffect(() => {
    if (driverLoc) {
      setPulseGlow(true);
      const timer = setTimeout(() => {
        setPulseGlow(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [driverLoc?.lat, driverLoc?.lng, driverLoc?.speed, driverLoc?.lastUpdated]);

  return (
    <div 
      className={`p-3.5 border rounded-xl bg-slate-50/40 hover:bg-slate-50 text-xs shadow-sm transition-all duration-700 overflow-hidden relative ${
        pulseGlow 
          ? 'border-indigo-400 bg-indigo-50/30 ring-1 ring-indigo-400/50' 
          : 'border-slate-200'
      }`}
    >
      {/* Laser line gradient beam animation */}
      {pulseGlow && (
        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-indigo-500 to-transparent animate-pulse" />
      )}
      
      <div className="flex items-center justify-between mb-1 relative z-10">
        <strong className="text-slate-800 font-bold">{drv.name}</strong>
        <span className={`inline-flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded-full font-bold uppercase border transition-colors duration-500 ${
          hasActiveRoute ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-450 border-slate-200'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${hasActiveRoute ? 'bg-emerald-500 animate-pulse' : 'bg-slate-450'}`}></span>
          {hasActiveRoute ? 'Em Rota' : 'Pausa / QAP'}
        </span>
      </div>
      
      <div className="text-[11px] text-slate-500 font-sans relative z-10 transition-colors duration-500">
        <p>Veículo: <span className="text-slate-705 font-medium">{drv.vehicleModel}</span> | Placa: <strong className="font-mono text-slate-750 text-[10px] uppercase">{drv.plate}</strong></p>
      </div>
      
      {driverLoc && (
        <div className={`mt-2.5 border p-1.5 rounded-lg flex items-center justify-between text-[10px] font-mono transition-all duration-700 relative z-10 ${
          pulseGlow 
            ? 'bg-indigo-500/10 border-indigo-200 text-indigo-700 font-semibold' 
            : 'bg-white border-slate-150 text-slate-700'
        }`}>
          <span className="font-bold flex items-center gap-1 transition-colors duration-500">
            <span className={`w-1.5 h-1.5 rounded-full ${pulseGlow ? 'bg-indigo-600 animate-ping' : 'bg-indigo-500 animate-ping'}`}></span>
            Live GPS: {Math.round(driverLoc.speed)} km/h
          </span>
          <span className="font-medium text-slate-450">Agulha: {Math.round(driverLoc.heading)}°</span>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 1. SUPER ADMIN VIEW
// ==========================================
interface AdminProps {
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

function _AdminDashboard({ 
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
  const [pushRegion, setPushRegion] = useState('GV1');
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
  const [editedPlate, setEditedPlate] = useState('');
  const [editedVehicleModel, setEditedVehicleModel] = useState('');
  const [editedCnh, setEditedCnh] = useState('');
  const [editedCnhCategory, setEditedCnhCategory] = useState('');
  const [editedCnhExpiration, setEditedCnhExpiration] = useState('');

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
            className="bg-slate-800 hover:bg-slate-705 text-amber-400 hover:text-amber-300 border border-slate-700 px-3 py-2 text-xs rounded-lg flex items-center gap-1.5 font-bold cursor-pointer transition-all"
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
          <div className="text-2xl font-black text-slate-800">7</div>
          <span className="text-[10px] text-slate-450 font-mono">GV1, GV2, GV3, ES/MG, etc.</span>
        </div>
      </div>

      {/* Navigation tabs inside Admin panel */}
      <div className="flex items-center border-b border-slate-200 gap-1.5 font-mono text-xs">
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
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Fichas Cadastrais ({filteredUsers.length})</span>
            <span className="text-[10px] text-slate-400 font-mono">Bypass Total de Regras Ativo</span>
          </div>

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
                              className="w-full border border-slate-200 bg-white rounded-xl p-1.5 text-[11.5px] text-slate-800 focus:ring-1 focus:ring-indigo-500"
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
                      <div className="space-y-1 text-xs">
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
                            <span>Placa: <strong>{(user as any).plate}</strong></span>
                            <span>•</span>
                            <span>CNH: <strong>{(user as any).cnh} ({(user as any).cnhCategory})</strong></span>
                            <span>•</span>
                            <span>Veículo: <strong>{(user as any).vehicleModel}</strong></span>
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
                                  className="p-1.5 border border-yellow-200 text-yellow-700 bg-yellow-50 rounded hover:bg-yellow-100 cursor-pointer"
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
                                  className="text-[9px] bg-red-600 hover:bg-red-705 text-white font-bold p-0.5 px-1.5 rounded cursor-pointer leading-tight"
                                >
                                  Sim
                                </button>
                                <button
                                  onClick={() => setUserToDeleteId(null)}
                                  className="text-[9px] bg-slate-200 hover:bg-slate-350 text-slate-700 p-0.5 px-1.5 rounded cursor-pointer leading-tight"
                                >
                                  Não
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setUserToDeleteId(user.id)}
                                title="Excluir Usuário Definitivamente"
                                className="p-1.5 border border-red-200 text-red-600 bg-red-50 hover:bg-red-105 hover:text-red-700 rounded transition-colors cursor-pointer"
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
              <div key={log.id} className="p-3 border border-slate-100 rounded-lg text-xs hover:border-indigo-150 transition-all bg-slate-50/50">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded font-mono font-bold text-[9px] uppercase">
                      {log.action}
                    </span>
                    <span className="text-[10px] text-slate-405 font-mono">{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Admin: <strong>{log.adminName}</strong></span>
                </div>
                <p className="text-slate-700 font-sans leading-relaxed">{log.details}</p>
                <div className="text-[10px] text-slate-450 mt-1">Alvo: {log.targetUserName} (ID: {log.targetUserId})</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: CHAT SLATE LOGGER */}
      {activeTab === 'chats' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-slate-700 text-xs">
              Histórico de Conversas Gerais
            </div>
            <div className="p-4 space-y-3 max-h-[300px] overflow-y-auto font-mono text-[11px]">
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
            <div className="space-y-2 text-xs">
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
            
            <div className="border-t border-slate-800 pt-3 mt-4 text-[10px] text-blue-400 font-mono">
              SECURITY LAYER ACTIVE (SSL)
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CONSOLE FCM CUSTOM PUSH */}
      {activeTab === 'analytics' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm max-w-xl">
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
              className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors font-bold"
            >
              Executar Push Firebase
            </button>
          </form>
        </div>
      )}

      {/* TAB 5: GLOBAL OPERATIONS PERFORMANCE BI */}
      {activeTab === 'desempenho' && (
        <div className="bg-white border border-slate-205 rounded-2xl p-6 shadow-sm space-y-5 font-sans text-xs">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
            <div>
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
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase font-mono">QUILOMETRAGEM TOTAL</span>
                    <strong className="text-xl font-bold text-slate-800">{Math.round(totalKm * 10) / 10} km</strong>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase font-mono">DESVIOS DETECTADOS</span>
                    <strong className="text-xl font-bold text-red-650 text-red-650 text-red-600 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse shrink-0" />
                      {totalDeviations}
                    </strong>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase font-mono">PERMANÊNCIA MÉDIA / PARADA</span>
                    <strong className="text-xl font-bold text-indigo-700">{avgStopMins} minutos</strong>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
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
                        <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider mb-2 font-mono">
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
                        <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider mb-2 font-mono">
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
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-705">Painel Global de Telemetria Auditada</span>
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

                      <div className="overflow-x-auto max-h-[180px] overflow-y-auto">
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
                                        <div className="text-[10px] text-slate-500 space-y-1">
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
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-rose-50 rounded-xl text-rose-600">
                <Globe className="w-5 h-5 animate-spin-slow" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total de Regiões</span>
                <span className="text-2xl font-black text-slate-900">{regions.length}</span>
                <span className="text-[10px] text-slate-500 block">Setores operacionais ativos</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center gap-4">
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

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center gap-4">
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

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center gap-4">
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
            <div className="lg:col-span-4 bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
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
                      setRegId(e.target.value.toUpperCase().replace(/[^A-Z0-9_/]/g, ''));
                    }}
                    placeholder="Ex: SP, RJ-1, CERRADO, GV4"
                    className="w-full text-xs font-mono border border-slate-200 p-2.5 rounded-lg bg-white focus:outline-none focus:border-rose-500 disabled:bg-slate-100 disabled:text-slate-400 focus:ring-1 focus:ring-rose-500"
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
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Geofence GPS da Base Operacional</span>
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
                    <label className="block text-[9px] font-bold text-slate-500">RAIO DO GEOFENCE (METROS) 🎯</label>
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
                <div className="absolute top-4 left-4 z-10">
                  <span className="bg-slate-800 text-rose-400 border border-slate-700 text-[10px] font-bold px-2 py-1 rounded">
                    SISTEMA DE CORRESPONDÊNCIA TERRESTRE
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-1">Clique em qualquer círculo ou ponto luminoso para abrir o modo de edição rápida.</span>
                </div>

                <div className="absolute top-4 right-4 z-10 flex gap-2 text-[10px] text-slate-400 font-medium">
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-500 inline-block"></span> Sem Carros
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block"></span> Baixo Fluxo
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-405 bg-emerald-400 inline-block"></span> Alta Densidade
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
                            className="bg-slate-900 px-1 py-0.5 rounded font-mono"
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
                <div className="bg-slate-50 p-3.5 border-b border-slate-200 text-xs font-bold text-slate-700 flex justify-between items-center">
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
                        <div>
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
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Frota Operacional</span>
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
                      let badgeStyle = 'bg-rose-55 bg-rose-50 text-rose-700 border-rose-200';
                      if (log.action?.includes('Alterada')) {
                        badgeStyle = 'bg-amber-50 text-amber-700 border-amber-200';
                      } else if (log.action?.includes('Criada')) {
                        badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                      }

                      return (
                        <div key={log.id} className="p-3 border border-slate-100 rounded-lg text-xs hover:border-rose-100 transition-all bg-slate-50/50">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className={`px-2 py-0.5 border text-[9px] font-bold uppercase rounded ${badgeStyle}`}>
                                {log.action}
                              </span>
                              <span className="text-[10px] text-slate-405 font-mono">
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

// ==========================================
// 2. GERENTE DE LOGÍSTICA VIEW
// ==========================================
interface GerenteProps {
  user: RouteUser;
  users: RouteUser[];
  rotas: Rota[];
  chats: ChatMessage[];
  locations: { [drvId: string]: GPSLocation };
  breadcrumbs?: { [drvId: string]: { lat: number; lng: number }[] };
  notifications: NotificationLog[];
  performanceLogs: RoutePerformanceLog[];
  pushLogs: PushDeliveryLog[];
  pushConfig: PushConfig;
  regions: Region[];
  clients?: Cliente[];
  onSaveClient?: (client: Cliente) => void;
  onDeleteClient?: (id: string) => void;
  onPostMessage: (text: string, audioUrl?: string) => void;
  onPush: (title: string, body: string, region: string) => void;
  onSendPush: (
    templateType: 'nova_rota' | 'rota_iniciada' | 'status_parada' | 'urgente_chat' | 'custom',
    profileSegment: 'all' | UserRole,
    regionSegment: string,
    customTitle?: string,
    customBody?: string
  ) => PushDeliveryLog;
  onCreateRoute: (data: Partial<Rota>) => Rota | undefined;
  onUpdateRoute: (id: string, data: Partial<Rota>) => void;
  onDeleteRoute: (id: string) => void;
  onOptimize: (stops: Parada[], oLat: number, oLng: number) => Promise<Parada[]>;
  onStartRoute: (id: string) => void;
  isDemoSimulationActive?: boolean;
  setIsDemoSimulationActive?: (active: boolean) => void;
}

export function GerenteDashboard({ 
  user, 
  users,
  rotas, 
  chats, 
  locations, 
  breadcrumbs,
  notifications, 
  performanceLogs, 
  pushLogs, 
  pushConfig, 
  regions,
  clients = [],
  onSaveClient,
  onDeleteClient,
  onPostMessage, 
  onPush, 
  onSendPush,
  onCreateRoute,
  onUpdateRoute,
  onDeleteRoute,
  onOptimize,
  onStartRoute,
  isDemoSimulationActive = false,
  setIsDemoSimulationActive
}: GerenteProps) {
  const [chatInput, setChatInput] = useState('');
  const [activeTab, setActiveTab] = useState<'map' | 'routes' | 'chat' | 'push_config' | 'analytics' | 'clientes'>('map');
  const [mapMode, setMapMode] = useState<'vector' | 'google'>('vector');
  const [searchTerm, setSearchTerm] = useState('');
  const [isImporterOpen, setIsImporterOpen] = useState(false);
  const [isSupabaseHelpOpen, setIsSupabaseHelpOpen] = useState(false);

  // Dynamic universal search categories matching
  const searchResults = useMemo(() => {
    if (!searchTerm || searchTerm.trim().length < 2) return null;
    const term = searchTerm.toLowerCase().trim();

    // 1. Matches Drivers in Region
    const region = (user as any).region || 'GV1';
    const drivers = users
      .filter(u => u.role === UserRole.MOTORISTA && (u as any).region === region && (
        u.name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        (u as any).plate?.toLowerCase().includes(term)
      ))
      .slice(0, 4);

    // 2. Matches Routes within Region
    const matchedRoutes = rotas
      .filter(r => r.region === region && (
        r.name.toLowerCase().includes(term) ||
        r.driverName.toLowerCase().includes(term)
      ))
      .slice(0, 4);

    // 3. Matches Clients within Region
    const matchedClients: { clientName: string; address: string; routeName: string; whatsApp?: string }[] = [];
    rotas
      .filter(r => r.region === region)
      .forEach(r => {
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
  }, [searchTerm, users, rotas, user]);
  
  // Tutorial and Dynamic Route Filters States
  const [showTutorial, setShowTutorial] = useState(false);
  const [filterRouteStatus, setFilterRouteStatus] = useState<string>('all');
  const [filterRouteDriver, setFilterRouteDriver] = useState<string>('all');
  const [filterRouteDate, setFilterRouteDate] = useState<string>('all'); // all, today, week, month
  
  // Custom Push Form states
  const [pushTemplate, setPushTemplate] = useState<'nova_rota' | 'rota_iniciada' | 'status_parada' | 'urgente_chat' | 'custom'>('nova_rota');
  const [pushRole, setPushRole] = useState<'all' | UserRole>('all');
  const [pushRegion, setPushRegion] = useState<string>((user as any).region || 'GV1');
  const [pushTitle, setPushTitle] = useState('Nova Rota Atribuída 📦');
  const [pushBody, setPushBody] = useState('Uma nova rota logística foi designada ao seu perfil regional.');
  const [apnsSandbox, setApnsSandbox] = useState(pushConfig.apnsSandbox);

  const region = (user as any).region || 'GV1';

  // NEW: Route Builder States inside Gerente "Clientes" tab
  const [gRouteName, setGRouteName] = useState('Rota Corporativa ' + new Date().toLocaleDateString('pt-BR'));
  const [gOrigin, setGOrigin] = useState('CD Central ' + region + ' - Av. Dos Camras, 513,Santo Antonio - Cariacica-ES');
  const [gOriginLat, setGOriginLat] = useState(-20.302534);
  const [gOriginLng, setGOriginLng] = useState(-40.401630);
  const [gSelectedDriverId, setGSelectedDriverId] = useState('');
  const [gStops, setGStops] = useState<Parada[]>([]);
  const [gClientName, setGClientName] = useState('');
  const [gClientWhatsApp, setGClientWhatsApp] = useState('');
  const [gClientAddress, setGClientAddress] = useState('');
  const [gCustomLat, setGCustomLat] = useState<number>(-20.302534);
  const [gCustomLng, setGCustomLng] = useState<number>(-40.401630);
  const [gAddressPredictions, setGAddressPredictions] = useState<{ description: string; placeId: string }[]>([]);
  const [gIsValidating, setGIsValidating] = useState(false);
  const [gIsValidated, setGIsValidated] = useState(false);
  const [gEditingRouteId, setGEditingRouteId] = useState<string | null>(null);

  // Client Management States
  const [clientSubTab, setClientSubTab] = useState<'database' | 'planner'>('database');
  const [clientsSearch, setClientsSearch] = useState('');
  const [checkedClientIds, setCheckedClientIds] = useState<string[]>([]);
  
  // Client CRUD Modal States
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [cEditingClient, setCEditingClient] = useState<Cliente | null>(null);
  const [cFormName, setCFormName] = useState('');
  const [cFormWhatsApp, setCFormWhatsApp] = useState('');
  const [cFormAddress, setCFormAddress] = useState('');
  const [cFormLat, setCFormLat] = useState<number>(-20.302534);
  const [cFormLng, setCFormLng] = useState<number>(-40.401630);
  const [cFormAddressPredictions, setCEAddrPredictions] = useState<{ description: string; placeId: string }[]>([]);
  const [cFormIsValidated, setCFormIsValidated] = useState(false);

  const cFetchAddressPredictions = (inputStr: string) => {
    if (!inputStr || inputStr.trim().length < 3) {
      setCEAddrPredictions([]);
      return;
    }
    if (typeof window !== 'undefined' && (window as any).google && (window as any).google.maps && (window as any).google.maps.places) {
      try {
        const service = new (window as any).google.maps.places.AutocompleteService();
        service.getPlacePredictions(
          { input: inputStr, componentRestrictions: { country: 'br' } },
          (predictions: any, status: any) => {
            if (status === 'OK' && predictions) {
              setCEAddrPredictions(
                predictions.map((p: any) => ({
                  description: p.description,
                  placeId: p.place_id,
                }))
              );
            } else {
              setCEAddrPredictions([]);
            }
          }
        );
      } catch (e) {
        console.warn('Client autocomp fail:', e);
      }
    }
  };

  const cHandleSelectPrediction = (address: string, placeId: string) => {
    setCFormAddress(address);
    setCEAddrPredictions([]);
    setCFormIsValidated(true);
    if (typeof window !== 'undefined' && (window as any).google && (window as any).google.maps) {
      try {
        const geocoder = new (window as any).google.maps.Geocoder();
        geocoder.geocode({ placeId: placeId }, (results: any, status: any) => {
          if (status === 'OK' && results && results[0]) {
            const loc = results[0].geometry.location;
            setCFormLat(loc.lat());
            setCFormLng(loc.lng());
          }
        });
      } catch (err) {
        console.warn('Client form geocoder failed:', err);
      }
    }
  };

  const handleSaveClientForm = () => {
    if (!cFormName || !cFormAddress) {
      alert('Favor preencher o Nome e Endereço do Cliente.');
      return;
    }
    const cleanPhone = cFormWhatsApp.replace(/\D/g, '');

    const clientData: Cliente = {
      id: cEditingClient ? cEditingClient.id : `cli_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: cFormName,
      whatsApp: cleanPhone || '5533999999999',
      address: cFormAddress,
      lat: cFormLat,
      lng: cFormLng,
      region,
      createdAt: cEditingClient ? cEditingClient.createdAt : new Date().toISOString()
    };

    if (onSaveClient) {
      onSaveClient(clientData);
    }
    setIsClientModalOpen(false);
    setCEditingClient(null);
    setCFormName('');
    setCFormWhatsApp('');
    setCFormAddress('');
  };

  const handleOpenEditClient = (cli: Cliente) => {
    setCEditingClient(cli);
    setCFormName(cli.name);
    setCFormWhatsApp(cli.whatsApp);
    setCFormAddress(cli.address);
    setCFormLat(cli.lat);
    setCFormLng(cli.lng);
    setCFormIsValidated(true);
    setIsClientModalOpen(true);
  };

  const handleOpenAddClient = () => {
    setCEditingClient(null);
    setCFormName('');
    setCFormWhatsApp('');
    setCFormAddress('');
    setCFormLat(gOriginLat);
    setCFormLng(gOriginLng);
    setCFormIsValidated(false);
    setIsClientModalOpen(true);
  };

  const handleExportClientsCSV = () => {
    const regionalClients = clients.filter(c => c.region === region);
    if (regionalClients.length === 0) {
      alert('Nenhum cliente cadastrado nesta região para exportar.');
      return;
    }

    const headers = ['ID', 'Nome', 'WhatsApp', 'Endereco', 'Lat', 'Lng', 'Regiao', 'CriadoEm'];
    const rows = regionalClients.map(c => [
      c.id,
      `"${c.name.replace(/"/g, '""')}"`,
      c.whatsApp,
      `"${c.address.replace(/"/g, '""')}"`,
      c.lat,
      c.lng,
      c.region,
      c.createdAt
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `banco_clientes_${region}_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateRouteFromSelected = () => {
    if (checkedClientIds.length === 0) {
      alert('Selecione pelo menos um cliente no banco de dados.');
      return;
    }

    const selectedClients = clients.filter(c => checkedClientIds.includes(c.id));
    const newStops: Parada[] = selectedClients.map((c, index) => ({
      id: `p_stop_db_${Date.now()}_${index}`,
      clientName: c.name,
      clientWhatsApp: c.whatsApp,
      address: c.address,
      lat: c.lat,
      lng: c.lng,
      status: 'pending',
      region: c.region
    }));

    setGStops(newStops);
    setCEditingClient(null);
    setCheckedClientIds([]);
    setClientSubTab('planner');
  };

  // Address places suggestions for Gerente view
  const gFetchAddressPredictions = (inputStr: string) => {
    if (!inputStr || inputStr.trim().length < 3) {
      setGAddressPredictions([]);
      return;
    }
    if (typeof window !== 'undefined' && (window as any).google && (window as any).google.maps && (window as any).google.maps.places) {
      try {
        const service = new (window as any).google.maps.places.AutocompleteService();
        service.getPlacePredictions(
          { input: inputStr, componentRestrictions: { country: 'br' } },
          (predictions: any, status: any) => {
            if (status === 'OK' && predictions) {
              setGAddressPredictions(
                predictions.map((p: any) => ({
                  description: p.description,
                  placeId: p.place_id,
                }))
              );
            } else {
              setGAddressPredictions([]);
            }
          }
        );
      } catch (e) {
        console.warn('Gerente autocomplete failed:', e);
      }
    }
  };

  const gHandleSelectPrediction = (address: string, placeId: string) => {
    setGClientAddress(address);
    setGAddressPredictions([]);
    setGIsValidated(true);
    if (typeof window !== 'undefined' && (window as any).google && (window as any).google.maps) {
      try {
        const geocoder = new (window as any).google.maps.Geocoder();
        geocoder.geocode({ placeId: placeId }, (results: any, status: any) => {
          if (status === 'OK' && results && results[0]) {
            const loc = results[0].geometry.location;
            setGCustomLat(loc.lat());
            setGCustomLng(loc.lng());
          }
        });
      } catch (err) {
        console.warn('Gerente geocoder by placeId failed:', err);
      }
    }
  };

  const gAddPresetStop = (idx: number) => {
    const preset = GUARIBA_LOCATIONS[idx % GUARIBA_LOCATIONS.length];
    setGClientName(preset.name);
    setGClientAddress(preset.address);
    setGCustomLat(preset.lat);
    setGCustomLng(preset.lng);
    setGClientWhatsApp('553399' + Math.floor(1000000 + Math.random() * 9000000));
    setGIsValidated(true);
  };

  const moveStopUp = (index: number) => {
    if (index === 0) return;
    const newStops = [...gStops];
    const temp = newStops[index];
    newStops[index] = newStops[index - 1];
    newStops[index - 1] = temp;
    setGStops(newStops);
  };

  const moveStopDown = (index: number) => {
    if (index === gStops.length - 1) return;
    const newStops = [...gStops];
    const temp = newStops[index];
    newStops[index] = newStops[index + 1];
    newStops[index + 1] = temp;
    setGStops(newStops);
  };

  const gHandleAddStop = () => {
    if (!gClientName || !gClientAddress) {
      alert('Favor preencher o Nome do Cliente e Endereço Completo.');
      return;
    }
    const newStop: Parada = {
      id: `p_stop_g_${Date.now()}`,
      clientName: gClientName,
      clientWhatsApp: gClientWhatsApp,
      address: gClientAddress,
      lat: gCustomLat,
      lng: gCustomLng,
      status: 'pending'
    };
    setGStops([...gStops, newStop]);
    setGClientName('');
    setGClientWhatsApp('');
    setGClientAddress('');
    setGAddressPredictions([]);
    setGIsValidated(false);
  };

  const gGeocodeAddress = (addressText: string, isOrigin: boolean) => {
    if (!addressText.trim()) return;
    if (typeof window !== 'undefined' && (window as any).google && (window as any).google.maps) {
      try {
        const geocoder = new (window as any).google.maps.Geocoder();
        geocoder.geocode({ address: addressText }, (results: any, status: any) => {
          if (status === 'OK' && results && results[0]) {
            const loc = results[0].geometry.location;
            if (isOrigin) {
              setGOriginLat(loc.lat());
              setGOriginLng(loc.lng());
            } else {
              setGCustomLat(loc.lat());
              setGCustomLng(loc.lng());
            }
          }
        });
      } catch (err) {
        console.warn('Gerente direct geocode failed:', err);
      }
    }
  };

  // Region isolation of routes
  const regionalRoutes = rotas.filter(r => r.region === region);
  const activeRoute = regionalRoutes.find(r => r.status === 'active') || null;

  // Filter regional routes dynamically by delivery status, assigned driver, and creation date
  const filteredRegionalRoutes = useMemo(() => {
    let list = [...regionalRoutes];
    
    if (filterRouteStatus !== 'all') {
      list = list.filter(r => r.status === filterRouteStatus);
    }
    
    if (filterRouteDriver !== 'all') {
      list = list.filter(r => r.driverId === filterRouteDriver);
    }
    
    if (filterRouteDate !== 'all') {
      const now = new Date();
      list = list.filter(r => {
        if (!r.createdAt) return false;
        const createdDate = new Date(r.createdAt);
        // Date difference calculation
        const createdStartOfDay = new Date(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate()).getTime();
        const nowStartOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const diffDays = Math.round((nowStartOfDay - createdStartOfDay) / (1000 * 60 * 60 * 24));
        
        if (filterRouteDate === 'today') {
          return createdDate.toDateString() === now.toDateString();
        } else if (filterRouteDate === 'week') {
          return diffDays <= 7;
        } else if (filterRouteDate === 'month') {
          return diffDays <= 30;
        }
        return true;
      });
    }
    
    return list;
  }, [regionalRoutes, filterRouteStatus, filterRouteDriver, filterRouteDate]);

  // Region isolation of drivers (displaying only those linked to the logged-in Manager's region)
  const regionalDrivers = useMemo(() => {
    return users.filter(u => u.role === UserRole.MOTORISTA && (u as any).region === region);
  }, [users, region]);

  // Region isolation of chat
  const regionalChats = chats.filter(c => c.region === region);

  // Region notifications (fully filtered automatically to Manager's registered profile region)
  const regionalNotifs = useMemo(() => {
    return notifications.filter(n => n.region === region);
  }, [notifications, region]);

  // Region isolated performance logs & push logs
  const regionalPerformance = performanceLogs.filter(p => p.region === region);
  const regionalPushLogs = pushLogs.filter(p => p.targetRegion === 'all' || p.targetRegion === region);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onPostMessage(chatInput.trim());
    setChatInput('');
  };

  // When a push template is selected, update placeholder texts automatically
  const handleTemplateChange = (tmpl: 'nova_rota' | 'rota_iniciada' | 'status_parada' | 'urgente_chat' | 'custom') => {
    setPushTemplate(tmpl);
    if (tmpl === 'nova_rota') {
      setPushTitle('Nova Rota Atribuída 📦');
      setPushBody('Atenção motorista: Uma nova rota de entregas multiparadas foi designada ao seu veículo.');
      setPushRole(UserRole.MOTORISTA);
    } else if (tmpl === 'rota_iniciada') {
      setPushTitle('Motorista em Trânsito 🚚');
      setPushBody('A rota regional foi iniciada pelo condutor. Posicionamento de satélite ativo.');
      setPushRole(UserRole.GERENTE);
    } else if (tmpl === 'status_parada') {
      setPushTitle('Entrega Concluída Checklist ✅');
      setPushBody('Canal de logística informa: Uma das paradas agendadas acaba de ser finalizada.');
      setPushRole('all');
    } else if (tmpl === 'urgente_chat') {
      setPushTitle('Mensagem Urgente da Central ⚠️');
      setPushBody('Retorno imediato solicitado! Favor verificar canal de chat regional.');
      setPushRole(UserRole.MOTORISTA);
    } else {
      setPushTitle('Alerta Customizado 📢');
      setPushBody('Comunicado operacional do time de controle RouteLog.');
      setPushRole('all');
    }
  };

  const handleDispatchPush = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pushTitle.trim() || !pushBody.trim()) return;
    onSendPush(pushTemplate, pushRole, pushRegion, pushTitle, pushBody);
    alert('FCM Push Broadcast Simulado Enviado com Sucesso!');
  };

  // Calculate high-fidelity performance metrics for regional analytics widgets
  const statsSummary = useMemo(() => {
    const totalKm = regionalPerformance.reduce((sum, p) => sum + p.actualDistanceKm, 0);
    const completedRoutes = regionalPerformance.filter(p => p.status === 'completed').length;
    const activeRoutes = regionalPerformance.filter(p => p.status === 'active').length;
    const totalDeviations = regionalPerformance.reduce((sum, p) => sum + p.routeDeviations, 0);

    const totalStopsMeasured = regionalPerformance.reduce((acc, p) => acc + p.stopTelemetry.length, 0);
    const totalMinutesMeasured = regionalPerformance.reduce((acc, p) => {
      return acc + p.stopTelemetry.reduce((stopAcc, s) => stopAcc + s.timeSpentMinutes, 0);
    }, 0);
    
    const avgStopMins = totalStopsMeasured > 0 ? Math.round(totalMinutesMeasured / totalStopsMeasured) : 18;

    return {
      totalKm: Math.round(totalKm * 10) / 10,
      completedRoutes,
      activeRoutes,
      totalDeviations,
      avgStopMins
    };
  }, [regionalPerformance]);

  // Transform data for recharts
  const distanceChartData = regionalPerformance.map(p => ({
    name: p.routeName.replace('Rota ', 'R_'),
    'Distância Prevista (km)': p.plannedDistanceKm,
    'Distância Realizada (km)': p.actualDistanceKm,
  }));

  const deviationChartData = regionalPerformance.map(p => ({
    name: p.routeName.replace('Rota ', 'R_'),
    'Desvios Detectados': p.routeDeviations,
    'Média Minutos/Parada': p.averageTimePerStopMinutes || 15
  }));

  return (
    <div id="gerente-main-panel" className="flex flex-col gap-5 select-text w-full">
      
      {/* Top Profile QuickBar & Tab Controller */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold font-mono">
              {region}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-850">{user.name}</h2>
                <span className="bg-blue-50 text-blue-700 text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase border border-blue-100">
                  Gerente de Logística
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Gestão de frota, inteligência regional & push-targeting.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
            <button
               type="button"
               onClick={() => setShowTutorial(true)}
               className="bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 border border-slate-700 px-3 py-1.5 text-xs rounded-xl flex items-center gap-1 font-bold cursor-pointer transition-all"
               title="Abrir guia interativo explicativo regional"
             >
               <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
               <span>Guia Regional</span>
             </button>

            <div className="relative">
              <input
                type="text"
                placeholder="Buscar rotas, motoristas..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-slate-50 border border-slate-300 text-slate-800 p-2 text-xs rounded-xl placeholder-slate-400 w-[180px] focus:outline-none focus:border-blue-500 font-sans shadow-sm"
              />
              {searchResults && (
                <div className="absolute right-0 top-full mt-2 w-[320px] md:w-[465px] bg-white border border-slate-200 shadow-2xl rounded-2xl p-4.5 z-50 overflow-y-auto max-h-[380px] space-y-4 text-slate-800 text-left border-t-8 border-t-blue-600">
                  <div className="flex items-center justify-between border-b pb-2 select-none">
                    <span className="font-extrabold text-[10px] text-slate-400 uppercase tracking-widest">Busca Logística ({region})</span>
                    <button 
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2.5 py-1 rounded font-black uppercase"
                    >
                      Limpar
                    </button>
                  </div>

                  {searchResults.drivers.length === 0 && searchResults.routes.length === 0 && searchResults.clients.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 font-medium font-sans">Nenhum registro correspondente encontrado para "{searchTerm}"</div>
                  ) : (
                    <div className="space-y-4 font-sans">
                      {/* Drivers category */}
                      {searchResults.drivers.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[9px] font-black text-blue-600 block uppercase tracking-wider font-mono">Motoristas Regionais 👀</span>
                          <div className="space-y-1">
                            {searchResults.drivers.map(drv => (
                              <div key={drv.id} className="p-2.5 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between transition-all hover:bg-slate-100/50">
                                <div>
                                  <strong className="block text-slate-850 text-xs font-semibold">{drv.name}</strong>
                                  <span className="text-[10px] text-slate-400 block mt-0.5 font-sans">E-mail: {drv.email} {(drv as any).region ? `| Região: ${(drv as any).region}` : ''}</span>
                                </div>
                                <span className="bg-blue-50 border border-blue-150 text-blue-700 font-mono text-[9px] font-black uppercase px-2 py-0.5 rounded shrink-0">
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
                          <span className="text-[9px] font-black text-blue-600 block uppercase tracking-wider font-mono">Rotas Isoladas 📦</span>
                          <div className="space-y-1">
                            {searchResults.routes.map(rt => (
                              <div key={rt.id} className="p-2.5 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between transition-all hover:bg-slate-100/50 font-sans">
                                <div className="min-w-0 pr-2">
                                  <strong className="block text-slate-850 text-xs font-semibold truncate">{rt.name}</strong>
                                  <span className="text-[10px] text-slate-400 block mt-0.5 truncate">Origem: {rt.origin} | Região: {rt.region}</span>
                                </div>
                                <span className={`font-mono text-[8px] text-white font-black uppercase px-2 py-0.5 rounded shrink-0 ${
                                  rt.status === 'completed' ? 'bg-emerald-500' : rt.status === 'active' ? 'bg-blue-500 animate-pulse' : 'bg-slate-400'
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
                          <span className="text-[9px] font-black text-blue-600 block uppercase tracking-wider font-mono">Clientes / Destinatários Regional 👤</span>
                          <div className="space-y-1">
                            {searchResults.clients.map((cl, cidx) => (
                              <div key={cidx} className="p-2.5 bg-slate-50 border border-slate-150 rounded-xl transition-all hover:bg-slate-100/50 font-sans">
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

            <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100 text-emerald-700 text-[11px] font-medium font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              FCM Channel Live: {region}-Secured
            </div>
          </div>
        </div>

        {/* Six-way tab selection button matrix */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/30">
          <button
            onClick={() => setActiveTab('map')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'map' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            Vigilância Satélite
          </button>
          
          <button
            onClick={() => setActiveTab('routes')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'routes' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Route className="w-3.5 h-3.5" />
            Condutores Ativos
          </button>
          
          <button
            onClick={() => setActiveTab('chat')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'chat' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Chat Regional
          </button>

          <button
            onClick={() => setActiveTab('push_config')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'push_config' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Bell className="w-3.5 h-3.5 text-rose-500" />
            Notificações Push
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'analytics' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-indigo-500" />
            Desempenho (BI)
          </button>

          <button
            onClick={() => setActiveTab('clientes')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 col-span-2 sm:col-span-1 ${
              activeTab === 'clientes' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-emerald-600" />
            Clientes (Rotas)
          </button>
        </div>
      </div>

      {/* Main Reactive Workspace Splitter */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch min-h-[460px]">
        
        {/* Dynamic Context Widget Frame (5 columns left side) */}
        <div className="lg:col-span-4 flex flex-col h-full gap-4">
          
          {/* Active routes metadata */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-md flex flex-col flex-grow">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5 border-b border-slate-100 pb-2 shrink-0">
              <Layers className="w-4 h-4 text-slate-400" />
              Operações Locais ({region})
            </h3>

            <div className="flex-grow overflow-y-auto pr-1 space-y-3.5 max-h-[380px]">
              {/* Conditional Left Widgets */}
              {activeTab === 'analytics' ? (
                // Performance mini metrics left sidebar
                <div className="space-y-4">
                  <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                    <span className="text-[10px] font-bold text-indigo-600 block uppercase font-mono">ON-TIME PERFORMANCE</span>
                    <strong className="text-2xl font-bold text-indigo-900 font-sans block mt-1">94.8%</strong>
                    <p className="text-[10px] text-indigo-400 mt-1 leading-normal font-sans">
                      Metas baseadas na tolerância máxima de 25 minutos por ponto de entrega programado.
                    </p>
                  </div>

                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                    <span className="text-[10px] font-bold text-amber-700 block uppercase font-mono">ALERTAS DE COMPORTAMENTO</span>
                    <strong className="text-lg font-bold text-amber-900 flex items-center gap-1 mt-1">
                      <AlertTriangle className="w-4 h-4 text-amber-600 animate-pulse" />
                      {statsSummary.totalDeviations} Desvios de Rota
                    </strong>
                    <p className="text-[10px] text-amber-500 mt-1 leading-normal font-sans">
                      Eventos registrados quando a distância realizada supera o modelo previsto em +0.5km por parada.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-650 space-y-2 text-[11px] font-sans">
                    <strong className="font-bold text-xs text-slate-700 block">Legenda da Grid de Escopo:</strong>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-blue-500 block"></span>
                      <span>Barra Azul: Trajeto planejado por algoritmos GIS</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-emerald-500 block"></span>
                      <span>Barra Verde: Escopo real medido por GPS mobile</span>
                    </div>
                  </div>
                </div>
              ) : activeTab === 'push_config' ? (
                // FCM Settings metadata log left sidebar
                <div className="space-y-4">
                  <div className="bg-slate-900 border border-slate-950 p-4 rounded-xl text-white space-y-3 font-mono text-[10px]">
                    <span className="text-rose-500 font-bold block uppercase tracking-wider text-[11px]">Firebase Service API Profile</span>
                    
                    <div>
                      <span className="text-slate-400 block">TOKEN DE IDENTIFICAÇÃO DO TERMINAL FCM:</span>
                      <span className="text-slate-200 select-all truncate block bg-slate-950 px-1.5 py-1 rounded mt-0.5 border border-slate-800">
                        {pushConfig.fcmToken}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block">SERVER WEB KEY (.json configuration):</span>
                      <span className="text-slate-350 select-all font-sans text-[9px] block">
                        {pushConfig.fcmServerKey} (Cloud Messaging V1 credentials loaded)
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[11px]">
                      <span>APNs IOS Certificate:</span>
                      <button 
                        type="button"
                        onClick={() => setApnsSandbox(!apnsSandbox)}
                        className={`px-2 py-0.5 rounded cursor-pointer text-[9px] ${apnsSandbox ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                      >
                        {apnsSandbox ? 'SANDBOX ACTIVE' : 'PRODUCTION APNS'}
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 text-slate-400 text-[10px] leading-relaxed font-sans pt-1">
                      <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span>Estes parâmetros correspondem às chaves injetadas para conexão direta aos servidores Google FCM.</span>
                    </div>
                  </div>
                </div>
              ) : activeTab === 'routes' ? (
                // Active driver and route list layout with full regional detail
                <div className="space-y-4">
                  {/* TOP ACTION BAR: NEW ROUTE & CSV IMPORT */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-blue-50/70 to-indigo-50/70 border border-blue-100 rounded-2xl p-4.5 shadow-sm">
                    <div>
                      <h4 className="font-extrabold text-[11px] text-indigo-950 uppercase tracking-widest font-mono">Painel de Planejamento Regional ({region})</h4>
                      <p className="text-[10.5px] text-indigo-800 font-sans mt-0.5 font-medium leading-relaxed">Importe planilhas de faturamento para roteamento de paradas e despacho das frotas.</p>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => setIsImporterOpen(true)}
                      className="px-4.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 text-xs select-none cursor-pointer uppercase tracking-wider self-start sm:self-center font-sans"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-white" />
                      <span>Importar Clientes (CSV/Excel)</span>
                    </button>
                  </div>

                  {/* Dynamic Fleet Filter bar widget */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3 shadow-xs">
                    <div className="flex items-center justify-between border-b border-slate-150 pb-2">
                      <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700 uppercase tracking-tight font-sans">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>Filtros Operacionais</span>
                      </div>
                      {(filterRouteStatus !== 'all' || filterRouteDriver !== 'all' || filterRouteDate !== 'all') && (
                        <button
                          type="button"
                          onClick={() => {
                            setFilterRouteStatus('all');
                            setFilterRouteDriver('all');
                            setFilterRouteDate('all');
                          }}
                          className="text-[10px] text-blue-600 hover:text-blue-800 font-bold transition-all cursor-pointer underline"
                        >
                          Limpar
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-2.5">
                      {/* Status select */}
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1 font-mono">Status de Entrega</label>
                        <select
                          value={filterRouteStatus}
                          onChange={(e) => setFilterRouteStatus(e.target.value)}
                          className="w-full bg-white border border-slate-205 text-slate-700 px-2 py-1.5 text-[11px] rounded-xl focus:border-blue-500 outline-none font-semibold transition-all cursor-pointer"
                        >
                          <option value="all">Todos os Status</option>
                          <option value="draft">Rascunho (Draft)</option>
                          <option value="active">Em Trânsito (Active)</option>
                          <option value="completed">Concluídos (Completed)</option>
                        </select>
                      </div>

                      {/* Driver select */}
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1 font-mono">Motorista Designado</label>
                        <select
                          value={filterRouteDriver}
                          onChange={(e) => setFilterRouteDriver(e.target.value)}
                          className="w-full bg-white border border-slate-205 text-slate-700 px-2 py-1.5 text-[11px] rounded-xl focus:border-blue-500 outline-none font-semibold text-ellipsis overflow-hidden transition-all cursor-pointer"
                        >
                          <option value="all">Todos os Motoristas</option>
                          {regionalDrivers.map(drv => (
                            <option key={drv.id} value={drv.id}>{drv.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Date select */}
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1 font-mono">Data de Criação</label>
                        <select
                          value={filterRouteDate}
                          onChange={(e) => setFilterRouteDate(e.target.value)}
                          className="w-full bg-white border border-slate-200 text-slate-700 px-2 py-1.5 text-[11px] rounded-xl focus:border-blue-500 outline-none font-semibold transition-all cursor-pointer"
                        >
                          <option value="all">Qualquer Período</option>
                          <option value="today">Criadas Hoje</option>
                          <option value="week">Últimos 7 dias</option>
                          <option value="month">Últimos 30 dias</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2 font-mono">
                      Rotas Regionais Mapeadas ({filteredRegionalRoutes.length})
                    </span>
                    <div className="space-y-2.5">
                      {filteredRegionalRoutes.map(route => {
                        const completedStops = route.stops.filter(s => s.status === 'completed').length;
                        const isCompleted = route.status === 'completed';
                        const isActive = route.status === 'active';

                        return (
                          <div key={route.id} className="p-3 border border-slate-200 rounded-xl text-xs bg-slate-50/50 hover:bg-slate-50 transition-all shadow-sm">
                            <div className="flex items-center justify-between mb-1.5 font-sans">
                              <strong className="text-slate-800 font-bold truncate block max-w-[170px]">{route.name}</strong>
                              <span className={`px-2 py-0.5 text-[9px] rounded-full font-mono font-bold uppercase border ${
                                isActive ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse' :
                                isCompleted ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-450 border-slate-200'
                              }`}>
                                {route.status}
                              </span>
                            </div>

                            <div className="space-y-0.5 text-[11px] text-slate-500 font-sans">
                              <p>Condutor: <strong className="text-slate-700">{route.driverName}</strong></p>
                              <p>Identificação: <strong className="text-slate-700 font-mono text-[10px] uppercase">{route.driverPlate}</strong></p>
                              {route.createdAt && (
                                <p className="text-[9px] text-slate-400 mt-1">Criação: <strong className="text-slate-500 font-mono">{new Date(route.createdAt).toLocaleDateString('pt-BR')}</strong></p>
                              )}
                            </div>
                            
                            <div className="mt-2.5 flex items-center justify-between text-[11px] border-t border-slate-200/50 pt-2 font-sans text-slate-500">
                              <span>Progresso:</span>
                              <strong className="text-slate-700 font-bold font-mono">{completedStops} / {route.stops.length} concluídas</strong>
                            </div>
                          </div>
                        );
                      })}
                      {filteredRegionalRoutes.length === 0 && (
                        <div className="text-center py-6 text-slate-400 text-xs italic">Nenhuma rota ativa regional com estes filtros.</div>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-slate-150 pt-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2 font-mono pb-1 border-b border-slate-50">
                      Motoristas Ativos da Região ({region})
                    </span>
                    <div className="space-y-2.5">
                      {regionalDrivers.map(drv => {
                        const driverLoc = locations[drv.id];
                        const hasActiveRoute = regionalRoutes.some(r => r.driverId === drv.id && r.status === 'active');
                        return (
                          <DriverStatusCard 
                            key={drv.id}
                            drv={drv as MotoristaUser}
                            driverLoc={driverLoc}
                            hasActiveRoute={hasActiveRoute}
                          />
                        );
                      })}
                      {regionalDrivers.length === 0 && (
                        <div className="text-center py-4 text-slate-400 text-xs italic">Nenhum motorista nesta região.</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : activeTab === 'chat' ? (
                // Team chat view of this region
                <div className="flex flex-col h-full min-h-[300px]">
                  {/* Tooltip explicativo regional */}
                  <div className="bg-amber-50/50 border border-amber-200/50 rounded-xl p-2.5 mb-2 flex items-start gap-1.5 text-[10px] text-amber-900 font-medium select-none shadow-xs">
                    <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      <strong>Visibilidade Restrita ({region}):</strong> Mensagens enviadas aqui só serão visíveis para membros associados a esta região.
                    </p>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[240px] pr-1 pb-1">
                    {regionalChats.map(c => (
                      <div key={c.id} className="p-2 rounded-xl bg-slate-50 border border-slate-150">
                        <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
                          <span className="font-bold text-slate-700">{c.senderName}</span>
                          <span className="font-mono text-[9px]">{new Date(c.timestamp).toLocaleTimeString('pt-BR')}</span>
                        </div>
                        <p className="text-slate-650 leading-relaxed font-sans">{c.message}</p>
                        {c.audioUrl && <AudioPlayer src={c.audioUrl} />}
                      </div>
                    ))}
                    {regionalChats.length === 0 && (
                      <div className="text-center py-10 text-slate-400">Nenhuma mensagem registrada no canal.</div>
                    )}
                  </div>

                  <form onSubmit={handleSendChat} className="flex gap-2 border-t border-slate-150 pt-2.5 mt-auto items-center">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      placeholder="Enviar mensagem para motoristas..."
                      className="flex-1 border border-slate-205 px-3 py-1.5 rounded-xl text-xs bg-slate-50 focus:bg-white transition-all outline-none"
                    />
                    <AudioRecorderButton onSendAudio={(base64) => onPostMessage('🎙️ Nota de Áudio', base64)} />
                    <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-3 py-2 flex items-center justify-center cursor-pointer transition-colors shadow-sm shrink-0">
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
              ) : (
                // Vigilancia: general notifications stream
                <div className="space-y-2.5">
                  {regionalNotifs.map(notif => (
                    <div key={notif.id} className="p-3 rounded-xl border border-blue-100 bg-blue-50/20 text-xs">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5">
                        <span className="font-semibold text-blue-700 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          {notif.title}
                        </span>
                        <span>{new Date(notif.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-slate-650 leading-relaxed font-sans">{notif.body}</p>
                    </div>
                  ))}
                  {regionalNotifs.length === 0 && (
                    <div className="text-center py-6 text-slate-400 text-xs font-sans">
                      Aguardando alertas de início de rota e telemetria...
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-3 pt-2 w-full text-center border-t border-slate-100 text-[10px] text-slate-450 uppercase tracking-widest font-mono">
              SECURE REGIONAL DATA ACCESS ONLY
            </div>
          </div>
        </div>

        {/* Dynamic Center Stage Area (8 columns right side) */}
        <div className="lg:col-span-8 flex flex-col h-full min-h-[460px]">
          
          {activeTab === 'map' ? (
            // Tab 1: GIS Regional Dashboard Monitor
            <div className="flex flex-col flex-1 h-full min-h-[420px]">
              
              {/* Performance Summary Dashboard Widget */}
              <div id="performance-summary-widget" className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 border border-slate-800 text-white rounded-2xl p-4 md:p-5 mb-4 shadow-xl relative overflow-hidden">
                {/* Background accent glow */}
                <div className="absolute right-0 top-0 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-4 select-none relative z-10">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="p-1 px-2.5 bg-blue-500/10 text-blue-400 text-[9px] rounded-full uppercase tracking-widest font-bold border border-blue-500/25 font-mono">Painel de Performance</span>
                      <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">• Região {region}</span>
                    </div>
                    <h3 className="font-sans font-bold text-base md:text-lg text-slate-100 tracking-tight mt-1 flex items-center gap-2">
                      <TrendingUp className="w-4.5 h-4.5 text-blue-400" />
                      Performance Summary
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Database Setup Button */}
                    <button
                      type="button"
                      onClick={() => setIsSupabaseHelpOpen(true)}
                      className="px-3.5 py-1.5 bg-indigo-600/95 hover:bg-indigo-650 text-[10.5px] font-extrabold text-blue-100 rounded-xl transition-all flex items-center gap-1.5 border border-indigo-500/30 cursor-pointer shadow-md shadow-indigo-950/40 uppercase tracking-wider active:scale-95"
                    >
                      <Settings className="w-3.5 h-3.5 text-indigo-300 animate-spin-slow" />
                      <span>Configurar Supabase</span>
                    </button>

                    {/* Geolocation Simulation Toggle */}
                    <button
                      type="button"
                      onClick={() => setIsDemoSimulationActive?.(!isDemoSimulationActive)}
                      className={`px-3.5 py-1.5 text-[10.5px] font-extrabold rounded-xl transition-all flex items-center gap-1.5 border cursor-pointer uppercase tracking-wider active:scale-95 ${
                        isDemoSimulationActive 
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-emerald-50 border-emerald-500/30 shadow-md shadow-emerald-950/40' 
                          : 'bg-slate-850 hover:bg-slate-800 text-slate-350 border-slate-755'
                      }`}
                    >
                      <Compass className={`w-3.5 h-3.5 text-white ${isDemoSimulationActive ? 'animate-spin' : ''}`} />
                      <span>Simulador: {isDemoSimulationActive ? 'ATIVO' : 'OFF'}</span>
                    </button>

                    {/* CSV Export Button */}
                    <button
                      type="button"
                      onClick={() => exportToCSV(regionalPerformance, `performance_summary_${region}.csv`)}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-[10.5px] font-extrabold text-white rounded-xl transition-all flex items-center gap-1.5 shadow-md shadow-blue-950/40 border border-blue-500/30 cursor-pointer uppercase tracking-wider active:scale-95"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-200" />
                      <span>Exportar CSV</span>
                    </button>
                  </div>
                </div>

                {/* Metrics and Chart Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 relative z-10">
                  
                  {/* Left Column: Core KPIs */}
                  <div className="lg:col-span-4 flex flex-col justify-between gap-3 font-sans">
                    <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl flex items-center justify-between shadow-xs">
                      <div>
                        <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider font-mono">Taxa de Sucesso Comercial</span>
                        <h4 className="text-xl md:text-2xl font-black text-slate-100">{
                          regionalPerformance.reduce((acc, p) => acc + (p.plannedStopsCount || 0), 0) > 0
                            ? Math.round((regionalPerformance.reduce((acc, p) => acc + (p.completedStopsCount || 0), 0) / regionalPerformance.reduce((acc, p) => acc + (p.plannedStopsCount || 0), 0)) * 100)
                            : 100
                        }%</h4>
                        <p className="text-[9px] text-slate-450 mt-0.5 leading-tight">Entregas concluídas vs. agendadas.</p>
                      </div>
                      <div className="p-2 py-1.5 bg-slate-850 border border-slate-800 rounded-lg text-emerald-400 font-bold text-xs uppercase font-mono shadow-inner">
                        {regionalPerformance.reduce((acc, p) => acc + (p.completedStopsCount || 0), 0)} paradas
                      </div>
                    </div>

                    <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl flex items-center justify-between shadow-xs">
                      <div>
                        <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider font-mono">Eficiência Média da Frota</span>
                        <h4 className="text-xl md:text-2xl font-black text-slate-100">{
                          regionalPerformance.length > 0 
                            ? Math.round(regionalPerformance.reduce((acc, p) => acc + Math.min(100, Math.round(((p.plannedDistanceKm || 50) / Math.max(1, p.actualDistanceKm || 50)) * 100)), 0) / regionalPerformance.length)
                            : 88
                        }%</h4>
                        <p className="text-[9px] text-slate-450 mt-0.5 leading-tight">Kms planejados vs. desvios percorridos.</p>
                      </div>
                      <div className="p-2 py-1.5 bg-slate-850 border border-slate-800 rounded-lg text-blue-400 font-bold text-xs uppercase font-mono shadow-inner">
                        {statsSummary.totalKm} kms
                      </div>
                    </div>

                    <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl flex items-center justify-between shadow-xs">
                      <div>
                        <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider font-mono">Alertas e Desvios de Rota</span>
                        <h4 className="text-xl md:text-2xl font-black text-amber-500">{statsSummary.totalDeviations} <span className="text-xs text-slate-450 font-normal">ocorrências</span></h4>
                        <p className="text-[9px] text-slate-450 mt-0.5 leading-tight">Telemetria detectou desvios em tempo real.</p>
                      </div>
                      <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-lg">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  {/* Right Column: High Fidelity Recharts Chart */}
                  <div className="lg:col-span-8 bg-slate-900/40 border border-slate-800 p-3 rounded-xl min-h-[160px] flex flex-col justify-between">
                    <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider block font-mono border-b border-slate-800 pb-1.5 mb-1.5">Eficiência por Rota Ativa/Finalizada (%)</span>
                    
                    <div className="w-full h-[120px] text-xs font-mono">
                      {regionalPerformance.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-slate-500 text-xs italic">
                          Nenhum dado de frete na região para preencher o gráfico.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={regionalPerformance.map(p => {
                              const planned = p.plannedDistanceKm || 50;
                              const actual = p.actualDistanceKm || 50;
                              const efficiency = Math.min(100, Math.round((planned / Math.max(1, actual)) * 100));
                              const stopsRatio = p.plannedStopsCount > 0 
                                ? Math.round((p.completedStopsCount / p.plannedStopsCount) * 100) 
                                : 100;
                              return {
                                name: p.routeName.replace('Rota ', 'R-'),
                                'Eficiência %': efficiency,
                                'Sucesso %': stopsRatio,
                              };
                            })}
                            margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
                          >
                            <defs>
                              <linearGradient id="colorEff" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                              </linearGradient>
                              <linearGradient id="colorSuc" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <XAxis dataKey="name" stroke="#64748b" fontSize={9} tickLine={false} />
                            <YAxis stroke="#64748b" fontSize={9} tickLine={false} domain={[0, 100]} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#f8fafc', fontSize: '10.5px' }}
                              labelStyle={{ fontWeight: 'bold', color: '#94a3b8' }}
                            />
                            <Area type="monotone" dataKey="Eficiência %" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorEff)" />
                            <Area type="monotone" dataKey="Sucesso %" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorSuc)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Supabase Technical Setup Helper Modal panel */}
              <AnimatePresence>
                {isSupabaseHelpOpen && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto select-text font-sans"
                  >
                    <motion.div 
                      initial={{ scale: 0.95, y: 15 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0.95, y: 15 }}
                      className="bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl w-full max-w-4xl p-6 shadow-2xl relative flex flex-col max-h-[85vh] overflow-hidden"
                    >
                      <button 
                        type="button"
                        onClick={() => setIsSupabaseHelpOpen(false)}
                        className="absolute top-5 right-5 p-2 bg-slate-850 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>

                      <div className="flex items-center gap-2.5 mb-3 border-b border-slate-800 pb-3">
                        <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
                          <Settings className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-extrabold text-slate-100 uppercase tracking-tight">Supabase Setup Guide & DDL Bootstrap</h3>
                          <p className="text-[11px] text-slate-400 mt-0.5">Siga os passos abaixo para transferir o RouteLog de Offline Sandbox para seu banco PostgreSQL dedicado em segundos.</p>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto pr-1 space-y-4 text-xs leading-relaxed text-slate-300">
                        <div>
                          <h4 className="font-extrabold text-[11px] text-indigo-400 uppercase tracking-wider font-mono mb-1.5 flex items-center gap-1.5">
                            <span className="w-5 h-5 bg-indigo-500/10 text-indigo-400 text-[10px] rounded-full flex items-center justify-center font-mono">1</span>
                            Configurar arquivo local .env
                          </h4>
                          <p className="mb-2">Copie e cole as chaves da API do cliente Supabase e declare-as no seu arquivo <code className="bg-slate-950 p-1 rounded border border-slate-850 font-mono text-pink-400 text-[10.5px]">.env</code> no diretório raiz do projeto:</p>
                          <pre className="bg-slate-950 p-3 rounded-2xl border border-slate-850 font-mono text-[11px] text-amber-300 overflow-x-auto whitespace-pre">VITE_SUPABASE_URL=https://seu-projeto.supabase.co&#10;VITE_SUPABASE_ANON_KEY=seu_anon_token_copiado_do_painel</pre>
                        </div>

                        <div>
                          <h4 className="font-extrabold text-[11px] text-indigo-400 uppercase tracking-wider font-mono mb-1.5 flex items-center gap-1.5">
                            <span className="w-5 h-5 bg-indigo-500/10 text-indigo-400 text-[10px] rounded-full flex items-center justify-center font-mono">2</span>
                            Criar Tabelas no Banco PostgreSQL do Supabase
                          </h4>
                          <p className="mb-2">Navegue até a seção <strong>SQL Editor</strong> do painel do seu projeto Supabase, crie um novo script de consulta (New query), cole o SQL DDL fornecido abaixo e clique em <strong>Run</strong>:</p>
                          
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(SUPABASE_SQL_DDL);
                                alert('SQL Script copiado para a Área de Transferência!');
                              }}
                              className="absolute right-3 top-3 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-lg text-[9px] transition-all uppercase tracking-wider cursor-pointer"
                            >
                              Copiar Código SQL
                            </button>
                            <pre className="bg-slate-950 p-3.5 pt-10 rounded-2xl border border-slate-850 font-mono text-[10px] text-emerald-300 overflow-x-auto max-h-[180px] overflow-y-auto whitespace-pre leading-normal select-all">
                              {SUPABASE_SQL_DDL}
                            </pre>
                          </div>
                        </div>

                        <div className="bg-slate-950/40 border border-slate-800 p-3 rounded-xl">
                          <h4 className="font-extrabold text-[11px] text-indigo-400 uppercase tracking-wider font-mono mb-1">🔥 Por que este design é robusto?</h4>
                          <p className="text-[11px] text-slate-400">O RouteLog adota um modelo híbrido com controle offline inteligente. Na ausência de chaves de ambiente, ele salva dados no ReactiveLocalStorage e atualiza seu monitor em tempo real sem interrupções. No momento em que você preenche o seu arquivo <code className="bg-slate-950 px-1 rounded font-mono text-pink-400">.env</code> com dados do Supabase, o sistema migra automaticamente para o banco PostgreSQL online e canais de sincronização real-time!</p>
                        </div>
                      </div>

                      <div className="border-t border-slate-800 pt-3.5 mt-3 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 font-mono">RouteLog Enterprise Database Module</span>
                        <button
                          type="button"
                          onClick={() => setIsSupabaseHelpOpen(false)}
                          className="px-5 py-2 bg-slate-800 hover:bg-slate-750 text-white font-extrabold rounded-xl transition-all cursor-pointer text-xs uppercase"
                        >
                          Fechar
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center justify-between mb-3 select-none">
                <span className="text-[11px] font-bold text-slate-500 uppercase font-mono">Modo de Exibição do Monitor:</span>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    onClick={() => setMapMode('vector')}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                      mapMode === 'vector' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Mapa Vetorial
                  </button>
                  <button
                    onClick={() => setMapMode('google')}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                      mapMode === 'google' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Google Maps Platform
                  </button>
                </div>
              </div>

              <div className="flex-1">
                {mapMode === 'vector' ? (
                  <RegionalMap 
                    rotas={rotas}
                    locations={locations}
                    region={region}
                    breadcrumbs={breadcrumbs}
                  />
                ) : (
                  <RouteMap 
                    rotas={rotas}
                    locations={locations}
                    currentUserRegion={region}
                    currentUserRole={user.role}
                    breadcrumbs={breadcrumbs}
                    regions={regions}
                  />
                )}
              </div>
            </div>
          ) : activeTab === 'push_config' ? (
            // Tab 4: FCM Segmented Push Manager panel
            <div className="bg-white border border-slate-205 rounded-2xl p-6 shadow-md flex flex-col flex-grow">
              
              <div className="mb-4 pb-3 border-b border-slate-150">
                <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                  <Bell className="w-4.5 h-4.5 text-rose-500 shrink-0" />
                  Painel de Segmentação de Notificações Push
                </h3>
                <p className="text-xs text-slate-400 mt-1 font-sans">Conecte-se aos SDKs do Firebase ou envie mensagens segmentadas por perfil corporativo e delimitadores geográficos.</p>
              </div>

              {/* Form parameters */}
              <form onSubmit={handleDispatchPush} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Template de Evento:</label>
                  <select 
                    value={pushTemplate}
                    onChange={e => handleTemplateChange(e.target.value as any)}
                    className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50 text-[11px] font-medium"
                  >
                    <option value="nova_rota">Nova Rota Atribuída 📦</option>
                    <option value="rota_iniciada">Rota Iniciada 🚚</option>
                    <option value="status_parada">Atualização de Parada ✅</option>
                    <option value="urgente_chat">Mensagem Urgente Chat ⚠️</option>
                    <option value="custom">Outros / Customizado 📢</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Segmentação por Perfil de Usuário:</label>
                  <select 
                    value={pushRole}
                    onChange={e => setPushRole(e.target.value as any)}
                    className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50 text-[11px] font-medium"
                  >
                    <option value="all">TODOS OS PERFIS</option>
                    <option value={UserRole.MOTORISTA}>Somente Motoristas (Drivers)</option>
                    <option value={UserRole.VENDEDOR}>Somente Vendedores (Vendors)</option>
                    <option value={UserRole.GERENTE}>Somente Gerentes Regionais (Managers)</option>
                    <option value={UserRole.ADMIN}>Somente Administradores</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Delimitação de Área:</label>
                  <select 
                    value={pushRegion}
                    onChange={e => setPushRegion(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50 text-[11px] font-medium"
                  >
                    <option value={region}>Somente minha região ({region})</option>
                    <option value="all">Sincronização global / Broadcast Geral</option>
                  </select>
                </div>

                <div className="md:col-span-2 flex flex-col">
                  <label className="block font-bold text-slate-700 mb-1">Título da Mensagem:</label>
                  <input 
                    type="text" 
                    value={pushTitle} 
                    onChange={e => setPushTitle(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50 font-medium text-[11px]"
                    placeholder="Ex: Alerta de trânsito..."
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Conteúdo do Push (Body):</label>
                  <textarea 
                    value={pushBody} 
                    onChange={e => setPushBody(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50 h-20 text-[11px]"
                    placeholder="Conteúdo descritivo que será exibido no popover do celular..."
                  />
                </div>

                <div className="md:col-span-2">
                  <button 
                    type="submit"
                    className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 px-4 rounded-xl transition-all shadow-md shadow-rose-100 flex items-center justify-center gap-1.5 cursor-pointer text-xs"
                  >
                    <Bell className="w-4 h-4 animate-bounce shrink-0" />
                    Enviar Notificação de Canal Segmentado (Firebase Mock)
                  </button>
                </div>
              </form>

              {/* History push log container in this manager's scope */}
              <div className="mt-5 border-t border-slate-150 pt-4 flex-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2 font-mono">Logs de Envio de Push (Auditados)</span>
                
                <div className="space-y-2 max-h-[140px] overflow-y-auto text-[11px] font-mono leading-relaxed">
                  {regionalPushLogs.map(log => {
                    const parsedTime = new Date(log.timestamp).toLocaleTimeString('pt-BR');
                    return (
                      <div key={log.id} className="p-2 border border-slate-200 rounded-lg bg-slate-50 flex items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-1 font-sans">
                            <span className="font-bold text-slate-800">{log.title}</span>
                            <span className="font-mono text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded font-bold border border-indigo-100">
                              {log.type.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-slate-500 mt-0.5 text-[10px] truncate max-w-[280px] font-sans leading-relaxed">{log.body}</p>
                        </div>

                        <div className="text-right font-mono text-[9px] text-slate-400 shrink-0 uppercase">
                          <span className="text-indigo-600 font-bold block">{log.sentCount} disparos</span>
                          <span>às {parsedTime}</span>
                        </div>
                      </div>
                    );
                  })}
                  {regionalPushLogs.length === 0 && (
                    <p className="text-center py-6 text-slate-400 text-xs font-sans">Nenhum histórico de push registrado nesta sessão.</p>
                  )}
                </div>
              </div>

            </div>
          ) : activeTab === 'analytics' ? (
            // Tab 5: Desempenho e BI dashboards with Recharts
            <div className="bg-white border border-slate-205 rounded-2xl p-6 shadow-md flex flex-col flex-grow space-y-5 font-sans">
              
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2 font-sans">
                    <BarChart3 className="w-4.5 h-4.5 text-indigo-700 shrink-0" />
                    Módulo de Análise e Auditoria de Logística (BI)
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Visão analítica regional de tempos por parada, distâncias percorridas e desvios de rota planejados.</p>
                </div>
                
                <div className="text-right hidden sm:block">
                  <span className="text-[9px] font-mono text-slate-400 block uppercase">FROTA COLETADA</span>
                  <span className="text-xs font-bold text-slate-700">{regionalPerformance.length} rotas mapeadas</span>
                </div>
              </div>

              {/* High-fidelity Recharts visual boards */}
              {regionalPerformance.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Graph A: planned vs actual distance comparison */}
                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                      <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider mb-2 font-mono">
                        CONFRONTAÇÃO QUILOMÉTRICA (Previsto vs Realizado)
                      </span>
                      <div className="h-44 text-[10px] font-mono">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={distanceChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="name" stroke="#64748b" />
                            <YAxis stroke="#64748b" unit="km" />
                            <Tooltip />
                            <Legend wrapperStyle={{ fontSize: 9 }} />
                            <Bar dataKey="Distância Prevista (km)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Distância Realizada (km)" fill="#10b981" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Graph B: times per stop & desvios bar chart */}
                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                      <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider mb-2 font-mono">
                        DESVIOS DETECTADOS & TEMPO MÉDIO DE PARADA
                      </span>
                      <div className="h-44 text-[10px] font-mono">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={deviationChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="name" stroke="#64748b" />
                            <YAxis stroke="#64748b" />
                            <Tooltip />
                            <Legend wrapperStyle={{ fontSize: 9 }} />
                            <Area type="monotone" dataKey="Média Minutos/Parada" stroke="#a855f7" fill="#f3e8ff" />
                            <Area type="monotone" dataKey="Desvios Detectados" stroke="#ef4444" fill="#fee2e2" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Operational Telemetry Tables displaying departure/arrival timestamps */}
                  <div className="border border-slate-200/85 rounded-xl overflow-hidden text-xs font-sans">
                    <div className="bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2.5 border-b border-slate-200 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-700">Registros de Tempo Reais (Telemetry)</span>
                        <span className="font-mono text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-tight">TIMESTAMPS AUDITED</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => exportToCSV(regionalPerformance, `desempenho_rotas_gerente_${region}.csv`)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[10px] font-bold rounded-lg transition-all shadow-sm cursor-pointer"
                        >
                          <Download className="w-3 h-3 text-slate-500" />
                          Exportar CSV
                        </button>
                        <button
                          type="button"
                          onClick={() => exportToPDF(regionalPerformance, `Relatório de Auditoria Logística - Região: ${region}`)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[10px] font-bold rounded-lg transition-all shadow-sm cursor-pointer"
                        >
                          <Printer className="w-3 h-3 text-slate-500" />
                          Relatório PDF
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto max-h-[160px] overflow-y-auto">
                      <table className="w-full text-left font-sans text-[11px] text-slate-605">
                        <thead className="bg-slate-100 text-slate-600 font-semibold sticky top-0 uppercase text-[9px] tracking-wider border-b border-slate-200 font-mono">
                          <tr>
                            <th className="p-2">Início da Viagem</th>
                            <th className="p-2">Motorista / Placa</th>
                            <th className="p-2 text-center">Fim / Conclusão</th>
                            <th className="p-2 text-right font-mono">Paradas</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150">
                          {regionalPerformance.map(log => {
                            const startTime = new Date(log.startTimestamp).toLocaleTimeString('pt-BR');
                            const endTime = log.endTimestamp ? new Date(log.endTimestamp).toLocaleTimeString('pt-BR') : 'Em Trânsito 🚚';
                            return (
                              <React.Fragment key={log.id}>
                                <tr className="hover:bg-slate-50 transition-colors font-medium">
                                  <td className="p-2 font-mono text-indigo-600 font-bold">{startTime} ({log.region})</td>
                                  <td className="p-2 text-slate-800">{log.driverName} <span className="font-mono text-[10px] text-slate-400">[{log.driverPlate}]</span></td>
                                  <td className="p-2 text-center text-slate-500 font-mono">{endTime}</td>
                                  <td className="p-2 text-right font-bold font-mono text-emerald-600">{log.completedStopsCount} / {log.plannedStopsCount}</td>
                                </tr>
                                {log.stopTelemetry && log.stopTelemetry.length > 0 && (
                                  <tr>
                                    <td colSpan={4} className="bg-slate-50 p-2.5 border-b border-slate-200/50">
                                      <div className="text-[10px] text-slate-500 space-y-1">
                                        <p className="font-bold text-slate-600 uppercase tracking-wide">Linha de Tempo das Paradas:</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                          {log.stopTelemetry.map((t, idx) => (
                                            <div key={t.stopId} className="bg-white rounded p-1.5 border border-slate-200 leading-normal font-mono text-[9px] shadow-sm">
                                              <span className="text-indigo-600 font-bold">#{idx + 1} {t.clientName}</span>: Chegou: <span className="text-slate-800 font-bold">{new Date(t.arrivalTimestamp).toLocaleTimeString()}</span> | Partiu: <span className="text-slate-800 font-bold">{new Date(t.departureTimestamp).toLocaleTimeString()}</span> | Permanência: <strong className="text-emerald-600">{t.timeSpentMinutes} min</strong>
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
                  <strong className="text-xs text-slate-605 block font-bold">Nenhum Dado Mapeado por Satélite</strong>
                  <p className="text-[11px] text-slate-400 max-w-sm mt-1 mx-auto leading-relaxed font-sans text-slate-450">
                    Ainda não há medições operacionais de viagens ativas iniciadas na região de <strong className="text-slate-500 font-medium">{region}</strong> nesta sessão para gerar relatórios de desempenho.
                  </p>
                </div>
              )}

            </div>
          ) : activeTab === 'clientes' ? (
            // Tab 6: Clientes route planner design
            <div className="bg-white border border-slate-205 rounded-2xl p-6 shadow-md flex flex-col flex-grow space-y-6 font-sans">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3.5">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-805 flex items-center gap-2 font-sans">
                    <Users className="w-4.5 h-4.5 text-indigo-700 shrink-0" />
                    Central Operacional de Clientes & Logística Reversa
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 font-sans">Cadastre clientes recorrentes, carregue planilhas regionalizadas, gerencie coordenadas e despache itinerários otimizados de transporte.</p>
                </div>
                
                <span className="text-[9px] font-mono text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100 font-bold uppercase shrink-0">
                  {region}-CLIENT-MANAGER
                </span>
              </div>

              {/* Horizontal Subtabs Switcher */}
              <div className="flex gap-4 border-b border-slate-150 pb-px select-none">
                <button
                  type="button"
                  onClick={() => setClientSubTab('database')}
                  className={`pb-2.5 font-extrabold text-xs uppercase tracking-wider transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                    clientSubTab === 'database'
                      ? 'border-indigo-600 text-indigo-700 font-black'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  📂 Banco de Dados de Clientes ({clients.filter(c => c.region === region).length})
                </button>
                <button
                  type="button"
                  onClick={() => setClientSubTab('planner')}
                  className={`pb-2.5 font-extrabold text-xs uppercase tracking-wider transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                    clientSubTab === 'planner'
                      ? 'border-indigo-600 text-indigo-700 font-black'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  🚚 Criar e Despachar Rota
                  {gStops.length > 0 && (
                    <span className="bg-indigo-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">
                      {gStops.length}
                    </span>
                  )}
                </button>
              </div>

              {clientSubTab === 'database' ? (
                <ClienteManager
                  region={region}
                  clients={clients}
                  onSaveClient={onSaveClient}
                  onDeleteClient={onDeleteClient}
                  onAddSelectedToRoute={(selectedClients) => {
                    const newStops: Parada[] = selectedClients.map((c, index) => ({
                      id: `p_stop_db_${Date.now()}_${index}`,
                      clientName: c.name,
                      clientWhatsApp: c.whatsApp,
                      address: c.address,
                      lat: c.lat,
                      lng: c.lng,
                      status: 'pending',
                      region: c.region
                    }));
                    setGStops(newStops);
                    setClientSubTab('planner');
                  }}
                  setIsImporterOpen={setIsImporterOpen}
                  gOriginLat={gOriginLat}
                  gOriginLng={gOriginLng}
                />
              ) : (
                /* ==============================================================
                   SUBTAB 2: ORIGINAL PLANNER CONTAINER WITH SECTIONS A + B
                   ============================================================== */
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start font-sans">
                {/* Section A: Creator/Editor card form (xl:col-span-5) */}
                <div className="xl:col-span-5 space-y-5">
                  
                  {/* Card A1: Basic Route Settings */}
                  <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-205 pb-2">
                      <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5 font-mono">
                        <span className="w-4.5 h-4.5 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-black">1</span>
                        {gEditingRouteId ? '📝 Editar Cabeçalho' : '📦 Informações da Rota'}
                      </span>
                      {gEditingRouteId && (
                        <button 
                          onClick={() => {
                            setGEditingRouteId(null);
                            setGRouteName('Rota Corporativa ' + new Date().toLocaleDateString('pt-BR'));
                            setGOrigin('CD Central ' + region + ' - BR-116, Km 410');
                            setGSelectedDriverId('');
                            setGStops([]);
                          }}
                          className="text-rose-600 hover:text-rose-800 hover:underline font-bold text-[10px] transition-colors"
                        >
                          Cancelar Edição
                        </button>
                      )}
                    </div>

                    <div className="space-y-3 px-0.5">
                      <div>
                        <label className="block text-slate-450 font-semibold mb-1 uppercase text-[8px] tracking-wider">Identificação da Rota</label>
                        <input 
                          type="text" 
                          value={gRouteName}
                          onChange={e => setGRouteName(e.target.value)}
                          placeholder="EX: Rota Expressa Centro"
                          className="w-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-xl p-2.5 bg-white text-slate-805 text-xs font-medium shadow-sm transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-450 font-semibold mb-1 uppercase text-[8px] tracking-wider">Origem / Centro de Distribuição</label>
                        <input 
                          type="text" 
                          value={gOrigin}
                          onChange={e => {
                            setGOrigin(e.target.value);
                            gGeocodeAddress(e.target.value, true);
                          }}
                          onBlur={e => gGeocodeAddress(e.target.value, true)}
                          className="w-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-xl p-2.5 bg-white text-slate-805 text-xs font-medium shadow-sm transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-450 font-semibold mb-1 uppercase text-[8px] tracking-wider font-sans">Condutor Regional Designado</label>
                        <select
                          value={gSelectedDriverId}
                          onChange={e => setGSelectedDriverId(e.target.value)}
                          className="w-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-xl p-2.5 bg-white text-slate-805 text-xs font-semibold shadow-sm cursor-pointer transition-all"
                        >
                          <option value="">Selecione um motorista escalado...</option>
                          {regionalDrivers.map(drv => (
                            <option key={drv.id} value={drv.id}>
                              👤 {drv.name} ({(drv as any).plate || 'Sem Placa'})
                            </option>
                          ))}
                        </select>
                        {regionalDrivers.length === 0 && (
                          <span className="text-[10px] text-amber-600 block mt-1 font-bold bg-amber-50 p-2.5 border border-amber-200 rounded-lg animate-pulse">
                            ⚠️ Nenhum motorista disponível na região {region}.
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card A2: Stops Builder & List */}
                  <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
                    <div className="flex items-center gap-1.5 border-b border-slate-205 pb-2">
                      <span className="w-4.5 h-4.5 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-black">2</span>
                      <span className="font-extrabold text-slate-805 text-xs uppercase tracking-wider font-mono">
                        Clientes & Itinerário
                      </span>
                    </div>

                    {/* Presets load helper */}
                    <div className="space-y-1.5 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                      <span className="text-[9px] text-indigo-800 font-bold block uppercase tracking-wider">📦 Endereços de Clientes Recorrentes:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {GUARIBA_LOCATIONS.map((loc, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => gAddPresetStop(idx)}
                            className="bg-white hover:bg-indigo-650 hover:text-white text-indigo-700 font-bold text-[10px] px-2.5 py-1 rounded-lg border border-indigo-200/50 shadow-sm transition-all cursor-pointer flex items-center gap-1"
                          >
                            <span>📍</span> {loc.name.split(' ')[0]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-slate-455 font-bold uppercase text-[8px] tracking-wider mb-1">Dados Complementares do Cliente</label>
                        <div className="grid grid-cols-2 gap-2">
                          <input 
                            type="text" 
                            placeholder="Nome do Cliente"
                            value={gClientName}
                            onChange={e => setGClientName(e.target.value)}
                            className="border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-550 focus:outline-none bg-white text-slate-850"
                          />
                          <input 
                            type="tel" 
                            placeholder="WhatsApp (ex: 55319...)"
                            value={gClientWhatsApp}
                            onChange={e => setGClientWhatsApp(e.target.value)}
                            className="border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-550 focus:outline-none bg-white text-slate-850"
                          />
                        </div>
                      </div>

                      <div className="relative font-sans">
                        <label className="block text-slate-455 font-bold uppercase text-[8px] tracking-wider mb-1">Endereço de Entrega</label>
                        <input 
                          type="text" 
                          placeholder="Digite o endereço completo do cliente"
                          value={gClientAddress}
                          onChange={e => {
                            setGClientAddress(e.target.value);
                            setGIsValidated(false);
                            gFetchAddressPredictions(e.target.value);
                          }}
                          className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-medium focus:ring-2 focus:ring-indigo-550 focus:outline-none bg-white text-slate-850"
                        />
                        {gAddressPredictions.length > 0 && (
                          <div className="absolute z-10 w-full bg-white border border-slate-200 rounded-xl shadow-xl mt-1 max-h-36 overflow-y-auto leading-tight font-sans">
                            {gAddressPredictions.map((pred, pIdx) => (
                              <button
                                key={pIdx}
                                type="button"
                                onClick={() => gHandleSelectPrediction(pred.description, pred.placeId)}
                                className="w-full text-left p-2.5 hover:bg-slate-50 border-b border-slate-100 text-[11px] font-sans truncate font-medium text-slate-705"
                              >
                                🗺️ {pred.description}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={gHandleAddStop}
                        className="w-full py-2 bg-white hover:bg-slate-200 border border-slate-300 text-slate-700 font-extrabold rounded-xl text-center cursor-pointer transition-all active:scale-[0.98] text-[11px] shadow-sm flex items-center justify-center gap-1"
                      >
                        ➕ Incluir Cliente na Rota
                      </button>
                    </div>

                    {/* Stops List Planned styled as a logistics vertical sequence */}
                    <div className="space-y-2 pt-2 border-t border-slate-200/80">
                      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Sequência Planilhada de Paradas ({gStops.length})</span>
                      
                      <div className="space-y-2 bg-white p-3 rounded-xl border border-slate-200 max-h-[220px] overflow-y-auto">
                        {gStops.length > 0 && (
                          <div className="relative pl-4 space-y-3.5">
                            {/* Vertical dashed line */}
                            <div className="absolute left-[7px] top-[14px] bottom-[14px] w-0.5 bg-dashed border-l border-indigo-200"></div>

                            {gStops.map((st, idx) => (
                              <div key={st.id} className="relative flex items-start justify-between gap-2.5 text-[11.5px]">
                                {/* Timeline badge */}
                                <div className="absolute left-[-17px] top-0.5 w-3.5 h-3.5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[8px] font-bold z-10 border border-indigo-200 animate-[pulse_2s_infinite]">
                                  {idx + 1}
                                </div>

                                <div className="min-w-0 pr-1 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <strong className="text-slate-850 font-bold truncate block text-xs">{st.clientName}</strong>
                                    {st.phone && (
                                      <span className="text-[9px] font-mono text-indigo-705 bg-indigo-50 border border-indigo-100/50 px-1 rounded font-bold uppercase scale-90">
                                        WhatsApp
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-450 truncate font-mono mt-0.5">{st.address}</p>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => moveStopUp(idx)}
                                    disabled={idx === 0}
                                    title="Subir Parada"
                                    className="text-slate-400 hover:text-indigo-600 disabled:opacity-30 p-1 rounded transition-all cursor-pointer active:scale-90 font-mono text-[10px]"
                                  >
                                    ▲
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moveStopDown(idx)}
                                    disabled={idx === gStops.length - 1}
                                    title="Descer Parada"
                                    className="text-slate-400 hover:text-indigo-600 disabled:opacity-30 p-1 rounded transition-all cursor-pointer active:scale-90 font-mono text-[10px]"
                                  >
                                    ▼
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setGStops(prev => prev.filter(item => item.id !== st.id))}
                                    title="Remover ponto de carga"
                                    className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-all cursor-pointer shrink-0 active:scale-90 font-sans"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {gStops.length === 0 && (
                          <div className="text-center py-6 text-slate-400 font-medium">
                            <p className="text-[11px]">Nenhum ponto planilhado para esta viagem.</p>
                            <p className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wide">Selecione presets acima para carregamento imediato</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Compile & Despatch Route Buttons */}
                    <div className="flex gap-2 pt-2 border-t border-slate-200/60">
                      <button
                        type="button"
                        onClick={() => {
                          if (gStops.length === 0) {
                            alert('Adicione pelo menos 1 parada.');
                            return;
                          }
                          if (!gSelectedDriverId) {
                            alert('Selecione um motorista escalado para receber a rota.');
                            return;
                          }

                          const driverObj = regionalDrivers.find(d => d.id === gSelectedDriverId);
                          if (!driverObj) return;

                          if (gEditingRouteId) {
                            // Update existing route
                            onUpdateRoute(gEditingRouteId, {
                              name: gRouteName,
                              origin: gOrigin,
                              stops: gStops,
                              driverId: driverObj.id,
                              driverName: driverObj.name,
                              driverPlate: (driverObj as any).plate || 'RTL-1234'
                            });
                            setGEditingRouteId(null);
                            alert('Alterações no itinerário gravadas e sincronizadas!');
                          } else {
                            // Create new route
                            onCreateRoute({
                              name: gRouteName,
                              origin: gOrigin,
                              originLat: gOriginLat,
                              originLng: gOriginLng,
                              stops: gStops,
                              driverId: driverObj.id,
                              driverName: driverObj.name,
                              driverPlate: (driverObj as any).plate || 'RTL-1234',
                              region: region,
                              optimized: true,
                              sentByGerente: true
                            });

                            // Send push alerts to driver automatically
                            onSendPush(
                              'nova_rota', 
                              UserRole.MOTORISTA, 
                              region, 
                              'Nova Rota Atribuída 📦', 
                              `Olá ${driverObj.name}: O gestor operacional inseriu a rota "${gRouteName}" com ${gStops.length} paradas na sua aba Rota REC.`
                            );
                            alert(`Sucesso! Rota despachada e notificação enviada no celular de ${driverObj.name}!`);
                          }

                          // Reset Creator
                          setGRouteName('Rota Corporativa ' + new Date().toLocaleDateString('pt-BR'));
                          setGOrigin('CD Central ' + region + ' - Av. dos Camaras,513, Santo Antonio, cariacica-ES');
                          setGSelectedDriverId('');
                          setGStops([]);
                        }}
                        className="flex-1 py-3 bg-gradient-to-r from-[#10b981] to-[#047857] hover:from-emerald-600 hover:to-emerald-805 text-white rounded-xl font-bold transition-all shadow-md cursor-pointer text-xs uppercase"
                      >
                        {gEditingRouteId ? 'Salvar Edição 📝' : 'Despachar Rota 📦'}
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          if (gStops.length <= 1) {
                            alert('Por favor insira ao menos duas paradas para rodar o otimizador.');
                            return;
                          }
                          try {
                            const sortedStops = await onOptimize(gStops, gOriginLat, gOriginLng);
                            setGStops(sortedStops);
                            alert('Itinerário otimizado com sucesso via API do Google (optimizeWaypoints:true)!');
                          } catch (err: any) {
                            alert('Falha na otimização: ' + err.message);
                          }
                        }}
                        className="py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all text-xs cursor-pointer flex gap-1 items-center"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse fill-amber-300" />
                        Otimizar
                      </button>
                    </div>
                  </div>
                </div>

                {/* Section B: Regional Assigned Routes List (xl:col-span-7) */}
                <div className="xl:col-span-7 bg-slate-50 border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b pb-2.5">
                    <div>
                      <span className="font-extrabold text-slate-800 text-xs block uppercase tracking-wider font-mono">
                        Acompanhamento Regional de Cargas
                      </span>
                      <p className="text-[10px] text-slate-400 mt-0.5">Controlador de fluxo operacional regional para a região {region}</p>
                    </div>
                    <span className="bg-slate-200 text-slate-700 border border-slate-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full font-mono">
                      {filteredRegionalRoutes.length} Itinerários
                    </span>
                  </div>

                  {/* Inline quick filters inside Section B */}
                  <div className="grid grid-cols-3 gap-2 bg-white p-2 text-xs rounded-xl border border-slate-200 shadow-xs">
                    <div>
                      <select
                        value={filterRouteStatus}
                        onChange={(e) => setFilterRouteStatus(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-150 text-slate-705 text-[10px] p-1.5 rounded-lg outline-none font-bold"
                      >
                        <option value="all">Status: Todos</option>
                        <option value="draft">Draft</option>
                        <option value="active">Em Viagem</option>
                        <option value="completed">Concluída</option>
                      </select>
                    </div>
                    <div>
                      <select
                        value={filterRouteDriver}
                        onChange={(e) => setFilterRouteDriver(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-150 text-slate-705 text-[10px] p-1.5 rounded-lg outline-none font-bold truncate"
                      >
                        <option value="all">Condutor: Todos</option>
                        {regionalDrivers.map(drv => (
                          <option key={drv.id} value={drv.id}>{drv.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <select
                        value={filterRouteDate}
                        onChange={(e) => setFilterRouteDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-150 text-slate-705 text-[10px] p-1.5 rounded-lg outline-none font-bold"
                      >
                        <option value="all">Período: Todos</option>
                        <option value="today">Hoje</option>
                        <option value="week">Esta semana</option>
                        <option value="month">Este mês</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-4 max-h-[660px] overflow-y-auto pr-1">
                    {filteredRegionalRoutes.map(item => {
                      const completedStopsCount = item.stops.filter(s => s.status === 'completed').length;
                      const totalStopsCount = item.stops.length;
                      const percentCompleted = totalStopsCount > 0 ? Math.round((completedStopsCount / totalStopsCount) * 100) : 0;

                      return (
                        <div key={item.id} className="p-4 border border-slate-200/95 bg-white rounded-2xl shadow-sm space-y-4 select-text hover:border-slate-350 transition-all duration-300">
                          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2.5">
                            <div>
                              <strong className="text-slate-900 text-sm font-extrabold">{item.name}</strong>
                              <p className="text-[11px] text-slate-450 font-medium mt-0.5 flex items-center gap-1 flex-wrap">
                                <span>Condutor:</span>
                                <span className="text-indigo-650 font-extrabold">{item.driverName}</span> 
                                <span className="font-mono text-[9px] bg-indigo-50 border border-indigo-100 px-1.5 py-0.2 rounded font-bold">[{item.driverPlate}]</span>
                              </p>
                            </div>

                            <div className="flex flex-col text-right shrink-0">
                              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                item.status === 'active' ? 'bg-amber-100 text-amber-805 border border-amber-200' :
                                item.status === 'completed' ? 'bg-emerald-100 text-emerald-805 border border-emerald-250' : 'bg-slate-100 text-slate-500'
                              }`}>
                                {item.status === 'active' ? 'Em Viagem 🚚' : item.status === 'completed' ? 'Concluída ✅' : 'Rascunho'}
                              </span>
                              <span className="text-[8px] text-slate-400 font-mono mt-0.5">Criada às {new Date(item.createdAt).toLocaleTimeString('pt-BR')}</span>
                            </div>
                          </div>

                          {/* Efficiency progress bar */}
                          <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-150 shadow-inner">
                            <div className="flex justify-between items-center text-[9px] font-mono font-black text-slate-500">
                              <span>ENTREGAS CONCLUÍDAS</span>
                              <span className="text-indigo-600">{percentCompleted}% ({completedStopsCount}/{totalStopsCount})</span>
                            </div>
                            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden border border-slate-200/50">
                              <div 
                                className="bg-gradient-to-r from-indigo-550 to-emerald-500 h-full transition-all duration-500" 
                                style={{ width: `${percentCompleted}%` }}
                              ></div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 px-1 leading-snug font-sans">
                            <p className="truncate">📍 <strong className="text-slate-700 font-bold">Origem:</strong> {item.origin}</p>
                            <p>🎯 <strong className="text-slate-700 font-bold">Paradas:</strong> {item.stops.length} Clientes</p>
                          </div>

                          {/* Detailed stops layout with color coded checks */}
                          <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-200/50 leading-normal space-y-2">
                            <span className="text-[9px] font-mono text-slate-400 font-bold uppercase tracking-wider block">Manifesto Detalhado das Encomendas:</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-sans">
                              {item.stops.map((stop, sIdx) => {
                                const isDone = stop.status === 'completed';
                                return (
                                  <div key={stop.id} className={`p-2 bg-white border rounded-xl text-[10.5px] shadow-sm leading-tight flex justify-between gap-1 items-center hover:bg-slate-50 transition-colors ${isDone ? 'border-emerald-100 bg-emerald-50/10' : 'border-slate-200'}`}>
                                    <span className="truncate pr-1">
                                      <span className="font-mono text-[9px] text-slate-400 font-bold mr-1">#{sIdx + 1}</span>
                                      <strong className="text-slate-700 font-bold">{stop.clientName}</strong>
                                    </span>
                                    <span className={`text-[9px] uppercase font-bold shrink-0 px-1.5 py-0.5 rounded font-mono ${isDone ? 'text-emerald-700 bg-emerald-50 border border-emerald-100' : 'text-slate-500 bg-slate-100'}`}>
                                      {isDone ? 'Concluído' : 'Pendente'}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="flex gap-2 items-center pt-2.5 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => {
                                setGEditingRouteId(item.id);
                                setGRouteName(item.name);
                                setGOrigin(item.origin);
                                setGSelectedDriverId(item.driverId);
                                setGStops(item.stops);
                                // Auto scroll to editor top on mobile
                                document.getElementById('gerente-main-panel')?.scrollIntoView({ behavior: 'smooth' });
                              }}
                              className="flex-1 py-2 px-3 border border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white font-extrabold rounded-xl transition-all hover:border-transparent cursor-pointer text-[11px] text-center shadow-sm"
                            >
                              Editar Itinerário
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Confirmar exclusão permanente da rota "${item.name}"?`)) {
                                  onDeleteRoute(item.id);
                                }
                              }}
                              className="py-2 px-3 border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-250 rounded-xl bg-white hover:bg-rose-50 transition-all cursor-pointer active:scale-90 flex items-center justify-center shrink-0 shadow-sm"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {filteredRegionalRoutes.length === 0 && (
                      <div className="text-center py-16 border rounded-2xl border-dashed bg-slate-50/50">
                        <Truck className="w-9 h-9 text-slate-350 mx-auto mb-2 animate-bounce" />
                        <span className="text-xs font-bold text-slate-500 block">Nenhuma Rota Disponível com estes Filtros</span>
                        <p className="text-[11px] text-slate-400 mt-0.5">Nenhuma rota regional atendeu aos parâmetros aplicados nos filtros operacionais.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              )}

              {/* FULL-SCREEN SECURE CLIENT IMPORTER MODAL */}
              {isImporterOpen && (
                <div id="client-importer-modal-v3" className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[99999] overflow-y-auto leading-normal">
                  <div className="bg-white rounded-3xl border border-slate-250 shadow-2xl w-full max-w-5xl overflow-hidden animate-in fade-in zoom-in duration-200">
                    {/* Modal Header */}
                    <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between select-none">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                        <div>
                          <h3 className="font-extrabold text-[12px] uppercase tracking-wider font-mono">
                            Importador e Validador de Endereços
                          </h3>
                          <p className="text-[10px] text-slate-400">Canal regional de carga: <span className="text-white font-bold uppercase">{region}</span></p>
                        </div>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => setIsImporterOpen(false)}
                        className="bg-slate-800 hover:bg-slate-705 p-2 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer active:scale-90"
                      >
                        <X className="w-4 h-4 text-slate-400 font-bold" />
                      </button>
                    </div>

                    <div className="p-2 text-slate-800 max-h-[85vh] overflow-y-auto">
                      <ClientImporter 
                        currentRegion={region}
                        onImportStops={(stops) => {
                          if (clientSubTab === 'database') {
                            stops.forEach(st => {
                              if (onSaveClient) {
                                onSaveClient({
                                  id: st.id || `cli_imp_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
                                  name: st.clientName,
                                  whatsApp: (st as any).clientWhatsApp || (st as any).phone || '5533991234567',
                                  address: st.address,
                                  lat: st.lat,
                                  lng: st.lng,
                                  region: region,
                                  createdAt: new Date().toISOString()
                                });
                              }
                            });
                            alert(`Excelente! Sincronização operacional realizada. ${stops.length} clientes foram adicionados ao seu Banco de Dados!`);
                          } else {
                            setGStops(prev => {
                              const prevIds = new Set(prev.map(p => p.id));
                              const filteredNewStops = stops.filter(s => !prevIds.has(s.id));
                              return [...prev, ...filteredNewStops];
                            });
                          }
                          setIsImporterOpen(false); // Cleanly dismiss
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

            </div>
          ) : (
            // Tabs 2 & 3: Standard active route lists or simple lists fallback
            <div className="flex flex-col h-full min-h-[420px] bg-white border border-slate-200 rounded-2xl p-4 shadow-md font-sans">
              <div className="flex-1 min-h-[355px]">
                <InteractiveMap 
                  rota={activeRoute} 
                  driverLocation={activeRoute ? locations[activeRoute.driverId] || null : null}
                  region={region}
                />
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}

// ==========================================
// 3. MOTORISTA VIEW
// ==========================================
interface MotoristaProps {
  user: RouteUser;
  rotas: Rota[];
  chats: ChatMessage[];
  locations: { [drvId: string]: GPSLocation };
  performanceLogs: RoutePerformanceLog[];
  onCreateRoute: (data: Partial<Rota>) => Rota | undefined;
  onUpdateRoute: (id: string, data: Partial<Rota>) => void;
  onDeleteRoute: (id: string) => void;
  onStartRoute: (id: string) => void;
  onPostMessage: (text: string, audioUrl?: string) => void;
  onOptimize: (stops: Parada[], oLat: number, oLng: number) => Promise<Parada[]>;
}

export const GUARIBA_LOCATIONS = [
  { name: 'Mercantil São Francisco', address: 'Rua Benjamin Constant, 120 - Centro', lat: -18.848, lng: -41.954 },
  { name: 'Supermercado Central', address: 'Av. Brasil, 4200 - Centro', lat: -18.855, lng: -41.942 },
  { name: 'Padaria Princesa', address: 'Rua Sete de Setembro, 320 - Esplanada', lat: -18.862, lng: -41.948 },
  { name: 'Drogaria do Povo', address: 'Rua Israel pinheiro, 1500 - Shopping', lat: -18.850, lng: -41.946 },
  { name: 'Mercearia Popular', address: 'Av. JK, 1100 - Vila Isa', lat: -18.882, lng: -41.972 }
];

export function MotoristaDashboard({ user, rotas, chats, locations, performanceLogs, onCreateRoute, onUpdateRoute, onDeleteRoute, onStartRoute, onPostMessage, onOptimize }: MotoristaProps) {
  const [activeTab, setActiveTab] = useState<'nova' | 'salvas' | 'chat' | 'rotarec' | 'resumos' | 'ativa'>('nova');
  const [mapMode, setMapMode] = useState<'vector' | 'google'>('vector');
  const [mobileFocus, setMobileFocus] = useState<'actions' | 'map'>('actions');
  
  // Signature Drawing canvas states for customer verification
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  // Clear digital signature
  const handleClearSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Draw elegant slate-200 help guideline
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(15, canvas.height - 35);
        ctx.lineTo(canvas.width - 15, canvas.height - 35);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    setHasSigned(false);
  };

  // Convert coordinate spaces of click / touch events to relative canvas layout dimensions
  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  const handleStartDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoords(e, canvas);
    ctx.strokeStyle = '#0f172a'; // slate-900 high contrast ink ink
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
    setHasSigned(true);
  };

  const handleDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoords(e, canvas);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const handleStopDrawing = () => {
    setIsDrawing(false);
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Route editing states
  const [mEditingRouteId, setMEditingRouteId] = useState<string | null>(null);
  const [mEditingRouteName, setMEditingRouteName] = useState('');
  const [mEditingRouteOrigin, setMEditingRouteOrigin] = useState('');
  const [mEditingRouteStops, setMEditingRouteStops] = useState<Parada[]>([]);
  const [mEditClientName, setMEditClientName] = useState('');
  const [mEditClientWhatsApp, setMEditClientWhatsApp] = useState('');
  const [mEditClientAddress, setMEditClientAddress] = useState('');
  
  // Create state for Stop fields inside Nova Rota
  const [routeName, setRouteName] = useState('Super Entrega ' + new Date().toLocaleDateString('pt-BR'));
  const [origin, setOrigin] = useState('CD Central ' + (user as any).region + ' - Av. dos Camaras, 513, Santo Antonio, Cariacica-ES');
  const [originLat, setOriginLat] = useState(-20.302534);
  const [originLng, setOriginLng] = useState(-40.401630);

  // Stop Form State
  const [stops, setStops] = useState<Parada[]>([]);
  const [clientName, setClientName] = useState('');
  const [clientWhatsApp, setClientWhatsApp] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [customLat, setCustomLat] = useState<number>(-20.302534);
  const [customLng, setCustomLng] = useState<number>(-40.401630);

  const [chatText, setChatText] = useState('');
  const [selectedCompletedRouteId, setSelectedCompletedRouteId] = useState<string | null>(null);
  
  // Connection / GPS status state & Gemini AI Loader
  const [connectionStatus, setConnectionStatus] = useState<'stable' | 'unstable'>('stable');
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  const region = (user as any).region || 'GV1';
  const myRoutes = rotas.filter(r => r.driverId === user.id);
  const myCreatedRoutes = rotas.filter(r => r.driverId === user.id && !r.sentByGerente);
  const myReceivedRoutes = rotas.filter(r => r.driverId === user.id && r.sentByGerente === true);
  const myCompletedRoutes = myRoutes.filter(r => r.status === 'completed');
  const activeRoute = myRoutes.find(r => r.status === 'active') || null;

  const [isSharingLocation, setIsSharingLocation] = useState(true);

  // Synchronize dynamic redirect tab
  useEffect(() => {
    if (activeRoute) {
      setActiveTab('ativa');
    }
  }, [activeRoute?.id]);

  // Guidelines reset on stop transition
  useEffect(() => {
    if (activeTab === 'ativa') {
      setTimeout(() => {
        handleClearSignature();
      }, 150);
    }
  }, [activeTab, activeRoute?.currentStopIndex]);

  // Delivery confirmation action
  const handleConfirmDelivery = async (routeId: string, stopId: string) => {
    if (!hasSigned) {
      alert('Por favor, solicite a assinatura digital do cliente na tela do dispositivo.');
      return;
    }
    if (!capturedPhoto) {
      alert('Por favor, faça a fotoconferência da mercadoria entregue para anexar como comprovante.');
      return;
    }

    const canvas = signatureCanvasRef.current;
    let signatureBase64 = '';
    if (canvas) {
      signatureBase64 = canvas.toDataURL('image/png');
    }

    const currentStop = activeRoute?.stops[activeRoute.currentStopIndex];
    if (!currentStop) return;

    const payload = {
      routeId,
      stopId,
      signatureUrl: signatureBase64,
      photoUrl: capturedPhoto,
      completedAt: new Date().toISOString()
    };

    // If signal status is configured unstable OR navigator is offline, trigger SW Queue
    if (connectionStatus === 'unstable' || !navigator.onLine) {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'QUEUE_DELIVERY_CONFIRMATION',
          payload
        });
      } else {
        console.warn('Service worker controller not active. Storing local simulation.');
      }

      // Optimistic local update so driver can progress
      const updatedStops = [...activeRoute.stops];
      const stopIndex = updatedStops.findIndex(s => s.id === stopId);
      if (stopIndex !== -1) {
        updatedStops[stopIndex] = {
          ...updatedStops[stopIndex],
          status: 'completed' as const,
          signatureUrl: signatureBase64,
          photoUrl: capturedPhoto,
          completedAt: payload.completedAt
        };

        const nextIndex = activeRoute.currentStopIndex + 1;
        const isRouteFinished = nextIndex >= updatedStops.length;
        const updatedStatus = isRouteFinished ? 'completed' : 'active';

        onUpdateRoute(routeId, {
          stops: updatedStops,
          currentStopIndex: nextIndex,
          status: updatedStatus
        });

        alert('Conexão instável! Entrega armazenada com segurança na fila de upload offline (Service Worker). Envio ocorrerá automaticamente quando reestabelecer conexão.');
      }
    } else {
      // Direct Online Write
      const updatedStops = [...activeRoute.stops];
      const stopIndex = updatedStops.findIndex(s => s.id === stopId);
      if (stopIndex !== -1) {
        updatedStops[stopIndex] = {
          ...updatedStops[stopIndex],
          status: 'completed' as const,
          signatureUrl: signatureBase64,
          photoUrl: capturedPhoto,
          completedAt: payload.completedAt
        };

        const nextIndex = activeRoute.currentStopIndex + 1;
        const isRouteFinished = nextIndex >= updatedStops.length;
        const updatedStatus = isRouteFinished ? 'completed' : 'active';

        try {
          await onUpdateRoute(routeId, {
            stops: updatedStops,
            currentStopIndex: nextIndex,
            status: updatedStatus
          });
          alert('Entrega confirmada com sucesso! Comprovantes sincronizados em tempo real.');
        } catch (err: any) {
          console.warn('Erro ao salvar online, tentando queuing em segundo plano:', err);
          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: 'QUEUE_DELIVERY_CONFIRMATION',
              payload
            });
          }
          alert('Sua assinatura e foto foram guardadas offline por segurança e serão enviadas quando a rede normalizar.');
        }
      }
    }

    setCapturedPhoto(null);
    setHasSigned(false);
  };

  // Background Geolocation simulator or real GPS tracker
  useEffect(() => {
    if (!isSharingLocation || !activeRoute) return;

    let watchId: number | null = null;
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const speed = position.coords.speed !== null ? Math.round(position.coords.speed * 3.6) : (45 + Math.floor(Math.random() * 10)); // convert to km/h or simulated
          const heading = position.coords.heading !== null ? position.coords.heading : Math.floor(Math.random() * 360);
          
          const nextLoc: GPSLocation = {
            driverId: user.id,
            lat,
            lng,
            heading,
            speed,
            lastUpdated: new Date().toISOString(),
            isSharing: true
          };
          
          try {
            await saveCloudGPSLocation(nextLoc);
          } catch (err) {
            console.warn("Failed to write real GPS background position to Firestore:", err);
          }
        },
        (error) => {
          console.log("Background Geoloc real position failed or permission blocked. Utilizing simulated auto-progression fallback.", error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [isSharingLocation, activeRoute?.id, user.id]);

  const handleSuggestAIPrediction = async () => {
    setIsLoadingAI(true);
    try {
      const response = await fetch('/api/gemini/suggest-stops', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          driverName: user.name,
          region,
          previousRoutes: myRoutes,
          presets: GUARIBA_LOCATIONS,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Erro na API');
      }

      const data = await response.json();
      if (data && data.stops) {
        setRouteName(data.routeName || ('Sugestão Inteligente ' + new Date().toLocaleDateString('pt-BR')));
        
        const loadedStops: Parada[] = data.stops.map((s: any, sIdx: number) => ({
          id: `p_stop_ia_${Date.now()}_${sIdx}`,
          clientName: s.clientName,
          clientWhatsApp: s.clientWhatsApp || '5533991234567',
          address: s.address,
          lat: s.lat,
          lng: s.lng,
          status: 'pending' as const
        }));

        setStops(loadedStops);
        alert(`O Gemini AI analisou seu histórico de ${myRoutes.length} rotas anteriores e encontrou padrões! ${loadedStops.length} paradas recorrentes foram sugeridas com sucesso.`);
      }
    } catch (err: any) {
      console.error('Erro na previsão Gemini:', err);
      alert('Não foi possível obter a sugestão com o Gemini AI: ' + err.message);
    } finally {
      setIsLoadingAI(false);
    }
  };

  // Google Places Autocomplete API connection and validation states
  const [addressPredictions, setAddressPredictions] = useState<{ description: string; placeId: string }[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isValidated, setIsValidated] = useState(false);

  const fetchAddressPredictions = (inputStr: string) => {
    if (!inputStr || inputStr.trim().length < 3) {
      setAddressPredictions([]);
      return;
    }

    if (typeof window !== 'undefined' && (window as any).google && (window as any).google.maps && (window as any).google.maps.places) {
      try {
        const service = new (window as any).google.maps.places.AutocompleteService();
        service.getPlacePredictions(
          { input: inputStr, componentRestrictions: { country: 'br' } },
          (predictions: any, status: any) => {
            if (status === 'OK' && predictions) {
              setAddressPredictions(
                predictions.map((p: any) => ({
                  description: p.description,
                  placeId: p.place_id,
                }))
              );
            } else {
              setAddressPredictions([]);
            }
          }
        );
      } catch (e) {
        console.warn('Autocomplete service failed:', e);
      }
    }
  };

  const handleSelectPrediction = (address: string, placeId: string) => {
    setClientAddress(address);
    setAddressPredictions([]);
    setIsValidated(true);

    if (typeof window !== 'undefined' && (window as any).google && (window as any).google.maps) {
      try {
        const geocoder = new (window as any).google.maps.Geocoder();
        geocoder.geocode({ placeId: placeId }, (results: any, status: any) => {
          if (status === 'OK' && results && results[0]) {
            const loc = results[0].geometry.location;
            setCustomLat(loc.lat());
            setCustomLng(loc.lng());
            console.log(`[Google Autocomplete Places] Set coordinates for ${address} to:`, loc.lat(), loc.lng());
          }
        });
      } catch (err) {
        console.warn('Geocoding by placeId failed, fallback to standard geocodeAddress:', err);
        geocodeAddress(address, false);
      }
    } else {
      geocodeAddress(address, false);
    }
  };

  // Add random realistic coordinate matching standard regional ranges
  const addPresetStop = (idx: number) => {
    const preset = GUARIBA_LOCATIONS[idx % GUARIBA_LOCATIONS.length];
    setClientName(preset.name);
    setClientAddress(preset.address);
    setCustomLat(preset.lat);
    setCustomLng(preset.lng);
    setClientWhatsApp('553399' + Math.floor(1000000 + Math.random() * 9000000));
    setIsValidated(true);
  };

  const handleAddStop = async () => {
    if (!clientName || !clientAddress) {
      alert('Favor preencher o Nome do Cliente e Endereço Completo.');
      return;
    }

    // Camada de validação com Google Places Autocomplete API
    if (typeof window !== 'undefined' && (window as any).google && (window as any).google.maps && (window as any).google.maps.places) {
      setIsValidating(true);
      try {
        const service = new (window as any).google.maps.places.AutocompleteService();
        const predictions: any = await new Promise((resolve) => {
          service.getPlacePredictions(
            { input: clientAddress, componentRestrictions: { country: 'br' } },
            (results: any, status: any) => {
              resolve(status === 'OK' ? results : null);
            }
          );
        });

        if (!predictions || predictions.length === 0) {
          alert(`⚠️ Endereço Inválido: Não encontramos correspondências na Google Places API para "${clientAddress}". Por favor, informe ou selecione um endereço válido para evitar erros de roteamento.`);
          setIsValidating(false);
          return;
        }

        // Se o usuário digitou sem clicar, valida e geocodifica o primeiro resultado aproximado
        if (!isValidated && predictions[0]) {
          const matchedPref = predictions[0];
          setClientAddress(matchedPref.description);
          
          const geocoder = new (window as any).google.maps.Geocoder();
          await new Promise<void>((resolve) => {
            geocoder.geocode({ placeId: matchedPref.place_id }, (results: any, status: any) => {
              if (status === 'OK' && results && results[0]) {
                const loc = results[0].geometry.location;
                setCustomLat(loc.lat());
                setCustomLng(loc.lng());
              }
              resolve();
            });
          });
        }
      } catch (err) {
        console.warn('Google Places validation errored, continuing with fallbacks:', err);
      } finally {
        setIsValidating(false);
      }
    }

    const newStop: Parada = {
      id: `p_stop_${Date.now()}`,
      clientName,
      clientWhatsApp,
      address: clientAddress,
      lat: customLat,
      lng: customLng,
      status: 'pending'
    };

    setStops([...stops, newStop]);
    
    // reset form
    setClientName('');
    setClientWhatsApp('');
    setClientAddress('');
    setAddressPredictions([]);
    setIsValidated(false);
  };

  // Geocoder function to resolve typed address of Origin or Stops
  const geocodeAddress = (addressText: string, isOrigin: boolean) => {
    if (!addressText.trim()) return;

    // Check if google maps geocoder is available at runtime
    if (typeof window !== 'undefined' && (window as any).google && (window as any).google.maps) {
      try {
        const geocoder = new (window as any).google.maps.Geocoder();
        geocoder.geocode({ address: addressText }, (results: any, status: any) => {
          if (status === 'OK' && results && results[0]) {
            const loc = results[0].geometry.location;
            const lat = loc.lat();
            const lng = loc.lng();
            if (isOrigin) {
              setOriginLat(lat);
              setOriginLng(lng);
            } else {
              setCustomLat(lat);
              setCustomLng(lng);
            }
            console.log(`[Google Geocoder] Resolved "${addressText}" to ${lat}, ${lng}`);
          }
        });
        return;
      } catch (err) {
        console.warn('Google maps geocoder failed, returning to smart fallback:', err);
      }
    }

    // Fallback: Smart lexicographical parser based on Brazilian regions
    const text = addressText.toLowerCase();
    let lat = isOrigin ? -18.845 : -18.85;
    let lng = isOrigin ? -41.945 : -41.95;

    // If region of user is MG, default to Belo Horizonte center
    if (region === 'ES/MG') {
      lat = -19.928;
      lng = -43.937;
    }

    if (text.includes('vila isa')) {
      lat = -18.882; lng = -41.972;
    } else if (text.includes('shopping') || text.includes('israel pinheiro')) {
      lat = -18.850; lng = -41.946;
    } else if (text.includes('esplanada') || text.includes('sete de setembro')) {
      lat = -18.862; lng = -41.948;
    } else if (text.includes('benjamin constant')) {
      lat = -18.848; lng = -41.954;
    } else if (text.includes('brasil')) {
      lat = -18.855; lng = -41.942;
    } else if (text.includes('savassi')) {
      lat = -19.938; lng = -43.936;
    } else if (text.includes('lourdes')) {
      lat = -19.929; lng = -43.943;
    } else if (text.includes('pampulha')) {
      lat = -19.858; lng = -43.980;
    } else if (text.includes('centro') && region === 'ES/MG') {
      lat = -19.920; lng = -43.938;
    } else if (text.includes('jk') || text.includes('juscelino')) {
      lat = -18.875; lng = -41.965;
    } else {
      // Add a repeatable deterministic coordinate based on name length to ensure different custom names put distinct markers on map
      const hash = addressText.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const offsetLat = ((hash % 100) / 1000) * (region === 'ES/MG' ? 0.03 : 0.015);
      const offsetLng = (((hash >> 2) % 100) / 1000) * (region === 'ES/MG' ? 0.03 : 0.015);
      lat += (hash % 2 === 0 ? 1 : -1) * offsetLat;
      lng += (hash % 3 === 0 ? 1 : -1) * offsetLng;
    }

    if (isOrigin) {
      setOriginLat(lat);
      setOriginLng(lng);
    } else {
      setCustomLat(lat);
      setCustomLng(lng);
    }
  };

  const handleRunOptimization = async () => {
    if (stops.length <= 1) return;
    try {
      const sorted = await onOptimize(stops, originLat, originLng);
      setStops(sorted);
      alert('Rota Otimizada via Google Directions API (optimizeWaypoints:true)! Paradas foram reordenadas para sequência de trânsito otimizada.');
    } catch (err: any) {
      alert('Falha na otimização: ' + err.message);
    }
  };

  const handlePublishRoute = () => {
    if (stops.length === 0) {
      alert('Adicione pelo menos 1 parada para planejar sua jornada.');
      return;
    }

    onCreateRoute({
      name: routeName,
      origin,
      originLat,
      originLng,
      stops,
      optimized: true
    });

    // Clear draft
    setStops([]);
    setRouteName('Super Entrega ' + new Date().toLocaleDateString('pt-BR'));
    setActiveTab('salvas');
  };

  const handleSendChatText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatText.trim()) return;
    onPostMessage(chatText.trim());
    setChatText('');
  };

  return (
    <div id="driver-main-panel" className="grid grid-cols-1 lg:grid-cols-12 gap-5 select-none md:select-text">
      
      {/* Top Bar Connection Status & Driver QuickBar with shadow-md and rounded-2xl */}
      <div className="lg:col-span-12 bg-white border border-slate-200 rounded-2xl p-4 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold shrink-0">
            <Truck className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-800 text-sm leading-none uppercase tracking-tight">{user.name}</span>
              <span className="text-[10px] bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 rounded-full uppercase">
                {user.role === UserRole.MOTORISTA ? 'Motorista' : 'Vendedor'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Região: <strong className="text-slate-600 font-semibold">{region}</strong> | Placa: <strong className="text-slate-600 font-semibold">{(user as any).plate || 'RTL-1234'}</strong>
            </p>
          </div>
        </div>

        {/* Connection Status widget */}
        <div className="flex flex-wrap items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[11px] font-semibold select-none ${
            connectionStatus === 'stable'
              ? 'bg-emerald-50/50 border-emerald-100/60 text-emerald-700'
              : 'bg-amber-50/50 border-amber-100/60 text-amber-700 animate-pulse'
          }`}>
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                connectionStatus === 'stable' ? 'bg-emerald-400' : 'bg-amber-400'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                connectionStatus === 'stable' ? 'bg-emerald-500' : 'bg-amber-500'
              }`}></span>
            </span>
            <span className="font-mono">
              {connectionStatus === 'stable' 
                ? 'Conectado (GPS & Sincronia Ativos)' 
                : 'Sinal GPS instável (Sincronização pendente)'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setConnectionStatus(prev => prev === 'stable' ? 'unstable' : 'stable')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <Signal className="w-3.5 h-3.5 text-slate-500" />
            Alternar Sinal
          </button>

          <button
            type="button"
            onClick={async () => {
              const nextSharing = !isSharingLocation;
              setIsSharingLocation(nextSharing);
              
              // Publish the sharing state to Firestore immediately
              const currentLoc = locations[user.id] || {
                driverId: user.id,
                lat: activeRoute?.originLat || -18.845,
                lng: activeRoute?.originLng || -41.945,
                heading: 0,
                speed: 0,
                lastUpdated: new Date().toISOString()
              };
              
              const updatedLoc: GPSLocation = {
                ...currentLoc,
                isSharing: nextSharing,
                lastUpdated: new Date().toISOString()
              };
              
              try {
                await saveCloudGPSLocation(updatedLoc);
              } catch (err: any) {
                console.error("Erro ao alternar compartilhamento:", err);
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 border text-[10px] font-bold rounded-xl transition-all cursor-pointer shadow-sm active:scale-95 ${
              isSharingLocation 
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 shadow-sm' 
                : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
            }`}
          >
            <Compass className={`w-3.5 h-3.5 ${isSharingLocation ? 'animate-spin' : 'text-rose-500'}`} style={{ animationDuration: '4s' }} />
            {isSharingLocation ? 'Compartilhando Localização' : 'Compartilhar Localização'}
          </button>
        </div>
      </div>

      {/* Subtle warning when Connection is unstable */}
      {connectionStatus === 'unstable' && (
        <div className="lg:col-span-12 bg-amber-50/80 border border-amber-200/60 rounded-xl p-3 shadow-sm text-xs text-amber-950 flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <div className="flex-1">
            <strong>⚠️ Atenção Condutor:</strong> Sinal de GPS instável detectado! Os dados de rota e as alterações continuarão sendo salvas localmente e sincronizarão automaticamente assim que o sinal reestabelecer.
          </div>
        </div>
      )}

      {/* Responsive Focus Toggle for Mobile Displays */}
      <div className="lg:hidden col-span-1 flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-sm mb-1 select-none w-full gap-1">
        <button
          type="button"
          onClick={() => setMobileFocus('actions')}
          className={`flex-1 py-3 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
            mobileFocus === 'actions' ? 'bg-white text-indigo-900 shadow-sm border border-slate-200/40' : 'text-slate-550'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4 text-indigo-600 shrink-0" />
          Controles e Ações
        </button>
        <button
          type="button"
          onClick={() => setMobileFocus('map')}
          className={`flex-1 py-3 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
            mobileFocus === 'map' ? 'bg-white text-indigo-900 shadow-sm border border-slate-200/40' : 'text-slate-550'
          }`}
        >
          <Map className="w-4 h-4 text-emerald-600 shrink-0" />
          Ver no Mapa
        </button>
      </div>

      {/* Left Column Container */}
      <div className={`lg:col-span-4 space-y-4 w-full ${mobileFocus === 'actions' ? 'block' : 'hidden lg:block'}`}>
        {activeRoute && (
          <button
            type="button"
            onClick={() => setActiveTab('ativa')}
            className={`w-full p-4.5 rounded-2xl border flex items-center justify-between gap-3 text-left transition-all cursor-pointer shadow-md select-none ${
              activeTab === 'ativa'
                ? 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white border-emerald-700 shadow-emerald-200/50 scale-[1.01]'
                : 'bg-emerald-50/70 hover:bg-emerald-100 border-emerald-250/70 text-emerald-950 font-medium'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                activeTab === 'ativa' ? 'bg-white/20 text-white' : 'bg-emerald-600 text-white'
              }`}>
                <Truck className={`w-5 h-5 ${activeTab === 'ativa' ? '' : 'animate-bounce'}`} />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-bold block opacity-90 uppercase tracking-widest leading-none">Jornada Ativa</span>
                <strong className="text-xs font-black truncate block mt-1.5 leading-none">Confirmar Assinatura & Foto</strong>
              </div>
            </div>
            <div className="flex items-center gap-1 font-mono text-[9px] bg-emerald-700/30 text-emerald-100 px-2 py-1 rounded-lg shrink-0 border border-emerald-600/30 font-bold">
               <span>{activeRoute.currentStopIndex + 1}/{activeRoute.stops.length} Parada</span>
            </div>
          </button>
        )}

        <div className="grid grid-cols-5 gap-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/40">
          <button
            onClick={() => setActiveTab('nova')}
            className={`py-3 px-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer flex flex-col items-center justify-center gap-1 uppercase tracking-wider ${
              activeTab === 'nova' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Plus className="w-3.5 h-3.5 text-indigo-600" />
            Nova Rota
          </button>
          <button
            onClick={() => setActiveTab('salvas')}
            className={`py-3 px-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer flex flex-col items-center justify-center gap-1 uppercase tracking-wider ${
              activeTab === 'salvas' ? 'bg-white text-indigo-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Route className="w-3.5 h-3.5 text-indigo-600" />
            Rotas ({myCreatedRoutes.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rotarec')}
            className={`py-3 px-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer flex flex-col items-center justify-center gap-1 uppercase tracking-wider ${
              activeTab === 'rotarec' ? 'bg-white text-indigo-950 shadow-sm animate-pulse' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Truck className="w-3.5 h-3.5 text-emerald-600" />
            REC ({myReceivedRoutes.length})
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`py-3 px-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer flex flex-col items-center justify-center gap-1 uppercase tracking-wider ${
              activeTab === 'chat' ? 'bg-white text-indigo-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
            Suporte
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('resumos')}
            className={`py-3 px-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer flex flex-col items-center justify-center gap-1 uppercase tracking-wider ${
              activeTab === 'resumos' ? 'bg-white text-indigo-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            Resumos ({myCompletedRoutes.length})
          </button>
        </div>

        {/* TAB 1: NEW ROUTE PLANNING WIZARD */}
        {activeTab === 'nova' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-sm space-y-4 text-xs font-sans">
            <span className="font-extrabold text-slate-800 text-xs block uppercase tracking-wider">Elaborar Planejamento de Carga</span>

            <div className="space-y-3.5">
              <div>
                <label className="block text-slate-400 font-semibold mb-1 uppercase text-[9px]">Nome Identificador do Itinerário</label>
                <input
                  type="text"
                  value={routeName}
                  onChange={e => setRouteName(e.target.value)}
                  className="w-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-xl p-3 md:p-2 bg-white text-slate-800 text-[14px] md:text-xs font-sans font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1 uppercase text-[9px]">Origem / CD de Carregamento</label>
                <input
                  type="text"
                  value={origin}
                  onChange={e => {
                    setOrigin(e.target.value);
                    geocodeAddress(e.target.value, true);
                  }}
                  onBlur={e => geocodeAddress(e.target.value, true)}
                  className="w-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-xl p-3 md:p-2 bg-white text-slate-800 text-[14px] md:text-xs font-sans font-medium"
                />
              </div>

              {/* AI Gemini Suggestion Button */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleSuggestAIPrediction}
                  disabled={isLoadingAI}
                  className="w-full py-3 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 text-white font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md text-xs uppercase tracking-wider active:scale-95 animate-pulse"
                >
                  {isLoadingAI ? (
                    <span className="flex items-center gap-1.5 font-bold">
                      <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
                      Analisando com Gemini...
                    </span>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300 fill-amber-300 shrink-0" />
                      Sugerir Rota por IA (Gemini)
                    </>
                  )}
                </button>
              </div>

              {/* Stop addition manager */}
              <div className="p-3.5 border border-indigo-120/40 bg-indigo-50/15 rounded-2xl space-y-3">
                <span className="font-extrabold text-indigo-950 block text-[10px] uppercase tracking-wider">Planejar Paradas</span>
                
                {/* Autocomplete fast presets helper */}
                <div className="bg-white p-3 rounded-xl border border-indigo-100/40 shadow-sm space-y-1.5">
                  <span className="text-[9px] text-slate-400 block w-full font-mono font-bold uppercase tracking-wide">Preencher com Presets rápidos:</span>
                  <div className="flex flex-wrap gap-1.5 font-sans">
                    {GUARIBA_LOCATIONS.map((loc, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => addPresetStop(idx)}
                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-[10px] px-2.5 py-1.5 rounded-full transition-all cursor-pointer border border-indigo-100/40 active:scale-95"
                      >
                        {loc.name.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <input
                      type="text"
                      placeholder="Nome do Cliente"
                      value={clientName}
                      onChange={e => setClientName(e.target.value)}
                      className="w-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-xl p-3 md:p-2 bg-white text-slate-800 text-[14px] md:text-xs font-sans font-medium"
                    />
                  </div>
                  <div>
                    <input
                      type="tel"
                      pattern="[0-9]*"
                      placeholder="WhatsApp (ex: 5533...)"
                      value={clientWhatsApp}
                      onChange={e => setClientWhatsApp(e.target.value)}
                      className="w-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-xl p-3 md:p-2 bg-white text-slate-800 text-[14px] md:text-xs font-sans font-medium"
                    />
                  </div>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    placeholder="Endereço Completo em trânsito"
                    value={clientAddress}
                    onChange={e => {
                      setClientAddress(e.target.value);
                      setIsValidated(false);
                      fetchAddressPredictions(e.target.value);
                    }}
                    className={`w-full border focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-xl p-3 md:p-2 text-[14px] md:text-xs font-sans ${
                      isValidated 
                        ? 'border-emerald-500 bg-emerald-50/20 pr-8 text-emerald-950 font-semibold' 
                        : 'border-slate-200 bg-white'
                    }`}
                  />
                  {isValidating && (
                    <span className="absolute right-3 top-3.5 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                    </span>
                  )}
                  {isValidated && !isValidating && (
                    <span className="absolute right-3 top-2.5 text-emerald-600 font-black text-base select-none" title="Endereço Validado via Google Places">
                      ✓
                    </span>
                  )}

                  {addressPredictions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl max-h-[160px] overflow-y-auto z-50 divide-y divide-slate-100">
                      {addressPredictions.map((pred) => (
                        <button
                          key={pred.placeId}
                          type="button"
                          onClick={() => handleSelectPrediction(pred.description, pred.placeId)}
                          className="w-full text-left p-2.5 hover:bg-indigo-50 text-[11px] text-slate-700 font-semibold truncate shrink-0 cursor-pointer block transition-colors"
                        >
                          📍 {pred.description}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleAddStop}
                  disabled={!isValidated}
                  className={`w-full py-3 font-extrabold rounded-xl flex items-center justify-center gap-1.5 transition-all text-xs uppercase tracking-wider ${
                    isValidated 
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer active:scale-95 shadow-sm' 
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                  }`}
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  Confirmar Parada
                </button>
              </div>

              {/* Added stops listing */}
              {stops.length > 0 && (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1 font-mono font-bold uppercase tracking-wider">
                    <span>Paradas ({stops.length}):</span>
                    <button
                      type="button"
                      onClick={handleRunOptimization}
                      className="text-amber-600 hover:text-amber-805 font-bold flex items-center gap-1 cursor-pointer font-sans"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      Optimize (Google TSP)
                    </button>
                  </div>
                  {stops.map((st, sidx) => (
                    <div key={st.id} className="p-3 border border-slate-100 rounded-xl bg-slate-50/70 flex items-center justify-between text-[11px]">
                      <div className="min-w-0 flex-1 pr-2">
                        <strong className="text-slate-800 block truncate">{sidx + 1}. {st.clientName}</strong>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{st.address}</p>
                      </div>
                      <span className="text-[9px] font-mono font-bold text-indigo-650 bg-indigo-50 border border-indigo-100/50 rounded-md px-2 py-0.5 shrink-0 uppercase">
                        PEDIDO
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={handlePublishRoute}
                className="w-full py-3.5 bg-slate-900 border border-slate-950 hover:bg-slate-800 text-white font-black rounded-xl transition-all cursor-pointer shadow-lg transform active:scale-95 text-xs uppercase tracking-wider text-center"
              >
                Salvar e Publicar Rota
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: SAVED JOURNEYS LIST & ACTIVATE */}
        {activeTab === 'salvas' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-sm space-y-4 text-xs font-sans">
            <span className="font-extrabold text-slate-800 text-xs block uppercase tracking-wider">Minhas Rotas ({myCreatedRoutes.length})</span>

            <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1">
              {myCreatedRoutes.map(route => (
                <div key={route.id} className="p-4 border border-slate-200 rounded-2xl bg-slate-50/50 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-slate-800 font-extrabold truncate max-w-[150px] text-[13px]">{route.name}</strong>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase shrink-0 ${
                      route.status === 'active' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                      route.status === 'completed' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {route.status}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 line-clamp-1">🔍 Origem: <span className="font-medium text-slate-700">{route.origin}</span></p>
                  <p className="text-[11px] text-slate-500">🏁 Paradas: <strong className="text-indigo-600 font-extrabold">{route.stops.length} entregas agendadas</strong></p>

                  <div className="pt-2.5 border-t border-slate-200/60 flex items-center gap-2">
                    {route.status === 'draft' && (
                      <button
                        onClick={() => onStartRoute(route.id)}
                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all text-xs"
                      >
                        <Play className="w-4 h-4 fill-white" />
                        Iniciar Rota
                      </button>
                    )}

                    <button
                      onClick={() => onDeleteRoute(route.id)}
                      className="p-2.5 border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 rounded-xl bg-white hover:bg-rose-50 transition-all cursor-pointer active:scale-90"
                    >
                      <Trash2 className="w-4.5 h-4.5" />
                    </button>
                  </div>
                </div>
              ))}
              {myCreatedRoutes.length === 0 && (
                <div className="text-center py-12 text-slate-400 font-medium">Você não criou nenhuma rota ainda. Use a aba Nova Rota para começar.</div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: SUPPORT REGIONAL CHAT */}
        {activeTab === 'chat' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-sm flex flex-col h-[350px] text-xs font-sans">
            <span className="font-extrabold text-slate-800 border-b border-slate-100 pb-2.5 block mb-2 uppercase tracking-wider">Canal de Ajuda Regional</span>
            
            {/* Tooltip explicativo regional */}
            <div className="bg-amber-50/50 border border-amber-200/50 rounded-xl p-2.5 mb-2 flex items-start gap-1.5 text-[10px] text-amber-900 font-medium select-none shadow-xs">
              <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Visibilidade Restrita ({region}):</strong> Mensagens enviadas aqui só serão visíveis para gerentes e vendedores parceiros alocados nesta mesma região.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto py-2 space-y-3 pr-1">
              {chats.filter(c => c.region === region).map(c => (
                <div key={c.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-100 shadow-sm">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
                    <span className="font-extrabold text-indigo-700">{c.senderName}</span>
                    <span>{new Date(c.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed text-[11px] font-medium">{c.message}</p>
                  {c.audioUrl && (
                    <div className="mt-2 pt-2 border-t border-slate-200/40">
                      <AudioPlayer src={c.audioUrl} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <form onSubmit={handleSendChatText} className="flex gap-2 border-t border-slate-100 pt-3 bg-white mt-2 items-center font-sans">
              <input
                type="text"
                placeholder="Exemplo: Carga despachada com sucesso..."
                value={chatText}
                onChange={e => setChatText(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 p-3 bg-white text-[14px] md:text-xs h-11"
              />
              <AudioRecorderButton onSendAudio={(base64) => onPostMessage('🎙️ Nota de Áudio', base64)} />
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 rounded-xl w-11 h-11 text-white font-extrabold flex items-center justify-center cursor-pointer shrink-0 active:scale-95 transition-all shadow-sm">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* TAB 4: RECEIVED ROUTES FROM MANAGER (ROTA REC) */}
        {activeTab === 'rotarec' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-sm space-y-4 text-xs font-sans">
            <span className="font-extrabold text-slate-800 text-xs block uppercase tracking-wider">
              Rotas Recebidas / REC ({myReceivedRoutes.length})
            </span>

            {mEditingRouteId ? (
              // Inline edit interface for editing a received route
              <div className="space-y-4 border border-indigo-100 bg-indigo-50/20 p-4 rounded-xl">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="font-extrabold text-indigo-900 uppercase text-[10px]">Editar Rota Recebida</span>
                  <button 
                    onClick={() => setMEditingRouteId(null)}
                    className="text-slate-400 hover:text-slate-600 font-bold hover:bg-slate-100 p-1 rounded-md text-[10px]"
                  >
                    Cancelar
                  </button>
                </div>

                <div className="space-y-3 font-sans">
                  <div>
                    <label className="block text-[9px] text-slate-400 uppercase font-bold">Identificador</label>
                    <input 
                      type="text" 
                      value={mEditingRouteName}
                      onChange={e => setMEditingRouteName(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl p-2 bg-white text-xs font-medium focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] text-slate-400 uppercase font-bold">Origem</label>
                    <input 
                      type="text" 
                      value={mEditingRouteOrigin}
                      onChange={e => setMEditingRouteOrigin(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl p-2 bg-white text-xs font-medium focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Stops list inside editable mode wrapper */}
                  <div className="space-y-2">
                    <span className="block text-[9px] text-slate-400 uppercase font-bold">Pontos de Parada ({mEditingRouteStops.length})</span>
                    <div className="space-y-1.5 max-h-[120px] overflow-y-auto bg-white/60 p-2 rounded-lg border">
                      {mEditingRouteStops.map((st, sIdx) => (
                        <div key={st.id} className="flex items-center justify-between bg-white border p-2 rounded-lg gap-2">
                          <div className="truncate">
                            <p className="font-bold text-[11px] text-slate-800">{st.clientName}</p>
                            <p className="text-[9px] text-slate-400 truncate">{st.address}</p>
                          </div>
                          <button 
                            type="button"
                            onClick={() => setMEditingRouteStops(prev => prev.filter(item => item.id !== st.id))}
                            className="text-rose-500 hover:bg-rose-50 p-1 rounded transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      {mEditingRouteStops.length === 0 && (
                        <p className="text-center py-4 text-slate-400 text-[10px]">Sem clientes adicionados.</p>
                      )}
                    </div>
                  </div>

                  {/* Add a stop to editing route */}
                  <div className="p-2 border border-dashed rounded-xl space-y-2 bg-white/30">
                    <span className="block text-[9px] font-bold text-indigo-900 uppercase">Adicionar Nova Parada</span>
                    <div className="grid grid-cols-2 gap-1.5 font-sans">
                      <input 
                        type="text" 
                        placeholder="Nome do Cliente"
                        value={mEditClientName}
                        onChange={e => setMEditClientName(e.target.value)}
                        className="border border-slate-200 rounded-md p-1.5 bg-white text-[11px]"
                      />
                      <input 
                        type="tel" 
                        placeholder="WhatsApp"
                        value={mEditClientWhatsApp}
                        onChange={e => setMEditClientWhatsApp(e.target.value)}
                        className="border border-slate-200 rounded-md p-1.5 bg-white text-[11px]"
                      />
                    </div>
                    <div className="relative font-sans">
                      <input 
                        type="text" 
                        placeholder="Endereço Completo do Cliente"
                        value={mEditClientAddress}
                        onChange={e => setMEditClientAddress(e.target.value)}
                        className="w-full border border-slate-200 rounded-md p-1.5 bg-white text-[11px]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!mEditClientName || !mEditClientAddress) {
                          alert('Por favor preencha nome e endereço.');
                          return;
                        }
                        const newSt: Parada = {
                          id: `p_stop_edit_${Date.now()}`,
                          clientName: mEditClientName,
                          clientWhatsApp: mEditClientWhatsApp,
                          address: mEditClientAddress,
                          lat: -18.85 + (Math.random() - 0.5) * 0.05,
                          lng: -41.95 + (Math.random() - 0.5) * 0.05,
                          status: 'pending'
                        };
                        setMEditingRouteStops([...mEditingRouteStops, newSt]);
                        setMEditClientName('');
                        setMEditClientWhatsApp('');
                        setMEditClientAddress('');
                      }}
                      className="w-full py-1 text-[10px] bg-slate-100 border text-slate-700 hover:bg-slate-200 mt-1 cursor-pointer rounded-md font-bold text-center"
                    >
                      Adicionar Parada à Rota
                    </button>
                  </div>

                  <div className="flex gap-2 pt-2 border-t">
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateRoute(mEditingRouteId, {
                          name: mEditingRouteName,
                          origin: mEditingRouteOrigin,
                          stops: mEditingRouteStops
                        });
                        setMEditingRouteId(null);
                        alert('Alterações salvas com sucesso!');
                      }}
                      className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs cursor-pointer"
                    >
                      Salvar Alterações
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (mEditingRouteStops.length <= 1) {
                          alert('Necessita ao menos duas paradas para otimizar.');
                          return;
                        }
                        try {
                          const sorted = await onOptimize(mEditingRouteStops, -18.845, -41.945);
                          setMEditingRouteStops(sorted);
                          alert('Rota de edição otimizada via Google Directions API (optimizeWaypoints:true)!');
                        } catch (err: any) {
                          alert('Falha na otimização: ' + err.message);
                        }
                      }}
                      className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex gap-1 items-center cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                      Otimizar
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              // List view of received routes
              <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1">
                {myReceivedRoutes.map(route => (
                  <div key={route.id} className="p-4 border border-slate-200 rounded-2xl bg-emerald-50/25 border-l-4 border-l-emerald-500 space-y-3 shadow-md">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <strong className="text-slate-800 font-extrabold truncate max-w-[150px] text-[13px] block">
                          {route.name}
                        </strong>
                        <span className="text-[9px] text-slate-400 block font-mono">Recebida do Gerente Regional</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase shrink-0 ${
                        route.status === 'active' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                        route.status === 'completed' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                      }`}>
                        {route.status}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 line-clamp-1">🔍 Origem: <span className="font-medium text-slate-700">{route.origin}</span></p>
                    <div className="text-[11px] text-slate-500 mt-1">
                      <p className="font-bold text-slate-700 mb-1 uppercase text-[9px] tracking-wider">📋 Clientes / Paradas ({route.stops.length}):</p>
                      <div className="bg-white/80 rounded-xl p-2 border space-y-1 font-sans text-[10.5px] leading-relaxed">
                        {route.stops.map((st, idx) => (
                          <motion.div 
                            key={st.id} 
                            layout
                            initial={{ opacity: 0.9, scale: 0.98 }}
                            animate={{ 
                              opacity: 1, 
                              scale: 1,
                              backgroundColor: st.status === 'completed' ? '#ecfdf5' : st.status === 'Chegando' ? '#fffbeb' : '#ffffff',
                              color: st.status === 'completed' ? '#065f46' : st.status === 'Chegando' ? '#92400e' : '#334155'
                            }}
                            className="flex justify-between items-center px-2 py-1.5 rounded-lg border border-slate-100 gap-1"
                          >
                            <span className="truncate max-w-[140px] font-medium">#{idx + 1} {st.clientName}</span>
                            <span className={`font-mono font-black text-[9px] shrink-0 uppercase border px-1.5 py-0.5 rounded-full leading-none ${
                              st.status === 'completed' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                              st.status === 'Chegando' ? 'bg-amber-50 text-amber-800 border-amber-200 animate-pulse' : 'bg-slate-50 text-slate-500 border-slate-150'
                            }`}>
                              {st.status === 'completed' ? 'CONCLUÍDO ✓' : st.status === 'Chegando' ? 'CHEGANDO 🚚' : 'PENDENTE'}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-slate-200/60 flex items-center gap-2">
                      {route.status === 'draft' && (
                        <button
                          onClick={() => {
                            onStartRoute(route.id);
                            alert(`Rota "${route.name}" iniciada com sucesso! Você pode acompanhar o monitoramento de satélite.`);
                          }}
                          className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all text-xs"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          Iniciar Rota
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setMEditingRouteId(route.id);
                          setMEditingRouteName(route.name);
                          setMEditingRouteOrigin(route.origin);
                          setMEditingRouteStops(route.stops);
                        }}
                        className="py-1.5 px-3 border border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-xl font-bold transition-all hover:border-indigo-300 cursor-pointer text-xs"
                      >
                        Editar
                      </button>

                      <button
                        onClick={() => {
                          if (confirm('Deseja excluir esta rota recebida permanentemente?')) {
                            onDeleteRoute(route.id);
                          }
                        }}
                        className="p-1.5 border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 rounded-xl bg-white hover:bg-rose-50 transition-all cursor-pointer active:scale-90"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {myReceivedRoutes.length === 0 && (
                  <div className="text-center py-12 text-slate-400 font-medium">Nenhuma rota enviada pelo gerente regional no momento.</div>
                )}
              </div>
            )}

            {/* TAB 5: FINISHED ROUTE SUMMARY */}
            {activeTab === 'resumos' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-sm space-y-4 text-xs font-sans">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wider block">Resumo de Rotas Finalizadas</span>
                  <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full">
                    {myCompletedRoutes.length} Concluídas
                  </span>
                </div>

                {myCompletedRoutes.length > 0 ? (
                  (() => {
                    const activeCompletedRouteId = selectedCompletedRouteId || myCompletedRoutes[myCompletedRoutes.length - 1]?.id || null;
                    const activeCompletedRoute = myCompletedRoutes.find(r => r.id === activeCompletedRouteId) || myCompletedRoutes[myCompletedRoutes.length - 1];
                    const activePerformanceLog = performanceLogs.find(p => p.routeId === activeCompletedRoute?.id) || null;

                    // Telemetry & fallbacks
                    const dist = activePerformanceLog ? activePerformanceLog.actualDistanceKm : (activeCompletedRoute ? parseFloat((activeCompletedRoute.stops.length * 7.5 + 4.2).toFixed(1)) : 0);
                    const planDist = activePerformanceLog ? activePerformanceLog.plannedDistanceKm : parseFloat((dist * 0.95).toFixed(1));
                    const totalStops = activeCompletedRoute?.stops?.length || 0;
                    
                    let timeStr = "";
                    if (activePerformanceLog && activePerformanceLog.startTimestamp && activePerformanceLog.endTimestamp) {
                      const diffMs = new Date(activePerformanceLog.endTimestamp).getTime() - new Date(activePerformanceLog.startTimestamp).getTime();
                      const diffMins = Math.round(diffMs / 60000);
                      const hrs = Math.floor(diffMins / 60);
                      const mins = diffMins % 60;
                      timeStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
                    } else if (activeCompletedRoute) {
                      const mins = activeCompletedRoute.stops.length * 15 + 35;
                      const hrs = Math.floor(mins / 60);
                      const rem = mins % 60;
                      timeStr = `${hrs}h ${rem}m`;
                    }

                    return (
                      <div className="space-y-4">
                        {/* Selector of completed routes if more than 1 */}
                        {myCompletedRoutes.length > 1 && (
                          <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-xl flex items-center justify-between gap-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase font-mono shrink-0 font-sans">Selecionar Viagem:</label>
                            <select
                              value={activeCompletedRoute?.id || ''}
                              onChange={(e) => setSelectedCompletedRouteId(e.target.value)}
                              className="flex-1 bg-white border border-slate-200 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 font-medium font-sans"
                            >
                              {myCompletedRoutes.map(completed => (
                                <option key={completed.id} value={completed.id}>
                                  {completed.name} ({new Date().toLocaleDateString('pt-BR')})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Highly Polished Resumo Main Card */}
                        <div className="border border-emerald-100 bg-emerald-50/20 rounded-2xl p-4 space-y-4 shadow-sm">
                          <div className="flex items-center justify-between border-b border-emerald-110 pb-2">
                            <div>
                              <h4 className="font-extrabold text-slate-800 text-[13px]">{activeCompletedRoute?.name}</h4>
                              <span className="text-[10px] text-slate-400 block font-mono">
                                ID: #{activeCompletedRoute?.id.substring(activeCompletedRoute?.id.length - 8)}
                              </span>
                            </div>
                            <span className="px-2.5 py-1 bg-emerald-500 text-white text-[10px] font-black uppercase rounded-lg tracking-wider">
                              Concluída com Sucesso 🏆
                            </span>
                          </div>

                          {/* Bento grid of metrics */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white border border-slate-100 p-3 rounded-xl flex flex-col justify-between shadow-xs">
                              <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider font-mono">Distância Percorrida</span>
                              <div className="mt-1">
                                <span className="text-lg font-black text-slate-800 font-mono">{dist} km</span>
                                <span className="block text-[9px] text-slate-400 font-mono">Planejado: {planDist} km</span>
                              </div>
                            </div>

                            <div className="bg-white border border-slate-100 p-3 rounded-xl flex flex-col justify-between shadow-xs">
                              <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider font-mono">Tempo de Viagem</span>
                              <div className="mt-1">
                                <span className="text-lg font-black text-slate-800 font-mono">{timeStr}</span>
                                <span className="block text-[9px] text-emerald-600 font-bold uppercase tracking-wider font-mono flex items-center gap-0.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block"></span> Sem atrasos
                                </span>
                              </div>
                            </div>

                            <div className="bg-white border border-slate-100 p-3 rounded-xl col-span-2 flex items-center justify-between shadow-xs">
                              <div>
                                <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider font-mono block mb-1">Taxa de Conclusão</span>
                                <span className="text-xs font-black text-slate-700">
                                  {totalStops} de {totalStops} paradas atendidas
                                </span>
                              </div>
                              <div className="bg-emerald-500 shrink-0 text-white text-xs font-mono font-black h-9 w-9 rounded-full flex items-center justify-center border-2 border-white shadow-md">
                                100%
                              </div>
                            </div>
                          </div>

                          {/* Deviations Panel */}
                          <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-xl flex items-center justify-between text-[11px] font-mono">
                            <div className="flex items-center gap-1 text-slate-600">
                              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                              <span>Desvios Geográficos:</span>
                            </div>
                            <strong className="text-slate-800 font-extrabold">{activePerformanceLog?.routeDeviations || 0} desvios</strong>
                          </div>
                        </div>

                        {/* Timeline of successfully completed stops */}
                        <div className="space-y-3">
                          <span className="font-extrabold text-slate-700 text-[10px] uppercase font-mono block tracking-wider">
                            📋 Relatório de Entregas Concluídas
                          </span>

                          <div className="relative border-l border-emerald-500 ml-3 pl-4 space-y-4 py-2">
                            {activeCompletedRoute?.stops?.map((stop, sIdx) => {
                              const arrivalTime = activePerformanceLog?.stopTelemetry?.[sIdx]?.arrivalTimestamp 
                                ? new Date(activePerformanceLog.stopTelemetry[sIdx].arrivalTimestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                                : (() => {
                                    const baseHour = 8;
                                    const totalMinutes = sIdx * 50 + 40;
                                    const hour = baseHour + Math.floor(totalMinutes / 60);
                                    const min = totalMinutes % 60;
                                    return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
                                  })();

                              const handleWhatsAppMsg = () => {
                                if (!stop.clientWhatsApp) return;
                                const text = `Olá ${stop.clientName}, sua entrega no endereço ${stop.address} foi concluída com sucesso às ${arrivalTime} pelo motorista ${user.name}!`;
                                const cleanPhone = stop.clientWhatsApp.replace(/\D/g, '');
                                window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`);
                              };

                              return (
                                <div key={stop.id} className="relative">
                                  {/* Timeline Circle Bullet */}
                                  <span className="absolute -left-[22px] top-1 h-3 w-3 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center text-white shrink-0 shadow-sm">
                                    <Check className="w-2 h-2 font-bold" />
                                  </span>

                                  <div className="bg-white border border-slate-150 p-3 rounded-xl shadow-xs space-y-1.5">
                                    <div className="flex items-center justify-between">
                                      <strong className="text-slate-800 text-[11px] font-extrabold truncate max-w-[130px]">
                                        #{sIdx + 1} {stop.clientName}
                                      </strong>
                                      <span className="text-[10px] text-slate-400 font-mono font-semibold flex items-center gap-0.5">
                                        <Clock className="w-3 h-3 text-slate-400" />
                                        {arrivalTime}
                                      </span>
                                    </div>

                                    <p className="text-[10px] text-slate-500 line-clamp-1">📍 {stop.address}</p>

                                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                                      <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-md uppercase">
                                        Sucesso ✅
                                      </span>
                                      {stop.clientWhatsApp && (
                                        <button
                                          type="button"
                                          onClick={handleWhatsAppMsg}
                                          className="text-emerald-700 hover:text-emerald-800 text-[10px] font-bold flex items-center gap-1 font-sans underline cursor-pointer"
                                        >
                                          <Phone className="w-3 h-3 text-emerald-500 fill-emerald-100" />
                                          {stop.clientWhatsApp}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="text-center py-16 text-slate-400 space-y-2">
                    <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200/80 mx-auto flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className="font-semibold text-xs text-slate-500">Sem Jornadas Concluídas</p>
                    <p className="text-[10px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                      As rotas que você iniciar e concluir com sucesso serão registradas para consolidação telemetria e visualização de tempos/distâncias.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 6: ACTIVE STOP CONFIRMATION & VERIFICATION (SIGNATURE & PHOTO) */}
            {activeTab === 'ativa' && activeRoute && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-sm space-y-4 text-xs font-sans">
                {(() => {
                  const currentStopIndex = activeRoute.currentStopIndex;
                  const currentStop = activeRoute.stops[currentStopIndex];

                  if (!currentStop) {
                    return (
                      <div className="text-center py-10 space-y-3">
                        <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto text-emerald-500">
                          <Check className="w-7 h-7" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-slate-800 text-sm uppercase">Todas as Entregas Concluídas!</h4>
                          <p className="text-[10px] text-slate-400 mt-1 max-w-xs mx-auto">
                            Excelente! Todas as paradas deste roteiro foram entregues e confirmadas com assinatura digital.
                          </p>
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              // Mark the route itself as completed
                              await onUpdateRoute(activeRoute.id, { status: 'completed' });
                              alert('Jornada de entregas finalizada com sucesso! Relatório telemetria salvo.');
                              setActiveTab('resumos');
                            } catch (e) {
                              alert('Falha ao concluir rota. Tente novamente.');
                            }
                          }}
                          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer uppercase tracking-wider text-xs"
                        >
                          <CheckCircle className="w-4 h-4 text-white" />
                          Finalizar Jornada
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {/* Delivery Card Header */}
                      <div className="border border-emerald-100 bg-emerald-50/15 rounded-2xl p-4">
                        <div className="flex items-center justify-between font-mono text-[9px] text-emerald-700 font-extrabold pb-2 border-b border-emerald-100/50 uppercase tracking-widest">
                          <span>📍 Entrega Atual (Parada #{currentStopIndex + 1})</span>
                          <span>Região: {region}</span>
                        </div>
                        
                        <div className="mt-3">
                          <strong className="text-slate-800 text-[13px] block font-black leading-tight">{currentStop.clientName}</strong>
                          <p className="text-[11px] text-slate-500 mt-1 select-all font-medium leading-snug">{currentStop.address}</p>
                        </div>

                        {/* Customer Quick Actions */}
                        <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
                          {currentStop.clientWhatsApp && (
                            <a
                              href={`https://wa.me/${currentStop.clientWhatsApp.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 py-2.5 bg-white border border-slate-200 hover:border-emerald-200 text-emerald-800 hover:bg-emerald-50 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 text-[10px] uppercase tracking-wider select-none leading-none text-center"
                            >
                              <Phone className="w-3.5 h-3.5 text-emerald-500 fill-emerald-150 inline" />
                              <span className="align-middle ml-1">WhatsApp</span>
                            </a>
                          )}
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${currentStop.lat},${currentStop.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 py-2.5 bg-white border border-slate-200 hover:border-indigo-200 text-indigo-800 hover:bg-indigo-50 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 text-[10px] uppercase tracking-wider select-none leading-none text-center"
                          >
                            <MapPin className="w-3.5 h-3.5 text-indigo-500 inline" />
                            <span className="align-middle ml-1">Navegar</span>
                          </a>
                        </div>
                      </div>

                      {/* CLIENT DIGITAL SIGNATURE PAD */}
                      <div className="space-y-2 select-none">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider">Passo 1: Assinatura Digital do Cliente</span>
                          {hasSigned && (
                            <button
                              type="button"
                              onClick={handleClearSignature}
                              className="text-[10px] font-black text-rose-600 hover:text-rose-700 uppercase flex items-center gap-1 hover:underline cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Limpar
                            </button>
                          )}
                        </div>

                        <div className="relative border border-slate-250 bg-slate-50/50 rounded-2xl overflow-hidden aspect-[16/9] flex flex-col shadow-inner">
                          <canvas
                            ref={signatureCanvasRef}
                            width={320}
                            height={180}
                            onMouseDown={handleStartDrawing}
                            onMouseMove={handleDraw}
                            onMouseUp={handleStopDrawing}
                            onMouseLeave={handleStopDrawing}
                            onTouchStart={handleStartDrawing}
                            onTouchMove={handleDraw}
                            onTouchEnd={handleStopDrawing}
                            className="w-full h-full bg-transparent cursor-crosshair touch-none"
                          />
                          {!hasSigned && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/5 backdrop-blur-[0.5px] pointer-events-none select-none text-slate-400">
                              <span className="text-[10px] uppercase font-black tracking-widest text-slate-600">Assinar aqui na tela</span>
                              <span className="text-[9px] text-slate-400 mt-1">Utilize o dedo ou caneta touch</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* PHOTO DELIVERY CONFERENCE WITH DEVICE NATIVE CAMERA */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider">Passo 2: Foto de Comprovante de Carga</span>
                          {capturedPhoto && (
                            <button
                              type="button"
                              onClick={() => setCapturedPhoto(null)}
                              className="text-[10px] font-black text-rose-600 hover:text-rose-700 uppercase flex items-center gap-1 hover:underline cursor-pointer"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Recapturar
                            </button>
                          )}
                        </div>

                        {!capturedPhoto ? (
                          <div className="border border-dashed border-slate-300 rounded-2xl bg-slate-50/50 p-6 flex flex-col items-center justify-center text-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
                              <Camera className="w-6 h-6" />
                            </div>
                            <div className="space-y-1">
                              <p className="font-extrabold text-slate-700 text-[11px]">Fotoconferência de Carga</p>
                              <p className="text-[9px] text-slate-400 max-w-[220px]">Registre uma imagem nítida da mercadoria entregue no local do recebedor.</p>
                            </div>

                            {/* Native camera trigger input */}
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              id="photo-capture-input-panel"
                              className="hidden"
                              onChange={handlePhotoFileChange}
                            />
                            <label
                              htmlFor="photo-capture-input-panel"
                              className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/50 text-indigo-700 font-extrabold rounded-xl shadow-sm cursor-pointer select-none active:scale-95 transition-all text-[11px] uppercase tracking-wider flex items-center gap-1.5"
                            >
                              <Camera className="w-4 h-4 text-indigo-600" />
                              Capturar da Câmera
                            </label>
                          </div>
                        ) : (
                          <div className="relative border border-slate-200 bg-slate-50 p-1.5 rounded-2xl overflow-hidden shadow-sm">
                            <img
                              src={capturedPhoto}
                              alt="Comprovante de entrega"
                              referrerPolicy="no-referrer"
                              className="w-full aspect-[4/3] object-cover rounded-xl border border-slate-200/50"
                            />
                            <div className="absolute top-3 right-3 flex gap-1.5">
                              <span className="bg-emerald-500/90 text-white font-mono font-black text-[9px] px-2 py-0.5 rounded uppercase shadow-sm select-none">FOTO CAPTURADA</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* CONCLUDE SUBMIT ACTION BUTTON */}
                      <button
                        type="button"
                        onClick={() => handleConfirmDelivery(activeRoute.id, currentStop.id)}
                        className="w-full mt-6 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-650 hover:from-emerald-700 hover:to-teal-700 text-white font-black uppercase rounded-2xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-98 text-xs tracking-wider cursor-pointer"
                      >
                        <CheckCircle className="w-4 h-4 fill-white text-emerald-605" />
                        Confirmar & Registrar Entrega
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Column: GPS Tracking & Vector Live Map */}
      <div className="lg:col-span-8 flex flex-col h-[400px] lg:h-full">
        
        {/* Dynamic active trip navigation dashboard overlay */}
        {activeRoute && (
          <div className={`mb-4 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm transition-all duration-300 ${
            isSharingLocation 
              ? 'bg-emerald-500 text-white animate-pulse' 
              : 'bg-slate-800 text-slate-300 animate-none'
          }`}>
            <div>
              <span className={`text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded ${
                isSharingLocation ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-700 text-slate-400'
              }`}>
                {isSharingLocation ? 'JORNADA ATIVA' : 'JORNADA PAUSADA'}
              </span>
              <h3 className="font-bold text-sm mt-1">{activeRoute.name}</h3>
              <p className="text-xs opacity-90">
                {isSharingLocation 
                  ? `Seu trajeto está sendo rastreado em tempo real na região ${region}.`
                  : 'Compartilhamento de GPS temporariamente suspenso pelo condutor.'}
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto text-xs font-mono">
              <div className={`${isSharingLocation ? 'bg-emerald-600/60' : 'bg-slate-700/65'} p-2 rounded border ${isSharingLocation ? 'border-emerald-400/30' : 'border-slate-600/40'}`}>
                <span className="block text-[9px] uppercase opacity-85">Próxima entrega:</span>
                <strong className="text-sm font-black whitespace-nowrap">
                  {activeRoute.stops[activeRoute.currentStopIndex]?.clientName || 'Concluída!'}
                </strong>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-3 select-none">
          <span className="text-[11px] font-bold text-slate-500 uppercase font-mono">Monitor de Mapa:</span>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setMapMode('vector')}
              className={`px-3 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                mapMode === 'vector' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Mapa Vetorial
            </button>
            <button
              onClick={() => setMapMode('google')}
              className={`px-3 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                mapMode === 'google' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Google Maps Platform
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-[350px]">
          {mapMode === 'vector' ? (
            <InteractiveMap 
              rota={activeRoute} 
              driverLocation={activeRoute ? locations[user.id] || null : null}
              region={region}
            />
          ) : (
            <RouteMap 
              rotas={myRoutes}
              locations={locations}
              currentUserRegion={region}
              currentUserRole={user.role}
              singleRouteMode={activeRoute}
              singleDriverLocation={activeRoute ? locations[user.id] || null : null}
            />
          )}
        </div>
      </div>

    </div>
  );
}

// ==========================================
// 4. VENDEDOR REGIONAL VIEW
// ==========================================
interface VendedorProps {
  user: RouteUser;
  rotas: Rota[];
  chats: ChatMessage[];
  users: RouteUser[];
  locations: { [drvId: string]: GPSLocation };
  onPostMessage: (text: string, audioUrl?: string) => void;
}

export function VendedorDashboard({ user, rotas, chats, users, locations, onPostMessage }: VendedorProps) {
  const [activeTab, setActiveTab] = useState<'map' | 'driver' | 'chat'>('map');
  const [mobileFocus, setMobileFocus] = useState<'actions' | 'map'>('actions');
  const [chatInp, setChatInp] = useState('');
  const [mapMode, setMapMode] = useState<'vector' | 'google'>('vector');
  
  const region = (user as any).region || 'GV1';

  // Regional driver info
  const myRegionDrivers = users.filter(u => u.role === UserRole.MOTORISTA && (u as any).region === region);
  const activeDriver = myRegionDrivers[0] || null;

  // Active routes of my region
  const regionalRoutes = rotas.filter(r => r.region === region);
  const activeRoute = regionalRoutes.find(r => r.status === 'active') || null;

  // Chats
  const regionalChats = chats.filter(c => c.region === region);

  const handlePostChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInp.trim()) return;
    onPostMessage(chatInp.trim());
    setChatInp('');
  };

  return (
    <div id="vendedor-main-panel" className="grid grid-cols-1 lg:grid-cols-12 gap-5 select-none md:select-text">
      
      {/* Top Bar / Profile Card Summary with shadow-md and rounded-2xl */}
      <div className="lg:col-span-12 bg-white border border-slate-200 rounded-2xl p-4 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 font-bold shrink-0">
            <UserCheck className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-800 text-sm leading-none uppercase tracking-tight">{user.name}</span>
              <span className="text-[10px] bg-amber-50 text-amber-600 font-bold px-2 py-0.5 rounded-full uppercase">
                {region}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Painel do Vendedor | Monitoramento de Pedidos e Rastreio GPS
            </p>
          </div>
        </div>

        {/* Info Widget */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-blue-105 bg-blue-50/20 text-[11px] font-semibold text-blue-700">
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          <span className="font-mono">Monitoramento de Entregas Ativo</span>
        </div>
      </div>

      {/* Responsive Focus Toggle for Mobile Displays */}
      <div className="lg:hidden col-span-1 flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-sm mb-1 select-none w-full gap-1">
        <button
          type="button"
          onClick={() => setMobileFocus('actions')}
          className={`flex-1 py-3 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
            mobileFocus === 'actions' ? 'bg-white text-indigo-900 shadow-sm border border-slate-200/40' : 'text-slate-550'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4 text-indigo-600 shrink-0" />
          Controles e Fichas
        </button>
        <button
          type="button"
          onClick={() => setMobileFocus('map')}
          className={`flex-1 py-3 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
            mobileFocus === 'map' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-550'
          }`}
        >
          <Map className="w-4 h-4 text-emerald-600 shrink-0" />
          Ver Mapa Regional
        </button>
      </div>

      {/* Left Column (only visible on desktop or when 'actions' is active on mobile) */}
      <div className={`lg:col-span-5 space-y-4 w-full ${mobileFocus === 'actions' ? 'block' : 'hidden lg:block'}`}>
        
        {/* Modern Tab Selection with Icons */}
        <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/40">
          <button
            onClick={() => setActiveTab('map')}
            className={`py-3 px-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer flex flex-col items-center justify-center gap-1 uppercase tracking-wider ${
              activeTab === 'map' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Route className="w-3.5 h-3.5 text-indigo-600" />
            Cargas
          </button>
          <button
            onClick={() => setActiveTab('driver')}
            className={`py-3 px-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer flex flex-col items-center justify-center gap-1 uppercase tracking-wider ${
              activeTab === 'driver' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Truck className="w-3.5 h-3.5 text-indigo-600" />
            Motorista
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`py-3 px-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer flex flex-col items-center justify-center gap-1 uppercase tracking-wider ${
              activeTab === 'chat' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
            Chat
          </button>
        </div>

        {/* Tab 1: Delivery status details list */}
        {activeTab === 'map' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-sm space-y-4 text-xs font-sans">
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
              <span className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px]">Cargas e Progressos no Solo</span>
              <span className="bg-indigo-50 text-indigo-750 px-2.5 py-1 rounded-full font-mono font-black text-[9px] uppercase">CÓDIGO: {region}</span>
            </div>

            {activeRoute ? (
              <div className="space-y-4">
                <div className="p-4 bg-indigo-50/20 border border-indigo-100/50 rounded-2xl">
                  <div className="flex items-center justify-between font-mono text-[9px] text-indigo-600 font-extrabold mb-2 uppercase tracking-wider">
                    <span>Rota em Andamento</span>
                    <span>Placa: {activeRoute.driverPlate}</span>
                  </div>
                  <strong className="text-slate-900 block text-xs leading-snug uppercase tracking-tight font-black">{activeRoute.name}</strong>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Motorista: <strong className="text-slate-700 font-extrabold">{activeRoute.driverName}</strong>
                  </p>
                </div>

                <div className="space-y-2.5">
                  <span className="font-extrabold text-slate-400 block text-[9px] uppercase tracking-wider">Relação de Entregas</span>
                  {activeRoute.stops.map((stop, sidx) => (
                    <motion.div 
                      key={stop.id} 
                      layout
                      initial={{ opacity: 0.9, scale: 0.98 }}
                      animate={{ 
                        opacity: 1, 
                        scale: 1,
                        backgroundColor: stop.status === 'completed' ? '#ecfdf5' : stop.status === 'Chegando' ? '#fffbeb' : '#f8fafc',
                        borderColor: stop.status === 'completed' ? '#a7f3d0' : stop.status === 'Chegando' ? '#fde68a' : '#f1f5f9'
                      }}
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                      className="p-3.5 rounded-2xl border flex items-center justify-between text-[11px] shadow-sm gap-2"
                    >
                       <div className="min-w-0 flex-1 pr-1.5">
                        <strong className="text-slate-800 block truncate text-xs">{stop.clientName}</strong>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{stop.address}</p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {stop.clientWhatsApp && (
                          <a 
                            href={`https://wa.me/${stop.clientWhatsApp}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            title="Conversar com cliente"
                            className="p-2.5 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-600 hover:text-indigo-600 transition-all active:scale-90 shadow-sm"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        )}
                        <span className={`px-2.5 py-1 font-mono font-black text-[9px] rounded-full uppercase shrink-0 border ${
                          stop.status === 'completed' 
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                            : stop.status === 'Chegando'
                              ? 'bg-amber-50 text-amber-800 border-amber-200 animate-pulse'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {stop.status === 'completed' ? 'ENTREGUE ✓' : stop.status === 'Chegando' ? 'CHEGANDO 🚚' : 'NA FILA'}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 px-4">
                <p className="text-slate-500 font-bold leading-normal font-sans text-xs">Nenhuma rota ativa no momento na região {region}.</p>
                <p className="text-[10px] text-slate-400 mt-1.5 font-mono">Aguardando login de motorista regional para despachar carga...</p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Regional Active Driver Bio CARD */}
        {activeTab === 'driver' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-sm text-xs space-y-4 font-sans">
            <span className="font-extrabold text-slate-800 tracking-wider uppercase text-[11px] block text-left">Dados Cadastrais do Condutor da Região</span>

            {activeDriver ? (
              <div className="space-y-4 bg-slate-50/50 p-4 border border-slate-100 rounded-2xl shadow-sm">
                <div className="flex justify-between items-center text-[9px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100/50 uppercase">
                  <span>CONDUTOR: #{activeDriver.id}</span>
                  <span>REG: {(activeDriver as any).region}</span>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Nome</span>
                  <strong className="text-slate-850 text-sm font-black block leading-none">{activeDriver.name}</strong>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 text-[11px]">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Placa do Veículo</span>
                    <strong className="text-slate-800 font-mono">{(activeDriver as any).plate}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Modelo do Caminhão</span>
                    <strong className="text-slate-700">{(activeDriver as any).vehicleModel}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200/50 text-[11px]">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Registro CNH</span>
                    <span className="text-slate-600 font-mono font-bold">{(activeDriver as any).cnh}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Validade CNH</span>
                    <span className="text-slate-600 font-mono">{(activeDriver as any).cnhExpiration}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/50">
                  <a
                    href={`https://wa.me/${activeDriver.phone.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-extrabold flex items-center justify-center gap-1.5 cursor-pointer shadow-md active:scale-95 transition-all text-xs uppercase tracking-wider"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Contatar WhatsApp do Condutor
                  </a>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 px-4">
                <p className="text-slate-455 font-bold leading-normal text-xs text-center">Nenhum motorista disponível na região {region}.</p>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Regional Chat Room */}
        {activeTab === 'chat' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col h-[380px] text-xs font-sans">
            <span className="font-extrabold text-slate-800 tracking-wider uppercase text-[11px] border-b border-slate-100 pb-2.5 block mb-2 text-left">Linha Regional de Comunicação</span>

            {/* Tooltip explicativo regional */}
            <div className="bg-amber-50/50 border border-amber-200/50 rounded-xl p-2.5 mb-2 flex items-start gap-1.5 text-[10px] text-amber-900 font-medium select-none shadow-xs">
              <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Visibilidade Restrita ({region}):</strong> Mensagens enviadas aqui só serão visíveis para motoristas e gerentes parceiros alocados nesta mesma região.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto py-2 space-y-3 pr-1">
              {regionalChats.length === 0 ? (
                <div className="text-center py-10 text-slate-400">Nenhuma mensagem enviada nesta região. Use o campo abaixo para iniciar o alinhamento.</div>
              ) : (
                regionalChats.map(c => {
                  const isMe = c.senderId === user.id;
                  return (
                    <div key={c.id} className={`p-3 rounded-2xl border transition-all ${
                      isMe ? 'bg-indigo-50/40 border-indigo-100/50 ml-6 shadow-sm' : 'bg-slate-50 border-slate-100 mr-6'
                    }`}>
                      <div className="flex justify-between items-center text-[10px] text-slate-450 mb-1.5 font-mono">
                        <span className={`font-black ${isMe ? 'text-indigo-650' : 'text-slate-600'}`}>{c.senderName}</span>
                        <span>{new Date(c.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-slate-700 leading-relaxed font-sans">{c.message}</p>
                      {c.audioUrl && (
                        <div className="mt-2 text-slate-800">
                          <AudioPlayer src={c.audioUrl} />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={handlePostChat} className="flex gap-2 border-t border-slate-150 pt-3 bg-white mt-2 items-center">
              <input
                type="text"
                placeholder="Digite seu aviso regional..."
                value={chatInp}
                onChange={e => setChatInp(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 p-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 h-11 text-xs font-medium"
              />
              <div className="shrink-0">
                <AudioRecorderButton onSendAudio={(base64) => onPostMessage('🎙️ Nota de Áudio', base64)} />
              </div>
              <button 
                type="submit" 
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-11 w-11 flex items-center justify-center cursor-pointer hover:shadow active:scale-90 transition-all shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Right Column: Live Vector Map View (toggles viewport presence on mobile) */}
      <div className={`lg:col-span-7 flex flex-col h-full min-h-[440px] w-full ${mobileFocus === 'map' ? 'block' : 'hidden lg:flex'}`}>
        <div className="flex items-center justify-between mb-3.5 select-none">
          <span className="text-[11px] font-extrabold text-slate-450 uppercase tracking-wider font-sans">Monitor de Região: Vivo</span>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-sm">
            <button
              onClick={() => setMapMode('vector')}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black cursor-pointer transition-all uppercase tracking-wider ${
                mapMode === 'vector' ? 'bg-white text-indigo-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Mapa Vetorial
            </button>
            <button
              onClick={() => setMapMode('google')}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black cursor-pointer transition-all uppercase tracking-wider ${
                mapMode === 'google' ? 'bg-white text-indigo-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Google Maps
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-[350px]">
          {mapMode === 'vector' ? (
            <InteractiveMap 
              rota={activeRoute} 
              driverLocation={activeRoute ? locations[activeRoute.driverId] || null : null}
              region={region}
            />
          ) : (
            <RouteMap 
              rotas={rotas}
              locations={locations}
              currentUserRegion={region}
              currentUserRole={user.role}
              singleRouteMode={activeRoute}
              singleDriverLocation={activeRoute ? locations[activeRoute.driverId] || null : null}
            />
          )}
        </div>
      </div>

    </div>
  );
}
