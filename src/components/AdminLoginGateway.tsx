import React, { useState } from 'react';
import { ShieldAlert, Compass, Keyboard, Lock, UserCheck, AlertOctagon, HelpCircle } from 'lucide-react';
import { RouteUser } from '../types';

interface AdminLoginGatewayProps {
  onLogin: (email: string, password?: string) => Promise<{ success: boolean; error?: string; user?: RouteUser }> | any;
  onSuccess: () => void;
}

export default function AdminLoginGateway({ onLogin, onSuccess }: AdminLoginGatewayProps) {
  const [email, setEmail] = useState('admin@routelog.com');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showHelper, setShowHelper] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    if (email !== 'admin@routelog.com' && email !== 'admin') {
      setErrorMsg('Email inválido para o portal administrativo master.');
      setIsLoading(false);
      return;
    }

    if (password !== 'admin2026') {
      setErrorMsg('Senha administrativa (Master Key) incorreta! Tente "admin2026".');
      setIsLoading(false);
      return;
    }

    try {
      const result = await onLogin(email);
      if (result.success) {
        setIsLoading(false);
        onSuccess();
      } else {
        setErrorMsg(result.error || 'Erro inesperado na autenticação administrativa.');
        setIsLoading(false);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro inesperado na autenticação.');
      setIsLoading(false);
    }
  };

  const handleReturnToSim = () => {
    window.history.pushState({}, '', '/');
  };

  return (
    <div className="min-h-[550px] flex flex-col items-center justify-center bg-slate-950 text-slate-100 p-6 rounded-2xl relative overflow-hidden border border-slate-800 shadow-2xl">
      {/* Background sci-fi grids decoration */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-35"></div>
      
      {/* Upper central scanner node circles */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
      
      <div className="relative z-10 w-full max-w-md flex flex-col items-center">
        {/* Animated Security Orb Logo */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-red-950/40 border border-slate-700/50 mb-4 animate-pulse">
          <ShieldAlert className="w-8 h-8 text-white" />
        </div>

        <span className="text-[10px] font-mono font-bold tracking-widest text-red-500 bg-red-950/40 border border-red-900/30 px-3 py-1 rounded-full uppercase mb-2">
          ACESSO HIGH-LEVEL COMPROMETIDO
        </span>
        
        <h1 className="text-2xl font-black tracking-tight text-white font-sans text-center">
          Administração Geral RouteLog
        </h1>
        <p className="text-xs text-slate-400 mt-1.5 text-center leading-relaxed max-w-xs font-sans">
          Insira as credenciais master criptografadas para herdar o bypass do RBAC regional e habilitar o painel reativo.
        </p>

        {/* Form authentication panel container */}
        <form onSubmit={handleSubmit} className="w-full mt-6 bg-slate-900/90 border border-slate-800 p-6 rounded-xl space-y-4 shadow-xl backdrop-blur-md">
          {errorMsg && (
            <div className="p-3 bg-red-950/60 border border-red-900/50 rounded-lg text-red-400 text-xs flex items-start gap-2 animate-shake">
              <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1.5 flex items-center gap-1.5">
              <Compass className="w-3 h-3 text-indigo-400" />
              E-mail Administrativo
            </label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@routelog.com"
              className="w-full bg-slate-950 border border-slate-800 text-white p-2.5 rounded-lg text-xs placeholder-slate-600 font-mono focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-900 focus:ring-opacity-50 transition-all text-left"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1.5 flex items-center justify-between gap-1.5">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-red-400" />
                Chave Mestra Operacional (Passcode)
              </span>
              <button 
                type="button"
                onClick={() => setShowHelper(!showHelper)}
                className="text-[9px] text-indigo-400 hover:text-indigo-300 font-bold tracking-normal cursor-pointer uppercase"
              >
                Esqueceu?
              </button>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-slate-950 border border-slate-800 text-white p-2.5 rounded-lg text-xs placeholder-slate-600 font-mono focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-900 focus:ring-opacity-50 transition-all text-left"
              required
            />
          </div>

          {showHelper && (
            <div className="p-2.5 bg-slate-950 border border-slate-800 text-slate-400 text-[10px] leading-relaxed rounded-lg">
              🔑 <strong className="text-white">Dica de Desenvolvimento:</strong> A senha padrão para este ambiente simulado é: <code className="bg-slate-900 px-1.5 py-0.5 rounded text-indigo-300 font-mono font-bold">admin2026</code>.
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-2.5 px-4 bg-gradient-to-r from-red-600 to-indigo-600 hover:from-red-700 hover:to-indigo-700 disabled:opacity-55 text-white rounded-lg text-xs font-bold tracking-wider uppercase transition-colors shadow-lg active:scale-95 duration-100 flex items-center justify-center gap-2 cursor-pointer ${
                isLoading ? 'animate-pulse' : ''
              }`}
            >
              {isLoading ? (
                <>Autenticando Criptografia...</>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />
                  Desbloquear Consola Master
                </>
              )}
            </button>
          </div>
        </form>

        <div className="mt-6 flex flex-col items-center gap-2">
          <button
            onClick={handleReturnToSim}
            className="text-xs text-slate-500 hover:text-slate-350 transition-colors font-semibold cursor-pointer underline flex items-center gap-1"
          >
            ← Voltar ao Painel Operacional
          </button>
          
          <div className="text-[9px] font-mono text-slate-650 uppercase tracking-widest mt-2">
            SECURE LOGISTICS TERMINAL v1.7.0
          </div>
        </div>
      </div>
    </div>
  );
}
