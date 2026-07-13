/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  UserRole, RouteUser, Rota, Parada, GPSLocation, ChatMessage, NotificationLog, 
  RoutePerformanceLog, PushDeliveryLog, PushConfig, Region, Cliente, MotoristaUser 
} from '../types';
import { 
  Users, TrendingUp, AlertTriangle, Globe, MapPin, Eye, ShieldCheck, 
  Trash2, AlertCircle, Share2, Navigation, CheckCircle, Send, MessageSquare, 
  UserCheck, ShieldAlert, Ban, Info, Sparkles, Plus, Map, Play, Check, Phone, ArrowRight, Edit, Pencil,
  Route, Compass, Bell, Settings, Layers, Calendar, BarChart3, Clock, AlertOctagon, HelpCircle, Truck, Signal,
  Download, Printer, Mic, Square, Pause, Volume2, SlidersHorizontal, Camera, RefreshCw, X, FileSpreadsheet, Search
} from 'lucide-react';
import InteractiveMap from './InteractiveMap';
import RegionalMap from './RegionalMap';
import RouteMap from './RouteMap';
import ClientImporter from './ClientImporter';
import ClienteManager from './ClienteManager';
import MapClientes from './MapClientes';
import WelcomeTutorial from './WelcomeTutorial';
import { ResponsiveContainer, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AudioPlayer, AudioRecorderButton, DriverStatusCard, exportToCSV, exportToPDF 
} from './DashboardUtils';
import { GUARIBA_LOCATIONS } from './MotoristaDashboard';

// ==========================================
// 2. GERENTE DE LOGÍSTICA VIEW
// ==========================================
interface GerenteProps {
  user: RouteUser;
  users: RouteUser[];
  rotas: Rota[];
  chats: ChatMessage[];
  locations: { [drvId: string]: GPSLocation };
  breadcrumbs?: { [drvId: string]: { lat: number; lng: number }[] };
  notifications: NotificationLog[];
  performanceLogs: RoutePerformanceLog[];
  pushLogs: PushDeliveryLog[];
  pushConfig: PushConfig;
  regions: Region[];
  clients?: Cliente[];
  onSaveClient?: (client: Cliente) => void;
  onDeleteClient?: (id: string) => void;
  onPostMessage: (text: string, audioUrl?: string) => void;
  onPush: (title: string, body: string, region: string) => void;
  onSendPush: (
    templateType: 'nova_rota' | 'rota_iniciada' | 'status_parada' | 'urgente_chat' | 'custom',
    profileSegment: 'all' | UserRole,
    regionSegment: string,
    customTitle?: string,
    customBody?: string
  ) => PushDeliveryLog;
  onCreateRoute: (data: Partial<Rota>) => Rota | undefined;
  onUpdateRoute: (id: string, data: Partial<Rota>) => void;
  onDeleteRoute: (id: string) => void;
  onOptimize: (stops: Parada[], oLat: number, oLng: number) => Promise<Parada[]>;
  onStartRoute: (id: string) => void;
}

