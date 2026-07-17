/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo } from 'react';
import { APIProvider, Map, AdvancedMarker, InfoWindow, Pin, useAdvancedMarkerRef, useMap } from '@vis.gl/react-google-maps';
import { db, subscribeToCollection } from '../services/firebase';
import { Cliente } from '../types';
import { Loader2, AlertCircle, MapPin, Phone, Compass, Info, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';

interface MapClientesProps {
  region: string;
  clients?: Cliente[];
}

// Function to safely extract coordinates from various GeoPoint formats or direct lat/lng fields
function getClientCoordinates(c: any): { lat: number; lng: number } | null {
  let lat = 0;
  let lng = 0;

  if (c.lat !== undefined && c.lat !== null) lat = Number(c.lat);
  else if (c.latitude !== undefined && c.latitude !== null) lat = Number(c.latitude);
  else if (c.location && typeof c.location.latitude === 'number') lat = c.location.latitude;
  else if (c.location && typeof c.location.lat === 'function') lat = c.location.lat();

  if (c.lng !== undefined && c.lng !== null) lng = Number(c.lng);
  else if (c.longitude !== undefined && c.longitude !== null) lng = Number(c.longitude);
  else if (c.location && typeof c.location.longitude === 'number') lng = c.location.longitude;
  else if (c.location && typeof c.location.lng === 'function') lng = c.location.lng();

  if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
    return null;
  }
  return { lat, lng };
}

