import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, ArrowLeft, Lock } from 'lucide-react';

export const NaoAutorizado: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const handleGoBack = () => {
    if (profile) {
      if (profile.role === 0) navigate('/admin/dashboard');
      else if (profile.role === 1) navigate('/gerente/dashboard');
      else if (profile.role === 2) navigate('/motorista/painel');
      else if (profile.role === 3) navigate('/vendedor/painel');
    } else {
      navigate('/login');
    }
  };

  const getRoleLabel = (roleType?: number) => {
    if (roleType === undefined || roleType === null) return 'Nenhum';
    switch (roleType) {
      case 0: return 'Administrador';
      case 1: return 'Gerente Regional';
      case 2: return 'Motorista';
      case 3: return 'Vendedor';
      default: return 'Desconhecido';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-lg p-8 max-w-md w-full text-center space-y-6">
        
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-250 flex items-center justify-center text-rose-600 shadow-sm animate-pulse">
            <Lock className="w-8 h-8" />
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Acesso Não Autorizado</h2>
          <p className="text-xs text-slate-400 mt-1 font-mono uppercase tracking-wider">Erro 403 / Permissão Insuficiente</p>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
          Você tentou acessar uma área que exige credenciais administrativas ou operacionais superiores ao seu cargo atual. 
          Seu perfil atual de acesso está registrado como <strong>{getRoleLabel(profile?.role)}</strong>.
        </p>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/55 text-left text-[11px] text-slate-500 space-y-1.5 font-sans">
          <p>• <strong>ID da Conta:</strong> <span className="font-mono text-[10px] text-slate-700 bg-slate-200/50 px-1.5 py-0.5 rounded">{profile?.uid || 'Não autenticado'}</span></p>
          <p>• <strong>Área de Atuação:</strong> {profile?.region ? `Região ${profile.region}` : 'Geral'}</p>
        </div>

        <button
          onClick={handleGoBack}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Retornar ao Meu Painel Ativo
        </button>

      </div>
    </div>
  );
};

export default NaoAutorizado;
