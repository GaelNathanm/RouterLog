/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  UserRole, RouteUser, Rota, GPSLocation, ChatMessage
} from '../../types';
import { 
  UserCheck, SlidersHorizontal, Map, Route, Truck, MessageSquare, Phone, Send, Info
} from 'lucide-react';
import InteractiveMap from '../../components/InteractiveMap';
import RouteMap from '../../components/RouteMap';
import { motion } from 'motion/react';
import { AudioPlayer, AudioRecorderButton } from '../../components/DashboardUtils';
import DashboardSkeleton from '../../components/DashboardSkeleton';

interface VendedorProps {
  user: RouteUser;
  rotas: Rota[];
  chats: ChatMessage[];
  users: RouteUser[];
  locations: { [drvId: string]: GPSLocation };
  onPostMessage: (text: string, audioUrl?: string) => void;
  isFirestoreLoading?: boolean;
}

export function VendedorDashboard({ user, rotas, chats, users, locations, onPostMessage, isFirestoreLoading }: VendedorProps) {
  if (isFirestoreLoading) {
    return <DashboardSkeleton role="vendedor" />;
  }

  const [activeTab, setActiveTab] = useState<'map' | 'driver' | 'chat'>('map');
  const [mobileFocus, setMobileFocus] = useState<'actions' | 'map'>('actions');
  const [chatInp, setChatInp] = useState('');
  const [mapMode, setMapMode] = useState<'vector' | 'google'>('vector');
  
  const region = (user as any).region || 'GV1';

  // Regional driver info
  const myRegionDrivers = users.filter(u => u.role === UserRole.MOTORISTA && (u as any).region === region);
  const activeDriver = myRegionDrivers[0] || null;

  // Active routes of my region
  const regionalRoutes = rotas.filter(r => r.region === region);
  const activeRoute = regionalRoutes.find(r => r.status === 'active') || null;

  // Chats
  const regionalChats = chats.filter(c => c.region === region);

  const handlePostChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInp.trim()) return;
    onPostMessage(chatInp.trim());
    setChatInp('');
  };

  return (
    <div id="vendedor-main-panel" className="grid grid-cols-1 lg:grid-cols-12 gap-5 select-none md:select-text">
      
      {/* Top Bar / Profile Card Summary */}
      <div className="lg:col-span-12 bg-white border border-slate-200 rounded-2xl p-4 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 font-bold shrink-0">
            <UserCheck className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-800 text-sm leading-none uppercase tracking-tight">{user.name}</span>
              <span className="text-[10px] bg-amber-50 text-amber-600 font-bold px-2 py-0.5 rounded-full uppercase">
                {region}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Painel do Vendedor | Monitoramento de Pedidos e Rastreio GPS
            </p>
          </div>
        </div>

        {/* Info Widget */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-blue-100 bg-blue-50/20 text-[11px] font-semibold text-blue-700">
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          <span className="font-mono">Monitoramento de Entregas Ativo</span>
        </div>
      </div>

      {/* Responsive Focus Toggle for Mobile Displays */}
      <div className="lg:hidden col-span-1 flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-sm mb-1 select-none w-full gap-1">
        <button
          type="button"
          onClick={() => setMobileFocus('actions')}
          className={`flex-1 py-3 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
            mobileFocus === 'actions' ? 'bg-white text-indigo-900 shadow-sm border border-slate-200/40' : 'text-slate-500'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4 text-indigo-600 shrink-0" />
          Controles e Fichas
        </button>
        <button
          type="button"
          onClick={() => setMobileFocus('map')}
          className={`flex-1 py-3 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
            mobileFocus === 'map' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-505'
          }`}
        >
          <Map className="w-4 h-4 text-emerald-600 shrink-0" />
          Ver Mapa Regional
        </button>
      </div>

      {/* Left Column */}
      <div className={`lg:col-span-5 space-y-4 w-full ${mobileFocus === 'actions' ? 'block' : 'hidden lg:block'}`}>
        
        {/* Modern Tab Selection with Icons */}
        <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/40">
          <button
            onClick={() => setActiveTab('map')}
            className={`py-3 px-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer flex flex-col items-center justify-center gap-1 uppercase tracking-wider ${
              activeTab === 'map' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Route className="w-3.5 h-3.5 text-indigo-600" />
            Cargas
          </button>
          <button
            onClick={() => setActiveTab('driver')}
            className={`py-3 px-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer flex flex-col items-center justify-center gap-1 uppercase tracking-wider ${
              activeTab === 'driver' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Truck className="w-3.5 h-3.5 text-indigo-600" />
            Motorista
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`py-3 px-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer flex flex-col items-center justify-center gap-1 uppercase tracking-wider ${
              activeTab === 'chat' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
            Chat
          </button>
        </div>

        {/* Tab 1: Delivery status details list */}
        {activeTab === 'map' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-sm space-y-4 text-xs font-sans">
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
              <span className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px]">Cargas e Progressos no Solo</span>
              <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-mono font-black text-[9px] uppercase">CÓDIGO: {region}</span>
            </div>

            {activeRoute ? (
              <div className="space-y-4">
                <div className="p-4 bg-indigo-50/20 border border-indigo-100/50 rounded-2xl">
                  <div className="flex items-center justify-between font-mono text-[9px] text-indigo-600 font-extrabold mb-2 uppercase tracking-wider">
                    <span>Rota em Andamento</span>
                    <span>Placa: {activeRoute.driverPlate}</span>
                  </div>
                  <strong className="text-slate-900 block text-xs leading-snug uppercase tracking-tight font-black">{activeRoute.name}</strong>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Motorista: <strong className="text-slate-700 font-extrabold">{activeRoute.driverName}</strong>
                  </p>
                </div>

                <div className="space-y-2.5">
                  <span className="font-extrabold text-slate-400 block text-[9px] uppercase tracking-wider">Relação de Entregas</span>
                  {activeRoute.stops.map((stop) => (
                    <motion.div 
                      key={stop.id} 
                      layout
                      initial={{ opacity: 0.9, scale: 0.98 }}
                      animate={{ 
                        opacity: 1, 
                        scale: 1,
                        backgroundColor: stop.status === 'completed' ? '#ecfdf5' : stop.status === 'Chegando' ? '#fffbeb' : '#f8fafc',
                        borderColor: stop.status === 'completed' ? '#a7f3d0' : stop.status === 'Chegando' ? '#fde68a' : '#f1f5f9'
                      }}
                      className="p-3.5 rounded-2xl border flex items-center justify-between text-[11px] shadow-sm gap-2"
                    >
                       <div className="min-w-0 flex-1 pr-1.5">
                        <strong className="text-slate-800 block truncate text-xs">{stop.clientName}</strong>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{stop.address}</p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {stop.clientWhatsApp && (
                          <a 
                            href={`https://wa.me/${stop.clientWhatsApp}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            title="Conversar com cliente"
                            className="p-2.5 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-600 hover:text-indigo-600 transition-all active:scale-90 shadow-sm"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        )}
                        <span className={`px-2.5 py-1 font-mono font-black text-[9px] rounded-full uppercase shrink-0 border ${
                          stop.status === 'completed' 
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                            : stop.status === 'Chegando'
                              ? 'bg-amber-50 text-amber-800 border-amber-200 animate-pulse'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {stop.status === 'completed' ? 'ENTREGUE ✓' : stop.status === 'Chegando' ? 'CHEGANDO 🚚' : 'NA FILA'}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 px-4">
                <p className="text-slate-500 font-bold leading-normal font-sans text-xs">Nenhuma rota ativa no momento na região {region}.</p>
                <p className="text-[10px] text-slate-400 mt-1.5 font-mono">Aguardando login de motorista regional para despachar carga...</p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Regional Active Driver Bio CARD */}
        {activeTab === 'driver' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-sm text-xs space-y-4 font-sans">
            <span className="font-extrabold text-slate-800 tracking-wider uppercase text-[11px] block text-left">Dados Cadastrais do Condutor da Região</span>

            {activeDriver ? (
              <div className="space-y-4 bg-slate-50/50 p-4 border border-slate-100 rounded-2xl shadow-sm">
                <div className="flex justify-between items-center text-[9px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100/50 uppercase">
                  <span>CONDUTOR: #{activeDriver.id}</span>
                  <span>REG: {(activeDriver as any).region}</span>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Nome</span>
                  <strong className="text-slate-850 text-sm font-black block leading-none">{activeDriver.name}</strong>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 text-[11px]">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Placa do Veículo</span>
                    <strong className="text-slate-800 font-mono">{(activeDriver as any).plate}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Modelo do Caminhão</span>
                    <strong className="text-slate-700">{(activeDriver as any).vehicleModel}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200/50 text-[11px]">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Registro CNH</span>
                    <span className="text-slate-600 font-mono font-bold">{(activeDriver as any).cnh}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Validade CNH</span>
                    <span className="text-slate-600 font-mono">{(activeDriver as any).cnhExpiration}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/50">
                  <a
                    href={`https://wa.me/${activeDriver.phone.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-extrabold flex items-center justify-center gap-1.5 cursor-pointer shadow-md active:scale-95 transition-all text-xs uppercase tracking-wider"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Contatar WhatsApp do Condutor
                  </a>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 px-4">
                <p className="text-slate-500 font-bold leading-normal text-xs text-center">Nenhum motorista disponível na região {region}.</p>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Regional Chat Room */}
        {activeTab === 'chat' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col h-[380px] text-xs font-sans">
            <span className="font-extrabold text-slate-800 tracking-wider uppercase text-[11px] border-b border-slate-100 pb-2.5 block mb-2 text-left">Linha Regional de Comunicação</span>

            {/* Tooltip explicativo regional */}
            <div className="bg-amber-50/50 border border-amber-200/50 rounded-xl p-2.5 mb-2 flex items-start gap-1.5 text-[10px] text-amber-900 font-medium select-none shadow-xs">
              <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Visibilidade Restrita ({region}):</strong> Mensagens enviadas aqui só serão visíveis para motoristas e gerentes parceiros alocados nesta mesma região.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto py-2 space-y-3 pr-1">
              {regionalChats.length === 0 ? (
                <div className="text-center py-10 text-slate-400">Nenhuma mensagem enviada nesta região. Use o campo abaixo para iniciar o alinhamento.</div>
              ) : (
                regionalChats.map(c => {
                  const isMe = c.senderId === user.id;
                  return (
                    <div key={c.id} className={`p-3 rounded-2xl border transition-all ${
                      isMe ? 'bg-indigo-50/40 border-indigo-100/50 ml-6 shadow-sm' : 'bg-slate-50 border-slate-100 mr-6'
                    }`}>
                      <div className="flex justify-between items-center text-[10px] text-slate-505 mb-1.5 font-mono">
                        <span className={`font-black ${isMe ? 'text-indigo-650' : 'text-slate-600'}`}>{c.senderName}</span>
                        <span>{new Date(c.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-slate-700 leading-relaxed font-sans">{c.message}</p>
                      {c.audioUrl && (
                        <div className="mt-2 text-slate-800">
                          <AudioPlayer src={c.audioUrl} />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={handlePostChat} className="flex gap-2 border-t border-slate-150 pt-3 bg-white mt-2 items-center">
              <input
                type="text"
                placeholder="Digite seu aviso regional..."
                value={chatInp}
                onChange={e => setChatInp(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 p-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 h-11 text-xs font-medium"
              />
              <div className="shrink-0">
                <AudioRecorderButton onSendAudio={(base64) => onPostMessage('🎙️ Nota de Áudio', base64)} />
              </div>
              <button 
                type="submit" 
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-11 w-11 flex items-center justify-center cursor-pointer hover:shadow active:scale-90 transition-all shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Right Column: Live Vector Map View */}
      <div className={`lg:col-span-7 flex flex-col h-full min-h-[440px] w-full ${mobileFocus === 'map' ? 'block' : 'hidden lg:flex'}`}>
        <div className="flex items-center justify-between mb-3.5 select-none">
          <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider font-sans">Monitor de Região: Vivo</span>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-sm">
            <button
              onClick={() => setMapMode('vector')}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black cursor-pointer transition-all uppercase tracking-wider ${
                mapMode === 'vector' ? 'bg-white text-indigo-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Mapa Vetorial
            </button>
            <button
              onClick={() => setMapMode('google')}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black cursor-pointer transition-all uppercase tracking-wider ${
                mapMode === 'google' ? 'bg-white text-indigo-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Google Maps
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-[350px]">
          {mapMode === 'vector' ? (
            <InteractiveMap 
              rota={activeRoute} 
              driverLocation={activeRoute ? locations[activeRoute.driverId] || null : null}
              region={region}
            />
          ) : (
            <RouteMap 
              rotas={rotas}
              locations={locations}
              currentUserRegion={region}
              currentUserRole={user.role}
              singleRouteMode={activeRoute}
              singleDriverLocation={activeRoute ? locations[activeRoute.driverId] || null : null}
            />
          )}
        </div>
      </div>

    </div>
  );
}