// Helper Marker Component with custom state and InfoWindow
function ClienteMarker({ cliente }: { cliente: Cliente; key?: string }) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [isOpen, setIsOpen] = useState(false);

  const coords = useMemo(() => getClientCoordinates(cliente), [cliente]);
  if (!coords) return null;

  // Pin colors based on status
  // Ativo -> Green, Inativo -> Red, default/Aguardando Rota -> Indigo
  const pinBackground = cliente.status === 'inativo' ? '#EF4444' : (cliente.status === 'ativo' ? '#10B981' : '#6366F1');
  const pinGlyphColor = '#FFFFFF';

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={coords}
        onClick={() => setIsOpen(true)}
        title={cliente.name}
      >
        <Pin background={pinBackground} glyphColor={pinGlyphColor} borderColor="#ffffff" />
      </AdvancedMarker>

      {isOpen && (
        <InfoWindow anchor={marker} onCloseClick={() => setIsOpen(false)}>
          <div className="p-2 min-w-[220px] max-w-[280px] font-sans text-slate-800 leading-tight">
            <div className="flex items-center gap-1.5 border-b border-slate-100 pb-1.5 mb-2">
              <MapPin className="w-4 h-4 text-indigo-600 shrink-0" />
              <strong className="text-sm font-bold text-slate-900 truncate">{cliente.name}</strong>
            </div>

            <div className="space-y-1.5 text-xs">
              <p className="text-slate-500 font-medium leading-normal">
                <span className="font-bold text-slate-700">Endereço:</span> {cliente.address}
              </p>

              {cliente.whatsApp && (
                <p className="flex items-center gap-1 text-slate-600 font-mono text-[11px]">
                  <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  {cliente.whatsApp}
                </p>
              )}

              <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 mt-1">
                <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded uppercase">
                  Região: {cliente.region}
                </span>

                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono uppercase ${
                  cliente.status === 'inativo'
                    ? 'text-rose-700 bg-rose-50 border border-rose-100'
                    : (cliente.status === 'ativo'
                      ? 'text-emerald-700 bg-emerald-50 border border-emerald-100'
                      : 'text-indigo-700 bg-indigo-50 border border-indigo-100')
                }`}>
                  {cliente.status || 'Ativo'}
                </span>
              </div>
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

// Inner map component that listens to map load and fits bounds dynamically
function FitMapBounds({ clientsWithCoords }: { clientsWithCoords: Cliente[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || typeof google === 'undefined' || clientsWithCoords.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    let hasCoords = false;

    clientsWithCoords.forEach((c) => {
      const coords = getClientCoordinates(c);
      if (coords) {
        bounds.extend(coords);
        hasCoords = true;
      }
    });

    if (hasCoords) {
      // fitBounds with slight padding
      map.fitBounds(bounds, 80);
    }
  }, [map, clientsWithCoords]);

  return null;
}

export default function MapClientes({ region, clients: propClients }: MapClientesProps) {
  const [clients, setClients] = useState<Cliente[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterRegionOnly, setFilterRegionOnly] = useState(true);

  // Load API Key from environment variables safely
  const API_KEY =
    process.env.GOOGLE_MAPS_PLATFORM_KEY ||
    (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
    (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
    '';

  const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

  // 1. Sync state directly if clients are provided as props
  useEffect(() => {
    if (propClients !== undefined) {
      setClients(propClients);
      setIsLoading(false);
      setError(null);
    }
  }, [propClients]);

  // 2. Fetch Clients from Firestore with Real-Time subscription only if not provided by props
  useEffect(() => {
    if (propClients !== undefined) return;

    setIsLoading(true);
    setError(null);

    const unsubscribe = subscribeToCollection<Cliente>(
      'clients',
      (list) => {
        setClients(list);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error fetching clients in MapClientes:', err);
        
        // Attempt to load from localStorage cache first to prevent blocking red-screens
        try {
          const cached = localStorage.getItem('routelog_db_clients');
          if (cached) {
            console.log('[MapClientes Fallback] Successfully restored client coordinates from offline cache.');
            setClients(JSON.parse(cached));
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.warn('[MapClientes Cache Restore Failed]', e);
        }

        setError(err.message || 'Falha ao buscar os clientes do Firestore.');
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [propClients]);

  // 2. Filter clients based on UI options
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      if (filterRegionOnly && c.region !== region) return false;
      return true;
    });
  }, [clients, region, filterRegionOnly]);

  // Clients with valid geographic coordinates
  const clientsWithCoords = useMemo(() => {
    return filteredClients.filter((c) => getClientCoordinates(c) !== null);
  }, [filteredClients]);

  // Default coordinate if no markers are available (Belo Horizonte / Valadares center)
  const defaultCenter = useMemo(() => {
    if (region === 'ES/MG') return { lat: -20.309455, lng: -40.309505 };
    return { lat: -18.85, lng: -41.95 };
  }, [region]);

  if (!hasValidKey) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center max-w-xl mx-auto my-10 shadow-md">
        <Compass className="w-12 h-12 text-slate-400 mx-auto mb-3 animate-pulse" />
        <h2 className="text-base font-black text-slate-800 uppercase tracking-wider mb-2">Chave da API do Google Maps Requerida</h2>
        <p className="text-xs text-slate-500 mb-6 leading-relaxed">
          Para exibir o mapa de clientes em tempo real, configure sua chave do Google Maps Platform.
        </p>
        <div className="bg-white border border-slate-200 text-left rounded-xl p-4 text-xs space-y-2.5 shadow-inner">
          <p><strong>Passo 1:</strong> <a href="https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline font-bold">Obter uma chave de API</a></p>
          <p><strong>Passo 2:</strong> Adicione a chave como segredo no AI Studio:</p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600 font-medium">
            <li>Abra as <strong>Configurações</strong> (ícone de engrenagem ⚙️ no canto superior direito)</li>
            <li>Selecione <strong>Secrets</strong></li>
            <li>Crie o segredo com o nome <code>GOOGLE_MAPS_PLATFORM_KEY</code></li>
            <li>Cole sua chave como o valor e pressione <strong>Enter</strong></li>
          </ul>
        </div>
        <p className="text-[10px] text-slate-400 mt-4 font-mono">O aplicativo será recompilado automaticamente ao salvar o segredo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-sans flex flex-col flex-grow">
      {/* Filters and Counters Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 border border-slate-200 p-4 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-100 text-indigo-700 p-2 rounded-xl shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Mapeamento Geográfico de Clientes</h4>
            <p className="text-[10px] text-slate-450 mt-0.5">
              Exibindo <strong className="text-indigo-700">{clientsWithCoords.length}</strong> de <strong className="text-slate-700">{filteredClients.length}</strong> clientes cadastrados com coordenadas nesta visão.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterRegionOnly(prev => !prev)}
            className={`px-3 py-1.5 text-[11px] font-extrabold rounded-xl border transition-all cursor-pointer shadow-sm ${
              filterRegionOnly
                ? 'bg-indigo-600 text-white border-transparent'
                : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
            }`}
          >
            {filterRegionOnly ? `📍 Região Ativa: ${region}` : '🌍 Todas as Regiões'}
          </button>
        </div>
      </div>

      {/* Map Board or State Renderers */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl h-[550px]">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-2" />
          <strong className="text-xs font-bold text-slate-600 uppercase">Sincronizando Banco de Dados...</strong>
          <p className="text-[10px] text-slate-400 mt-0.5">Carregando coordenadas dos clientes a partir do Firestore.</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center p-8 border border-dashed border-rose-200 bg-rose-50/20 rounded-2xl text-center h-[550px]">
          <AlertCircle className="w-10 h-10 text-rose-500 mb-2" />
          <strong className="text-xs font-bold text-rose-850 uppercase">Falha na Sincronização</strong>
          <p className="text-xs text-rose-650 max-w-sm mt-1">{error}</p>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 border border-dashed border-slate-200 bg-slate-50/50 rounded-2xl text-center h-[550px]">
          <MapPin className="w-10 h-10 text-slate-350 mb-2 animate-bounce" />
          <strong className="text-xs font-bold text-slate-500 uppercase">Nenhum Cliente Registrado</strong>
          <p className="text-xs text-slate-400 max-w-xs mt-1">
            Não existem clientes cadastrados {filterRegionOnly ? `na região de ${region}` : 'no sistema'}. Use a aba "Banco de Dados de Clientes" para cadastrar novos ou importar via planilha.
          </p>
        </div>
      ) : (
        <div className="relative h-[550px] w-full rounded-2xl overflow-hidden shadow-lg border border-slate-200">
          <APIProvider apiKey={API_KEY} version="weekly">
            <Map
              defaultCenter={defaultCenter}
              defaultZoom={11}
              mapId="DEMO_MAP_ID"
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              style={{ width: '100%', height: '100%' }}
              gestureHandling="cooperative"
            >
              {/* Dynamic Bounds Fitting */}
              <FitMapBounds clientsWithCoords={clientsWithCoords} />

              {/* Render Markers for all clients with coordinates */}
              {clientsWithCoords.map((c) => (
                <ClienteMarker key={c.id} cliente={c} />
              ))}
            </Map>
          </APIProvider>

          {/* Map Info Badge Overlay */}
          <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-md border border-slate-200/80 rounded-xl p-3 shadow-lg flex items-start gap-2 max-w-md pointer-events-none z-10 select-none">
            <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div className="text-[10px] text-slate-600 leading-normal">
              <strong className="font-bold text-slate-800 uppercase tracking-wider block mb-0.5">Legenda do Status Geográfico:</strong>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 font-mono">
                <span className="flex items-center gap-1 font-semibold text-emerald-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Ativo
                </span>
                <span className="flex items-center gap-1 font-semibold text-rose-500">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span> Inativo
                </span>
                <span className="flex items-center gap-1 font-semibold text-indigo-500">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block"></span> Outros / Pendentes
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
