import React from 'react';
import { ShieldAlert, AlertTriangle, LogOut, EyeOff, Shield, RefreshCcw } from 'lucide-react';
import { RouteUser, UserRole } from '../types';

interface ActiveSessionBlockerProps {
  user: RouteUser;
  isImpersonating: boolean;
  onEndImpersonation: () => void;
  onLogout: () => void;
  onReset?: () => void;
}

export default function ActiveSessionBlocker({ 
  user, 
  isImpersonating, 
  onEndImpersonation, 
  onLogout,
  onReset 
}: ActiveSessionBlockerProps) {
  const isSuspended = user.status === 'suspended';
  
  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4">
      {/* Background glowing red eclipse */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none"></div>
      
      <div className="bg-slate-900 border border-red-900/40 rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative overflow-hidden select-text">
        {/* Warning ambient bar decoration */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-600 via-rose-500 to-amber-500"></div>
        
        <div className="flex flex-col items-center text-center">
          {/* Pulsing Shield Ring */}
          <div className="w-16 h-16 rounded-2xl bg-red-950 border border-red-800 flex items-center justify-center text-red-500 mb-5 relative animate-pulse">
            <ShieldAlert className="w-8 h-8" />
            <span className="absolute -inset-1 rounded-2xl border border-red-500/20 animate-ping" style={{ animationDuration: '3s' }}></span>
          </div>

          <span className="text-[10px] font-mono font-bold uppercase tracking-widest bg-red-500/15 text-red-400 border border-red-500/20 px-3 py-1 rounded-full">
            {isSuspended ? 'CONTA SUSPENSA TEMPORARIAMENTE' : 'CONTA BANIDA PERMANENTEMENTE'}
          </span>

          <h2 className="text-xl font-black text-white mt-4 tracking-tight">
            Restrição Operacional Detectada
          </h2>
          
          <p className="text-xs text-slate-450 mt-2.5 max-w-sm leading-relaxed font-sans">
            Detector reativo do barramento de dados identificou que o operador <strong className="text-red-400 font-bold">{user.name}</strong> ({UserRole[user.role]}) foi marcado com status <span className="font-mono underline uppercase font-black">{user.status}</span>. Security Rules ativadas imediatamente.
          </p>

          {/* User profile dossier */}
          <div className="w-full mt-6 bg-slate-950/85 border border-slate-800/80 rounded-xl p-4 text-left font-mono text-[11px] space-y-2.5">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="text-slate-500 uppercase text-[9px] font-semibold">Identificador ID</span>
              <span className="text-slate-350">{user.id}</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="text-slate-500 uppercase text-[9px] font-semibold">Credencial (E-mail)</span>
              <span className="text-slate-350">{user.email}</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="text-slate-500 uppercase text-[9px] font-semibold">Região</span>
              <span className="text-slate-350 uppercase">{(user as any).region || 'GV1'}</span>
            </div>
            {user.role === UserRole.MOTORISTA && (user as any).plate && (
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="text-slate-500 uppercase text-[9px] font-semibold">Veículo / Placa</span>
                <span className="text-rose-400 font-bold uppercase">{(user as any).vehicleModel || ''} [{(user as any).plate}]</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-slate-500 uppercase text-[9px] font-semibold">Latência de Enforcement</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <Shield className="w-3 h-3 text-emerald-400" />
                &lt; 0.7s (Tempo Real)
              </span>
            </div>
          </div>

          {/* Security details block */}
          <div className="mt-4 p-3 bg-red-950/40 border border-red-900/25 rounded-xl text-left text-xs leading-relaxed text-red-300">
            <div className="font-bold uppercase tracking-wider text-[9px] text-red-400 mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              INSTRUÇÕES DE SEGURANÇA
            </div>
            {isSuspended ? (
              <p className="text-[11px]">
                Sua sessão foi suspensa temporariamente para averiguação logística ou auditoria de rotas sob suspeita de desvios geográficos. Entre em contato com seu Gerente Regional ou Administrador.
              </p>
            ) : (
              <p className="text-[11px]">
                Esta conta foi banida permanentemente por violar as diretrizes operacionais de conformidade e integridade física de frotas. O CNH e a placa do veículo associado encontram-se na lista negra (blacklist).
              </p>
            )}
          </div>

          {/* Active Action Controls */}
          <div className="w-full mt-6 grid grid-cols-1 gap-3.5">
            {isImpersonating ? (
              // Admin impersonation override controls
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={onEndImpersonation}
                  className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-slate-700 shadow"
                >
                  <EyeOff className="w-4 h-4 text-blue-400" />
                  Sair do Modo de Supervisão (Voltar ao Admin)
                </button>
                <div className="text-[9px] text-slate-500 font-mono text-center">
                  Como Administrador Geral, você pode encerrar este espelhamento sem ser restrito pela Security Rule.
                </div>
              </div>
            ) : (
              // Direct locked user controls
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex-1 py-2.5 px-4 bg-red-700 hover:bg-red-800 text-white rounded-lg text-xs font-bold tracking-wider uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md active:scale-95"
                >
                  <LogOut className="w-4 h-4" />
                  Sair da Conta Bloqueada
                </button>
                {onReset && (
                  <button
                    type="button"
                    onClick={() => {
                      onReset();
                      onLogout();
                    }}
                    className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 border border-slate-700"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" />
                    Resetar Ambiente
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
