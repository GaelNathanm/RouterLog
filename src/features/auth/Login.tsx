import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { Compass, ShieldAlert, LogIn, User, Truck, ClipboardList, AlertCircle, HelpCircle } from 'lucide-react';
import GoogleAuthButton from '../../components/GoogleAuthButton';
import { showToast } from '../../utils/toast';

interface RouteUser {
  id: string;
  name: string;
  email: string;
  role: number;
}

interface LoginProps {
  users?: RouteUser[];
  regions?: any[];
  onLogin?: (email: string, password?: string) => any;
  onRegister?: (data: any) => any;
}

export const Login: React.FC<LoginProps> = ({ users = [] }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();

  // Efeito para redirecionar o usuário caso ele já esteja logado no sistema
  useEffect(() => {
    if (!loading && user && role !== null) {
      redirecionarPorPerfil(role);
    }
  }, [user, role, loading]);

  // Função centralizada de rotas pós-login
  const redirecionarPorPerfil = (userRole: number) => {
    switch (userRole) {
      case 0:
        navigate('/admin/dashboard', { replace: true });
        break;
      case 1:
        navigate('/gerente/dashboard', { replace: true });
        break;
      case 2:
        navigate('/motorista/painel', { replace: true });
        break;
      case 3:
        navigate('/vendedor/painel', { replace: true });
        break;
      default:
        navigate('/sem-acesso', { replace: true });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Preencha seu e-mail e senha.');
      return;
    }
    setError('');
    setIsSubmitting(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      showToast('Autenticado com sucesso!', 'success', 'Bem-vindo');
      // O useEffect acima cuidará do redirecionamento assim que o AuthContext atualizar
    } catch (err: any) {
      console.error("Erro ao autenticar:", err);
      // Tratamento de erros amigável do Firebase
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('E-mail ou senha incorretos.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Acesso bloqueado temporariamente por excesso de tentativas. Tente mais tarde.');
      } else {
        setError('Ocorreu um erro ao tentar fazer login. Tente novamente.');
      }
      setIsSubmitting(false);
    }
  };

  const handlePresetLogin = async (presetEmail: string) => {
    setError('');
    setIsSubmitting(true);
    try {
      // 1. Tenta fazer login com a senha padrão de simulação
      await signInWithEmailAndPassword(auth, presetEmail, '123456');
      showToast('Simulação iniciada com sucesso!', 'success', 'Acesso Simulado');
    } catch (err: any) {
      console.warn("Erro ao fazer login na conta simulada, tentando criar o usuário no Firebase Auth...", err);
      
      // Se falhar porque o usuário não existe ou as credenciais são inválidas, criamos a conta no Firebase Auth
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        try {
          // 2. Cria o usuário com a senha de desenvolvimento padrão
          await createUserWithEmailAndPassword(auth, presetEmail, '123456');
          showToast('Conta simulada criada e logada com sucesso!', 'success', 'Acesso Simulado');
        } catch (regErr: any) {
          console.error("Erro ao registrar conta simulada no Firebase Auth:", regErr);
          
          // Se falhar porque o e-mail já existe (pode ser outra senha), tenta usar o prefixo do e-mail como senha
          if (regErr.code === 'auth/email-already-in-use') {
            try {
              const defaultPass = presetEmail.split('@')[0];
              await signInWithEmailAndPassword(auth, presetEmail, defaultPass);
              showToast('Simulação iniciada com sucesso!', 'success', 'Acesso Simulado');
              return;
            } catch (innerErr) {
              console.error("Erro ao logar com senha baseada em e-mail:", innerErr);
            }
          }
          setError(`Não foi possível acessar a conta simulada. Erro: ${regErr.message || regErr}`);
          setIsSubmitting(false);
        }
      } else {
        setError(`Erro ao logar com conta simulada: ${err.message || err}`);
        setIsSubmitting(false);
      }
    }
  };

  const getRoleIcon = (roleType: number) => {
    switch (roleType) {
      case 0: return <ShieldAlert className="w-4 h-4 text-rose-600 animate-pulse" />;
      case 1: return <ClipboardList className="w-4 h-4 text-blue-600" />;
      case 2: return <Truck className="w-4 h-4 text-emerald-600" />;
      case 3: return <User className="w-4 h-4 text-amber-600" />;
      default: return <User className="w-4 h-4 text-slate-500" />;
    }
  };

  const getRoleLabel = (roleType: number) => {
    switch (roleType) {
      case 0: return 'Administrador';
      case 1: return 'Gerente Regional';
      case 2: return 'Motorista';
      case 3: return 'Vendedor';
      default: return 'Operador';
    }
  };

  const getRoleBadgeStyle = (roleType: number) => {
    switch (roleType) {
      case 0: return 'bg-rose-50 text-rose-700 border-rose-200/60';
      case 1: return 'bg-blue-50 text-blue-700 border-blue-200/60';
      case 2: return 'bg-emerald-50 text-emerald-700 border-emerald-200/60';
      case 3: return 'bg-amber-50 text-amber-700 border-amber-200/60';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-sm font-medium text-slate-500 font-sans">Carregando credenciais...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-100">
            <Compass className="w-7 h-7 animate-spin-slow" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900 tracking-tight">
          RouteLog Enterprise
        </h2>
        <p className="mt-2 text-center text-xs text-slate-500 max-w">
          Insira suas credenciais corporativas do Firebase ou utilize uma conta operacional de simulação.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white py-8 px-6 shadow-md rounded-2xl border border-slate-200/80 sm:px-10 space-y-6">
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-rose-50 border border-rose-150 rounded-xl p-3 text-rose-700 text-xs flex items-center gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <p className="font-medium">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-bold uppercase text-slate-500 tracking-wider">
                E-mail Corporativo
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@routelog.com"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl shadow-sm text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-slate-900"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-bold uppercase text-slate-500 tracking-wider">
                Senha Operacional
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl shadow-sm text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-slate-900"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Acessar o Sistema</span>
                </>
              )}
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-250"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase font-mono">
              <span className="bg-white px-3 text-slate-400">Ou use login social</span>
            </div>
          </div>

          <div className="flex justify-center">
            <GoogleAuthButton />
          </div>

          {/* SIMULATION PRESETS BLOCK */}
          {users && users.length > 0 && (
            <div className="pt-4 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-3 font-mono">
                <HelpCircle className="w-4 h-4 text-blue-600" />
                <span>CONTAS OPERACIONAIS DE SIMULAÇÃO:</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {users.map((presetUser) => (
                  <button
                    key={presetUser.id}
                    type="button"
                    onClick={() => handlePresetLogin(presetUser.email)}
                    disabled={isSubmitting}
                    className="flex items-center justify-between p-3 border border-slate-250 rounded-xl hover:bg-slate-50 hover:border-blue-300 transition-all text-left bg-white shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{presetUser.name}</p>
                      <p className="text-[10px] text-slate-450 truncate">{presetUser.email}</p>
                    </div>
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border font-mono text-[9px] font-black shrink-0 ${getRoleBadgeStyle(presetUser.role)}`}>
                      {getRoleIcon(presetUser.role)}
                      <span>{getRoleLabel(presetUser.role).toUpperCase()}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Login;