export function GerenteDashboard({ 
  user, 
  users,
  rotas, 
  chats, 
  locations, 
  breadcrumbs,
  notifications, 
  performanceLogs, 
  pushLogs, 
  pushConfig, 
  regions,
  clients = [],
  onSaveClient,
  onDeleteClient,
  onPostMessage, 
  onPush, 
  onSendPush,
  onCreateRoute,
  onUpdateRoute,
  onDeleteRoute,
  onOptimize,
  onStartRoute
}: GerenteProps) {
  const [chatInput, setChatInput] = useState('');
  const [activeTab, setActiveTab] = useState<'map' | 'routes' | 'chat' | 'push_config' | 'analytics' | 'clientes'>('map');
  const [mapMode, setMapMode] = useState<'vector' | 'google'>('vector');
  const [searchTerm, setSearchTerm] = useState('');
  const [isImporterOpen, setIsImporterOpen] = useState(false);

  // Dynamic universal search categories matching
  const searchResults = useMemo(() => {
    if (!searchTerm || searchTerm.trim().length < 2) return null;
    const term = searchTerm.toLowerCase().trim();

    // 1. Matches Drivers in Region
    const region = (user as any).region || 'GV1';
    const drivers = users
      .filter(u => u.role === UserRole.MOTORISTA && (u as any).region === region && (
        u.name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        (u as any).plate?.toLowerCase().includes(term)
      ))
      .slice(0, 4);

    // 2. Matches Routes within Region
    const matchedRoutes = rotas
      .filter(r => r.region === region && (
        r.name.toLowerCase().includes(term) ||
        r.driverName.toLowerCase().includes(term)
      ))
      .slice(0, 4);

    // 3. Matches Clients within Region
    const matchedClients: { clientName: string; address: string; routeName: string; whatsApp?: string }[] = [];
    rotas
      .filter(r => r.region === region)
      .forEach(r => {
        r.stops.forEach(st => {
          if (
            st.clientName.toLowerCase().includes(term) ||
            st.address.toLowerCase().includes(term) ||
            (st.clientWhatsApp && st.clientWhatsApp.includes(term))
          ) {
            if (!matchedClients.some(c => c.clientName === st.clientName)) {
              matchedClients.push({
                clientName: st.clientName,
                address: st.address,
                routeName: r.name,
                whatsApp: st.clientWhatsApp
              });
            }
          }
        });
      });

    return {
      drivers,
      routes: matchedRoutes,
      clients: matchedClients.slice(0, 4)
    };
  }, [searchTerm, users, rotas, user]);
  
  // Tutorial and Dynamic Route Filters States
  const [showTutorial, setShowTutorial] = useState(false);
  const [filterRouteStatus, setFilterRouteStatus] = useState<string>('all');
  const [filterRouteDriver, setFilterRouteDriver] = useState<string>('all');
  const [filterRouteDate, setFilterRouteDate] = useState<string>('all'); // all, today, week, month
  
  // Custom Push Form states
  const [pushTemplate, setPushTemplate] = useState<'nova_rota' | 'rota_iniciada' | 'status_parada' | 'urgente_chat' | 'custom'>('nova_rota');
  const [pushRole, setPushRole] = useState<'all' | UserRole>('all');
  const [pushRegion, setPushRegion] = useState<string>((user as any).region || 'GV1');
  const [pushTitle, setPushTitle] = useState('Nova Rota Atribuída 📦');
  const [pushBody, setPushBody] = useState('Uma nova rota logística foi designada ao seu perfil regional.');
  const [apnsSandbox, setApnsSandbox] = useState(pushConfig.apnsSandbox);

  const region = (user as any).region || 'GV1';

  // NEW: Route Builder States inside Gerente "Clientes" tab
  const [gRouteName, setGRouteName] = useState('Rota Corporativa ' + new Date().toLocaleDateString('pt-BR'));
  const [gOrigin, setGOrigin] = useState('CD Central ' + region + ' - Av. Dos Camras, 513,Santo Antonio - Cariacica-ES');
  const [gOriginLat, setGOriginLat] = useState(-20.302534);
  const [gOriginLng, setGOriginLng] = useState(-40.401630);
  const [gSelectedDriverId, setGSelectedDriverId] = useState('');
  const [gStops, setGStops] = useState<Parada[]>([]);
  const [gClientName, setGClientName] = useState('');
  const [gClientWhatsApp, setGClientWhatsApp] = useState('');
  const [gClientAddress, setGClientAddress] = useState('');
  const [gCustomLat, setGCustomLat] = useState<number>(-20.302534);
  const [gCustomLng, setGCustomLng] = useState<number>(-40.401630);
  const [gAddressPredictions, setGAddressPredictions] = useState<{ description: string; placeId: string }[]>([]);
  const [gIsValidating, setGIsValidating] = useState(false);
  const [gIsValidated, setGIsValidated] = useState(false);
  const [gEditingRouteId, setGEditingRouteId] = useState<string | null>(null);

  // High Precision GIS Routing & Truck Restriction States
  const [gVehicleHeight, setGVehicleHeight] = useState<string>('4.2');
  const [gVehicleWeight, setGVehicleWeight] = useState<string>('12.0');
  const [gisDirections, setGisDirections] = useState<any>(null);
  const [isGisCalculating, setIsGisCalculating] = useState(false);

  useEffect(() => {
    if (gStops.length === 0) {
      setGisDirections(null);
      return;
    }
    const fetchGisDirections = async () => {
      setIsGisCalculating(true);
      try {
        const response = await fetch('/api/gis/directions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stops: gStops,
            originLat: gOriginLat,
            originLng: gOriginLng,
            vehicleHeight: Number(gVehicleHeight || 4.2),
            vehicleWeight: Number(gVehicleWeight || 12)
          })
        });
        if (response.ok) {
          const data = await response.json();
          setGisDirections(data);
        }
      } catch (err) {
        console.warn('GIS Directions load error:', err);
      } finally {
        setIsGisCalculating(false);
      }
    };

    const timer = setTimeout(fetchGisDirections, 500);
    return () => clearTimeout(timer);
  }, [gStops, gOriginLat, gOriginLng, gVehicleHeight, gVehicleWeight]);

  // Client Management States
  const [clientSubTab, setClientSubTab] = useState<'database' | 'planner' | 'map_clientes'>('database');
  const [clientsSearch, setClientsSearch] = useState('');
  const [checkedClientIds, setCheckedClientIds] = useState<string[]>([]);
  
  // Client CRUD Modal States
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [cEditingClient, setCEditingClient] = useState<Cliente | null>(null);
  const [cFormName, setCFormName] = useState('');
  const [cFormWhatsApp, setCFormWhatsApp] = useState('');
  const [cFormAddress, setCFormAddress] = useState('');
  const [cFormLat, setCFormLat] = useState<number>(-20.302534);
  const [cFormLng, setCFormLng] = useState<number>(-40.401630);
  const [cFormAddressPredictions, setCEAddrPredictions] = useState<{ description: string; placeId: string }[]>([]);
  const [cFormIsValidated, setCFormIsValidated] = useState(false);

  const cFetchAddressPredictions = async (inputStr: string) => {
    if (!inputStr || inputStr.trim().length < 2) {
      setCEAddrPredictions([]);
      return;
    }
    try {
      const response = await fetch(`/api/gis/autocomplete?input=${encodeURIComponent(inputStr)}`);
      if (response.ok) {
        const data = await response.json();
        setCEAddrPredictions(data.map((item: any) => ({
          description: item.description,
          placeId: item.placeId
        })));
      }
    } catch (e) {
      console.warn('Client autocomp fail:', e);
    }
  };

  const cHandleSelectPrediction = async (address: string, placeId: string) => {
    setCFormAddress(address);
    setCEAddrPredictions([]);
    setCFormIsValidated(true);
    try {
      const response = await fetch('/api/gis/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.valid) {
          setCFormLat(data.lat);
          setCFormLng(data.lng);
          setCFormAddress(data.standardizedAddress);
        }
      }
    } catch (err) {
      console.warn('Client form geocoder failed:', err);
    }
  };

  const handleSaveClientForm = () => {
    if (!cFormName || !cFormAddress) {
      alert('Favor preencher o Nome e Endereço do Cliente.');
      return;
    }
    const cleanPhone = cFormWhatsApp.replace(/\D/g, '');

    const clientData: Cliente = {
      id: cEditingClient ? cEditingClient.id : `cli_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: cFormName,
      whatsApp: cleanPhone || '5533999999999',
      address: cFormAddress,
      lat: cFormLat,
      lng: cFormLng,
      region,
      createdAt: cEditingClient ? cEditingClient.createdAt : new Date().toISOString()
    };

    if (onSaveClient) {
      onSaveClient(clientData);
    }
    setIsClientModalOpen(false);
    setCEditingClient(null);
    setCFormName('');
    setCFormWhatsApp('');
    setCFormAddress('');
  };

  const handleOpenEditClient = (cli: Cliente) => {
    setCEditingClient(cli);
    setCFormName(cli.name);
    setCFormWhatsApp(cli.whatsApp);
    setCFormAddress(cli.address);
    setCFormLat(cli.lat);
    setCFormLng(cli.lng);
    setCFormIsValidated(true);
    setIsClientModalOpen(true);
  };

  const handleOpenAddClient = () => {
    setCEditingClient(null);
    setCFormName('');
    setCFormWhatsApp('');
    setCFormAddress('');
    setCFormLat(gOriginLat);
    setCFormLng(gOriginLng);
    setCFormIsValidated(false);
    setIsClientModalOpen(true);
  };

  const handleExportClientsCSV = () => {
    const regionalClients = clients.filter(c => c.region === region);
    if (regionalClients.length === 0) {
      alert('Nenhum cliente cadastrado nesta região para exportar.');
      return;
    }

    const headers = ['ID', 'Nome', 'WhatsApp', 'Endereco', 'Lat', 'Lng', 'Regiao', 'CriadoEm'];
    const rows = regionalClients.map(c => [
      c.id,
      `"${c.name.replace(/"/g, '""')}"`,
      c.whatsApp,
      `"${c.address.replace(/"/g, '""')}"`,
      c.lat,
      c.lng,
      c.region,
      c.createdAt
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `banco_clientes_${region}_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateRouteFromSelected = () => {
    if (checkedClientIds.length === 0) {
      alert('Selecione pelo menos um cliente no banco de dados.');
      return;
    }

    const selectedClients = clients.filter(c => checkedClientIds.includes(c.id));
    const newStops: Parada[] = selectedClients.map((c, index) => ({
      id: `p_stop_db_${Date.now()}_${index}`,
      clientName: c.name,
      clientWhatsApp: c.whatsApp,
      address: c.address,
      lat: c.lat,
      lng: c.lng,
      status: 'pending',
      region: c.region
    }));

    setGStops(newStops);
    setCEditingClient(null);
    setCheckedClientIds([]);
    setClientSubTab('planner');
  };

  // Address places suggestions for Gerente view via server-side GIS Autocomplete
  const gFetchAddressPredictions = async (inputStr: string) => {
    if (!inputStr || inputStr.trim().length < 2) {
      setGAddressPredictions([]);
      return;
    }
    try {
      const response = await fetch(`/api/gis/autocomplete?input=${encodeURIComponent(inputStr)}`);
      if (response.ok) {
        const data = await response.json();
        setGAddressPredictions(data.map((item: any) => ({
          description: item.description,
          placeId: item.placeId
        })));
      }
    } catch (e) {
      console.warn('Gerente autocomplete failed:', e);
    }
  };

  const gHandleSelectPrediction = async (address: string, placeId: string) => {
    setGClientAddress(address);
    setGAddressPredictions([]);
    setGIsValidated(true);
    try {
      const response = await fetch('/api/gis/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.valid) {
          setGCustomLat(data.lat);
          setGCustomLng(data.lng);
          setGClientAddress(data.standardizedAddress);
        }
      }
    } catch (err) {
      console.warn('Gerente geocoder by placeId failed:', err);
    }
  };

  const gAddPresetStop = (idx: number) => {
    const preset = GUARIBA_LOCATIONS[idx % GUARIBA_LOCATIONS.length];
    setGClientName(preset.name);
    setGClientAddress(preset.address);
    setGCustomLat(preset.lat);
    setGCustomLng(preset.lng);
    setGClientWhatsApp('553399' + Math.floor(1000000 + Math.random() * 9000000));
    setGIsValidated(true);
  };

  const moveStopUp = (index: number) => {
    if (index === 0) return;
    const newStops = [...gStops];
    const temp = newStops[index];
    newStops[index] = newStops[index - 1];
    newStops[index - 1] = temp;
    setGStops(newStops);
  };

  const moveStopDown = (index: number) => {
    if (index === gStops.length - 1) return;
    const newStops = [...gStops];
    const temp = newStops[index];
    newStops[index] = newStops[index + 1];
    newStops[index + 1] = temp;
    setGStops(newStops);
  };

  const gHandleAddStop = () => {
    if (!gClientName || !gClientAddress) {
      alert('Favor preencher o Nome do Cliente e Endereço Completo.');
      return;
    }
    const newStop: Parada = {
      id: `p_stop_g_${Date.now()}`,
      clientName: gClientName,
      clientWhatsApp: gClientWhatsApp,
      address: gClientAddress,
      lat: gCustomLat,
      lng: gCustomLng,
      status: 'pending'
    };
    setGStops([...gStops, newStop]);
    setGClientName('');
    setGClientWhatsApp('');
    setGClientAddress('');
    setGAddressPredictions([]);
    setGIsValidated(false);
  };

  const gGeocodeAddress = (addressText: string, isOrigin: boolean) => {
    if (!addressText.trim()) return;
    if (typeof window !== 'undefined' && (window as any).google && (window as any).google.maps) {
      try {
        const geocoder = new (window as any).google.maps.Geocoder();
        geocoder.geocode({ address: addressText }, (results: any, status: any) => {
          if (status === 'OK' && results && results[0]) {
            const loc = results[0].geometry.location;
            if (isOrigin) {
              setGOriginLat(loc.lat());
              setGOriginLng(loc.lng());
            } else {
              setGCustomLat(loc.lat());
              setGCustomLng(loc.lng());
            }
          }
        });
      } catch (err) {
        console.warn('Gerente direct geocode failed:', err);
      }
    }
  };

  // Region isolation of routes
  const regionalRoutes = rotas.filter(r => r.region === region);
  const activeRoute = regionalRoutes.find(r => r.status === 'active') || null;

  // Filter regional routes dynamically by delivery status, assigned driver, and creation date
  const filteredRegionalRoutes = useMemo(() => {
    let list = [...regionalRoutes];
    
    if (filterRouteStatus !== 'all') {
      list = list.filter(r => r.status === filterRouteStatus);
    }
    
    if (filterRouteDriver !== 'all') {
      list = list.filter(r => r.driverId === filterRouteDriver);
    }
    
    if (filterRouteDate !== 'all') {
      const now = new Date();
      list = list.filter(r => {
        if (!r.createdAt) return false;
        const createdDate = new Date(r.createdAt);
        // Date difference calculation
        const createdStartOfDay = new Date(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate()).getTime();
        const nowStartOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const diffDays = Math.round((nowStartOfDay - createdStartOfDay) / (1000 * 60 * 60 * 24));
        
        if (filterRouteDate === 'today') {
          return createdDate.toDateString() === now.toDateString();
        } else if (filterRouteDate === 'week') {
          return diffDays <= 7;
        } else if (filterRouteDate === 'month') {
          return diffDays <= 30;
        }
        return true;
      });
    }
    
    return list;
  }, [regionalRoutes, filterRouteStatus, filterRouteDriver, filterRouteDate]);

  // Region isolation of drivers (displaying only those linked to the logged-in Manager's region)
  const regionalDrivers = useMemo(() => {
    return users.filter(u => u.role === UserRole.MOTORISTA && (u as any).region === region);
  }, [users, region]);

  // Region isolation of chat
  const regionalChats = chats.filter(c => c.region === region);

  // Region notifications (fully filtered automatically to Manager's registered profile region)
  const regionalNotifs = useMemo(() => {
    return notifications.filter(n => n.region === region);
  }, [notifications, region]);

  // Region isolated performance logs & push logs
  const regionalPerformance = performanceLogs.filter(p => p.region === region);
  const regionalPushLogs = pushLogs.filter(p => p.targetRegion === 'all' || p.targetRegion === region);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onPostMessage(chatInput.trim());
    setChatInput('');
  };

  // When a push template is selected, update placeholder texts automatically
  const handleTemplateChange = (tmpl: 'nova_rota' | 'rota_iniciada' | 'status_parada' | 'urgente_chat' | 'custom') => {
    setPushTemplate(tmpl);
    if (tmpl === 'nova_rota') {
      setPushTitle('Nova Rota Atribuída 📦');
      setPushBody('Atenção motorista: Uma nova rota de entregas multiparadas foi designada ao seu veículo.');
      setPushRole(UserRole.MOTORISTA);
    } else if (tmpl === 'rota_iniciada') {
      setPushTitle('Motorista em Trânsito 🚚');
      setPushBody('A rota regional foi iniciada pelo condutor. Posicionamento de satélite ativo.');
      setPushRole(UserRole.GERENTE);
    } else if (tmpl === 'status_parada') {
      setPushTitle('Entrega Concluída Checklist ✅');
      setPushBody('Canal de logística informa: Uma das paradas agendadas acaba de ser finalizada.');
      setPushRole('all');
    } else if (tmpl === 'urgente_chat') {
      setPushTitle('Mensagem Urgente da Central ⚠️');
      setPushBody('Retorno imediato solicitado! Favor verificar canal de chat regional.');
      setPushRole(UserRole.MOTORISTA);
    } else {
      setPushTitle('Alerta Customizado 📢');
      setPushBody('Comunicado operacional do time de controle RouteLog.');
      setPushRole('all');
    }
  };

  const handleDispatchPush = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pushTitle.trim() || !pushBody.trim()) return;
    onSendPush(pushTemplate, pushRole, pushRegion, pushTitle, pushBody);
    alert('FCM Push Broadcast Simulado Enviado com Sucesso!');
  };

  // Calculate high-fidelity performance metrics for regional analytics widgets
  const statsSummary = useMemo(() => {
    const totalKm = regionalPerformance.reduce((sum, p) => sum + p.actualDistanceKm, 0);
    const completedRoutes = regionalPerformance.filter(p => p.status === 'completed').length;
    const activeRoutes = regionalPerformance.filter(p => p.status === 'active').length;
    const totalDeviations = regionalPerformance.reduce((sum, p) => sum + p.routeDeviations, 0);

    const totalStopsMeasured = regionalPerformance.reduce((acc, p) => acc + p.stopTelemetry.length, 0);
    const totalMinutesMeasured = regionalPerformance.reduce((acc, p) => {
      return acc + p.stopTelemetry.reduce((stopAcc, s) => stopAcc + s.timeSpentMinutes, 0);
    }, 0);
    
    const avgStopMins = totalStopsMeasured > 0 ? Math.round(totalMinutesMeasured / totalStopsMeasured) : 18;

    return {
      totalKm: Math.round(totalKm * 10) / 10,
      completedRoutes,
      activeRoutes,
      totalDeviations,
      avgStopMins
    };
  }, [regionalPerformance]);

  // Transform data for recharts
  const distanceChartData = regionalPerformance.map(p => ({
    name: p.routeName.replace('Rota ', 'R_'),
    'Distância Prevista (km)': p.plannedDistanceKm,
    'Distância Realizada (km)': p.actualDistanceKm,
  }));

  const deviationChartData = regionalPerformance.map(p => ({
    name: p.routeName.replace('Rota ', 'R_'),
    'Desvios Detectados': p.routeDeviations,
    'Média Minutos/Parada': p.averageTimePerStopMinutes || 15
  }));

  return (
    <div id="gerente-main-panel" className="flex flex-col gap-5 select-text w-full">
      
      {/* Top Profile QuickBar & Tab Controller */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold font-mono">
              {region}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-850">{user.name}</h2>
                <span className="bg-blue-50 text-blue-700 text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase border border-blue-100">
                  Gerente de Logística
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Gestão de frota, inteligência regional & push-targeting.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
            <button
               type="button"
               onClick={() => setShowTutorial(true)}
               className="bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 border border-slate-700 px-3 py-1.5 text-xs rounded-xl flex items-center gap-1 font-bold cursor-pointer transition-all"
               title="Abrir guia interativo explicativo regional"
             >
               <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
               <span>Guia Regional</span>
             </button>

            <div className="relative">
              <input
                type="text"
                placeholder="Buscar rotas, motoristas..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-slate-50 border border-slate-300 text-slate-800 p-2 text-xs rounded-xl placeholder-slate-400 w-[180px] focus:outline-none focus:border-blue-500 font-sans shadow-sm"
              />
              {searchResults && (
                <div className="absolute right-0 top-full mt-2 w-[320px] md:w-[465px] bg-white border border-slate-200 shadow-2xl rounded-2xl p-4.5 z-50 overflow-y-auto max-h-[380px] space-y-4 text-slate-800 text-left border-t-8 border-t-blue-600">
                  <div className="flex items-center justify-between border-b pb-2 select-none">
                    <span className="font-extrabold text-[10px] text-slate-400 uppercase tracking-widest">Busca Logística ({region})</span>
                    <button 
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2.5 py-1 rounded font-black uppercase"
                    >
                      Limpar
                    </button>
                  </div>

                  {searchResults.drivers.length === 0 && searchResults.routes.length === 0 && searchResults.clients.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 font-medium font-sans">Nenhum registro correspondente encontrado para "{searchTerm}"</div>
                  ) : (
                    <div className="space-y-4 font-sans">
                      {/* Drivers category */}
                      {searchResults.drivers.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[9px] font-black text-blue-600 block uppercase tracking-wider font-mono">Motoristas Regionais 👀</span>
                          <div className="space-y-1">
                            {searchResults.drivers.map(drv => (
                              <div key={drv.id} className="p-2.5 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between transition-all hover:bg-slate-100/50">
                                <div>
                                  <strong className="block text-slate-850 text-xs font-semibold">{drv.name}</strong>
                                  <span className="text-[10px] text-slate-400 block mt-0.5 font-sans">E-mail: {drv.email} {(drv as any).region ? `| Região: ${(drv as any).region}` : ''}</span>
                                </div>
                                <span className="bg-blue-50 border border-blue-150 text-blue-700 font-mono text-[9px] font-black uppercase px-2 py-0.5 rounded shrink-0">
                                  Placa: {(drv as any).plate || 'RTL-1234'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Routes category */}
                      {searchResults.routes.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[9px] font-black text-blue-600 block uppercase tracking-wider font-mono">Rotas Isoladas 📦</span>
                          <div className="space-y-1">
                            {searchResults.routes.map(rt => (
                              <div key={rt.id} className="p-2.5 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between transition-all hover:bg-slate-100/50 font-sans">
                                <div className="min-w-0 pr-2">
                                  <strong className="block text-slate-850 text-xs font-semibold truncate">{rt.name}</strong>
                                  <span className="text-[10px] text-slate-400 block mt-0.5 truncate">Origem: {rt.origin} | Região: {rt.region}</span>
                                </div>
                                <span className={`font-mono text-[8px] text-white font-black uppercase px-2 py-0.5 rounded shrink-0 ${
                                  rt.status === 'completed' ? 'bg-emerald-500' : rt.status === 'active' ? 'bg-blue-500 animate-pulse' : 'bg-slate-400'
                                }`}>
                                  {rt.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Clients category */}
                      {searchResults.clients.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[9px] font-black text-blue-600 block uppercase tracking-wider font-mono">Clientes / Destinatários Regional 👤</span>
                          <div className="space-y-1">
                            {searchResults.clients.map((cl, cidx) => (
                              <div key={cidx} className="p-2.5 bg-slate-50 border border-slate-150 rounded-xl transition-all hover:bg-slate-100/50 font-sans">
                                <div className="flex items-center justify-between pr-1 gap-2">
                                  <strong className="text-slate-850 text-xs font-semibold truncate">{cl.clientName}</strong>
                                  {cl.whatsApp && <span className="text-[9px] font-mono font-bold text-emerald-600 shrink-0">💬 {cl.whatsApp}</span>}
                                </div>
                                <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{cl.address}</p>
                                <span className="text-[8px] text-slate-500 bg-slate-200/60 inline-block mt-1 px-1.5 py-0.5 rounded font-mono font-bold leading-none select-none">
                                  Rota associada: {cl.routeName}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100 text-emerald-700 text-[11px] font-medium font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              FCM Channel Live: {region}-Secured
            </div>
          </div>
        </div>

        {/* Six-way tab selection button matrix */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/30">
          <button
            onClick={() => setActiveTab('map')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'map' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            Vigilância Satélite
          </button>
          
          <button
            onClick={() => setActiveTab('routes')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'routes' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Route className="w-3.5 h-3.5" />
            Condutores Ativos
          </button>
          
          <button
            onClick={() => setActiveTab('chat')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'chat' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Chat Regional
          </button>

          <button
            onClick={() => setActiveTab('push_config')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'push_config' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Bell className="w-3.5 h-3.5 text-rose-500" />
            Notificações Push
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'analytics' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-indigo-500" />
            Desempenho (BI)
          </button>

          <button
            onClick={() => setActiveTab('clientes')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 col-span-2 sm:col-span-1 ${
              activeTab === 'clientes' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-emerald-600" />
            Clientes (Rotas)
          </button>
        </div>
      </div>

      {/* Main Reactive Workspace Splitter */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch min-h-[460px]">
        
        {/* Dynamic Context Widget Frame (5 columns left side) */}
        <div className="lg:col-span-4 flex flex-col h-full gap-4">
          
          {/* Active routes metadata */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-md flex flex-col flex-grow">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5 border-b border-slate-100 pb-2 shrink-0">
              <Layers className="w-4 h-4 text-slate-400" />
              Operações Locais ({region})
            </h3>

            <div className="flex-grow overflow-y-auto pr-1 space-y-3.5 max-h-[380px]">
              {/* Conditional Left Widgets */}
              {activeTab === 'analytics' ? (
                // Performance mini metrics left sidebar
                <div className="space-y-4">
                  <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                    <span className="text-[10px] font-bold text-indigo-600 block uppercase font-mono">ON-TIME PERFORMANCE</span>
                    <strong className="text-2xl font-bold text-indigo-900 font-sans block mt-1">94.8%</strong>
                    <p className="text-[10px] text-indigo-400 mt-1 leading-normal font-sans">
                      Metas baseadas na tolerância máxima de 25 minutos por ponto de entrega programado.
                    </p>
                  </div>

                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                    <span className="text-[10px] font-bold text-amber-700 block uppercase font-mono">ALERTAS DE COMPORTAMENTO</span>
                    <strong className="text-lg font-bold text-amber-900 flex items-center gap-1 mt-1">
                      <AlertTriangle className="w-4 h-4 text-amber-600 animate-pulse" />
                      {statsSummary.totalDeviations} Desvios de Rota
                    </strong>
                    <p className="text-[10px] text-amber-500 mt-1 leading-normal font-sans">
                      Eventos registrados quando a distância realizada supera o modelo previsto em +0.5km por parada.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-650 space-y-2 text-[11px] font-sans">
                    <strong className="font-bold text-xs text-slate-700 block">Legenda da Grid de Escopo:</strong>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-blue-500 block"></span>
                      <span>Barra Azul: Trajeto planejado por algoritmos GIS</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-emerald-500 block"></span>
                      <span>Barra Verde: Escopo real medido por GPS mobile</span>
                    </div>
                  </div>
                </div>
              ) : activeTab === 'push_config' ? (
                // FCM Settings metadata log left sidebar
                <div className="space-y-4">
                  <div className="bg-slate-900 border border-slate-950 p-4 rounded-xl text-white space-y-3 font-mono text-[10px]">
                    <span className="text-rose-500 font-bold block uppercase tracking-wider text-[11px]">Firebase Service API Profile</span>
                    
                    <div>
                      <span className="text-slate-400 block">TOKEN DE IDENTIFICAÇÃO DO TERMINAL FCM:</span>
                      <span className="text-slate-200 select-all truncate block bg-slate-950 px-1.5 py-1 rounded mt-0.5 border border-slate-800">
                        {pushConfig.fcmToken}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block">SERVER WEB KEY (.json configuration):</span>
                      <span className="text-slate-350 select-all font-sans text-[9px] block">
                        {pushConfig.fcmServerKey} (Cloud Messaging V1 credentials loaded)
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[11px]">
                      <span>APNs IOS Certificate:</span>
                      <button 
                        type="button"
                        onClick={() => setApnsSandbox(!apnsSandbox)}
                        className={`px-2 py-0.5 rounded cursor-pointer text-[9px] ${apnsSandbox ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                      >
                        {apnsSandbox ? 'SANDBOX ACTIVE' : 'PRODUCTION APNS'}
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 text-slate-400 text-[10px] leading-relaxed font-sans pt-1">
                      <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span>Estes parâmetros correspondem às chaves injetadas para conexão direta aos servidores Google FCM.</span>
                    </div>
                  </div>
                </div>
              ) : activeTab === 'routes' ? (
                // Active driver and route list layout with full regional detail
                <div className="space-y-4">
                  {/* TOP ACTION BAR: NEW ROUTE & CSV IMPORT */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-blue-50/70 to-indigo-50/70 border border-blue-100 rounded-2xl p-4.5 shadow-sm">
                    <div>
                      <h4 className="font-extrabold text-[11px] text-indigo-950 uppercase tracking-widest font-mono">Painel de Planejamento Regional ({region})</h4>
                      <p className="text-[10.5px] text-indigo-800 font-sans mt-0.5 font-medium leading-relaxed">Importe planilhas de faturamento para roteamento de paradas e despacho das frotas.</p>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => setIsImporterOpen(true)}
                      className="px-4.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 text-xs select-none cursor-pointer uppercase tracking-wider self-start sm:self-center font-sans"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-white" />
                      <span>Importar Clientes (CSV/Excel)</span>
                    </button>
                  </div>

                  {/* Dynamic Fleet Filter bar widget */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3 shadow-xs">
                    <div className="flex items-center justify-between border-b border-slate-150 pb-2">
                      <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700 uppercase tracking-tight font-sans">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>Filtros Operacionais</span>
                      </div>
                      {(filterRouteStatus !== 'all' || filterRouteDriver !== 'all' || filterRouteDate !== 'all') && (
                        <button
                          type="button"
                          onClick={() => {
                            setFilterRouteStatus('all');
                            setFilterRouteDriver('all');
                            setFilterRouteDate('all');
                          }}
                          className="text-[10px] text-blue-600 hover:text-blue-800 font-bold transition-all cursor-pointer underline"
                        >
                          Limpar
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-2.5">
                      {/* Status select */}
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1 font-mono">Status de Entrega</label>
                        <select
                          value={filterRouteStatus}
                          onChange={(e) => setFilterRouteStatus(e.target.value)}
                          className="w-full bg-white border border-slate-205 text-slate-700 px-2 py-1.5 text-[11px] rounded-xl focus:border-blue-500 outline-none font-semibold transition-all cursor-pointer"
                        >
                          <option value="all">Todos os Status</option>
                          <option value="draft">Rascunho (Draft)</option>
                          <option value="active">Em Trânsito (Active)</option>
                          <option value="completed">Concluídos (Completed)</option>
                        </select>
                      </div>

                      {/* Driver select */}
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1 font-mono">Motorista Designado</label>
                        <select
                          value={filterRouteDriver}
                          onChange={(e) => setFilterRouteDriver(e.target.value)}
                          className="w-full bg-white border border-slate-205 text-slate-700 px-2 py-1.5 text-[11px] rounded-xl focus:border-blue-500 outline-none font-semibold text-ellipsis overflow-hidden transition-all cursor-pointer"
                        >
                          <option value="all">Todos os Motoristas</option>
                          {regionalDrivers.map(drv => (
                            <option key={drv.id} value={drv.id}>{drv.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Date select */}
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1 font-mono">Data de Criação</label>
                        <select
                          value={filterRouteDate}
                          onChange={(e) => setFilterRouteDate(e.target.value)}
                          className="w-full bg-white border border-slate-200 text-slate-700 px-2 py-1.5 text-[11px] rounded-xl focus:border-blue-500 outline-none font-semibold transition-all cursor-pointer"
                        >
                          <option value="all">Qualquer Período</option>
                          <option value="today">Criadas Hoje</option>
                          <option value="week">Últimos 7 dias</option>
                          <option value="month">Últimos 30 dias</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2 font-mono">
                      Rotas Regionais Mapeadas ({filteredRegionalRoutes.length})
                    </span>
                    <div className="space-y-2.5">
                      {filteredRegionalRoutes.map(route => {
                        const completedStops = route.stops.filter(s => s.status === 'completed').length;
                        const isCompleted = route.status === 'completed';
                        const isActive = route.status === 'active';

                        return (
                          <div key={route.id} className="p-3 border border-slate-200 rounded-xl text-xs bg-slate-50/50 hover:bg-slate-50 transition-all shadow-sm">
                            <div className="flex items-center justify-between mb-1.5 font-sans">
                              <strong className="text-slate-800 font-bold truncate block max-w-[170px]">{route.name}</strong>
                              <span className={`px-2 py-0.5 text-[9px] rounded-full font-mono font-bold uppercase border ${
                                isActive ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse' :
                                isCompleted ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-450 border-slate-200'
                              }`}>
                                {route.status}
                              </span>
                            </div>

                            <div className="space-y-0.5 text-[11px] text-slate-500 font-sans">
                              <p>Condutor: <strong className="text-slate-700">{route.driverName}</strong></p>
                              <p>Identificação: <strong className="text-slate-700 font-mono text-[10px] uppercase">{route.driverPlate}</strong></p>
                              {route.createdAt && (
                                <p className="text-[9px] text-slate-400 mt-1">Criação: <strong className="text-slate-500 font-mono">{new Date(route.createdAt).toLocaleDateString('pt-BR')}</strong></p>
                              )}
                            </div>
                            
                            <div className="mt-2.5 flex items-center justify-between text-[11px] border-t border-slate-200/50 pt-2 font-sans text-slate-500">
                              <span>Progresso:</span>
                              <strong className="text-slate-700 font-bold font-mono">{completedStops} / {route.stops.length} concluídas</strong>
                            </div>
                          </div>
                        );
                      })}
                      {filteredRegionalRoutes.length === 0 && (
                        <div className="text-center py-6 text-slate-400 text-xs italic">Nenhuma rota ativa regional com estes filtros.</div>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-slate-150 pt-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2 font-mono pb-1 border-b border-slate-50">
                      Motoristas Ativos da Região ({region})
                    </span>
                    <div className="space-y-2.5">
                      {regionalDrivers.map(drv => {
                        const driverLoc = locations[drv.id];
                        const hasActiveRoute = regionalRoutes.some(r => r.driverId === drv.id && r.status === 'active');
                        return (
                          <DriverStatusCard 
                            key={drv.id}
                            drv={drv as MotoristaUser}
                            driverLoc={driverLoc}
                            hasActiveRoute={hasActiveRoute}
                          />
                        );
                      })}
                      {regionalDrivers.length === 0 && (
                        <div className="text-center py-4 text-slate-400 text-xs italic">Nenhum motorista nesta região.</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : activeTab === 'chat' ? (
                // Team chat view of this region
                <div className="flex flex-col h-full min-h-[300px]">
                  {/* Tooltip explicativo regional */}
                  <div className="bg-amber-50/50 border border-amber-200/50 rounded-xl p-2.5 mb-2 flex items-start gap-1.5 text-[10px] text-amber-900 font-medium select-none shadow-xs">
                    <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      <strong>Visibilidade Restrita ({region}):</strong> Mensagens enviadas aqui só serão visíveis para membros associados a esta região.
                    </p>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[240px] pr-1 pb-1">
                    {regionalChats.map(c => (
                      <div key={c.id} className="p-2 rounded-xl bg-slate-50 border border-slate-150">
                        <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
                          <span className="font-bold text-slate-700">{c.senderName}</span>
                          <span className="font-mono text-[9px]">{new Date(c.timestamp).toLocaleTimeString('pt-BR')}</span>
                        </div>
                        <p className="text-slate-650 leading-relaxed font-sans">{c.message}</p>
                        {c.audioUrl && <AudioPlayer src={c.audioUrl} />}
                      </div>
                    ))}
                    {regionalChats.length === 0 && (
                      <div className="text-center py-10 text-slate-400">Nenhuma mensagem registrada no canal.</div>
                    )}
                  </div>

                  <form onSubmit={handleSendChat} className="flex gap-2 border-t border-slate-150 pt-2.5 mt-auto items-center">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      placeholder="Enviar mensagem para motoristas..."
                      className="flex-1 border border-slate-205 px-3 py-1.5 rounded-xl text-xs bg-slate-50 focus:bg-white transition-all outline-none"
                    />
                    <AudioRecorderButton onSendAudio={(base64) => onPostMessage('🎙️ Nota de Áudio', base64)} />
                    <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-3 py-2 flex items-center justify-center cursor-pointer transition-colors shadow-sm shrink-0">
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
              ) : (
                // Vigilancia: general notifications stream
                <div className="space-y-2.5">
                  {regionalNotifs.map(notif => (
                    <div key={notif.id} className="p-3 rounded-xl border border-blue-100 bg-blue-50/20 text-xs">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5">
                        <span className="font-semibold text-blue-700 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          {notif.title}
                        </span>
                        <span>{new Date(notif.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-slate-650 leading-relaxed font-sans">{notif.body}</p>
                    </div>
                  ))}
                  {regionalNotifs.length === 0 && (
                    <div className="text-center py-6 text-slate-400 text-xs font-sans">
                      Aguardando alertas de início de rota e telemetria...
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-3 pt-2 w-full text-center border-t border-slate-100 text-[10px] text-slate-450 uppercase tracking-widest font-mono">
              SECURE REGIONAL DATA ACCESS ONLY
            </div>
          </div>
        </div>

        {/* Dynamic Center Stage Area (8 columns right side) */}
        <div className="lg:col-span-8 flex flex-col h-full min-h-[460px]">
          
          {activeTab === 'map' ? (
            // Tab 1: GIS Regional Dashboard Monitor
            <div className="flex flex-col flex-1 h-full min-h-[420px]">
              
              {/* Performance Summary Dashboard Widget */}
              <div id="performance-summary-widget" className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 border border-slate-800 text-white rounded-2xl p-4 md:p-5 mb-4 shadow-xl relative overflow-hidden">
                {/* Background accent glow */}
                <div className="absolute right-0 top-0 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-4 select-none relative z-10">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="p-1 px-2.5 bg-blue-500/10 text-blue-400 text-[9px] rounded-full uppercase tracking-widest font-bold border border-blue-500/25 font-mono">Painel de Performance</span>
                      <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">• Região {region}</span>
                    </div>
                    <h3 className="font-sans font-bold text-base md:text-lg text-slate-100 tracking-tight mt-1 flex items-center gap-2">
                      <TrendingUp className="w-4.5 h-4.5 text-blue-400" />
                      Performance Summary
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* CSV Export Button */}
                    <button
                      type="button"
                      onClick={() => exportToCSV(regionalPerformance, `performance_summary_${region}.csv`)}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-[10.5px] font-extrabold text-white rounded-xl transition-all flex items-center gap-1.5 shadow-md shadow-blue-950/40 border border-blue-500/30 cursor-pointer uppercase tracking-wider active:scale-95"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-200" />
                      <span>Exportar CSV</span>
                    </button>
                  </div>
                </div>

                {/* Metrics and Chart Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 relative z-10">
                  
                  {/* Left Column: Core KPIs */}
                  <div className="lg:col-span-4 flex flex-col justify-between gap-3 font-sans">
                    <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl flex items-center justify-between shadow-xs">
                      <div>
                        <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider font-mono">Taxa de Sucesso Comercial</span>
                        <h4 className="text-xl md:text-2xl font-black text-slate-100">{
                          regionalPerformance.reduce((acc, p) => acc + (p.plannedStopsCount || 0), 0) > 0
                            ? Math.round((regionalPerformance.reduce((acc, p) => acc + (p.completedStopsCount || 0), 0) / regionalPerformance.reduce((acc, p) => acc + (p.plannedStopsCount || 0), 0)) * 100)
                            : 100
                        }%</h4>
                        <p className="text-[9px] text-slate-450 mt-0.5 leading-tight">Entregas concluídas vs. agendadas.</p>
                      </div>
                      <div className="p-2 py-1.5 bg-slate-850 border border-slate-800 rounded-lg text-emerald-400 font-bold text-xs uppercase font-mono shadow-inner">
                        {regionalPerformance.reduce((acc, p) => acc + (p.completedStopsCount || 0), 0)} paradas
                      </div>
                    </div>

                    <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl flex items-center justify-between shadow-xs">
                      <div>
                        <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider font-mono">Eficiência Média da Frota</span>
                        <h4 className="text-xl md:text-2xl font-black text-slate-100">{
                          regionalPerformance.length > 0 
                            ? Math.round(regionalPerformance.reduce((acc, p) => acc + Math.min(100, Math.round(((p.plannedDistanceKm || 50) / Math.max(1, p.actualDistanceKm || 50)) * 100)), 0) / regionalPerformance.length)
                            : 88
                        }%</h4>
                        <p className="text-[9px] text-slate-450 mt-0.5 leading-tight">Kms planejados vs. desvios percorridos.</p>
                      </div>
                      <div className="p-2 py-1.5 bg-slate-850 border border-slate-800 rounded-lg text-blue-400 font-bold text-xs uppercase font-mono shadow-inner">
                        {statsSummary.totalKm} kms
                      </div>
                    </div>

                    <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl flex items-center justify-between shadow-xs">
                      <div>
                        <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider font-mono">Alertas e Desvios de Rota</span>
                        <h4 className="text-xl md:text-2xl font-black text-amber-500">{statsSummary.totalDeviations} <span className="text-xs text-slate-450 font-normal">ocorrências</span></h4>
                        <p className="text-[9px] text-slate-450 mt-0.5 leading-tight">Telemetria detectou desvios em tempo real.</p>
                      </div>
                      <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-lg">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  {/* Right Column: High Fidelity Recharts Chart */}
                  <div className="lg:col-span-8 bg-slate-900/40 border border-slate-800 p-3 rounded-xl min-h-[160px] flex flex-col justify-between">
                    <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider block font-mono border-b border-slate-800 pb-1.5 mb-1.5">Eficiência por Rota Ativa/Finalizada (%)</span>
                    
                    <div className="w-full h-[120px] text-xs font-mono">
                      {regionalPerformance.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-slate-500 text-xs italic">
                          Nenhum dado de frete na região para preencher o gráfico.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={regionalPerformance.map(p => {
                              const planned = p.plannedDistanceKm || 50;
                              const actual = p.actualDistanceKm || 50;
                              const efficiency = Math.min(100, Math.round((planned / Math.max(1, actual)) * 100));
                              const stopsRatio = p.plannedStopsCount > 0 
                                ? Math.round((p.completedStopsCount / p.plannedStopsCount) * 100) 
                                : 100;
                              return {
                                name: p.routeName.replace('Rota ', 'R-'),
                                'Eficiência %': efficiency,
                                'Sucesso %': stopsRatio,
                              };
                            })}
                            margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
                          >
                            <defs>
                              <linearGradient id="colorEff" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                              </linearGradient>
                              <linearGradient id="colorSuc" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <XAxis dataKey="name" stroke="#64748b" fontSize={9} tickLine={false} />
                            <YAxis stroke="#64748b" fontSize={9} tickLine={false} domain={[0, 100]} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#f8fafc', fontSize: '10.5px' }}
                              labelStyle={{ fontWeight: 'bold', color: '#94a3b8' }}
                            />
                            <Area type="monotone" dataKey="Eficiência %" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorEff)" />
                            <Area type="monotone" dataKey="Sucesso %" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorSuc)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mb-3 select-none">
                <span className="text-[11px] font-bold text-slate-500 uppercase font-mono">Modo de Exibição do Monitor:</span>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    onClick={() => setMapMode('vector')}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                      mapMode === 'vector' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Mapa Vetorial
                  </button>
                  <button
                    onClick={() => setMapMode('google')}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                      mapMode === 'google' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Google Maps Platform
                  </button>
                </div>
              </div>

              <div className="flex-1">
                {mapMode === 'vector' ? (
                  <RegionalMap 
                    rotas={rotas}
                    locations={locations}
                    region={region}
                    breadcrumbs={breadcrumbs}
                  />
                ) : (
                  <RouteMap 
                    rotas={rotas}
                    locations={locations}
                    currentUserRegion={region}
                    currentUserRole={user.role}
                    breadcrumbs={breadcrumbs}
                    regions={regions}
                  />
                )}
              </div>
            </div>
          ) : activeTab === 'push_config' ? (
            // Tab 4: FCM Segmented Push Manager panel
            <div className="bg-white border border-slate-205 rounded-2xl p-6 shadow-md flex flex-col flex-grow">
              
              <div className="mb-4 pb-3 border-b border-slate-150">
                <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                  <Bell className="w-4.5 h-4.5 text-rose-500 shrink-0" />
                  Painel de Segmentação de Notificações Push
                </h3>
                <p className="text-xs text-slate-400 mt-1 font-sans">Conecte-se aos SDKs do Firebase ou envie mensagens segmentadas por perfil corporativo e delimitadores geográficos.</p>
              </div>

              {/* Form parameters */}
              <form onSubmit={handleDispatchPush} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Template de Evento:</label>
                  <select 
                    value={pushTemplate}
                    onChange={e => handleTemplateChange(e.target.value as any)}
                    className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50 text-[11px] font-medium"
                  >
                    <option value="nova_rota">Nova Rota Atribuída 📦</option>
                    <option value="rota_iniciada">Rota Iniciada 🚚</option>
                    <option value="status_parada">Atualização de Parada ✅</option>
                    <option value="urgente_chat">Mensagem Urgente Chat ⚠️</option>
                    <option value="custom">Outros / Customizado 📢</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Segmentação por Perfil de Usuário:</label>
                  <select 
                    value={pushRole}
                    onChange={e => setPushRole(e.target.value as any)}
                    className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50 text-[11px] font-medium"
                  >
                    <option value="all">TODOS OS PERFIS</option>
                    <option value={UserRole.MOTORISTA}>Somente Motoristas (Drivers)</option>
                    <option value={UserRole.VENDEDOR}>Somente Vendedores (Vendors)</option>
                    <option value={UserRole.GERENTE}>Somente Gerentes Regionais (Managers)</option>
                    <option value={UserRole.ADMIN}>Somente Administradores</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Delimitação de Área:</label>
                  <select 
                    value={pushRegion}
                    onChange={e => setPushRegion(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50 text-[11px] font-medium"
                  >
                    <option value={region}>Somente minha região ({region})</option>
                    <option value="all">Sincronização global / Broadcast Geral</option>
                  </select>
                </div>

                <div className="md:col-span-2 flex flex-col">
                  <label className="block font-bold text-slate-700 mb-1">Título da Mensagem:</label>
                  <input 
                    type="text" 
                    value={pushTitle} 
                    onChange={e => setPushTitle(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50 font-medium text-[11px]"
                    placeholder="Ex: Alerta de trânsito..."
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Conteúdo do Push (Body):</label>
                  <textarea 
                    value={pushBody} 
                    onChange={e => setPushBody(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50 h-20 text-[11px]"
                    placeholder="Conteúdo descritivo que será exibido no popover do celular..."
                  />
                </div>

                <div className="md:col-span-2">
                  <button 
                    type="submit"
                    className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 px-4 rounded-xl transition-all shadow-md shadow-rose-100 flex items-center justify-center gap-1.5 cursor-pointer text-xs"
                  >
                    <Bell className="w-4 h-4 animate-bounce shrink-0" />
                    Enviar Notificação de Canal Segmentado (Firebase Mock)
                  </button>
                </div>
              </form>

              {/* History push log container in this manager's scope */}
              <div className="mt-5 border-t border-slate-150 pt-4 flex-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2 font-mono">Logs de Envio de Push (Auditados)</span>
                
                <div className="space-y-2 max-h-[140px] overflow-y-auto text-[11px] font-mono leading-relaxed">
                  {regionalPushLogs.map(log => {
                    const parsedTime = new Date(log.timestamp).toLocaleTimeString('pt-BR');
                    return (
                      <div key={log.id} className="p-2 border border-slate-200 rounded-lg bg-slate-50 flex items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-1 font-sans">
                            <span className="font-bold text-slate-800">{log.title}</span>
                            <span className="font-mono text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded font-bold border border-indigo-100">
                              {log.type.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-slate-500 mt-0.5 text-[10px] truncate max-w-[280px] font-sans leading-relaxed">{log.body}</p>
                        </div>

                        <div className="text-right font-mono text-[9px] text-slate-400 shrink-0 uppercase">
                          <span className="text-indigo-600 font-bold block">{log.sentCount} disparos</span>
                          <span>às {parsedTime}</span>
                        </div>
                      </div>
                    );
                  })}
                  {regionalPushLogs.length === 0 && (
                    <p className="text-center py-6 text-slate-400 text-xs font-sans">Nenhum histórico de push registrado nesta sessão.</p>
                  )}
                </div>
              </div>

            </div>
          ) : activeTab === 'analytics' ? (
            // Tab 5: Desempenho e BI dashboards with Recharts
            <div className="bg-white border border-slate-205 rounded-2xl p-6 shadow-md flex flex-col flex-grow space-y-5 font-sans">
              
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2 font-sans">
                    <BarChart3 className="w-4.5 h-4.5 text-indigo-700 shrink-0" />
                    Módulo de Análise e Auditoria de Logística (BI)
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Visão analítica regional de tempos por parada, distâncias percorridas e desvios de rota planejados.</p>
                </div>
                
                <div className="text-right hidden sm:block">
                  <span className="text-[9px] font-mono text-slate-400 block uppercase">FROTA COLETADA</span>
                  <span className="text-xs font-bold text-slate-700">{regionalPerformance.length} rotas mapeadas</span>
                </div>
              </div>

              {/* High-fidelity Recharts visual boards */}
              {regionalPerformance.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Graph A: planned vs actual distance comparison */}
                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                      <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider mb-2 font-mono">
                        CONFRONTAÇÃO QUILOMÉTRICA (Previsto vs Realizado)
                      </span>
                      <div className="h-44 text-[10px] font-mono">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={distanceChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="name" stroke="#64748b" />
                            <YAxis stroke="#64748b" unit="km" />
                            <Tooltip />
                            <Legend wrapperStyle={{ fontSize: 9 }} />
                            <Bar dataKey="Distância Prevista (km)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Distância Realizada (km)" fill="#10b981" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Graph B: times per stop & desvios bar chart */}
                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                      <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider mb-2 font-mono">
                        DESVIOS DETECTADOS & TEMPO MÉDIO DE PARADA
                      </span>
                      <div className="h-44 text-[10px] font-mono">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={deviationChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="name" stroke="#64748b" />
                            <YAxis stroke="#64748b" />
                            <Tooltip />
                            <Legend wrapperStyle={{ fontSize: 9 }} />
                            <Area type="monotone" dataKey="Média Minutos/Parada" stroke="#a855f7" fill="#f3e8ff" />
                            <Area type="monotone" dataKey="Desvios Detectados" stroke="#ef4444" fill="#fee2e2" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Operational Telemetry Tables displaying departure/arrival timestamps */}
                  <div className="border border-slate-200/85 rounded-xl overflow-hidden text-xs font-sans">
                    <div className="bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2.5 border-b border-slate-200 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-700">Registros de Tempo Reais (Telemetry)</span>
                        <span className="font-mono text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-tight">TIMESTAMPS AUDITED</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => exportToCSV(regionalPerformance, `desempenho_rotas_gerente_${region}.csv`)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[10px] font-bold rounded-lg transition-all shadow-sm cursor-pointer"
                        >
                          <Download className="w-3 h-3 text-slate-500" />
                          Exportar CSV
                        </button>
                        <button
                          type="button"
                          onClick={() => exportToPDF(regionalPerformance, `Relatório de Auditoria Logística - Região: ${region}`)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[10px] font-bold rounded-lg transition-all shadow-sm cursor-pointer"
                        >
                          <Printer className="w-3 h-3 text-slate-500" />
                          Relatório PDF
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto max-h-[160px] overflow-y-auto">
                      <table className="w-full text-left font-sans text-[11px] text-slate-605">
                        <thead className="bg-slate-100 text-slate-600 font-semibold sticky top-0 uppercase text-[9px] tracking-wider border-b border-slate-200 font-mono">
                          <tr>
                            <th className="p-2">Início da Viagem</th>
                            <th className="p-2">Motorista / Placa</th>
                            <th className="p-2 text-center">Fim / Conclusão</th>
                            <th className="p-2 text-right font-mono">Paradas</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150">
                          {regionalPerformance.map(log => {
                            const startTime = new Date(log.startTimestamp).toLocaleTimeString('pt-BR');
                            const endTime = log.endTimestamp ? new Date(log.endTimestamp).toLocaleTimeString('pt-BR') : 'Em Trânsito 🚚';
                            return (
                              <React.Fragment key={log.id}>
                                <tr className="hover:bg-slate-50 transition-colors font-medium">
                                  <td className="p-2 font-mono text-indigo-600 font-bold">{startTime} ({log.region})</td>
                                  <td className="p-2 text-slate-800">{log.driverName} <span className="font-mono text-[10px] text-slate-400">[{log.driverPlate}]</span></td>
                                  <td className="p-2 text-center text-slate-500 font-mono">{endTime}</td>
                                  <td className="p-2 text-right font-bold font-mono text-emerald-600">{log.completedStopsCount} / {log.plannedStopsCount}</td>
                                </tr>
                                {log.stopTelemetry && log.stopTelemetry.length > 0 && (
                                  <tr>
                                    <td colSpan={4} className="bg-slate-50 p-2.5 border-b border-slate-200/50">
                                      <div className="text-[10px] text-slate-500 space-y-1">
                                        <p className="font-bold text-slate-600 uppercase tracking-wide">Linha de Tempo das Paradas:</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                          {log.stopTelemetry.map((t, idx) => (
                                            <div key={t.stopId} className="bg-white rounded p-1.5 border border-slate-200 leading-normal font-mono text-[9px] shadow-sm">
                                              <span className="text-indigo-600 font-bold">#{idx + 1} {t.clientName}</span>: Chegou: <span className="text-slate-800 font-bold">{new Date(t.arrivalTimestamp).toLocaleTimeString()}</span> | Partiu: <span className="text-slate-800 font-bold">{new Date(t.departureTimestamp).toLocaleTimeString()}</span> | Permanência: <strong className="text-emerald-600">{t.timeSpentMinutes} min</strong>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-20 border border-dashed border-slate-150 rounded-2xl select-none">
                  <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2 animate-bounce" />
                  <strong className="text-xs text-slate-605 block font-bold">Nenhum Dado Mapeado por Satélite</strong>
                  <p className="text-[11px] text-slate-400 max-w-sm mt-1 mx-auto leading-relaxed font-sans text-slate-450">
                    Ainda não há medições operacionais de viagens ativas iniciadas na região de <strong className="text-slate-500 font-medium">{region}</strong> nesta sessão para gerar relatórios de desempenho.
                  </p>
                </div>
              )}

            </div>
          ) : activeTab === 'clientes' ? (
            // Tab 6: Clientes route planner design
            <div className="bg-white border border-slate-205 rounded-2xl p-6 shadow-md flex flex-col flex-grow space-y-6 font-sans">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3.5">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-805 flex items-center gap-2 font-sans">
                    <Users className="w-4.5 h-4.5 text-indigo-700 shrink-0" />
                    Central Operacional de Clientes & Logística Reversa
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 font-sans">Cadastre clientes recorrentes, carregue planilhas regionalizadas, gerencie coordenadas e despache itinerários otimizados de transporte.</p>
                </div>
                
                <span className="text-[9px] font-mono text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100 font-bold uppercase shrink-0">
                  {region}-CLIENT-MANAGER
                </span>
              </div>

              {/* Horizontal Subtabs Switcher */}
              <div className="flex gap-4 border-b border-slate-150 pb-px select-none">
                <button
                  type="button"
                  onClick={() => setClientSubTab('database')}
                  className={`pb-2.5 font-extrabold text-xs uppercase tracking-wider transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                    clientSubTab === 'database'
                      ? 'border-indigo-600 text-indigo-700 font-black'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  📂 Banco de Dados de Clientes ({clients.filter(c => c.region === region).length})
                </button>
                <button
                  type="button"
                  onClick={() => setClientSubTab('planner')}
                  className={`pb-2.5 font-extrabold text-xs uppercase tracking-wider transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                    clientSubTab === 'planner'
                      ? 'border-indigo-600 text-indigo-700 font-black'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  🚚 Criar e Despachar Rota
                  {gStops.length > 0 && (
                    <span className="bg-indigo-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">
                      {gStops.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setClientSubTab('map_clientes')}
                  className={`pb-2.5 font-extrabold text-xs uppercase tracking-wider transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                    clientSubTab === 'map_clientes'
                      ? 'border-indigo-600 text-indigo-700 font-black'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  🗺️ Map Clientes
                </button>
              </div>

              {clientSubTab === 'database' ? (
                <ClienteManager
                  region={region}
                  clients={clients}
                  onSaveClient={onSaveClient}
                  onDeleteClient={onDeleteClient}
                  onAddSelectedToRoute={(selectedClients) => {
                    const newStops: Parada[] = selectedClients.map((c, index) => ({
                      id: `p_stop_db_${Date.now()}_${index}`,
                      clientName: c.name,
                      clientWhatsApp: c.whatsApp,
                      address: c.address,
                      lat: c.lat,
                      lng: c.lng,
                      status: 'pending',
                      region: c.region
                    }));
                    setGStops(newStops);
                    setClientSubTab('planner');
                  }}
                  setIsImporterOpen={setIsImporterOpen}
                  gOriginLat={gOriginLat}
                  gOriginLng={gOriginLng}
                />
              ) : clientSubTab === 'planner' ? (
                /* ==============================================================
                   SUBTAB 2: ORIGINAL PLANNER CONTAINER WITH SECTIONS A + B
                   ============================================================== */
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start font-sans">
                {/* Section A: Creator/Editor card form (xl:col-span-5) */}
                <div className="xl:col-span-5 space-y-5">
                  
                  {/* Card A1: Basic Route Settings */}
                  <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-205 pb-2">
                      <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5 font-mono">
                        <span className="w-4.5 h-4.5 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-black">1</span>
                        {gEditingRouteId ? '📝 Editar Cabeçalho' : '📦 Informações da Rota'}
                      </span>
                      {gEditingRouteId && (
                        <button 
                          onClick={() => {
                            setGEditingRouteId(null);
                            setGRouteName('Rota Corporativa ' + new Date().toLocaleDateString('pt-BR'));
                            setGOrigin('CD Central ' + region + ' - BR-116, Km 410');
                            setGSelectedDriverId('');
                            setGStops([]);
                          }}
                          className="text-rose-600 hover:text-rose-800 hover:underline font-bold text-[10px] transition-colors"
                        >
                          Cancelar Edição
                        </button>
                      )}
                    </div>

                    <div className="space-y-3 px-0.5">
                      <div>
                        <label className="block text-slate-450 font-semibold mb-1 uppercase text-[8px] tracking-wider">Identificação da Rota</label>
                        <input 
                          type="text" 
                          value={gRouteName}
                          onChange={e => setGRouteName(e.target.value)}
                          placeholder="EX: Rota Expressa Centro"
                          className="w-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-xl p-2.5 bg-white text-slate-805 text-xs font-medium shadow-sm transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-450 font-semibold mb-1 uppercase text-[8px] tracking-wider">Origem / Centro de Distribuição</label>
                        <input 
                          type="text" 
                          value={gOrigin}
                          onChange={e => {
                            setGOrigin(e.target.value);
                            gGeocodeAddress(e.target.value, true);
                          }}
                          onBlur={e => gGeocodeAddress(e.target.value, true)}
                          className="w-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-xl p-2.5 bg-white text-slate-805 text-xs font-medium shadow-sm transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-450 font-semibold mb-1 uppercase text-[8px] tracking-wider font-sans">Condutor Regional Designado</label>
                        <select
                          value={gSelectedDriverId}
                          onChange={e => setGSelectedDriverId(e.target.value)}
                          className="w-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-xl p-2.5 bg-white text-slate-805 text-xs font-semibold shadow-sm cursor-pointer transition-all"
                        >
                          <option value="">Selecione um motorista escalado...</option>
                          {regionalDrivers.map(drv => (
                            <option key={drv.id} value={drv.id}>
                              👤 {drv.name} ({(drv as any).plate || 'Sem Placa'})
                            </option>
                          ))}
                        </select>
                        {regionalDrivers.length === 0 && (
                          <span className="text-[10px] text-amber-600 block mt-1 font-bold bg-amber-50 p-2.5 border border-amber-200 rounded-lg animate-pulse">
                            ⚠️ Nenhum motorista disponível na região {region}.
                          </span>
                        )}
                      </div>

                      {/* Truck size and weight constraints for GIS Route Validation */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <label className="block text-slate-450 font-semibold mb-1 uppercase text-[8px] tracking-wider">Altura Max (m)</label>
                          <input 
                            type="number" 
                            step="0.1" 
                            min="1.0"
                            max="6.0"
                            value={gVehicleHeight}
                            onChange={e => setGVehicleHeight(e.target.value)}
                            className="w-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-xl p-2.5 bg-white text-slate-805 text-xs font-bold shadow-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-450 font-semibold mb-1 uppercase text-[8px] tracking-wider">Peso Max (toneladas)</label>
                          <input 
                            type="number" 
                            step="0.5" 
                            min="1.0"
                            max="50.0"
                            value={gVehicleWeight}
                            onChange={e => setGVehicleWeight(e.target.value)}
                            className="w-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-xl p-2.5 bg-white text-slate-805 text-xs font-bold shadow-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card A2: Stops Builder & List */}
                  <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
                    <div className="flex items-center gap-1.5 border-b border-slate-205 pb-2">
                      <span className="w-4.5 h-4.5 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-black">2</span>
                      <span className="font-extrabold text-slate-805 text-xs uppercase tracking-wider font-mono">
                        Clientes & Itinerário
                      </span>
                    </div>

                    {/* Presets load helper */}
                    <div className="space-y-1.5 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                      <span className="text-[9px] text-indigo-800 font-bold block uppercase tracking-wider">📦 Endereços de Clientes Recorrentes:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {GUARIBA_LOCATIONS.map((loc, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => gAddPresetStop(idx)}
                            className="bg-white hover:bg-indigo-650 hover:text-white text-indigo-700 font-bold text-[10px] px-2.5 py-1 rounded-lg border border-indigo-200/50 shadow-sm transition-all cursor-pointer flex items-center gap-1"
                          >
                            <span>📍</span> {loc.name.split(' ')[0]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-slate-455 font-bold uppercase text-[8px] tracking-wider mb-1">Dados Complementares do Cliente</label>
                        <div className="grid grid-cols-2 gap-2">
                          <input 
                            type="text" 
                            placeholder="Nome do Cliente"
                            value={gClientName}
                            onChange={e => setGClientName(e.target.value)}
                            className="border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-550 focus:outline-none bg-white text-slate-850"
                          />
                          <input 
                            type="tel" 
                            placeholder="WhatsApp (ex: 55319...)"
                            value={gClientWhatsApp}
                            onChange={e => setGClientWhatsApp(e.target.value)}
                            className="border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-550 focus:outline-none bg-white text-slate-850"
                          />
                        </div>
                      </div>

                      <div className="relative font-sans">
                        <label className="block text-slate-455 font-bold uppercase text-[8px] tracking-wider mb-1">Endereço de Entrega</label>
                        <input 
                          type="text" 
                          placeholder="Digite o endereço completo do cliente"
                          value={gClientAddress}
                          onChange={e => {
                            setGClientAddress(e.target.value);
                            setGIsValidated(false);
                            gFetchAddressPredictions(e.target.value);
                          }}
                          className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-medium focus:ring-2 focus:ring-indigo-550 focus:outline-none bg-white text-slate-850"
                        />
                        {gAddressPredictions.length > 0 && (
                          <div className="absolute z-10 w-full bg-white border border-slate-200 rounded-xl shadow-xl mt-1 max-h-36 overflow-y-auto leading-tight font-sans">
                            {gAddressPredictions.map((pred, pIdx) => (
                              <button
                                key={pIdx}
                                type="button"
                                onClick={() => gHandleSelectPrediction(pred.description, pred.placeId)}
                                className="w-full text-left p-2.5 hover:bg-slate-50 border-b border-slate-100 text-[11px] font-sans truncate font-medium text-slate-705"
                              >
                                🗺️ {pred.description}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={gHandleAddStop}
                        className="w-full py-2 bg-white hover:bg-slate-200 border border-slate-300 text-slate-700 font-extrabold rounded-xl text-center cursor-pointer transition-all active:scale-[0.98] text-[11px] shadow-sm flex items-center justify-center gap-1"
                      >
                        ➕ Incluir Cliente na Rota
                      </button>
                    </div>

                    {/* Stops List Planned styled as a logistics vertical sequence */}
                    <div className="space-y-2 pt-2 border-t border-slate-200/80">
                      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Sequência Planilhada de Paradas ({gStops.length})</span>
                      
                      <div className="space-y-2 bg-white p-3 rounded-xl border border-slate-200 max-h-[220px] overflow-y-auto">
                        {gStops.length > 0 && (
                          <div className="relative pl-4 space-y-3.5">
                            {/* Vertical dashed line */}
                            <div className="absolute left-[7px] top-[14px] bottom-[14px] w-0.5 bg-dashed border-l border-indigo-200"></div>

                            {gStops.map((st, idx) => (
                              <div key={st.id} className="relative flex items-start justify-between gap-2.5 text-[11.5px]">
                                {/* Timeline badge */}
                                <div className="absolute left-[-17px] top-0.5 w-3.5 h-3.5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[8px] font-bold z-10 border border-indigo-200 animate-[pulse_2s_infinite]">
                                  {idx + 1}
                                </div>

                                <div className="min-w-0 pr-1 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <strong className="text-slate-850 font-bold truncate block text-xs">{st.clientName}</strong>
                                    {st.phone && (
                                      <span className="text-[9px] font-mono text-indigo-705 bg-indigo-50 border border-indigo-100/50 px-1 rounded font-bold uppercase scale-90">
                                        WhatsApp
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-450 truncate font-mono mt-0.5">{st.address}</p>
                                  {st.justificativa && (
                                    <div className="mt-1 text-[8.5px] text-amber-800 font-medium italic flex items-center gap-1 bg-amber-50/50 border border-amber-150 px-1.5 py-0.5 rounded">
                                      <Sparkles className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                                      <span className="whitespace-normal leading-normal">{st.justificativa}</span>
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => moveStopUp(idx)}
                                    disabled={idx === 0}
                                    title="Subir Parada"
                                    className="text-slate-400 hover:text-indigo-600 disabled:opacity-30 p-1 rounded transition-all cursor-pointer active:scale-90 font-mono text-[10px]"
                                  >
                                    ▲
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moveStopDown(idx)}
                                    disabled={idx === gStops.length - 1}
                                    title="Descer Parada"
                                    className="text-slate-400 hover:text-indigo-600 disabled:opacity-30 p-1 rounded transition-all cursor-pointer active:scale-90 font-mono text-[10px]"
                                  >
                                    ▼
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setGStops(prev => prev.filter(item => item.id !== st.id))}
                                    title="Remover ponto de carga"
                                    className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-all cursor-pointer shrink-0 active:scale-90 font-sans"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {gStops.length === 0 && (
                          <div className="text-center py-6 text-slate-400 font-medium">
                            <p className="text-[11px]">Nenhum ponto planilhado para esta viagem.</p>
                            <p className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wide">Selecione presets acima para carregamento imediato</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card A3: Painel de Roteirização Inteligente & GIS de Alta Precisão */}
                    {gStops.length > 0 && (
                      <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-4.5 rounded-2xl border border-indigo-900 shadow-lg space-y-3.5">
                        <div className="flex items-center justify-between border-b border-white/10 pb-2">
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded bg-indigo-500 text-white flex items-center justify-center text-[10px] font-black">GIS</span>
                            <span className="font-extrabold text-[11px] uppercase tracking-wider font-mono text-indigo-200">
                              Roteirização Inteligente & Trajetória
                            </span>
                          </div>
                          {isGisCalculating ? (
                            <span className="text-[9px] font-mono text-indigo-400 animate-pulse font-bold uppercase">Calculando...</span>
                          ) : (
                            <span className="text-[9px] font-mono text-emerald-400 font-bold uppercase">✓ Ativo</span>
                          )}
                        </div>

                        {gisDirections ? (
                          <div className="space-y-3 font-sans text-xs">
                            {/* Summary row */}
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div className="bg-white/5 border border-white/10 p-2 rounded-xl">
                                <span className="block text-[8px] text-slate-400 uppercase font-mono">Distância Real</span>
                                <strong className="text-xs font-black text-indigo-200">{gisDirections.distanceKm} km</strong>
                              </div>
                              <div className="bg-white/5 border border-white/10 p-2 rounded-xl">
                                <span className="block text-[8px] text-slate-400 uppercase font-mono">Tempo c/ Trânsito</span>
                                <strong className="text-xs font-black text-indigo-200">{gisDirections.durationMinutes} min</strong>
                              </div>
                              <div className="bg-white/5 border border-white/10 p-2 rounded-xl">
                                <span className="block text-[8px] text-slate-400 uppercase font-mono">Pedágios (Tolls)</span>
                                <strong className="text-xs font-black text-indigo-200">R$ {gisDirections.tollsTotalBrl.toFixed(2)}</strong>
                              </div>
                            </div>

                            {/* Traffic and Road state */}
                            <div className="bg-indigo-900/40 p-2 rounded-xl border border-indigo-800/30 flex items-center justify-between text-[10px]">
                              <span className="text-slate-350">Fator Tráfego (Live):</span>
                              <span className="font-bold font-mono text-indigo-300">{gisDirections.trafficState}</span>
                            </div>

                            {/* Warnings list */}
                            {gisDirections.warnings && gisDirections.warnings.length > 0 && (
                              <div className="bg-rose-950/50 border border-rose-800/60 p-3 rounded-xl space-y-1">
                                <span className="block text-[8px] text-rose-300 font-black uppercase tracking-wider font-mono">⚠️ RESTRIÇÕES E ALERTAS DE VIAS</span>
                                <ul className="space-y-1 text-[9.5px] text-rose-100 font-medium">
                                  {gisDirections.warnings.map((warn: string, wIdx: number) => (
                                    <li key={wIdx} className="flex items-start gap-1">
                                      <span className="text-rose-400 shrink-0">•</span>
                                      <span>{warn}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Steplist preview */}
                            <div className="space-y-1">
                              <span className="block text-[8px] text-indigo-350 font-black uppercase tracking-wider font-mono">PASSOS DA JORNADA LOGÍSTICA</span>
                              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                                {gisDirections.steps.map((step: any, sIdx: number) => (
                                  <div key={sIdx} className="bg-white/5 border border-white/5 p-2 rounded-xl flex items-start gap-2">
                                    <span className="text-[9px] font-bold font-mono bg-indigo-900 text-indigo-200 px-1.5 py-0.5 rounded shrink-0">
                                      {step.index}
                                    </span>
                                    <div className="min-w-0 flex-1 leading-tight">
                                      <div className="flex justify-between items-center flex-wrap gap-1">
                                        <strong className="text-slate-200 truncate block text-[10px]">{step.targetName}</strong>
                                        <span className="text-[9px] font-mono text-slate-450">{step.distanceKm} km</span>
                                      </div>
                                      <p className="text-[9px] text-slate-400 italic mt-1">{step.instructions}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-4 text-slate-400 text-xs">Aguardando dados de paradas...</div>
                        )}
                      </div>
                    )}

                    {/* Compile & Despatch Route Buttons */}
                    <div className="flex gap-2 pt-2 border-t border-slate-200/60">
                      <button
                        type="button"
                        onClick={() => {
                          if (gStops.length === 0) {
                            alert('Adicione pelo menos 1 parada.');
                            return;
                          }
                          if (!gSelectedDriverId) {
                            alert('Selecione um motorista escalado para receber a rota.');
                            return;
                          }

                          const driverObj = regionalDrivers.find(d => d.id === gSelectedDriverId);
                          if (!driverObj) return;

                          if (gEditingRouteId) {
                            // Update existing route
                            onUpdateRoute(gEditingRouteId, {
                              name: gRouteName,
                              origin: gOrigin,
                              stops: gStops,
                              driverId: driverObj.id,
                              driverName: driverObj.name,
                              driverPlate: (driverObj as any).plate || 'RTL-1234'
                            });
                            setGEditingRouteId(null);
                            alert('Alterações no itinerário gravadas e sincronizadas!');
                          } else {
                            // Create new route
                            onCreateRoute({
                              name: gRouteName,
                              origin: gOrigin,
                              originLat: gOriginLat,
                              originLng: gOriginLng,
                              stops: gStops,
                              driverId: driverObj.id,
                              driverName: driverObj.name,
                              driverPlate: (driverObj as any).plate || 'RTL-1234',
                              region: region,
                              optimized: true,
                              sentByGerente: false
                            });

                            // Send push alerts to driver automatically
                            onSendPush(
                              'nova_rota', 
                              UserRole.MOTORISTA, 
                              region, 
                              'Nova Rota Atribuída 📦', 
                              `Olá ${driverObj.name}: O gestor operacional inseriu a rota "${gRouteName}" com ${gStops.length} paradas na sua aba Minhas Rotas.`
                            );
                            alert(`Sucesso! Rota despachada e notificação enviada no celular de ${driverObj.name}!`);
                          }

                          // Reset Creator
                          setGRouteName('Rota Corporativa ' + new Date().toLocaleDateString('pt-BR'));
                          setGOrigin('CD Central ' + region + ' - Av. dos Camaras,513, Santo Antonio, cariacica-ES');
                          setGSelectedDriverId('');
                          setGStops([]);
                        }}
                        className="flex-1 py-3 bg-gradient-to-r from-[#10b981] to-[#047857] hover:from-emerald-600 hover:to-emerald-805 text-white rounded-xl font-bold transition-all shadow-md cursor-pointer text-xs uppercase"
                      >
                        {gEditingRouteId ? 'Salvar Edição 📝' : 'Despachar Rota 📦'}
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          if (gStops.length <= 1) {
                            alert('Por favor insira ao menos duas paradas para rodar o otimizador.');
                            return;
                          }
                          try {
                            const sortedStops = await onOptimize(gStops, gOriginLat, gOriginLng);
                            setGStops(sortedStops);
                            alert('Itinerário otimizado com sucesso via API do Google (optimizeWaypoints:true)!');
                          } catch (err: any) {
                            alert('Falha na otimização: ' + err.message);
                          }
                        }}
                        className="py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all text-xs cursor-pointer flex gap-1 items-center"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse fill-amber-300" />
                        Otimizar
                      </button>
                    </div>
                  </div>
                </div>

                {/* Section B: Regional Assigned Routes List (xl:col-span-7) */}
                <div className="xl:col-span-7 bg-slate-50 border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b pb-2.5">
                    <div>
                      <span className="font-extrabold text-slate-800 text-xs block uppercase tracking-wider font-mono">
                        Acompanhamento Regional de Cargas
                      </span>
                      <p className="text-[10px] text-slate-400 mt-0.5">Controlador de fluxo operacional regional para a região {region}</p>
                    </div>
                    <span className="bg-slate-200 text-slate-700 border border-slate-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full font-mono">
                      {filteredRegionalRoutes.length} Itinerários
                    </span>
                  </div>

                  {/* Inline quick filters inside Section B */}
                  <div className="grid grid-cols-3 gap-2 bg-white p-2 text-xs rounded-xl border border-slate-200 shadow-xs">
                    <div>
                      <select
                        value={filterRouteStatus}
                        onChange={(e) => setFilterRouteStatus(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-150 text-slate-705 text-[10px] p-1.5 rounded-lg outline-none font-bold"
                      >
                        <option value="all">Status: Todos</option>
                        <option value="draft">Draft</option>
                        <option value="active">Em Viagem</option>
                        <option value="completed">Concluída</option>
                      </select>
                    </div>
                    <div>
                      <select
                        value={filterRouteDriver}
                        onChange={(e) => setFilterRouteDriver(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-150 text-slate-705 text-[10px] p-1.5 rounded-lg outline-none font-bold truncate"
                      >
                        <option value="all">Condutor: Todos</option>
                        {regionalDrivers.map(drv => (
                          <option key={drv.id} value={drv.id}>{drv.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <select
                        value={filterRouteDate}
                        onChange={(e) => setFilterRouteDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-150 text-slate-705 text-[10px] p-1.5 rounded-lg outline-none font-bold"
                      >
                        <option value="all">Período: Todos</option>
                        <option value="today">Hoje</option>
                        <option value="week">Esta semana</option>
                        <option value="month">Este mês</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-4 max-h-[660px] overflow-y-auto pr-1">
                    {filteredRegionalRoutes.map(item => {
                      const completedStopsCount = item.stops.filter(s => s.status === 'completed').length;
                      const totalStopsCount = item.stops.length;
                      const percentCompleted = totalStopsCount > 0 ? Math.round((completedStopsCount / totalStopsCount) * 100) : 0;

                      return (
                        <div key={item.id} className="p-4 border border-slate-200/95 bg-white rounded-2xl shadow-sm space-y-4 select-text hover:border-slate-350 transition-all duration-300">
                          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2.5">
                            <div>
                              <strong className="text-slate-900 text-sm font-extrabold">{item.name}</strong>
                              <p className="text-[11px] text-slate-450 font-medium mt-0.5 flex items-center gap-1 flex-wrap">
                                <span>Condutor:</span>
                                <span className="text-indigo-650 font-extrabold">{item.driverName}</span> 
                                <span className="font-mono text-[9px] bg-indigo-50 border border-indigo-100 px-1.5 py-0.2 rounded font-bold">[{item.driverPlate}]</span>
                              </p>
                            </div>

                            <div className="flex flex-col text-right shrink-0">
                              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                item.status === 'active' ? 'bg-amber-100 text-amber-805 border border-amber-200' :
                                item.status === 'completed' ? 'bg-emerald-100 text-emerald-805 border border-emerald-250' : 'bg-slate-100 text-slate-500'
                              }`}>
                                {item.status === 'active' ? 'Em Viagem 🚚' : item.status === 'completed' ? 'Concluída ✅' : 'Rascunho'}
                              </span>
                              <span className="text-[8px] text-slate-400 font-mono mt-0.5">Criada às {new Date(item.createdAt).toLocaleTimeString('pt-BR')}</span>
                            </div>
                          </div>

                          {/* Efficiency progress bar */}
                          <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-150 shadow-inner">
                            <div className="flex justify-between items-center text-[9px] font-mono font-black text-slate-500">
                              <span>ENTREGAS CONCLUÍDAS</span>
                              <span className="text-indigo-600">{percentCompleted}% ({completedStopsCount}/{totalStopsCount})</span>
                            </div>
                            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden border border-slate-200/50">
                              <div 
                                className="bg-gradient-to-r from-indigo-550 to-emerald-500 h-full transition-all duration-500" 
                                style={{ width: `${percentCompleted}%` }}
                              ></div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 px-1 leading-snug font-sans">
                            <p className="truncate">📍 <strong className="text-slate-700 font-bold">Origem:</strong> {item.origin}</p>
                            <p>🎯 <strong className="text-slate-700 font-bold">Paradas:</strong> {item.stops.length} Clientes</p>
                          </div>

                          {/* Detailed stops layout with color coded checks */}
                          <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-200/50 leading-normal space-y-2">
                            <span className="text-[9px] font-mono text-slate-400 font-bold uppercase tracking-wider block">Manifesto Detalhado das Encomendas:</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-sans">
                              {item.stops.map((stop, sIdx) => {
                                const isDone = stop.status === 'completed';
                                return (
                                  <div key={stop.id} className={`p-2 bg-white border rounded-xl text-[10.5px] shadow-sm leading-tight flex justify-between gap-1 items-center hover:bg-slate-50 transition-colors ${isDone ? 'border-emerald-100 bg-emerald-50/10' : 'border-slate-200'}`}>
                                    <span className="truncate pr-1">
                                      <span className="font-mono text-[9px] text-slate-400 font-bold mr-1">#{sIdx + 1}</span>
                                      <strong className="text-slate-700 font-bold">{stop.clientName}</strong>
                                    </span>
                                    <span className={`text-[9px] uppercase font-bold shrink-0 px-1.5 py-0.5 rounded font-mono ${isDone ? 'text-emerald-700 bg-emerald-50 border border-emerald-100' : 'text-slate-500 bg-slate-100'}`}>
                                      {isDone ? 'Concluído' : 'Pendente'}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="flex gap-2 items-center pt-2.5 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => {
                                setGEditingRouteId(item.id);
                                setGRouteName(item.name);
                                setGOrigin(item.origin);
                                setGSelectedDriverId(item.driverId);
                                setGStops(item.stops);
                                // Auto scroll to editor top on mobile
                                document.getElementById('gerente-main-panel')?.scrollIntoView({ behavior: 'smooth' });
                              }}
                              className="flex-1 py-2 px-3 border border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white font-extrabold rounded-xl transition-all hover:border-transparent cursor-pointer text-[11px] text-center shadow-sm"
                            >
                              Editar Itinerário
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Confirmar exclusão permanente da rota "${item.name}"?`)) {
                                  onDeleteRoute(item.id);
                                }
                              }}
                              className="py-2 px-3 border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-250 rounded-xl bg-white hover:bg-rose-50 transition-all cursor-pointer active:scale-90 flex items-center justify-center shrink-0 shadow-sm"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {filteredRegionalRoutes.length === 0 && (
                      <div className="text-center py-16 border rounded-2xl border-dashed bg-slate-50/50">
                        <Truck className="w-9 h-9 text-slate-350 mx-auto mb-2 animate-bounce" />
                        <span className="text-xs font-bold text-slate-500 block">Nenhuma Rota Disponível com estes Filtros</span>
                        <p className="text-[11px] text-slate-400 mt-0.5">Nenhuma rota regional atendeu aos parâmetros aplicados nos filtros operacionais.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              ) : (
                <MapClientes region={region} />
              )}

              {/* FULL-SCREEN SECURE CLIENT IMPORTER MODAL */}
              {isImporterOpen && (
                <div id="client-importer-modal-v3" className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[99999] overflow-y-auto leading-normal">
                  <div className="bg-white rounded-3xl border border-slate-250 shadow-2xl w-full max-w-5xl overflow-hidden animate-in fade-in zoom-in duration-200">
                    {/* Modal Header */}
                    <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between select-none">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                        <div>
                          <h3 className="font-extrabold text-[12px] uppercase tracking-wider font-mono">
                            Importador e Validador de Endereços
                          </h3>
                          <p className="text-[10px] text-slate-400">Canal regional de carga: <span className="text-white font-bold uppercase">{region}</span></p>
                        </div>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => setIsImporterOpen(false)}
                        className="bg-slate-800 hover:bg-slate-705 p-2 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer active:scale-90"
                      >
                        <X className="w-4 h-4 text-slate-400 font-bold" />
                      </button>
                    </div>

                    <div className="p-2 text-slate-800 max-h-[85vh] overflow-y-auto">
                      <ClientImporter 
                        currentRegion={region}
                        onImportStops={(stops) => {
                          // Always save all imported clients to client registry (database) to guarantee backing
                          stops.forEach(st => {
                            if (onSaveClient) {
                              onSaveClient({
                                id: st.id || `cli_imp_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
                                name: st.clientName,
                                whatsApp: (st as any).clientWhatsApp || (st as any).phone || '5533991234567',
                                address: st.address,
                                lat: st.lat,
                                lng: st.lng,
                                region: region,
                                createdAt: new Date().toISOString()
                              });
                            }
                          });

                          // Determine if we should also load them into the current active planning queue (gStops)
                          const isPlanningPath = activeTab === 'routes' || (activeTab === 'clientes' && clientSubTab === 'planner');

                          if (isPlanningPath) {
                            setGStops(prev => {
                              const prevIds = new Set(prev.map(p => p.id));
                              const filteredNewStops = stops.filter(s => !prevIds.has(s.id));
                              return [...prev, ...filteredNewStops];
                            });

                            if (activeTab === 'routes') {
                              // Let them stay inside routes tab so they can finish planning! Keep track of progress.
                              alert(`Excelente! Planilha de faturamento processada. ${stops.length} clientes/paradas foram salvos no Banco de Dados e adicionados ao seu Quadro de Planejamento de Rotas atual!`);
                            } else {
                              alert(`Excelente! Planilha de faturamento processada. ${stops.length} clientes/paradas foram salvos no Banco de Dados e carregados no Planejador de Rotas!`);
                            }
                          } else {
                            // Only registering to clients list database
                            alert(`Excelente! Sincronização operacional realizada. ${stops.length} clientes foram importados e salvos em seu Banco de Dados!`);
                          }

                          setIsImporterOpen(false); // Cleanly dismiss
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

            </div>
          ) : (
            // Tabs 2 & 3: Standard active route lists or simple lists fallback
            <div className="flex flex-col h-full min-h-[420px] bg-white border border-slate-200 rounded-2xl p-4 shadow-md font-sans">
              <div className="flex-1 min-h-[355px]">
                <InteractiveMap 
                  rota={activeRoute} 
                  driverLocation={activeRoute ? locations[activeRoute.driverId] || null : null}
                  region={region}
                />
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}

