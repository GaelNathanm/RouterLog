/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useRouteLogState } from './hooks/useRouteLogState';
import { UserRole } from './types';
import UserLoginMenu from './components/UserLoginMenu';
import ActiveSessionBlocker from './components/ActiveSessionBlocker';
import { AdminDashboard } from './features/admin/AdminDashboard';
import { GerenteDashboard } from './features/gerente/GerenteDashboard';
import { MotoristaDashboard } from './features/motorista/MotoristaDashboard';
import { VendedorDashboard } from './features/vendedor/VendedorDashboard';
import UserProfilePage from './components/UserProfilePage';
import ControlPanelMockMap from './components/ControlPanelMockMap';
import { 
  Network, LayoutDashboard, HelpCircle, Eye, EyeOff, ShieldAlert,
  Info, AlertTriangle, AlertCircle, Compass, CheckCircle2, User, RefreshCw
} from 'lucide-react';
import { NetworkGpsStatusWidget } from './components/NetworkGpsStatusWidget';
import { motion, AnimatePresence } from 'motion/react';
import ToastContainer from './components/ToastContainer';
import { showToast } from './utils/toast';
import { useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './features/auth/Login';
import { SemAcesso } from './features/auth/SemAcesso';
import { NaoAutorizado } from './features/auth/NaoAutorizado';

function AppContent() {
  const {
    users,
    rotas,
    locations,
    breadcrumbs,
    chats,
    notifications,
    offlineQueueLength,
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
    clients,
    handleSaveClient,
    handleDeleteClient,
    handleLogin,
    handleRegister,
    handleLogout,
    handleImpersonate,
    handleModerateUser,
    handleUpdateUser,
    handleSelfProfileUpdate,
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
    resetAllData
  } = useRouteLogState();

  const navigate = useNavigate();
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);
  const [fcmToast, setFcmToast] = useState<{ title: string; body: string; type: string } | null>(null);

  // Synchronize browser alerts with beautiful toasts
  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (message: string) => {
      if (!message) return;
      const lower = message.toLowerCase();
      let type: 'success' | 'error' | 'info' | 'warning' = 'info';
      let title = 'Informativo';

      if (lower.includes('sucesso') || lower.includes('concluído') || lower.includes('concluido') || lower.includes('gravado') || lower.includes('excelente') || lower.includes('enviado') || lower.includes('salvas') || lower.includes('adicionados') || lower.includes('finalizada') || lower.includes('iniciada')) {
        type = 'success';
        title = 'Sucesso Operacional';
      } else if (lower.includes('erro') || lower.includes('falha') || lower.includes('limite') || lower.includes('não foi possível') || lower.includes('bloqueado') || lower.includes('não deves') || lower.includes('rejeitado') || lower.includes('instável')) {
        type = 'error';
        title = 'Falha / Erro';
      } else if (lower.includes('atenção') || lower.includes('por favor') || lower.includes('selecione') || lower.includes('necessita') || lower.includes('preencha') || lower.includes('inválido') || lower.includes('vazio') || lower.includes('vazia') || lower.includes('nenhum') || lower.includes('adicionar')) {
        type = 'warning';
        title = 'Alerta Operacional';
      } else {
        type = 'info';
        title = 'Notificação';
      }

      showToast(message, type, title);
    };

    return () => {
      window.alert = originalAlert;
    };
  }, []);

  // Sync real-time FCM notifications
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

  // Real-time network-synced push notification trigger for chats
  const lastProcessedChatId = React.useRef<string | null>(null);
  const isInitialChatLoad = React.useRef(true);

  useEffect(() => {
    if (!activeSessionUser || chats.length === 0) {
      if (chats.length > 0) {
        isInitialChatLoad.current = false;
      }
      return;
    }

    if (isInitialChatLoad.current) {
      isInitialChatLoad.current = false;
      if (chats.length > 0) {
        lastProcessedChatId.current = chats[chats.length - 1].id;
      }
      return;
    }

    const latestChat = chats[chats.length - 1];
    if (latestChat && latestChat.id !== lastProcessedChatId.current) {
      lastProcessedChatId.current = latestChat.id;

      if (latestChat.senderId !== activeSessionUser.id) {
        const matchesRegion = latestChat.region === 'all' || (activeSessionUser as any).region === latestChat.region || Number(activeSessionUser.role) === UserRole.ADMIN;
        if (matchesRegion) {
          window.dispatchEvent(new CustomEvent('fcm_notification_received', {
            detail: {
              title: `Mensagem de ${latestChat.senderName} 💬`,
              body: latestChat.message,
              type: 'urgente_chat',
              region: latestChat.region,
              role: 'all'
            }
          }));
        }
      }
    }
  }, [chats, activeSessionUser]);

  // Real-time network-synced push notification trigger for system notifications
  const lastProcessedNotifId = React.useRef<string | null>(null);
  const isInitialNotifLoad = React.useRef(true);

  useEffect(() => {
    if (!activeSessionUser || notifications.length === 0) {
      if (notifications.length > 0) {
        isInitialNotifLoad.current = false;
      }
      return;
    }

    if (isInitialNotifLoad.current) {
      isInitialNotifLoad.current = false;
      if (notifications.length > 0) {
        lastProcessedNotifId.current = notifications[0].id;
      }
      return;
    }

    const latestNotif = notifications[0];
    if (latestNotif && latestNotif.id !== lastProcessedNotifId.current) {
      lastProcessedNotifId.current = latestNotif.id;

      if (latestNotif.senderName !== activeSessionUser.name) {
        const isUserAdmin = Number(activeSessionUser.role) === UserRole.ADMIN || String(activeSessionUser.role) === '0' || String(activeSessionUser.role).toLowerCase() === 'admin';
        const matchesRegion = latestNotif.region === 'all' || (activeSessionUser as any).region === latestNotif.region || isUserAdmin;
        
        if (matchesRegion) {
          window.dispatchEvent(new CustomEvent('fcm_notification_received', {
            detail: {
              title: latestNotif.title,
              body: latestNotif.body,
              type: 'status_parada',
              region: latestNotif.region,
              role: 'all'
            }
          }));
        }
      }
    }
  }, [notifications, activeSessionUser]);

  const matchesAdminRole = activeSessionUser && (Number(activeSessionUser.role) === UserRole.ADMIN || String(activeSessionUser.role) === '0' || String(activeSessionUser.role).toLowerCase() === 'admin');
  const matchesGerenteRole = activeSessionUser && (Number(activeSessionUser.role) === UserRole.GERENTE || String(activeSessionUser.role) === '1' || String(activeSessionUser.role).toLowerCase() === 'gerente');

  const isWidescreen = activeSessionUser && (matchesAdminRole || matchesGerenteRole);

  // Layout wrapper component to contain common shell UI for logged-in users
  const LayoutWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const isProfilePage = window.location.pathname === '/perfil';

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
                  <button
                    onClick={() => navigate('/perfil')}
                    title="Ver e Editar Meu Perfil"
                    className="flex flex-col text-right hover:opacity-85 transition-opacity cursor-pointer group"
                  >
                    <span className="font-bold text-slate-800 text-[11px] leading-tight truncate max-w-[150px] group-hover:text-blue-600 transition-colors">
                      {activeSessionUser.name}
                    </span>
                    <span className="text-[9px] text-[#4f46e5] bg-[#e0e7ff] px-1.5 py-0.5 border border-[#c7d2fe]/50 rounded font-mono font-black leading-none mt-0.5">
                      {matchesAdminRole ? 'ADMIN MASTER' : `GERENTE (Região ${ (activeSessionUser as any).region || '' })`}
                    </span>
                  </button>
                  <div className="w-px h-6 bg-slate-300/80"></div>
                  <button
                    onClick={async () => {
                      await handleLogout();
                      navigate('/login');
                    }}
                    title="Fazer Logout"
                    className="text-rose-600 hover:text-white hover:bg-rose-600 transition-all p-1.5 px-2.5 border border-rose-250 hover:border-transparent rounded-lg text-[10px] font-bold cursor-pointer bg-white shadow-sm flex items-center justify-center"
                  >
                    Sair do Painel
                  </button>
                </div>
              )}

              <NetworkGpsStatusWidget />

              {!isWidescreen && isSidebarHidden && (
                <button
                  type="button"
                  onClick={() => setIsSidebarHidden(false)}
                  className="px-3.5 py-2 rounded-xl text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-all flex items-center gap-1.5 font-bold text-xs cursor-pointer shadow-sm"
                  title="Mostrar Simulador de Login"
                >
                  <Eye className="w-4 h-4 shrink-0 text-blue-600" />
                  <span>Simulador de Login</span>
                </button>
              )}
              
              {/* Core Master Tabs (Dashboard vs Profile) */}
              <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-250/20 font-mono text-xs">
                <button
                  onClick={() => navigate('/')}
                  className={`px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 font-bold cursor-pointer ${
                    !isProfilePage 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-slate-500 hover:text-slate-950 hover:bg-slate-200/50'
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  Painel Operacional
                </button>
                {activeSessionUser && (
                  <button
                    onClick={() => navigate('/perfil')}
                    className={`px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 font-bold cursor-pointer ${
                      isProfilePage 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'text-slate-500 hover:text-slate-950 hover:bg-slate-200/50'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    Meu Perfil
                  </button>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Board Area */}
        <main className={`flex-grow w-full mx-auto p-4 sm:p-6 transition-all duration-300 ${
          (isWidescreen || isSidebarHidden) 
            ? 'max-w-full px-4 sm:px-8 xl:px-10 flex flex-col gap-6' 
            : 'max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch'
        }`}>
          
          {/* Left Column: Sider Profile login representation (4 columns) */}
          {!isWidescreen && !isSidebarHidden && (
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
                  onViewProfile={() => navigate('/perfil')}
                  onCollapse={() => setIsSidebarHidden(true)}
                />
              </div>
            </div>
          )}

          {/* Right Column: Dynamic workspace content (8 columns or full width) */}
          <div className={`${(isWidescreen || isSidebarHidden) ? 'w-full' : 'lg:col-span-8'} flex flex-col h-full`}>

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
              <motion.div
                key={window.location.pathname}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="flex-1 bg-white rounded-2xl border border-slate-200/80 shadow-md p-6 flex flex-col h-full min-h-[500px]"
              >
                {/* Workspace Header for internal dashboards only */}
                {!isProfilePage && (
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-5 select-none">
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
                )}

                {/* GPS Mock telemetry monitor for admins and regional manager */}
                {!isProfilePage && (matchesAdminRole || matchesGerenteRole) && (
                  <ControlPanelMockMap
                    locations={locations}
                    users={users}
                    rotas={rotas}
                    regions={regions}
                    activeUserRegion={(activeSessionUser as any)?.region || "all"}
                  />
                )}

                <div className="flex-1">
                  {children}
                </div>
              </motion.div>
            </AnimatePresence>

          </div>
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

        <ToastContainer />

      </div>
    );
  };

  // Dedicated component to redirect root / path to corresponding authorized dashboard
  const RootRedirect = () => {
    const { user, profile, loading } = useAuth();
    
    if (loading) {
      return (
        <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            <p className="text-sm font-medium text-slate-500">Direcionando fluxo...</p>
          </div>
        </div>
      );
    }
    
    if (!user) return <Navigate to="/login" replace />;
    if (!profile) return <Navigate to="/sem-acesso" replace />;
    
    if (profile.role === 0) return <Navigate to="/admin/dashboard" replace />;
    if (profile.role === 1) return <Navigate to="/gerente/dashboard" replace />;
    if (profile.role === 2) return <Navigate to="/motorista/painel" replace />;
    if (profile.role === 3) return <Navigate to="/vendedor/painel" replace />;
    
    return <Navigate to="/sem-acesso" replace />;
  };

  return (
    <Routes>
      {/* Public Pages */}
      <Route path="/login" element={<Login users={users} regions={regions} onLogin={handleLogin} onRegister={handleRegister} />} />
      <Route path="/sem-acesso" element={<SemAcesso />} />
      <Route path="/nao-autorizado" element={<NaoAutorizado />} />

      {/* Protected Area Profile page */}
      <Route element={<ProtectedRoute allowedRoles={[0, 1, 2, 3]} />}>
        <Route path="/perfil" element={
          <LayoutWrapper>
            <UserProfilePage user={activeSessionUser!} onUpdateProfile={handleSelfProfileUpdate} />
          </LayoutWrapper>
        } />
      </Route>

      {/* Protected Area: Admin Specific Dashboard */}
      <Route element={<ProtectedRoute allowedRoles={[0]} />}>
        <Route path="/admin/dashboard" element={
          <LayoutWrapper>
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
              clients={clients}
              onSaveClient={handleSaveClient}
              onDeleteClient={handleDeleteClient}
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
          </LayoutWrapper>
        } />
      </Route>

      {/* Protected Area: Gerente Specific Dashboard */}
      <Route element={<ProtectedRoute allowedRoles={[1]} />}>
        <Route path="/gerente/dashboard" element={
          <LayoutWrapper>
            <GerenteDashboard
              user={activeSessionUser!}
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
              clients={clients}
              onSaveClient={handleSaveClient}
              onDeleteClient={handleDeleteClient}
              onPostMessage={handlePostMessage}
              onPush={dispatchCustomPush}
              onSendPush={sendSegmentedPush}
              onCreateRoute={handleCreateRoute}
              onUpdateRoute={handleUpdateRoute}
              onDeleteRoute={handleDeleteRoute}
              onOptimize={handleOptimizeRoute}
              onStartRoute={handleStartRoute}
            />
          </LayoutWrapper>
        } />
      </Route>

      {/* Protected Area: Motorista Specific Dashboard */}
      <Route element={<ProtectedRoute allowedRoles={[2]} />}>
        <Route path="/motorista/painel" element={
          <LayoutWrapper>
            <MotoristaDashboard
              user={activeSessionUser!}
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
              offlineQueueLength={offlineQueueLength}
              onUpdateUser={handleUpdateUser}
            />
          </LayoutWrapper>
        } />
      </Route>

      {/* Protected Area: Vendedor Specific Dashboard */}
      <Route element={<ProtectedRoute allowedRoles={[3]} />}>
        <Route path="/vendedor/painel" element={
          <LayoutWrapper>
            <VendedorDashboard
              user={activeSessionUser!}
              rotas={rotas}
              chats={chats}
              users={users}
              locations={locations}
              onPostMessage={handlePostMessage}
            />
          </LayoutWrapper>
        } />
      </Route>

      {/* Root/Fallback Redirections */}
      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
