/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  UserRole, RouteUser, Rota, Parada, GPSLocation, ChatMessage, NotificationLog, 
  AuditLogEntry, RoutePerformanceLog, PushDeliveryLog, PushConfig, MotoristaUser, Region, Cliente 
} from '../types';
import { showToast } from '../utils/toast';
import { 
  Pause, Play, Volume2, Mic, Square, Truck, UserCheck, ClipboardList, ShieldAlert, User
} from 'lucide-react';

// ==========================================
// CENTRALIZED EXPORT HELPERS (CSV & PDF)
// ==========================================
export const exportToCSV = (logs: RoutePerformanceLog[], filename = 'relatorio_desempenho_rotas.csv') => {
  if (logs.length === 0) {
    showToast('Nenhum dado de desempenho disponível para exportação.', 'warning', 'Exportação');
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

export const exportToPDF = (logs: RoutePerformanceLog[], viewTitle = 'Relatório Geral de Desempenho Logístico') => {
  if (logs.length === 0) {
    showToast('Nenhum dado de desempenho disponível para gerar relatório.', 'warning', 'Exportação PDF');
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    showToast('Por favor, permita pop-ups no navegador para gerar e imprimir o PDF.', 'warning', 'Bloqueador de Pop-ups');
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
      showToast('Não foi possível obter acesso ao microfone. Verifique as configurações de permissões do navegador.', 'error', 'Permissão');
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
  key?: string | number;
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
