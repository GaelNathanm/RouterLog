/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { UserRole, RouteUser, Region } from '../types';
import { REGIONS_LIST, INITIAL_REGIONS } from '../mockData';
import { ShieldAlert, User, Truck, ClipboardList, LogIn, ChevronRight, UserPlus2, RefreshCw, EyeOff } from 'lucide-react';
import GoogleAuthButton from './GoogleAuthButton';

interface LoginMenuProps {
  users: RouteUser[];
  regions?: Region[];
  onLogin: (email: string, password?: string) => Promise<{ success: boolean; error?: string; user?: RouteUser }> | any;
  sendPasswordlessSignInLink?: (email: string) => Promise<{ success: boolean; error?: string }>;
  onRegister: (data: Partial<RouteUser> & { password?: string }) => Promise<RouteUser> | any;
  onReset: () => void;
  currentUser: RouteUser | null;
  onLogout: () => void;
  onViewProfile?: () => void;
  onCollapse?: () => void;
}

export default function UserLoginMenu({ users, regions = INITIAL_REGIONS, onLogin, sendPasswordlessSignInLink, onRegister, onReset, currentUser, onLogout, onViewProfile, onCollapse }: LoginMenuProps) {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Credentials login states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Passwordless email link states
  const [isPasswordlessMode, setIsPasswordlessMode] = useState(false);
  const [passwordlessEmail, setPasswordlessEmail] = useState('');
  const [passwordlessSent, setPasswordlessSent] = useState(false);
  const [isPasswordlessLoading, setIsPasswordlessLoading] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.MOTORISTA);
  const [region, setRegion] = useState('GV1');
  const [cnh, setCnh] = useState('');
  const [cnhCategory, setCnhCategory] = useState('D');
  const [cnhExpiration, setCnhExpiration] = useState('2030-12-31');
  const [vehicleModel, setVehicleModel] = useState('');
  const [plate, setPlate] = useState('');

  const submitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name || !email) {
      setErrorMsg('Por favor, preencha Nome e E-mail.');
      return;
    }

    setIsAuthenticating(true);

    const regData: Partial<RouteUser> & { password?: string } = {
      name,
      email,
      phone,
      address,
      role,
      region,
      password: password || undefined,
      ...(role === UserRole.MOTORISTA ? {
        cnh,
        cnhCategory,
        cnhExpiration,
        vehicleModel,
        plate
      } : {})
    };

    try {
      await onRegister(regData);
      setIsRegisterMode(false);
      // Clear form
      setName('');
      setEmail('');
      setPassword('');
      setPhone('');
      setAddress('');
      setCnh('');
      setVehicleModel('');
      setPlate('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao realizar cadastro.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const selectPreset = async (emailStr: string) => {
    setErrorMsg(null);
    setIsAuthenticating(true);
    try {
      const result = await onLogin(emailStr);
      if (!result.success) {
        setErrorMsg(result.error || 'Erro ao realizar login.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao tentar login.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const submitCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!loginEmail || !loginPassword) {
      setErrorMsg('Por favor, informe seu email e senha.');
      return;
    }
    setIsAuthenticating(true);
    try {
      const result = await onLogin(loginEmail, loginPassword);
      if (result.success) {
        setLoginEmail('');
        setLoginPassword('');
      } else {
        setErrorMsg(result.error || 'Credenciais inválidas.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro de autenticação.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const submitPasswordlessLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setPasswordlessSent(false);

    if (!passwordlessEmail) {
      setErrorMsg('Por favor, informe seu e-mail cadastrado.');
      return;
    }

    if (!sendPasswordlessSignInLink) {
      setErrorMsg('Serviço de login sem senha não configurado.');
      return;
    }

    setIsPasswordlessLoading(true);
    try {
      const result = await sendPasswordlessSignInLink(passwordlessEmail);
      if (result.success) {
        setPasswordlessSent(true);
        setPasswordlessEmail('');
      } else {
        setErrorMsg(result.error || 'Erro ao enviar o link de acesso.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro inesperado.');
    } finally {
      setIsPasswordlessLoading(false);
    }
  };

  const getRoleIcon = (roleType: UserRole) => {
    switch (roleType) {
      case UserRole.ADMIN: return <ShieldAlert className="w-4 h-4 text-rose-600" />;
      case UserRole.GERENTE: return <ClipboardList className="w-4 h-4 text-blue-600" />;
      case UserRole.MOTORISTA: return <Truck className="w-4 h-4 text-emerald-600" />;
      case UserRole.VENDEDOR: return <User className="w-4 h-4 text-amber-600" />;
    }
  };

  const getRoleBadge = (roleType: UserRole) => {
    switch (roleType) {
      case UserRole.ADMIN: return 'bg-rose-50 text-rose-700 border-rose-100';
      case UserRole.GERENTE: return 'bg-blue-50 text-blue-700 border-blue-100';
      case UserRole.MOTORISTA: return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case UserRole.VENDEDOR: return 'bg-amber-50 text-amber-700 border-amber-100';
    }
  };

  const getRoleLabel = (roleType: UserRole) => {
    switch (roleType) {
      case UserRole.ADMIN: return 'Administrador Geral';
      case UserRole.GERENTE: return 'Gerente Logística';
      case UserRole.MOTORISTA: return 'Motorista';
      case UserRole.VENDEDOR: return 'Vendedor Regional';
    }
  };

  return (
    <div id="auth-simulator-sider" className="h-full flex flex-col bg-slate-50 border-r border-slate-200/80 p-5">
      
      {/* Upper Logo header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-1.5 font-sans">
            <Truck className="w-5 h-5 text-blue-600 shrink-0" />
            RouteLog <span className="bg-emerald-100 text-emerald-800 text-[10px] font-mono px-2 py-0.5 rounded-full">Enterprise</span>
          </h1>
          <p className="text-[10px] text-slate-400 mt-1 font-mono">STATUS: Controle de Frotas Ativo</p>
        </div>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            title="Ocultar Simulador de Login"
            className="p-1.5 hover:bg-slate-200/60 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer shrink-0"
          >
            <EyeOff className="w-4 h-4" />
          </button>
        )}
      </div>

      {currentUser ? (
        // LOGGED USER CARD INFO
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 left-0 h-1.5 bg-blue-600"></div>
            
            <div className="flex items-center gap-2 mb-3">
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${getRoleBadge(currentUser.role)}`}>
                {getRoleLabel(currentUser.role)}
              </span>
              
              {(currentUser as any).region && (
                <span className="bg-slate-100 text-slate-600 border border-slate-200 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded">
                  REG: {(currentUser as any).region}
                </span>
              )}
            </div>

            <h3 className="text-sm font-bold text-slate-800">{currentUser.name}</h3>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">{currentUser.email}</p>

            <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-500">
              <div>
                <span className="text-[8px] text-slate-400 block uppercase">Status</span>
                <span className="text-emerald-600 font-semibold uppercase">● Ativo</span>
              </div>
              {currentUser.role === UserRole.MOTORISTA && (
                <div>
                  <span className="text-[8px] text-slate-400 block uppercase">Placa</span>
                  <span className="text-slate-700 font-bold uppercase">{(currentUser as any).plate}</span>
                </div>
              )}
            </div>
          </div>

          {onViewProfile && (
            <button
              onClick={onViewProfile}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold hover:shadow-md transition-all cursor-pointer"
            >
              <User className="w-3.5 h-3.5" />
              Ver / Editar Meu Perfil
            </button>
          )}

          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-4 border border-slate-200 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50/50 bg-white transition-colors cursor-pointer"
          >
            Fazer Logout (Voltar Sessão)
          </button>
        </div>
      ) : isRegisterMode ? (
        
        // REGISTER MODE FORM (FIRST ACCESS FLOW)
        <div className="flex-1 overflow-y-auto pr-1">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <UserPlus2 className="w-4 h-4 text-blue-600" />
              Onboarding de Primeiro Acesso
            </span>
            <button 
              onClick={() => setIsRegisterMode(false)}
              className="text-blue-600 hover:text-blue-800 text-xs font-semibold cursor-pointer"
            >
              Fazer Login
            </button>
          </div>

          <form onSubmit={submitRegister} className="space-y-3.5 text-xs">
            {errorMsg && (
              <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-700 rounded text-[11px]">
                {errorMsg}
              </div>
            )}

            <div>
              <label className="block text-slate-500 mb-1 font-medium">Selecione seu Perfil Operacional *</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setRole(UserRole.MOTORISTA)}
                  className={`p-2 border rounded-lg text-center font-medium transition-all flex flex-col items-center gap-1 cursor-pointer ${
                    role === UserRole.MOTORISTA 
                      ? 'border-blue-600 bg-blue-50/50 text-blue-700 shadow-sm' 
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Truck className="w-4 h-4" />
                  <span>Motorista</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole(UserRole.GERENTE)}
                  className={`p-2 border rounded-lg text-center font-medium transition-all flex flex-col items-center gap-1 cursor-pointer ${
                    role === UserRole.GERENTE 
                      ? 'border-blue-600 bg-blue-50/50 text-blue-700 shadow-sm' 
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <ClipboardList className="w-4 h-4" />
                  <span>Gerente</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole(UserRole.VENDEDOR)}
                  className={`p-2 border rounded-lg text-center font-medium transition-all flex flex-col items-center gap-1 cursor-pointer ${
                    role === UserRole.VENDEDOR 
                      ? 'border-blue-600 bg-blue-50/50 text-blue-700 shadow-sm' 
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span>Vendedor</span>
                </button>
              </div>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-slate-200">
              <div>
                <label className="block text-slate-500 mb-1">Nome Completo *</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)}
                  placeholder="Nome do operador" 
                  className="w-full border border-slate-200 p-2 rounded-lg bg-white focus:outline-none focus:border-blue-500" 
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 mb-1 font-medium">E-mail *</label>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)}
                    placeholder="ex@routelog.com" 
                    className="w-full border border-slate-200 p-2 rounded-lg bg-white focus:outline-none focus:border-blue-500" 
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">WhatsApp de Contato</label>
                  <input 
                    type="text" 
                    value={phone} 
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+55 31 9999-9999" 
                    className="w-full border border-slate-200 p-2 rounded-lg bg-white focus:outline-none focus:border-blue-500" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Endereço Residencial</label>
                <input 
                  type="text" 
                  value={address} 
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Rua, Número, Bairro, Cidade" 
                  className="w-full border border-slate-200 p-2 rounded-lg bg-white focus:outline-none focus:border-blue-500" 
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Região Operacional</label>
                <select 
                  value={region} 
                  onChange={e => setRegion(e.target.value)}
                  className="w-full border border-slate-200 p-2 rounded-lg bg-white focus:outline-none focus:border-blue-500 font-mono text-xs"
                >
                  {regions.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.id} - {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Crie uma Senha (Credenciais Firebase Reais) *</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres" 
                  className="w-full border border-slate-200 p-2 rounded-lg bg-white focus:outline-none focus:border-blue-500" 
                  required
                />
              </div>

              {/* PROFILE SPECIFIC - DRIVER CNH & VEHICLE SPECS */}
              {role === UserRole.MOTORISTA && (
                <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl space-y-2 mt-2">
                  <span className="font-bold text-blue-950 text-[10px] uppercase block">Atributos de Trânsito Obrigatórios</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">Registro CNH</label>
                      <input 
                        type="text" 
                        value={cnh} 
                        onChange={e => setCnh(e.target.value)}
                        placeholder="11 dígitos" 
                        className="w-full border border-slate-200 p-1.5 rounded bg-white" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">Categoria CNH</label>
                      <select 
                        value={cnhCategory} 
                        onChange={e => setCnhCategory(e.target.value)}
                        className="w-full border border-slate-200 p-1.5 rounded bg-white text-slate-700"
                      >
                        <option value="B">Cat B (Carro)</option>
                        <option value="C">Cat C (Carga)</option>
                        <option value="D">Cat D (Van/Microônibus)</option>
                        <option value="E">Cat E (Articulado)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">Modelo do Veículo</label>
                      <input 
                        type="text" 
                        value={vehicleModel} 
                        onChange={e => setVehicleModel(e.target.value)}
                        placeholder="Ex: Sprinter 315" 
                        className="w-full border border-slate-200 p-1.5 rounded bg-white" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">Placa (Placa Mercosul)</label>
                      <input 
                        type="text" 
                        value={plate} 
                        onChange={e => setPlate(e.target.value)}
                        placeholder="Ex: RTL-4G21" 
                        className="w-full border border-slate-200 p-1.5 rounded bg-white uppercase font-mono" 
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-sm transition-colors cursor-pointer mt-3"
            >
              Criar Perfil e Acessar Home
            </button>
          </form>
        </div>

      ) : (

        // DEFAULT OPERATOR LOGIN PANEL
        <div className="flex-1 overflow-y-auto pr-1">
          <div className="mb-4">
            <span className="text-xs font-bold text-slate-700 block col-span-full">Controle de Sessão Operacional</span>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed font-sans">
              Autentique-se via Google, com sua Conta Real Firebase, ou crie seu perfil de operador para acessar o rastreamento e controle logístico.
            </p>
          </div>

          {errorMsg && (
            <div className="p-2 mb-3 bg-rose-50 border border-rose-100 text-rose-700 rounded text-[11px]">
              {errorMsg}
            </div>
          )}

          {/* Form Selection Toggle */}
          <div className="flex bg-slate-200/60 p-1 rounded-lg text-xs font-semibold mb-4">
            <button
              type="button"
              onClick={() => { setIsPasswordlessMode(false); setPasswordlessSent(false); }}
              className={`flex-1 py-1.5 rounded-md text-center transition-all cursor-pointer ${!isPasswordlessMode ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Entrar com Senha
            </button>
            <button
              type="button"
              onClick={() => { setIsPasswordlessMode(true); }}
              className={`flex-1 py-1.5 rounded-md text-center transition-all cursor-pointer ${isPasswordlessMode ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Link por E-mail (Sem Senha)
            </button>
          </div>

          {isPasswordlessMode ? (
            /* Passwordless Email Link Login Form */
            <form onSubmit={submitPasswordlessLogin} className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-sm mb-4 space-y-2.5">
              <span className="text-[9px] font-black text-indigo-600 block uppercase tracking-wider font-mono">Acesso Sem Senha • Firebase Link</span>
              
              {passwordlessSent ? (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-800 text-[11px] leading-relaxed">
                  📧 <strong className="font-bold">Link enviado!</strong> Verifique a caixa de entrada do seu e-mail para concluir a autenticação com segurança.
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <input 
                      type="email" 
                      placeholder="Seu E-mail Cadastrado" 
                      value={passwordlessEmail}
                      onChange={e => setPasswordlessEmail(e.target.value)}
                      className="w-full border border-slate-200 p-2 rounded-lg text-xs bg-white focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isPasswordlessLoading}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-[10px] uppercase rounded-lg shadow-sm transition-all text-center tracking-wider flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {isPasswordlessLoading ? 'Enviando link...' : 'Enviar Link de Acesso'}
                  </button>
                </>
              )}
            </form>
          ) : (
            /* Real Credentials Login Form */
            <form onSubmit={submitCredentialsLogin} className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-sm mb-4 space-y-2.5">
              <span className="text-[9px] font-black text-blue-600 block uppercase tracking-wider font-mono">Acesso Credenciais Reais • Firebase</span>
              <div className="space-y-1.5">
                <input 
                  type="email" 
                  placeholder="E-mail Real" 
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  className="w-full border border-slate-200 p-2 rounded-lg text-xs bg-white focus:outline-none focus:border-blue-500"
                  required
                />
                <input 
                  type="password" 
                  placeholder="Senha de Acesso" 
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  className="w-full border border-slate-200 p-2 rounded-lg text-xs bg-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isAuthenticating}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-[10px] uppercase rounded-lg shadow-sm transition-all text-center tracking-wider flex items-center justify-center gap-1 cursor-pointer animate-none"
              >
                {isAuthenticating ? 'Autenticando...' : 'Entrar com Conta Real'}
              </button>
            </form>
          )}

          <div className="mb-4">
            <GoogleAuthButton onAuthError={(err) => setErrorMsg(err)} />
          </div>

          <div className="mt-5 pt-4 border-t border-slate-200">
            <button
              onClick={() => setIsRegisterMode(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-4 border border-blue-600/30 rounded-lg text-xs font-bold text-blue-700 hover:bg-blue-50 bg-white transition-all cursor-pointer"
            >
              <UserPlus2 className="w-4 h-4" />
              Entrar como Novo Operador
            </button>
          </div>

          <div className="mt-4 p-3 bg-slate-100 rounded-xl space-y-2">
            <span className="font-semibold text-slate-700 text-[10px] block uppercase">Acesso Geral do Administrador</span>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Autenticação master centralizada com permissões completas para supervisão do fluxo de frotas e auditorias de sistema.
            </p>
            <button
              onClick={() => {
                window.history.pushState({}, '', '/admin-login');
              }}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-slate-900 hover:bg-slate-950 text-white rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all shadow-sm cursor-pointer"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
              Acessar Portal Master (/admin-login)
            </button>
          </div>
        </div>
      )}

      {/* Footer credits representation */}
      <div className="mt-auto pt-4 border-t border-slate-200/80 text-[10px] text-slate-400 font-mono">
        LOGISTICS OPERATIONS SYSTEM v1.0
      </div>
    </div>
  );
}
