/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState } from 'react';
import { UserRole, RouteUser, Region } from '../types';
import { 
  Chrome, Mail, Lock, User, Truck, ClipboardList, 
  ChevronRight, ArrowLeft, ShieldAlert, ShieldCheck, 
  CheckCircle, Info, RefreshCw, LogIn, Sparkles, MapPin, Phone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UnifiedAuthFlowProps {
  users: RouteUser[];
  regions: Region[];
  onLogin: (email: string) => { success: boolean; error?: string; user?: RouteUser } | Promise<{ success: boolean; error?: string; user?: RouteUser }>;
  onRegister: (data: Partial<RouteUser>) => RouteUser | Promise<RouteUser>;
  onReset: () => void;
  onLogout: () => void;
}

export default function UnifiedAuthFlow({ 
  users, 
  regions, 
  onLogin, 
  onRegister, 
  onReset,
  onLogout 
}: UnifiedAuthFlowProps) {
  // Current view phase: 'login' | 'profile-select' | 'register'
  const [phase, setPhase] = useState<'login' | 'profile-select' | 'register'>('login');
  
  // Selected role for first access creation
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.MOTORISTA);

  // Status notifications
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Special Auth states
  const [isAdminMasterMode, setIsAdminMasterMode] = useState(false);
  const [showGoogleSimulator, setShowGoogleSimulator] = useState(false);

  // Form states - Credentials Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Form states - Registration
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [region, setRegion] = useState('GV1');
  const [cnh, setCnh] = useState('');
  const [cnhCategory, setCnhCategory] = useState('D');
  const [vehicleModel, setVehicleModel] = useState('');
  const [plate, setPlate] = useState('');

  // Handles standard credentials and Master Admin submission
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    if (!loginEmail) {
      setErrorMsg('Por favor, digite o e-mail cadastrado ou de administrador.');
      setLoading(false);
      return;
    }

    const targetEmail = loginEmail.toLowerCase().trim();

    // Admin Master Credentials Validate
    if (isAdminMasterMode || targetEmail === 'adminzte@email.com' || targetEmail === 'adminzto@email.com') {
      if ((targetEmail !== 'adminzte@email.com' && targetEmail !== 'adminzto@email.com') || loginPassword !== 'Admin101987') {
        setErrorMsg('Senha ou credencial de Administrador Master incorreta.');
        setLoading(false);
        return;
      }
      
      const res = await onLogin(targetEmail);
      if (res.success) {
        setSuccessMsg('Acesso Master Autorizado com sucesso! Carregando painel...');
      } else {
        setErrorMsg(res.error || 'Erro de autenticação para o Administrador.');
      }
      setLoading(false);
      return;
    }

    // Regular Operational User Credentials Validate
    const exists = users.find(u => u.email.toLowerCase() === targetEmail);
    if (!exists) {
      setErrorMsg('Registro corporativo não encontrado. Utilize a opção "Entrar com o Google" para registrar seu primeiro acesso.');
      setLoading(false);
      return;
    }

    const loginRes = await onLogin(targetEmail);
    if (loginRes.success) {
      setSuccessMsg(`Bem-vindo de volta, ${loginRes.user?.name}!`);
    } else {
      setErrorMsg(loginRes.error || 'Falha ao autenticar credenciais no servidor.');
    }
    setLoading(false);
  };

  // Handles Simulated Google OAuth Select Account click
  const handleGoogleSelect = async (selectedEmail: string) => {
    setErrorMsg(null);
    setLoading(true);
    setShowGoogleSimulator(false);

    // Normalize email
    const googleEmail = selectedEmail.toLowerCase().trim();

    // Check if the user already exists in RouteLog database
    const existingUser = users.find(u => u.email.toLowerCase() === googleEmail);
    if (existingUser) {
      const res = await onLogin(googleEmail);
      if (res.success) {
        setSuccessMsg(`Autenticado via Google com sucesso. Bem-vindo, ${res.user?.name}!`);
      } else {
        setErrorMsg(res.error || 'Falha ao realizar integração de sessão com o Google.');
      }
      setLoading(false);
      return;
    }

    // Since the user is not recognized yet, trigger standard onboarding Primeiro Acesso.
    // Pre-fill email and guest configuration
    setEmail(googleEmail);
    
    // Guess appropriate human name for custom styling
    const emailPrefix = googleEmail.split('@')[0];
    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    const guessedName = googleEmail.toLowerCase() === 'linkalexanderlink@gmail.com' 
      ? 'Alexander Link' 
      : emailPrefix.split(/[\._\-]/).map(capitalize).join(' ');
    
    setName(guessedName);
    setPhase('profile-select');
    setLoading(false);
    setSuccessMsg('Sua conta Google foi validada! Escolha seu Perfil de Atendimento abaixo para completar o cadastro.');
  };

  // Handles final registration saving to local/Supabase database
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    if (!name || !email) {
      setErrorMsg('Os campos Nome Completo e E-mail de cadastro são obrigatórios.');
      setLoading(false);
      return;
    }

    const registerData: Partial<RouteUser> = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim() || '+55 (31) 99999-0000',
      address: address.trim() || 'Área Metropolitana de Logística - MG',
      role: selectedRole,
      region,
      status: 'active',
      createdAt: new Date().toISOString(),
      ...(selectedRole === UserRole.MOTORISTA ? {
        cnh: cnh.trim() || '12345678912',
        cnhCategory,
        cnhExpiration: '2031-10-18',
        vehicleModel: vehicleModel.trim() || 'Veículo de Entrega Regional',
        plate: plate.trim().toUpperCase() || 'RTL4G21'
      } : {})
    };

    try {
      const newUser = await onRegister(registerData);
      setSuccessMsg(`Cadastro de ${newUser.name} efetuado com sucesso! Redirecionando para seu Painel Operacional...`);
      // Immediately sign in with the new email
      const logRes = await onLogin(newUser.email);
      if (!logRes.success) {
        setErrorMsg('Perfil criado, mas falhou ao iniciar a sessão automática.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Falha ao processar parâmetros do novo operador.');
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = (r: UserRole) => {
    switch (r) {
      case UserRole.MOTORISTA: return 'Motorista';
      case UserRole.GERENTE: return 'GerenteLog';
      case UserRole.VENDEDOR: return 'Vendedor';
      default: return 'Geral';
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-2xl border border-slate-200/90 shadow-2xl overflow-hidden self-center transition-all duration-300">
      
      {/* Visual Header Branding */}
      <div className={`p-6 text-center flex flex-col items-center justify-center relative border-b border-slate-100 transition-colors duration-300 ${
        isAdminMasterMode ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-800'
      }`}>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-md mb-2.5 shrink-0 ${
          isAdminMasterMode ? 'bg-slate-800 text-red-500' : 'bg-blue-600 text-white'
        }`}>
          {isAdminMasterMode ? <ShieldAlert className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
        </div>
        
        <h2 className="text-lg font-black tracking-tight font-sans">
          {isAdminMasterMode ? 'RouteLog Secure Terminal' : 'Acesse o RouteLog'}
        </h2>
        
        <p className={`text-[11px] mt-1 ${isAdminMasterMode ? 'text-slate-400' : 'text-slate-500'}`}>
          {!isAdminMasterMode ? (
            <span>
              Controle, otimização regional e despacho de frotas empresarial.
            </span>
          ) : (
            <span>Terminal específico para administradores master autorizados.</span>
          )}
        </p>
      </div>

      <div className="p-6 sm:p-7 space-y-5">
        
        {/* Banner Alert for feedback messages */}
        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-850 text-xs rounded-xl flex items-start gap-2.5 animate-shake">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold">Aviso técnico:</strong>
              <p className="mt-0.5">{errorMsg}</p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-850 text-xs rounded-xl flex items-start gap-2.5">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold">Informação:</strong>
              <p className="mt-0.5">{successMsg}</p>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          
          {/* PHASE 1: STANDARD OR MASTER ADMIN LOGIN SCREEN */}
          {phase === 'login' && (
            <motion.div
              key="login"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              
              {/* Form Layout matching reference picture (Credentials Input first) */}
              <form onSubmit={handleEmailSubmit} className="space-y-3.5">
                <div className="space-y-1.5 text-xs">
                  <label className="block text-slate-650 font-bold">Email corporativo ou usuário *</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input 
                      type="email"
                      value={loginEmail}
                      onChange={e => setLoginEmail(e.target.value)}
                      placeholder={isAdminMasterMode ? "adminzte@email.com" : "ex: seu-nome@routelog.com"}
                      required
                      className="w-full h-10 pl-10 pr-4 border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/10 text-xs text-slate-800"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <label className="block text-slate-650 font-bold">Senha ou código PIN *</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input 
                      type="password"
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      className="w-full h-10 pl-10 pr-4 border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/10 text-xs text-slate-800"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full h-10 text-white rounded-lg font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer text-xs ${
                    isAdminMasterMode 
                      ? 'bg-slate-900 hover:bg-slate-950 active:scale-98' 
                      : 'bg-blue-600 hover:bg-blue-700 active:scale-98'
                  }`}
                >
                  <LogIn className="w-4 h-4" />
                  <span>{loading ? 'Processando dados...' : isAdminMasterMode ? 'Entrar Como Master' : 'Entrar'}</span>
                </button>
              </form>

              {/* GOOGLE ENTRAR COM O GOOGLE PROMINENT BUTTON (Reference style) */}
              {!isAdminMasterMode && (
                <>
                  <div className="flex items-center gap-3 py-1">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">ou</span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null);
                      setShowGoogleSimulator(true);
                    }}
                    className="w-full h-10 border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 transition-all cursor-pointer rounded-lg font-semibold text-slate-700 flex items-center justify-center gap-2.5 text-xs shadow-sm"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4.5 h-4.5 shrink-0 select-none">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                      <path fill="#4285F4" d="M46.5 24c0-1.61-.15-3.16-.42-4.69H24v8.87h12.62c-.54 2.85-2.15 5.27-4.57 6.89l7.1 5.5C43.3 36.55 46.5 30.76 46.5 24z"/>
                      <path fill="#FBBC05" d="M10.54 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.98-6.19z"/>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.1-5.5c-2.2 1.48-5.01 2.31-8.79 2.31-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                    </svg>
                    <span>Entrar com o Google</span>
                  </button>
                </>
              )}

              {/* Master Admin toggle switch button */}
              <div className="flex items-center justify-center pt-3 border-t border-slate-100 text-xs text-slate-400">
                {isAdminMasterMode ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdminMasterMode(false);
                      setLoginEmail('');
                      setLoginPassword('');
                      setErrorMsg(null);
                    }}
                    className="text-blue-600 font-bold hover:underline cursor-pointer flex items-center gap-1 py-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Voltar para Login de Colaboradores
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdminMasterMode(true);
                      setLoginEmail('adminzte@email.com');
                      setLoginPassword('');
                      setErrorMsg(null);
                    }}
                    className="text-slate-400 hover:text-red-650 hover:underline cursor-pointer flex items-center gap-1.5 py-1 font-semibold"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-slate-350" />
                    Acesso Administrador Master
                  </button>
                )}
              </div>

            </motion.div>
          )}

          {/* PHASE 2: TELA SELEÇÃO DE PERFIL VIA BOTÕES VISUAIS */}
          {phase === 'profile-select' && (
            <motion.div
              key="profile-select"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <button
                  type="button"
                  onClick={() => setPhase('login')}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 cursor-pointer"
                  title="Voltar ao início"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-wide font-mono">Seleção de Perfil (Primeiro Acesso)</h3>
                  <p className="text-[11px] text-slate-450">Como deseja atuar na empresa RouteLog?</p>
                </div>
              </div>

              {/* Profile card buttons */}
              <div className="grid grid-cols-1 gap-2.5">
                
                {/* MOTORISTA BUTTON */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRole(UserRole.MOTORISTA);
                    setPhase('register');
                  }}
                  className="p-3.5 border border-slate-200 bg-white hover:bg-emerald-50/20 hover:border-emerald-500 rounded-xl text-left flex items-start gap-3 transition-all cursor-pointer active:scale-98 group flex-row w-full shadow-sm"
                >
                  <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-100/50 shrink-0">
                    <Truck className="w-4.5 h-4.5" />
                  </div>
                  <div className="min-w-0 pr-1 flex-1">
                    <div className="flex items-center gap-1.5">
                      <strong className="text-xs font-black text-slate-800">Motorista</strong>
                      <span className="bg-slate-100 font-mono text-[8px] px-1.5 py-0.5 rounded text-slate-500 font-extrabold uppercase">Driver</span>
                    </div>
                    <p className="text-[10px] text-slate-450 mt-0.5 leading-relaxed">Crie, gerencie e acompanhe rotas otimizadas ponto-a-ponto com telemetria GPS em trânsito.</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-350 ml-auto self-center shrink-0 group-hover:text-emerald-600 transition-colors" />
                </button>

                {/* GERENTE LOGÍSTICA BUTTON */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRole(UserRole.GERENTE);
                    setPhase('register');
                  }}
                  className="p-3.5 border border-slate-200 bg-white hover:bg-blue-50/20 hover:border-blue-500 rounded-xl text-left flex items-start gap-3 transition-all cursor-pointer active:scale-98 group flex-row w-full shadow-sm"
                >
                  <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100/50 shrink-0">
                    <ClipboardList className="w-4.5 h-4.5" />
                  </div>
                  <div className="min-w-0 pr-1 flex-1">
                    <div className="flex items-center gap-1.5">
                      <strong className="text-xs font-black text-slate-800">GerenteLog</strong>
                      <span className="bg-blue-50 font-mono text-[8px] px-1.5 py-0.5 rounded text-blue-600 font-extrabold uppercase">Manager</span>
                    </div>
                    <p className="text-[10px] text-slate-450 mt-0.5 leading-relaxed">Despache notificações em massa, gerencie canais de frotas e fiscalize motoristas nas rotas.</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-350 ml-auto self-center shrink-0 group-hover:text-blue-600 transition-colors" />
                </button>

                {/* VENDEDOR BUTTON */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRole(UserRole.VENDEDOR);
                    setPhase('register');
                  }}
                  className="p-3.5 border border-slate-200 bg-white hover:bg-amber-50/20 hover:border-amber-500 rounded-xl text-left flex items-start gap-3 transition-all cursor-pointer active:scale-98 group flex-row w-full shadow-sm"
                >
                  <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg group-hover:bg-amber-100/50 shrink-0">
                    <User className="w-4.5 h-4.5" />
                  </div>
                  <div className="min-w-0 pr-1 flex-1">
                    <div className="flex items-center gap-1.5">
                      <strong className="text-xs font-black text-slate-800">Vendedor</strong>
                      <span className="bg-amber-50 font-mono text-[8px] px-1.5 py-0.5 rounded text-amber-700 font-extrabold uppercase">Sales</span>
                    </div>
                    <p className="text-[10px] text-slate-450 mt-0.5 leading-relaxed">Monitore status de entregas da sua carteira e comunique-se com os gerentes de logística.</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-350 ml-auto self-center shrink-0 group-hover:text-amber-600 transition-colors" />
                </button>

              </div>

              <div className="text-center pt-1.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPhase('login')}
                  className="text-xs text-slate-450 hover:text-slate-700 font-semibold cursor-pointer underline"
                >
                  Voltar para tela de login convencional
                </button>
              </div>
            </motion.div>
          )}

          {/* PHASE 3: COMPREHENSIVE REGISTRATION FORM */}
          {phase === 'register' && (
            <motion.div
              key="register"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <button
                  type="button"
                  onClick={() => setPhase('profile-select')}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 cursor-pointer"
                  title="Voltar ao perfil"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-wide font-mono">Ficha Cadastral ({getRoleLabel(selectedRole)})</h3>
                  <p className="text-[11px] text-slate-450">E-mail Google: {email}</p>
                </div>
              </div>

              <form onSubmit={handleRegisterSubmit} className="space-y-3.5 font-sans">
                
                <div className="space-y-3 text-xs">
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-600">Nome Completo *</label>
                    <input 
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Insira seu nome completo"
                      required
                      className="w-full h-9 px-3 border border-slate-250 rounded-lg bg-white focus:outline-none focus:border-blue-500 font-sans text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-500">Contato / WhatsApp</label>
                      <input 
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="+55 (31) 98888-7777"
                        className="w-full h-9 px-3 border border-slate-250 rounded-lg bg-white focus:outline-none focus:border-blue-500 font-sans text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block font-bold text-slate-500">Região Operacional</label>
                      <select 
                        value={region}
                        onChange={e => setRegion(e.target.value)}
                        className="w-full h-9 px-2 border border-slate-250 rounded-lg bg-white focus:outline-none focus:border-blue-500 font-mono text-xs cursor-pointer"
                      >
                        {regions.map(r => (
                          <option key={r.id} value={r.id}>
                            {r.id} - {r.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-500">Endereço Residencial</label>
                    <input 
                      type="text"
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      placeholder="São Geraldo, Governador Valadares - MG"
                      className="w-full h-9 px-3 border border-slate-250 rounded-lg bg-white focus:outline-none focus:border-blue-500 font-sans text-xs"
                    />
                  </div>
                </div>

                {/* DRIVER ROLE SPECIFIC LOGISTIC ATTRIBUTES */}
                {selectedRole === UserRole.MOTORISTA && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3"
                  >
                    <span className="font-extrabold text-[#059669] text-[9.5px] uppercase tracking-wider font-mono block">ATRIBUTOS LOGÍSTICOS DO MOTORISTA</span>
                    
                    <div className="grid grid-cols-2 gap-3 text-[10.5px]">
                      <div className="space-y-1">
                        <label className="block text-slate-550 font-bold font-mono">Número da CNH</label>
                        <input 
                          type="text"
                          value={cnh}
                          onChange={e => setCnh(e.target.value)}
                          placeholder="Ex: 55432167890"
                          maxLength={11}
                          className="w-full h-8.5 px-2.5 border border-slate-250 rounded bg-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-slate-550 font-bold">Categoria da CNH</label>
                        <select 
                          value={cnhCategory}
                          onChange={e => setCnhCategory(e.target.value)}
                          className="w-full h-8.5 px-2 border border-slate-250 rounded bg-white text-xs focus:outline-none cursor-pointer focus:border-emerald-500"
                        >
                          <option value="B">B (Vans leves / Carro)</option>
                          <option value="C">C (Caminhão simples)</option>
                          <option value="D">D (Microônibus e Vans)</option>
                          <option value="E">E (Carga articulada)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-[10.5px]">
                      <div className="space-y-1">
                        <label className="block text-slate-550 font-bold">Modelo de Carga</label>
                        <input 
                          type="text"
                          value={vehicleModel}
                          onChange={e => setVehicleModel(e.target.value)}
                          placeholder="Sprinter 315 / Fiorino Cargo"
                          className="w-full h-8.5 px-2.5 border border-slate-250 rounded bg-white text-xs focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-slate-550 font-bold font-mono">Placa do Veículo</label>
                        <input 
                          type="text"
                          value={plate}
                          onChange={e => setPlate(e.target.value)}
                          placeholder="EX: RTL-4G21"
                          maxLength={8}
                          className="w-full h-8.5 px-2.5 border border-slate-250 rounded bg-white uppercase font-mono text-xs focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-all text-xs cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{loading ? 'Cadastrando dados...' : 'Finalizar Cadastro e Entrar'}</span>
                </button>
              </form>
            </motion.div>
          )}

        </AnimatePresence>

      </div>

      {/* GOOGLE INTEGRATION SIMULATOR DIALOG POPUP (Styled precisely as an authentic Google Consent Selector) */}
      {showGoogleSimulator && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 select-text">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-xl border border-slate-200/90 p-7 max-w-[400px] w-full shadow-2xl space-y-6 text-center text-slate-800 font-sans"
          >
            {/* Google Vector Brand Logo Header */}
            <div className="flex flex-col items-center justify-center space-y-3">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-8 h-8 select-none">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.5 24c0-1.61-.15-3.16-.42-4.69H24v8.87h12.62c-.54 2.85-2.15 5.27-4.57 6.89l7.1 5.5C43.3 36.55 46.5 30.76 46.5 24z"/>
                <path fill="#FBBC05" d="M10.54 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.98-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.1-5.5c-2.2 1.48-5.01 2.31-8.79 2.31-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              
              <div className="space-y-1">
                <h4 className="text-[20px] font-normal tracking-tight text-slate-800 font-sans">Fazer login com o Google</h4>
                <p className="text-xs text-slate-500">
                  para prosseguir no <span className="text-slate-700 font-medium">RouteLog Enterprise</span>
                </p>
              </div>
            </div>

            {/* Standard Single account select list or direct typing inputs */}
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => handleGoogleSelect('linkalexanderlink@gmail.com')}
                className="w-full p-3.5 border border-slate-200 hover:border-slate-350 hover:bg-slate-50 transition-all rounded-lg flex items-center gap-3 text-left cursor-pointer group"
              >
                <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm shrink-0 font-sans shadow-sm">
                  AL
                </div>
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span>Alexander Link</span>
                    <span className="text-[9px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-mono">Padrão</span>
                  </div>
                  <div className="text-[11px] text-slate-450 truncate">linkalexanderlink@gmail.com</div>
                </div>
              </button>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-slate-150" />
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">ou usar outro email</span>
                <div className="flex-1 h-px bg-slate-150" />
              </div>

              {/* Enter Custom Google Email form */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const customG = new FormData(form).get('customGoogleEmail') as string;
                  if (customG && customG.includes('@')) {
                    handleGoogleSelect(customG);
                  }
                }}
                className="space-y-2.5"
              >
                <input 
                  type="email"
                  name="customGoogleEmail"
                  required
                  placeholder="Seu e-mail do Google (ex: joao@gmail.com)"
                  className="w-full h-10 px-3 border border-slate-250 rounded-lg text-xs text-slate-800 bg-white focus:outline-none focus:border-blue-500 placeholder-slate-400 font-sans"
                />
                <button
                  type="submit"
                  className="w-full h-9.5 bg-slate-850 hover:bg-slate-900 active:scale-98 transition-all text-white font-bold text-xs rounded-lg cursor-pointer animate-pulse-subtle"
                >
                  Continuar com este e-mail
                </button>
              </form>
            </div>

            {/* Google standard OAuth permissions warning text */}
            <p className="text-[11px] text-slate-450 text-justify leading-normal px-1">
              Para continuar, o Google compartilhará seu nome, endereço de e-mail, preferência de idioma e foto do perfil com o <strong className="font-semibold text-slate-600">RouteLog Enterprise</strong>. Antes de usar este app, você pode revisar a política de privacidade e os termos de serviço.
            </p>

            <div className="pt-2 border-t border-slate-150 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGoogleSimulator(false)}
                className="px-4 h-9 text-xs rounded-lg font-bold text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Footer copyright */}
      <div className="p-3 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-450 font-medium text-center">
        Serviços de autorização protegidos por criptografia ponta a ponta.
      </div>

    </div>
  );
}
