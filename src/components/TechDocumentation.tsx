/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  BookOpen, Network, Layers, ShieldCheck, Cpu, 
  MapPin, Milestone, MessageSquare, Bell, Compass, Server
} from 'lucide-react';

export default function TechDocumentation() {
  const [activeTab, setActiveTab] = useState<'architecture' | 'scope' | 'flows' | 'audits'>('architecture');
  const [selectedArchNode, setSelectedArchNode] = useState<string | null>('directions');

  const archNodesInfo: Record<string, { title: string; tech: string; desc: string; role: string }> = {
    mobile: {
      title: 'Cliente Mobile (Android / iOS)',
      tech: 'React Native / Flutter / Kotlin-Swift',
      desc: 'Interface mobile-first otimizada para operação em campo. Coleta telemetria GPS em plano de fundo, exibe rotas com renderização de polylines e gerencia chats locais.',
      role: 'Captura dados de sensores locais e fornece a interface para Motoristas, Vendedores e Gerentes.'
    },
    auth: {
      title: 'Firebase Authentication (OAuth 2.0)',
      tech: 'Google Sign-In & Email/Password',
      desc: 'Gerenciamento seguro de identidades. Primeiro acesso direciona para cadastro de perfil (driver_fields, seller_fields, etc.). Rota protegida oculta /admin-login bypassa fluxos de região.',
      role: 'Garante o controle de acesso baseado em funções (RBAC).'
    },
    firestore: {
      title: 'Cloud Firestore (NoSQL Real-time)',
      tech: 'Firestore Database',
      desc: 'Banco de dados estruturado com escopo regional. Documentos vinculados por região (ex: "GV1"). As regras de segurança garantem isolamento cross-perfil total.',
      role: 'Sincronização de rotas, estado de progresso e coordenadas GPS em tempo real.'
    },
    directions: {
      title: 'Google Directions API (Otimizadora)',
      tech: 'optimizeWaypoints: true',
      desc: 'Algoritmo de Otimização que reordena as N-paradas enviadas pelo Motorista para reduzir distância e tempo total de condução (Problema do Caixeiro Viajante - TSP).',
      role: 'Motor de cálculo logístico essencial para a operação.'
    },
    places: {
      title: 'Google Places API & Geocoding',
      tech: 'Autocomplete & Geocoder',
      desc: 'Auxilia na digitação rápida de endereços (mínimo de cliques em trânsito) e traduz endereços de texto em coordenadas geográficas (lat, lng) precisas.',
      role: 'Garantia de precisão na localização dos pontos de entrega.'
    },
    push: {
      title: 'Firebase Cloud Messaging (FCM)',
      tech: 'Cloud Functions + FCM Server',
      desc: 'Serviço de envio de notificações push. Disparado automaticamente quando um Motorista clica em "Iniciar Rota", alertando gerentes e vendedores da mesma região.',
      role: 'Engajamento operacional e alertas em tempo real.'
    }
  };

  return (
    <div id="tech-doc-container" className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="bg-slate-900 text-white p-6 border-b border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Painel de Arquitetura e Engenharia</h2>
            <p className="text-xs text-slate-400 mt-1 font-mono">ROLE: Tech Lead / Software Architect Advisor</p>
          </div>
          
          <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-lg border border-slate-700 font-mono text-xs">
            <button
              onClick={() => setActiveTab('architecture')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'architecture' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              Arquitetura
            </button>
            <button
              onClick={() => setActiveTab('scope')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'scope' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Escopo MVP
            </button>
            <button
              onClick={() => setActiveTab('flows')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'flows' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              Fluxos de Tela
            </button>
            <button
              onClick={() => setActiveTab('audits')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'audits' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              Cotas e Auditoria (Passo 3)
            </button>
          </div>
        </div>
      </div>

      {/* Content body */}
      <div className="flex-1 overflow-y-auto p-6">
        
        {/* TAB 1: ARCHITECTURE DIAGRAM */}
        {activeTab === 'architecture' && (
          <div className="space-y-6">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Left Column: Interactive Technical Vector Diagram */}
              <div className="flex-1 border border-slate-200/80 rounded-xl p-4 bg-slate-50 relative">
                <div className="absolute top-3 left-3 flex items-center gap-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                  Diagrama Lógico de Integração
                </div>
                <div className="text-right text-[10px] text-slate-400 font-mono mb-4">
                  Clique nos blocos para detalhes de integração
                </div>

                {/* SVG logical diagram */}
                <div className="w-full h-[320px] flex items-center justify-center">
                  <svg viewBox="0 0 800 400" className="w-full h-full">
                    {/* Definitions */}
                    <defs>
                      <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
                      </marker>
                      <marker id="arrow-interactive" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#6366f1" />
                      </marker>
                    </defs>

                    {/* background grids/lanes */}
                    <rect x="10" y="20" width="220" height="360" rx="10" fill="#f1f5f9" stroke="#cbd5e1" strokeDasharray="3 3" />
                    <text x="25" y="45" className="text-slate-500 text-xs font-mono font-bold" fill="#64748b">CLIENT LAYER (Mobile)</text>

                    <rect x="270" y="20" width="260" height="360" rx="10" fill="#eef2ff" stroke="#c7d2fe" strokeDasharray="3 3" />
                    <text x="285" y="45" className="text-indigo-600 text-xs font-mono font-bold" fill="#4f46e5">BACKEND / CLOUD SERVICES</text>

                    <rect x="560" y="20" width="230" height="360" rx="10" fill="#f0fdf4" stroke="#bbf7d0" strokeDasharray="3 3" />
                    <text x="575" y="45" className="text-emerald-700 text-xs font-mono font-bold" fill="#15803d">EXTERNAL API LAYER</text>

                    {/* Mobile App Node */}
                    <g 
                      onClick={() => setSelectedArchNode('mobile')} 
                      className="cursor-pointer group"
                    >
                      <rect 
                        x="30" y="120" width="180" height="180" rx="8" 
                        fill={selectedArchNode === 'mobile' ? '#6366f1' : '#ffffff'} 
                        stroke={selectedArchNode === 'mobile' ? '#4f46e5' : '#475569'} 
                        strokeWidth="2.5"
                        className="transition-all duration-200 shadow-sm"
                      />
                      <text x="120" y="160" textAnchor="middle" className={`text-sm font-bold font-sans ${selectedArchNode === 'mobile' ? 'fill-white' : 'fill-slate-800'}`}>
                        RouteLog Client
                      </text>
                      <text x="120" y="180" textAnchor="middle" className={`text-[10px] font-mono ${selectedArchNode === 'mobile' ? 'fill-indigo-100' : 'fill-slate-400'}`}>
                        (React Native / TS)
                      </text>
                      
                      {/* Inner features */}
                      <rect x="45" y="200" width="150" height="22" rx="4" fill={selectedArchNode === 'mobile' ? '#4f46e5' : '#f1f5f9'} />
                      <text x="120" y="214" textAnchor="middle" className={`text-[10px] font-bold ${selectedArchNode === 'mobile' ? 'fill-white' : 'fill-slate-600'}`}>
                        + GPS BG Telemetria
                      </text>

                      <rect x="45" y="230" width="150" height="22" rx="4" fill={selectedArchNode === 'mobile' ? '#4f46e5' : '#f1f5f9'} />
                      <text x="120" y="244" textAnchor="middle" className={`text-[10px] font-bold ${selectedArchNode === 'mobile' ? 'fill-white' : 'fill-slate-600'}`}>
                        + Real-time Maps API
                      </text>

                      <rect x="45" y="260" width="150" height="22" rx="4" fill={selectedArchNode === 'mobile' ? '#4f46e5' : '#f1f5f9'} />
                      <text x="120" y="274" textAnchor="middle" className={`text-[10px] font-bold ${selectedArchNode === 'mobile' ? 'fill-white' : 'fill-slate-600'}`}>
                        + WebSocket Regional Chat
                      </text>
                    </g>

                    {/* Auth Node */}
                    <g 
                      onClick={() => setSelectedArchNode('auth')} 
                      className="cursor-pointer"
                    >
                      <rect 
                        x="290" y="60" width="220" height="70" rx="6" 
                        fill={selectedArchNode === 'auth' ? '#6366f1' : '#ffffff'} 
                        stroke="#e2e8f0" 
                        strokeWidth="2"
                        className="transition-all duration-200 shadow-sm"
                      />
                      <text x="400" y="90" textAnchor="middle" className={`text-xs font-bold ${selectedArchNode === 'auth' ? 'fill-white' : 'fill-slate-800'}`}>
                        Firebase Auth (OAuth)
                      </text>
                      <text x="400" y="110" textAnchor="middle" className={`text-[9px] font-mono ${selectedArchNode === 'auth' ? 'fill-indigo-100' : 'fill-slate-400'}`}>
                        RBAC & Bypass /admin-login
                      </text>
                    </g>

                    {/* Firestore Node */}
                    <g 
                      onClick={() => setSelectedArchNode('firestore')} 
                      className="cursor-pointer"
                    >
                      <rect 
                        x="290" y="165" width="220" height="90" rx="8" 
                        fill={selectedArchNode === 'firestore' ? '#6366f1' : '#ffffff'} 
                        stroke="#e2e8f0" 
                        strokeWidth="2"
                        className="transition-all duration-200 shadow-sm"
                      />
                      <text x="400" y="195" textAnchor="middle" className={`text-xs font-bold ${selectedArchNode === 'firestore' ? 'fill-white' : 'fill-slate-800'}`}>
                        Cloud Firestore DB
                      </text>
                      <text x="400" y="215" textAnchor="middle" className={`text-[9px] ${selectedArchNode === 'firestore' ? 'fill-indigo-100' : 'fill-indigo-600'} font-bold font-mono`}>
                        Regional Partition (GV1 / MG)
                      </text>
                      <text x="400" y="235" textAnchor="middle" className={`text-[9px] font-sans ${selectedArchNode === 'firestore' ? 'fill-indigo-200' : 'fill-slate-400'}`}>
                        Rotas Salvas, Coord GPS, Histórico
                      </text>
                    </g>

                    {/* Push FCM Node */}
                    <g 
                      onClick={() => setSelectedArchNode('push')} 
                      className="cursor-pointer"
                    >
                      <rect 
                        x="290" y="285" width="220" height="70" rx="6" 
                        fill={selectedArchNode === 'push' ? '#6366f1' : '#ffffff'} 
                        stroke="#e2e8f0" 
                        strokeWidth="2"
                        className="transition-all duration-200 shadow-sm"
                      />
                      <text x="400" y="315" textAnchor="middle" className={`text-xs font-bold ${selectedArchNode === 'push' ? 'fill-white' : 'fill-slate-800'}`}>
                        FCM Push Server + Functions
                      </text>
                      <text x="400" y="335" textAnchor="middle" className={`text-[9px] font-sans ${selectedArchNode === 'push' ? 'fill-indigo-100' : 'fill-slate-400'}`}>
                        Triggers ao Iniciar Rota (Vendedor + Gerente)
                      </text>
                    </g>

                    {/* Google Directions API */}
                    <g 
                      onClick={() => setSelectedArchNode('directions')} 
                      className="cursor-pointer"
                    >
                      <rect 
                        x="580" y="80" width="190" height="90" rx="6" 
                        fill={selectedArchNode === 'directions' ? '#6366f1' : '#ffffff'} 
                        stroke="#bbf7d0" 
                        strokeWidth="2.5"
                        className="transition-all duration-200 shadow-sm"
                      />
                      <text x="675" y="115" textAnchor="middle" className={`text-xs font-bold ${selectedArchNode === 'directions' ? 'fill-white' : 'fill-slate-800'}`}>
                        Google Directions API
                      </text>
                      <text x="675" y="135" textAnchor="middle" className={`text-[9px] font-mono ${selectedArchNode === 'directions' ? 'fill-indigo-100' : 'fill-emerald-600'} font-bold`}>
                        optimizeWaypoints: true
                      </text>
                      <text x="675" y="152" textAnchor="middle" className={`text-[8px] ${selectedArchNode === 'directions' ? 'fill-indigo-200' : 'fill-slate-400'}`}>
                        Otimização de Rota Multi-paradas (TSP)
                      </text>
                    </g>

                    {/* Google Places API */}
                    <g 
                      onClick={() => setSelectedArchNode('places')} 
                      className="cursor-pointer"
                    >
                      <rect 
                        x="580" y="210" width="190" height="90" rx="6" 
                        fill={selectedArchNode === 'places' ? '#6366f1' : '#ffffff'} 
                        stroke="#bbf7d0" 
                        strokeWidth="2.5"
                        className="transition-all duration-200 shadow-sm"
                      />
                      <text x="675" y="245" textAnchor="middle" className={`text-xs font-bold ${selectedArchNode === 'places' ? 'fill-white' : 'fill-slate-800'}`}>
                        Google Places & Geocoding
                      </text>
                      <text x="675" y="265" textAnchor="middle" className={`text-[9px] font-sans ${selectedArchNode === 'places' ? 'fill-indigo-100' : 'fill-slate-500'}`}>
                        Autocomplete em campo
                      </text>
                      <text x="675" y="282" textAnchor="middle" className={`text-[8px] ${selectedArchNode === 'places' ? 'fill-indigo-200' : 'fill-slate-400'}`}>
                        Conversão de endereços para Lat/Lng
                      </text>
                    </g>

                    {/* FLOW ARRAYS (Connectors) */}
                    {/* Client -> Auth */}
                    <path d="M 210,140 L 290,110" stroke={selectedArchNode === 'auth' ? '#6366f1' : '#64748b'} strokeWidth={selectedArchNode === 'auth' ? '2.5' : '1.5'} fill="none" markerEnd={selectedArchNode === 'auth' ? 'url(#arrow-interactive)' : 'url(#arrow)'} />
                    {/* Client <=> Firestore (Real-time sync) */}
                    <path d="M 210,210 L 290,210" stroke={selectedArchNode === 'firestore' ? '#6366f1' : '#64748b'} strokeWidth={selectedArchNode === 'firestore' ? '3' : '1.5'} fill="none" markerEnd={selectedArchNode === 'firestore' ? 'url(#arrow-interactive)' : 'url(#arrow)'} />
                    {/* Client -> Push FCM */}
                    <path d="M 210,270 L 290,305" stroke={selectedArchNode === 'push' ? '#6366f1' : '#64748b'} strokeWidth={selectedArchNode === 'push' ? '2.5' : '1.5'} fill="none" markerEnd={selectedArchNode === 'push' ? 'url(#arrow-interactive)' : 'url(#arrow)'} />
                    {/* Firestore -> Google Directions */}
                    <path d="M 510,200 L 580,150" stroke={selectedArchNode === 'directions' ? '#6366f1' : '#64748b'} strokeWidth={selectedArchNode === 'directions' ? '2.5' : '1.5'} fill="none" markerEnd={selectedArchNode === 'directions' ? 'url(#arrow-interactive)' : 'url(#arrow)'} strokeDasharray="4 2" />
                    {/* Client -> Google Places */}
                    <path d="M 180,300 C 240,410 490,410 650,300" stroke={selectedArchNode === 'places' ? '#6366f1' : '#64748b'} strokeWidth={selectedArchNode === 'places' ? '2.5' : '1.5'} fill="none" markerEnd={selectedArchNode === 'places' ? 'url(#arrow-interactive)' : 'url(#arrow)'} strokeDasharray="3 3"/>
                  </svg>
                </div>
              </div>

              {/* Right Column: Dynamic Node Information Panel */}
              <div className="w-full lg:w-[320px] shrink-0 border border-indigo-100 rounded-xl p-5 bg-indigo-50/50 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-indigo-600 rounded-lg text-white">
                      <Cpu className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-indigo-900 font-mono tracking-wider uppercase">Info de Arquitetura</span>
                  </div>

                  {selectedArchNode ? (
                    <div>
                      <h4 className="text-base font-bold text-slate-900 mb-1">
                        {archNodesInfo[selectedArchNode].title}
                      </h4>
                      <p className="text-xs font-mono text-indigo-600 bg-indigo-100/60 inline-block px-2 py-0.5 rounded mb-4">
                        {archNodesInfo[selectedArchNode].tech}
                      </p>
                      <div className="space-y-3 text-slate-700 text-xs">
                        <p>
                          <strong className="text-slate-900">Descrição Técnica: </strong>
                          {archNodesInfo[selectedArchNode].desc}
                        </p>
                        <p>
                          <strong className="text-slate-900">Papel na Solução: </strong>
                          {archNodesInfo[selectedArchNode].role}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-10 text-slate-400 text-xs">
                      Selecione um componente no diagrama interativo ao lado para abrir o dossiê arquitetural.
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-indigo-100/80 text-[11px] text-slate-500 italic">
                  *Nota: O MVP centraliza coordenação em tempo real segmentada pela Região Operacional dos usuários.
                </div>
              </div>
            </div>

            {/* Cross-Profile Protocol Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border border-slate-100 rounded-xl p-4 bg-slate-50/30">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-slate-900 font-semibold text-xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Isolamento por Região
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Vendedores e GerentesLog são rigidamente associados a uma Região (ex: GV1, MG). Eles não conseguem realizar queries de telemetria ou acessar salas de chat fora dos limites declarados.
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-slate-900 font-semibold text-xs">
                  <Milestone className="w-3.5 h-3.5 text-indigo-600" />
                  Google TSP Optimization
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Para reduzir o custo por entrega e o tempo de condução dos Motoristas, a integração do MVP passa um array ordenado de paradas por meio do parâmetro <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[9px]">optimizeWaypoints: true</code> da API do Google.
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-slate-900 font-semibold text-xs">
                  <Compass className="w-3.5 h-3.5 text-rose-600" />
                  Sensoriamento Reativo
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  O Motorista publica pacotes de telemetria GPS na sua região. O mapa do Vendedor e do Gerente assina esse tópico e renderiza o caminhão em movimento de forma fluida sem requisições HTTP redundantes.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DEVELOPMENT SCOPE */}
        {activeTab === 'scope' && (
          <div className="space-y-6">
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-mono uppercase text-[10px]">
                    <th className="p-3">Fase / Marcos</th>
                    <th className="p-3">Sprints</th>
                    <th className="p-3">Resultados Esperados (Estágio MVP)</th>
                    <th className="p-3">Complexidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="p-3 font-semibold text-slate-900">Fase 1: Infraestrutura de Identidade (RBAC)</td>
                    <td className="p-3 font-mono text-slate-500">Sprint 1 - 2</td>
                    <td className="p-3 text-slate-600 leading-relaxed">
                      Implementação de Firebase Auth com custom claims de Perfil (0, 1, 2, 3), tela de fluxo de primeiro acesso com onboarding específico e restrições rígidas por Região no Firestore. Rota secreta de login administrativo.
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded font-bold text-[10px]">Média</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-slate-900">Fase 2: Motor de Navegação e Otimização</td>
                    <td className="p-3 font-mono text-slate-500">Sprint 3 - 4</td>
                    <td className="p-3 text-slate-600 leading-relaxed">
                      Integração de Google Places Autocomplete para inserção veloz de N paradas pelo Motorista. Conexão com a Google Directions API enviando <code className="bg-slate-100 px-1 rounded text-red-600 font-mono text-[10px]">optimizeWaypoints:true</code> e reordenamento em banco pós-resposta.
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded font-bold text-[10px]">Alta</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-slate-900">Fase 3: Rastreamento Reativo e GPS Background</td>
                    <td className="p-3 font-mono text-slate-500">Sprint 5 - 6</td>
                    <td className="p-3 text-slate-600 leading-relaxed">
                      Desenvolvimento do módulo de Background Geolocation no app do Motorista (ativado pelo botão &quot;Compartilhar Localização&quot;). Criação de canais de sincronização direta no Firestore para renderização em tempo real nos mapas de Vendedores e Gerentes.
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded font-bold text-[10px]">Alta</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-slate-900">Fase 4: Painéis Administrativos e Moderation Suite</td>
                    <td className="p-3 font-mono text-slate-500">Sprint 7</td>
                    <td className="p-3 text-slate-600 leading-relaxed">
                      Painel oculto (/admin-login) com fluxo de auditoria, banimento/suspensão reativa em tempo real através de Security Rules em menos de 1 segundo de latência, e o modo Impersonation (Visualizar como qualquer usuário de campo).
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded font-bold text-[10px]">Média</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-slate-900">Fase 5: Comunicação de Campo (Regional Chat)</td>
                    <td className="p-3 font-mono text-slate-500">Sprint 8</td>
                    <td className="p-3 text-slate-600 leading-relaxed">
                      Chat de equipe regional no Firebase. Ao postar mensagem no canal regional da região x, todos os usuários da região x assinam o stream, exibindo as bolhas correspondentes e despachando Notificação FCM para os motoristas/vendedores ausentes.
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded font-bold text-[10px]">Baixa</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-lg text-xs leading-relaxed text-indigo-900">
              <strong className="font-semibold block mb-1">Estratégia de Rápido Go-To-Market (GTM):</strong>
              Em conformidade com a diretriz estratégica definida pelo Arquiteto, utilizaremos a infraestrutura de SDKs do Firebase para evitar a orquestração manual de microsserviços Node/Go no MVP. Isso economiza pelo menos 6 semanas de pipeline DevOps e provisionamento em container.
            </div>
          </div>
        )}

        {/* TAB 3: SCREEN FLOW DESCRIPTION */}
        {activeTab === 'flows' && (
          <div className="space-y-4 text-xs">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Fluxos de Tela do Ciclo de Planejamento Logístico</h3>
            
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-3">
                <div className="bg-slate-900 text-white rounded-full w-5 h-5 flex items-center justify-center font-mono font-bold shrink-0 text-[10px]">1</div>
                <div>
                  <h4 className="font-bold text-slate-900 mb-1">Onboarding e Autenticação Dinâmica (Flow Comum)</h4>
                  <ul className="list-disc pl-4 space-y-1 text-slate-600">
                    <li><strong>Login Geral:</strong> Login com Credenciais Tradicionais ou OAuth Google.</li>
                    <li><strong>Detecção de Estado:</strong> Se for a primeira inicialização do usuário autenticado, direciona para o <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[9px]">SelectProfileScreen</code> (Três painéis táteis: Motorista, Vendedor, Gerente).</li>
                    <li><strong>Formulário Onboarding:</strong> Ao selecionar o perfil, o formulário varia (CNH para Motorista, Região para Gerente/Vendedor). Salvar em banco re-direciona à Home de cada Perfil.</li>
                  </ul>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-3">
                <div className="bg-slate-900 text-white rounded-full w-5 h-5 flex items-center justify-center font-mono font-bold shrink-0 text-[10px]">2</div>
                <div>
                  <h4 className="font-bold text-slate-900 mb-1">Modelação e Planejamento (Fluxo do Motorista)</h4>
                  <ul className="list-disc pl-4 space-y-1 text-slate-600">
                    <li><strong>Tela &quot;Nova Rota&quot;:</strong> Motorista escreve nome do itinerário, seleciona origem, e clica em &quot;Adicionar Parada&quot; que abre uma modal com inputs inteligentes alimentados pelo places.</li>
                    <li><strong>Módulo &quot;Otimizar Rota&quot;:</strong> Um clique ativa o algoritmo no back, devolvendo as coordenadas reordenadas sequencialmente na tela para visualização prévia da rota ideal.</li>
                    <li><strong>Iniciar e Executar:</strong> Um clique no botão &quot;Iniciar Rota&quot; re-desenha a interface em modo navegação com coordenadas GPS ativas no mapa e dispara eventos push para sua equipe.</li>
                  </ul>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-3">
                <div className="bg-slate-900 text-white rounded-full w-5 h-5 flex items-center justify-center font-mono font-bold shrink-0 text-[10px]">3</div>
                <div>
                  <h4 className="font-bold text-slate-900 mb-1">Painel Oculto Master (Fluxo do Super Administrador)</h4>
                  <ul className="list-disc pl-4 space-y-1 text-slate-600">
                    <li><strong>Gate:</strong> Acessível unicamente pelo endpoint virtual de login (<code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[9px]">/admin-login</code>).</li>
                    <li><strong>Ferramenta de Supervisão (Mirroring/Espelhamento):</strong> O gestor navega pela lista de usuários e espelha em tempo real o painel exato de qualquer operador para fins de diagnóstico rápido e suporte remoto.</li>
                    <li><strong>Enforcement:</strong> Painel de moderação instantâneo para banimento imediato de CPF ou veículo.</li>
                  </ul>
                </div>
              </div>

              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-lg flex items-start gap-3 text-indigo-950">
                <BookOpen className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-indigo-900 mb-1">Efeito Colateral Reativo</h4>
                  <p className="text-[11px] text-indigo-900 leading-relaxed">
                    O app opera como um organismo vivo: no momento do Motorista GV1 iniciar sua viagem, o celular pessoal envia uma notificação FCM silenciosa e ruidosa. Instantaneamente, o telefone da Vendedora Paula Reis (GV1) e o da Gerente Mariana Souza (GV1) recebem banners suspensos: <strong>&quot;Rota iniciada por Lucas Silva!&quot;</strong>, guiando seus respectivos mapas e streams de telemetria em menos de 200 milissegundos.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'audits' && (
          <div className="space-y-6 text-xs text-slate-700">
            <div className="p-4 bg-slate-900 text-white rounded-xl flex items-center justify-between border border-slate-800 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 rounded-lg text-white">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Passo 3: Auditoria Regular de Desempenho e Cotas</h3>
                  <p className="text-[11px] text-slate-400">Diretrizes de monitoramento, otimização de limites operacionais e saúde do ecossistema Cloud.</p>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-mono font-bold text-[10px]">RECOMENDADO</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: Métricas de Desempenho React */}
              <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-sm space-y-3">
                <h4 className="font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Server className="w-4 h-4 text-indigo-600" />
                  1. Auditoria de Desempenho Client-Side
                </h4>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  Para garantir a estabilidade da aplicação em dispositivos móveis e navegadores web com recursos limitados, estabelecemos métricas rigorosas de consumo e ciclo de vida:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-600 leading-relaxed text-[11px]">
                  <li><strong>Gerenciamento de Subscrições:</strong> Sincronização síncrona acoplada rigidamente ao ciclo de vida do componente React para prevenção absoluta de listeners órfãos.</li>
                  <li><strong>Limpeza de Memória:</strong> Eliminação de loops redundantes e timers inativos na simulação de GPS, reduzindo o uso de CPU para quase zero em modo inativo.</li>
                  <li><strong>Cache de Estado Local:</strong> Utilização estratégica do local storage como cache resiliente para acelerar o tempo de carregamento da interface em conexões 3G/4G instáveis.</li>
                </ul>
              </div>

              {/* Card 2: Controle de Cotas Cloud */}
              <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-sm space-y-3">
                <h4 className="font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  2. Auditoria de Cotas e Custos Operacionais
                </h4>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  A operação logística utiliza intensivamente as APIs do Google Maps e o Firestore. O controle estrito de cotas é essencial para evitar picos inesperados de faturamento:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-600 leading-relaxed text-[11px]">
                  <li><strong>Google Directions API:</strong> Implementação de otimização de waypoints para consolidar múltiplos cálculos de rota em uma única chamada.</li>
                  <li><strong>Firestore Reads/Writes:</strong> Substituição completa de polling por conexões WebSockets nativas (onSnapshot) para reduzir em até 92% a cota de leitura do banco de dados.</li>
                  <li><strong>Limitação de Banda:</strong> Desativação inteligente de atualizações em plano de fundo quando o motorista suspende voluntariamente o compartilhamento de localização.</li>
                </ul>
              </div>
            </div>

            {/* Checklist de Auditoria Periódica */}
            <div className="border border-slate-200 rounded-xl p-5 bg-indigo-50/50 space-y-4">
              <h4 className="font-bold text-indigo-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                Protocolo Semanal de Auditoria Logística
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-indigo-100 p-4 rounded-lg space-y-1">
                  <span className="font-bold text-indigo-600 text-[10px] font-mono">ETAPA A</span>
                  <h5 className="font-bold text-slate-900 text-xs">Revisão de Desvios</h5>
                  <p className="text-[11px] text-slate-500 leading-relaxed">Auditar logs de telemetria comparando a quilometragem estimada versus real para identificar gargalos operacionais nas rotas sugeridas.</p>
                </div>
                <div className="bg-white border border-indigo-100 p-4 rounded-lg space-y-1">
                  <span className="font-bold text-indigo-600 text-[10px] font-mono">ETAPA B</span>
                  <h5 className="font-bold text-slate-900 text-xs">Análise de Latência</h5>
                  <p className="text-[11px] text-slate-500 leading-relaxed">Medir a latência média de entrega das notificações FCM para assegurar que motoristas e vendedores operem em perfeita sincronia.</p>
                </div>
                <div className="bg-white border border-indigo-100 p-4 rounded-lg space-y-1">
                  <span className="font-bold text-indigo-600 text-[10px] font-mono">ETAPA C</span>
                  <h5 className="font-bold text-slate-900 text-xs">Depuração de Cotas</h5>
                  <p className="text-[11px] text-slate-500 leading-relaxed">Revisar o console do Google Cloud Platform semanalmente, checando os limites e thresholds de requisições de mapas por usuário ativo.</p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
