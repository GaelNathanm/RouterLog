import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, LogOut, Compass, RefreshCw } from 'lucide-react';
import { auth } from '../../config/firebase';
import { signOut } from 'firebase/auth';

export const SemAcesso: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Erro ao deslogar:', error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-lg p-8 max-w-md w-full text-center space-y-6">
        
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-500 shadow-sm animate-bounce">
            <ShieldAlert className="w-8 h-8" />
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Sem Perfil Ativo</h2>
          <p className="text-xs text-slate-400 mt-1 font-mono uppercase tracking-wider">Acesso Restrito / Não Configurado</p>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
          Sua conta (<strong>{user?.email}</strong>) foi autenticada com sucesso pelo provedor, mas você ainda não possui um perfil operacional ativo configurado na coleção corporativa do RouteLog, ou sua conta foi suspensa temporariamente por um administrador.
        </p>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/55 text-left space-y-2">
          <span className="font-semibold text-slate-700 text-[10px] block uppercase tracking-wider font-mono">Próximos passos recomendados:</span>
          <ul className="space-y-1.5 text-[11px] text-slate-500">
            <li className="flex items-start gap-1">
              <span className="text-blue-500 font-bold shrink-0">•</span>
              <p>Entre em contato com o suporte de TI para liberar seu nível de permissão.</p>
            </li>
            <li className="flex items-start gap-1">
              <span className="text-blue-500 font-bold shrink-0">•</span>
              <p>Selecione um dos operadores fictícios de simulação na tela de login para testar.</p>
            </li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => window.location.reload()}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-4 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold text-slate-700 bg-white shadow-sm transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Recarregar Estado
          </button>
          
          <button
            onClick={handleSignOut}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-4 border border-transparent rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Voltar ao Login
          </button>
        </div>

      </div>
    </div>
  );
};

export default SemAcesso;
