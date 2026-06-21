/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useRouteLogState } from './useRouteLogState';
import { UserRole } from './types';
import UserLoginMenu from './components/UserLoginMenu';
import TechDocumentation from './components/TechDocumentation';
import AdminLoginGateway from './components/AdminLoginGateway';
import ActiveSessionBlocker from './components/ActiveSessionBlocker';
import { AdminDashboard } from './components/AdminDashboard';
import { 
  GerenteDashboard, 
  MotoristaDashboard, 
  VendedorDashboard 
} from './components/RoleViews';
import { 
  Network, Play, HelpCircle, EyeOff, ShieldAlert,
  Info, AlertTriangle, AlertCircle, Compass, CheckCircle2 
} from 'lucide-react';
import { NetworkGpsStatusWidget } from './components/NetworkGpsStatusWidget';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const {
    users,
    rotas,
    locations,
    breadcrumbs,
    chats,
    notifications,
    auditLogs,
    performanceLogs,
    setPerformanceLogs,
    pushLogs,
    setPushLogs,
    regions,
    pushConfig,
    setPushConfig,
    sendSegmentedPush,
    currentUser,
    impersonatingUser,
    activeSessionUser,
    handleLogin,
    handleRegister,
    handleLogout,
    handleImpersonate,
    handleModerateUser,
    handleUpdateUser,
    handleCreateUser,
    handleDeleteUser,
    handleSaveRegion,
    handleDeleteRegion,
    dispatchCustomPush,
    handleCreateRoute,
    handleUpdateRoute,
    handleDeleteRoute,
    handleOptimizeRoute,
    handleStartRoute,
    handlePostMessage,
    resetAllData,
    isDemoSimulationActive,
    setIsDemoSimulationActive
  } = useRouteLogState();

  const [activeTab, setActiveTab] = useState<'simulation' | 'docs'>('simulation');
  const [fcmToast, setFcmToast] = useState<{ title: string; body: string; type: string } | null>(null);
  const [currentPathname, setCurrentPathname] = useState(typeof window !== 'undefined' ? window.location.pathname : '/');

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPathname(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    
    const originalPushState = window.history.pushState;
    window.history.pushState = function(...args) {
      const result = originalPushState.apply(this, args);
      window.dispatchEvent(new Event('pushstate'));
      window.dispatchEvent(new Event('locationchange'));
      return result;
    };
    
    window.addEventListener('locationchange', handleLocationChange);
    window.addEventListener('pushstate', handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('locationchange', handleLocationChange);
      window.removeEventListener('pushstate', handleLocationChange);
      window.history.pushState = originalPushState;
    };
  }, []);

  useEffect(() => {
    const handleFcm = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { title, body, type, region, role } = customEvent.detail;
      
      if (activeSessionUser) {
        const matchesRole = role === 'all' || activeSessionUser.role === role;
        const isUserAdmin = Number(activeSessionUser.role) === UserRole.ADMIN || String(activeSessionUser.role) === '0' || String(activeSessionUser.role).toLowerCase() === 'admin';
        const matchesRegion = region === 'all' || (activeSessionUser as any).region === region || isUserAdmin;
        
        if (matchesRole && matchesRegion) {
          setFcmToast({ title, body, type });
          // Auto close toaster after 6 seconds
          const timer = setTimeout(() => {
            setFcmToast(null);
          }, 6000);
          return () => clearTimeout(timer);
        }
      }
    };
    window.addEventListener('fcm_notification_received', handleFcm);
    return () => window.removeEventListener('fcm_notification_received', handleFcm);
  }, [activeSessionUser]);

  const matchesAdminRole = activeSessionUser && (Number(activeSessionUser.role) === UserRole.ADMIN || String(activeSessionUser.role) === '0' || String(activeSessionUser.role).toLowerCase() === 'admin');
  const matchesGerenteRole = activeSessionUser && (Number(activeSessionUser.role) === UserRole.GERENTE || String(activeSessionUser.role) === '1' || String(activeSessionUser.role).toLowerCase() === 'gerente');

  const isWidescreen = activeSessionUser && 
    (matchesAdminRole || matchesGerenteRole) && 
    activeTab !== 'docs';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      
      {/* Top Universal Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm px-6 py-4">
        <div className={`mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 transition-all duration-300 ${isWidescreen ? 'max-w-full px-2 lg:px-6' : 'max-w-7xl'}`}>
          
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-100">
              <Compass className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-slate-900">RouteLog Enterprise</span>
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold">
                  Produção Ativa
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                Logística de Rotas Multi-Paradas de Alta Reatividade
              </p>
            </div>
          </div>

          {/* Right items: Status + Tabs */}
          <div className="flex flex-col sm:flex-row items-center gap-3.5">
            {isWidescreen && activeSessionUser && (
              <div className="flex items-center gap-2.5 bg-slate-100/95 border border-slate-200 px-3 py-1.5 rounded-xl text-xs shadow-sm">
                <div className="flex flex-col text-right">
                  <span className="font-bold text-slate-800 text-[11px] leading-tight truncate max-w-[150px]">
                    {activeSessionUser.name}
                  </span>
                  <span className="text-[9px] text-[#4f46e5] bg-[#e0e7ff] px-1.5 py-0.5 border border-[#c7d2fe]/50 rounded font-mono font-black leading-none mt-0.5">
                    {matchesAdminRole ? 'ADMIN MASTER' : `GERENTE (Região ${ (activeSessionUser as any).region || '' })`}
                  </span>
                </div>
                <div className="w-px h-6 bg-slate-300/80"></div>
                <button
                  onClick={handleLogout}
                  title="Fazer Logout"
                  className="text-rose-600 hover:text-white hover:bg-rose-600 transition-all p-1.5 px-2.5 border border-rose-250 hover:border-transparent rounded-lg text-[10px] font-bold cursor-pointer bg-white shadow-sm flex items-center justify-center"
                >
                  Sair do Painel
                </button>
              </div>
            )}

            <NetworkGpsStatusWidget />
            
            {/* Core Master Tabs (Simulation vs Docs) */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-250/20 font-mono text-xs">
              <button
                onClick={() => setActiveTab('simulation')}
                className={`px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 font-bold cursor-pointer ${
                  activeTab === 'simulation' 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-950 hover:bg-slate-200/50'
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Painel Operacional
              </button>
              <button
                onClick={() => setActiveTab('docs')}
                className={`px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 font-bold cursor-pointer ${
                  activeTab === 'docs' 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-950 hover:bg-slate-200/50'
                }`}
              >
                <Network className="w-3.5 h-3.5" />
                Especificações Técnicas
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Board Area */}
      <main className={`flex-grow w-full mx-auto p-4 sm:p-6 transition-all duration-300 ${
        currentPathname === '/admin-login'
          ? 'max-w-2xl justify-center items-center py-10'
          : isWidescreen 
            ? 'max-w-full px-4 sm:px-8 xl:px-10 flex flex-col gap-6' 
            : 'max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch'
      }`}>
        
        {currentPathname === '/admin-login' ? (
          <div className="w-full col-span-full">
            <AdminLoginGateway
              onLogin={handleLogin}
              onSuccess={() => {
                window.history.pushState({}, '', '/');
              }}
            />
          </div>
        ) : (
          <>
            {/* Left Column: Sider Profile login representation (4 columns) */}
            {!isWidescreen && (
              <div className="lg:col-span-4 h-full">
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md overflow-hidden flex flex-col h-full min-h-[460px]">
                  <UserLoginMenu
                    users={users}
                    regions={regions}
                    onLogin={handleLogin}
                    onRegister={handleRegister}
                    onReset={resetAllData}
                    currentUser={currentUser}
                    onLogout={handleLogout}
                  />
                </div>
              </div>
            )}

            {/* Right Column: Dynamic workspace content (8 columns or full width) */}
            <div className={`${isWidescreen ? 'w-full' : 'lg:col-span-8'} flex flex-col h-full`}>

          {/* SUPERVISOR FLOATING WARNING NOTEPAD */}
          {impersonatingUser && (
            <div className="mb-4 bg-slate-900 border border-slate-950 rounded-2xl p-4 text-white shadow-md flex items-center justify-between gap-4 animate-[bounce_1.5s_infinite_1]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-800 rounded-xl text-yellow-400 border border-slate-705">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-mono text-blue-400 font-bold uppercase tracking-wider block">MODO DE SUPERVISÃO OPERACIONAL ATIVO</span>
                  <p className="text-xs">
                    Supervisionando sessão de: <strong className="text-blue-300">{impersonatingUser.name}</strong> ({UserRole[impersonatingUser.role]})
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleImpersonate(null)}
                className="flex items-center gap-1 text-[11px] font-semibold bg-slate-950 text-slate-350 border border-slate-800 hover:text-white px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <EyeOff className="w-3.5 h-3.5" />
                Encerrar Supervisão
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            {activeTab === 'docs' ? (
              // Tab 2: Technical architecture specs
              <motion.div
                key="docs"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="flex-1"
              >
                <TechDocumentation />
              </motion.div>
            ) : (
              // Tab 1: Real-time simulation board
              <motion.div
                key="simulation"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="flex-1 bg-white rounded-2xl border border-slate-200/80 shadow-md p-6 flex flex-col h-full min-h-[500px]"
              >
                
                {activeSessionUser ? (
                  // LOGGED ROLE INTERACTION COMPONENT
                  <div className="flex-1 flex flex-col h-full">
                    
                    {/* Internal Workspace Header Info */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-5">
                      <div>
                        <h2 className="text-lg font-extrabold text-slate-850 flex items-center gap-2">
                          <span>Painel de Controle Operacional</span>
                        </h2>
                        <p className="text-xs text-slate-400">Gestão logística e de comunicação segmentada por nível regional e perfil.</p>
                      </div>

                      <div className="text-right text-[10px] text-slate-400 font-mono">
                        SEGURANÇA ATIVA: ISOLAMENTO REGIONAL HABILITADO
                      </div>
                    </div>

                    {/* Segment view dashboard based on user role */}
                    <div className="flex-1">
                      {matchesAdminRole && (
                        <AdminDashboard
                          users={users}
                          rotas={rotas}
                          auditLogs={auditLogs}
                          chats={chats}
                          locations={locations}
                          breadcrumbs={breadcrumbs}
                          notifications={notifications}
                          performanceLogs={performanceLogs}
                          pushLogs={pushLogs}
                          pushConfig={pushConfig}
                          regions={regions}
                          onImpersonate={handleImpersonate}
                          onModerate={handleModerateUser}
                          onUpdateUser={handleUpdateUser}
                          onCreateUser={handleCreateUser}
                          onDeleteUser={handleDeleteUser}
                          onSaveRegion={handleSaveRegion}
                          onDeleteRegion={handleDeleteRegion}
                          onPush={dispatchCustomPush}
                          onSendPush={sendSegmentedPush}
                        />
                      )}

                      {matchesGerenteRole && !matchesAdminRole && (
                        <GerenteDashboard
                          user={activeSessionUser}
                          users={users}
                          rotas={rotas}
                          chats={chats}
                          locations={locations}
                          breadcrumbs={breadcrumbs}
                          notifications={notifications}
                          performanceLogs={performanceLogs}
                          pushLogs={pushLogs}
                          pushConfig={pushConfig}
                          regions={regions}
                          onPostMessage={handlePostMessage}
                          onPush={dispatchCustomPush}
                          onSendPush={sendSegmentedPush}
                          onCreateRoute={handleCreateRoute}
                          onUpdateRoute={handleUpdateRoute}
                          onDeleteRoute={handleDeleteRoute}
                          onOptimize={handleOptimizeRoute}
                          onStartRoute={handleStartRoute}
                          isDemoSimulationActive={isDemoSimulationActive}
                          setIsDemoSimulationActive={setIsDemoSimulationActive}
                        />
                      )}

                      {activeSessionUser && (Number(activeSessionUser.role) === UserRole.MOTORISTA || String(activeSessionUser.role) === '2' || String(activeSessionUser.role).toLowerCase() === 'motorista') && !matchesAdminRole && !matchesGerenteRole && (
                        <MotoristaDashboard
                          user={activeSessionUser}
                          rotas={rotas}
                          chats={chats}
                          locations={locations}
                          performanceLogs={performanceLogs}
                          onCreateRoute={handleCreateRoute}
                          onUpdateRoute={handleUpdateRoute}
                          onDeleteRoute={handleDeleteRoute}
                          onStartRoute={handleStartRoute}
                          onPostMessage={handlePostMessage}
                          onOptimize={handleOptimizeRoute}
                        />
                      )}

                      {activeSessionUser && (Number(activeSessionUser.role) === UserRole.VENDEDOR || String(activeSessionUser.role) === '3' || String(activeSessionUser.role).toLowerCase() === 'vendedor') && !matchesAdminRole && !matchesGerenteRole && (
                        <VendedorDashboard
                          user={activeSessionUser}
                          rotas={rotas}
                          chats={chats}
                          users={users}
                          locations={locations}
                          onPostMessage={handlePostMessage}
                        />
                      )}
                    </div>
                  </div>
                ) : (
                    // FALLBACK LOGIN BOARD (IF NOT LOGGED)
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 select-text h-full">
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 mb-4 border border-blue-100 shadow-sm">
                      <Compass className="w-7 h-7" />
                    </div>
                    
                    <h3 className="text-lg font-bold text-slate-805">Aguardando Conexão de Operador</h3>
                    <p className="text-xs text-slate-450 max-w-sm mt-2 leading-relaxed">
                      Selecione um dos perfis operacionais ativos no painel lateral esquerdo para conectar-se ao fluxo de monitoramento de rotas e despacho de frotas.
                    </p>

                    <div className="mt-6 pt-5 border-t border-slate-100 w-full max-w-md text-left bg-slate-50 p-4 rounded-xl space-y-2">
                      <span className="font-semibold text-slate-700 text-[10px] block uppercase tracking-wider">Fluxos de Trabalho Integrados:</span>
                      <ul className="space-y-1.5 text-[11px] text-slate-500">
                        <li className="flex items-start gap-1">
                          <span className="text-emerald-500 font-bold shrink-0">✓</span>
                          <p><strong>Motorista:</strong> Criação e otimização de rotas multi-paradas com rastreamento GPS ativo durante o trajeto.</p>
                        </li>
                        <li className="flex items-start gap-1">
                          <span className="text-emerald-500 font-bold shrink-0">✓</span>
                          <p><strong>Gerente:</strong> Monitoramento regional em tempo real das frotas em trânsito com recebimento de geocomparações.</p>
                        </li>
                        <li className="flex items-start gap-1">
                          <span className="text-blue-500 font-bold shrink-0">✓</span>
                          <p><strong>Vendedor:</strong> Acompanhamento imediato do status do pedido e canal direto de comunicação via chat.</p>
                        </li>
                        <li className="flex items-start gap-1">
                          <span className="text-blue-500 font-bold shrink-0">✓</span>
                          <p><strong>Administrador:</strong> Supervisão operacional completa com acesso a logs de auditoria e configurações globais de FCM.</p>
                        </li>
                      </ul>
                    </div>
                  </div>
                )}

              </motion.div>
            )}
          </AnimatePresence>

            </div>
          </>
        )}
      </main>

      {/* FLOATING FCM NOTIFICATION TOAST */}
      {fcmToast && (
        <div className="fixed top-24 right-6 z-50 max-w-sm w-full bg-slate-900 border border-slate-700 text-white rounded-2xl shadow-2xl p-4 flex gap-3 animate-fade-in select-text">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 border border-blue-500/30">
            <CheckCircle2 className="w-5 h-5 text-emerald-300 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] uppercase font-mono tracking-wider text-blue-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                FCM Push Received
              </span>
              <button 
                onClick={() => setFcmToast(null)} 
                className="text-slate-400 hover:text-white font-bold text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>
            <strong className="text-xs font-bold font-sans block text-slate-100">{fcmToast.title}</strong>
            <p className="text-[11px] text-slate-350 mt-1 leading-relaxed font-sans">{fcmToast.body}</p>
          </div>
        </div>
      )}

      {/* Universal Bottom bar info block */}
      <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 py-6 text-center text-xs font-mono">
        <div className="max-w-7xl mx-auto px-6">
          <p>RouteLog Enterprise Logistics © 2026</p>
          <p className="text-[10px] text-slate-500 mt-1">
            Plataforma Corporativa integrada com Firebase & Google Maps Platform. Todos os direitos reservados.
          </p>
        </div>
      </footer>

      {activeSessionUser && (activeSessionUser.status === 'suspended' || activeSessionUser.status === 'banned') && (
        <ActiveSessionBlocker
          user={activeSessionUser}
          isImpersonating={impersonatingUser !== null}
          onEndImpersonation={() => handleImpersonate(null)}
          onLogout={handleLogout}
          onReset={resetAllData}
        />
      )}

    </div>
  );
}
