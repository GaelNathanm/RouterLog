/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, animate } from 'motion/react';
import { APIProvider, Map, AdvancedMarker, InfoWindow, useMap } from '@vis.gl/react-google-maps';
import { Rota, GPSLocation, Parada, Region, UserRole } from '../types';
import { INITIAL_REGIONS } from '../data/mockData';
import { 
  Truck, MapPin, Navigation, Warehouse, Play, Signal, 
  Filter, Info, ShieldAlert, CheckCircle2, AlertTriangle, HelpCircle, Layers, Compass
} from 'lucide-react';

interface RouteMapProps {
  rotas: Rota[];
  locations: { [drvId: string]: GPSLocation };
  currentUserRegion?: string;
  currentUserRole?: number; // UserRole
  singleRouteMode?: Rota | null; // If passed, specializes on this route
  singleDriverLocation?: GPSLocation | null;
  breadcrumbs?: { [drvId: string]: { lat: number; lng: number }[] };
  regions?: Region[];
  onStopClick?: (stop: Parada) => void;
}

// Safely fetch Google Maps API key from environment configuration
const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

// Custom component to handle dynamic rendering of route polylines on Google Maps
function MapPolyline({ path, color }: { path: google.maps.LatLngLiteral[]; color: string; key?: React.Key }) {
  const map = useMap();
  
  useEffect(() => {
    if (!map || path.length < 2 || typeof google === 'undefined') return;
    
    const polyline = new google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: color,
      strokeOpacity: 0.8,
      strokeWeight: 4,
      map
    });
    
    return () => {
      polyline.setMap(null);
    };
  }, [map, path, color]);
  
  return null;
}

// Custom component to dynamically center and fit map boundaries to encapsulate active routes and points
function FitMapBounds({ routes, locations, singleRouteMode, singleDriverLocation }: {
  routes: Rota[];
  locations: { [drvId: string]: GPSLocation };
  singleRouteMode?: Rota | null;
  singleDriverLocation?: GPSLocation | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || typeof google === 'undefined' || routes.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;

    routes.forEach(r => {
      if (r.originLat && r.originLng && !isNaN(r.originLat) && !isNaN(r.originLng)) {
        bounds.extend({ lat: r.originLat, lng: r.originLng });
        hasPoints = true;
      }
      r.stops.forEach(s => {
        if (s.lat && s.lng && !isNaN(s.lat) && !isNaN(s.lng) && s.lat !== 0 && s.lng !== 0) {
          bounds.extend({ lat: s.lat, lng: s.lng });
          hasPoints = true;
        }
      });

      const drvLoc = singleRouteMode && singleDriverLocation ? singleDriverLocation : locations[r.driverId];
      if (drvLoc && drvLoc.lat && drvLoc.lng && !isNaN(drvLoc.lat) && !isNaN(drvLoc.lng)) {
        bounds.extend({ lat: drvLoc.lat, lng: drvLoc.lng });
        hasPoints = true;
      }
    });

    if (hasPoints) {
      map.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 });
    }
  }, [map, routes, locations, singleRouteMode, singleDriverLocation]);

  return null;
}

export default function RouteMap({ 
  rotas, 
  locations, 
  currentUserRegion, 
  currentUserRole,
  singleRouteMode = null,
  singleDriverLocation = null,
  breadcrumbs,
  regions = INITIAL_REGIONS,
  onStopClick
}: RouteMapProps) {
  
  // States
  const [selectedRegion, setSelectedRegion] = useState<string>(currentUserRegion || 'all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedStop, setSelectedStop] = useState<{ stop: Parada; routeName: string } | null>(null);
  const [hoveredDriver, setHoveredDriver] = useState<{ driverName: string; location: GPSLocation; plate: string } | null>(null);
  const [driverFilter, setDriverFilter] = useState<{ [drvId: string]: boolean }>({});
  const [completionNotification, setCompletionNotification] = useState<string | null>(null);

  // Keep track of previously active routes to detect when they complete
  const prevRotasRef = useRef<Rota[]>([]);

  // Local physical layout fallback states
  const [mapLoadError, setMapLoadError] = useState<string | null>(null);
  const [useFallbackMap, setUseFallbackMap] = useState<boolean>(false);
  const [dashOffset, setDashOffset] = useState<number>(0);

  // Effect to verify if a driver has finished their route and clear map automatically
  useEffect(() => {
    if (prevRotasRef.current && prevRotasRef.current.length > 0) {
      rotas.forEach(currentRoute => {
        const previousRoute = prevRotasRef.current.find(r => r.id === currentRoute.id);
        if (previousRoute && previousRoute.status !== 'completed' && currentRoute.status === 'completed') {
          // Driver completed the route!
          setCompletionNotification(`O motorista ${currentRoute.driverName} concluiu a rota "${currentRoute.name}". As informações de rota foram limpas do mapa automaticamente.`);
        }
      });
    }
    prevRotasRef.current = rotas;
  }, [rotas]);

  // Vector animation trace for fallback SVG
  useEffect(() => {
    let animationId: number;
    const tick = () => {
      setDashOffset(prev => (prev - 0.4) % 20);
      animationId = requestAnimationFrame(tick);
    };
    animationId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationId);
  }, []);

  // Sync state if currentUserRegion changes
  useEffect(() => {
    if (currentUserRegion) {
      setSelectedRegion(currentUserRegion);
    }
  }, [currentUserRegion]);

  // Determine current effective region
  const effectiveRegion = (currentUserRole === 1 && currentUserRegion) ? currentUserRegion : selectedRegion;

  // List of drivers matching the active/focused region
  const regionalDriversForFilter = useMemo(() => {
    const routesInRegion = rotas.filter(r => effectiveRegion === 'all' || r.region === effectiveRegion);
    const seen = new Set<string>();
    const list: { id: string; name: string }[] = [];
    routesInRegion.forEach(r => {
      if (!seen.has(r.driverId)) {
        seen.add(r.driverId);
        list.push({ id: r.driverId, name: r.driverName });
      }
    });
    return list;
  }, [rotas, effectiveRegion]);

  // Filter routes based on selected region, status or singleMode
  const filteredRoutes = useMemo(() => {
    if (singleRouteMode) {
      return [singleRouteMode];
    }
    return rotas.filter(r => {
      const matchesRegion = effectiveRegion === 'all' || r.region === effectiveRegion;
      
      // EXCLUDE completed routes automatically by default when selectedStatus is 'all'
      const matchesStatus = selectedStatus === 'all' 
        ? r.status !== 'completed' 
        : r.status === selectedStatus;
      
      // Filter out if driver filter is explicitly deactivated
      const passesDriver = driverFilter[r.driverId] !== false;
      
      return matchesRegion && matchesStatus && passesDriver;
    });
  }, [rotas, effectiveRegion, selectedStatus, singleRouteMode, driverFilter]);

  // Collated bounding region of filtered routes
  const bounds = useMemo(() => {
    if (filteredRoutes.length === 0) {
      // Default to either MG (Belo Horizonte) or GV1 (Valadares)
      if (effectiveRegion === 'ES/MG') {
        return { minLat: -20.309455, maxLat: -20.309205, minLng: -40.409505, maxLng: -40.409305 };
      }
      return { minLat: -18.870, maxLat: -18.840, minLng: -41.960, maxLng: -41.930 };
    }

    const pts: { lat: number; lng: number }[] = [];
    filteredRoutes.forEach(r => {
      if (r.originLat && r.originLng && !isNaN(r.originLat) && !isNaN(r.originLng) && r.originLat !== 0 && r.originLng !== 0) {
        pts.push({ lat: r.originLat, lng: r.originLng });
      }
      r.stops.forEach(s => {
        if (s.lat && s.lng && !isNaN(s.lat) && !isNaN(s.lng) && s.lat !== 0 && s.lng !== 0) {
          pts.push({ lat: s.lat, lng: s.lng });
        }
      });
      
      const drvLoc = locations[r.driverId];
      if (drvLoc && drvLoc.lat && drvLoc.lng && !isNaN(drvLoc.lat) && !isNaN(drvLoc.lng) && drvLoc.lat !== 0 && drvLoc.lng !== 0) {
        pts.push({ lat: drvLoc.lat, lng: drvLoc.lng });
      }
    });

    if (singleDriverLocation && singleDriverLocation.lat && singleDriverLocation.lng && !isNaN(singleDriverLocation.lat) && !isNaN(singleDriverLocation.lng) && singleDriverLocation.lat !== 0 && singleDriverLocation.lng !== 0) {
      pts.push({ lat: singleDriverLocation.lat, lng: singleDriverLocation.lng });
    }

    if (pts.length === 0) return null;

    let minLat = Math.min(...pts.map(p => p.lat));
    let maxLat = Math.max(...pts.map(p => p.lat));
    let minLng = Math.min(...pts.map(p => p.lng));
    let maxLng = Math.max(...pts.map(p => p.lng));

    // Pad slightly
    const latPad = Math.max((maxLat - minLat) * 0.15, 0.005);
    const lngPad = Math.max((maxLng - minLng) * 0.15, 0.005);

    return {
      minLat: minLat - latPad,
      maxLat: maxLat + latPad,
      minLng: minLng - lngPad,
      maxLng: maxLng + lngPad
    };
  }, [filteredRoutes, locations, effectiveRegion, singleDriverLocation]);

  const mapCenter = useMemo(() => {
    if (!bounds) {
      return { lat: -20.30855, lng: -40.405535 }; // Default GV
    }
    return {
      lat: (bounds.minLat + bounds.maxLat) / 2,
      lng: (bounds.minLng + bounds.maxLng) / 2
    };
  }, [bounds]);

  return (
    <div id="route-google-map-panel" className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[520px]">
      
      {/* Top action controls of the map */}
      <div className="bg-slate-50 border-b border-slate-200 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></div>
          <div>
            <h4 className="text-xs font-bold text-slate-850 flex items-center gap-1.5 uppercase font-mono tracking-tight">
              Acompanhamento Mapa (Google Maps)
            </h4>
            <p className="text-[10px] text-slate-400">Roteador ativo com polilinhas imutáveis e telemetria regional.</p>
          </div>
        </div>

        {/* Dynamic filters unless in single mode */}
        {!singleRouteMode && (
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
            {currentUserRole === 1 && currentUserRegion ? (
              <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-150 px-2.5 py-1 rounded-xl text-blue-800 font-bold text-[10px]">
                <span className="text-[9px] text-blue-400 uppercase font-mono tracking-wide">Região Focada:</span>
                <span>{currentUserRegion}</span>
              </div>
            ) : (
              /* Filter Region */
              <div className="flex items-center gap-1 border border-slate-250 bg-white px-2 py-1 rounded-lg">
                <Filter className="w-3 h-3 text-slate-450" />
                <select 
                  value={selectedRegion}
                  onChange={e => setSelectedRegion(e.target.value)}
                  className="bg-transparent font-semibold text-slate-700 outline-none max-w-[100px]"
                >
                  <option value="all">Filtro: Todas Regiões</option>
                  {regions.map(r => (
                    <option key={r.id} value={r.id}>Região {r.id}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Visual driver filtering list of pins */}
            {regionalDriversForFilter.length > 0 && (
              <div className="flex items-center gap-1.5 border border-slate-250 bg-white px-2.5 py-1 rounded-lg">
                <span className="text-slate-450 font-bold text-[9px] uppercase tracking-wider">Filtro Motoristas:</span>
                <div className="flex items-center gap-2 max-w-[240px] overflow-x-auto whitespace-nowrap scrollbar-none">
                  {regionalDriversForFilter.map(drv => {
                    const isChecked = driverFilter[drv.id] !== false;
                    return (
                      <label key={drv.id} className="inline-flex items-center gap-1 cursor-pointer select-none hover:text-slate-800 transition-colors">
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={() => setDriverFilter(prev => ({
                            ...prev,
                            [drv.id]: !isChecked
                          }))}
                          className="rounded border-slate-255 text-blue-600 focus:ring-blue-500 w-3 h-3 cursor-pointer"
                        />
                        <span className="text-slate-705 font-bold text-[10px]">{drv.name.split(' ')[0]}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Filter Route Status */}
            <div className="flex items-center gap-1 border border-slate-250 bg-white px-2 py-1 rounded-lg">
              <Layers className="w-3 h-3 text-slate-450" />
              <select 
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="bg-transparent font-semibold text-slate-700 outline-none max-w-[110px]"
              >
                <option value="all">Status: Todos</option>
                <option value="active">Apenas Ativos</option>
                <option value="draft">Em Rascunho</option>
                <option value="completed">Concluídos</option>
              </select>
            </div>

            {/* Toggle button */}
            <button
              type="button"
              onClick={() => setUseFallbackMap(prev => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-semibold select-none transition-all duration-150 cursor-pointer ${
                useFallbackMap 
                  ? 'bg-indigo-650 border-indigo-650 text-white hover:bg-indigo-700' 
                  : 'bg-white border-slate-250 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Compass className={`w-3.5 h-3.5 ${!useFallbackMap ? 'text-indigo-600' : 'text-white'}`} />
              <span>{useFallbackMap ? "Exibir Google Maps" : "Exibir Vetor CD"}</span>
            </button>
          </div>
        )}

        {/* Single Mode Metadata */}
        {singleRouteMode && (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-105 rounded-full px-3 py-1 font-mono text-[10px] text-blue-700">
            <Truck className="w-3.5 h-3.5 animate-bounce text-blue-600" />
            Ativo: <span className="font-bold">{singleRouteMode.driverName}</span> ({singleRouteMode.region})
          </div>
        )}
      </div>

      {/* Main Row layout composed of Sidebar (if singleRouteMode) + Map */}
      <div className="flex-1 flex items-stretch overflow-hidden relative">
        
        {/* Automatic Completion Clean alert Toast */}
        {completionNotification && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-emerald-800 text-white px-5 py-3 rounded-xl shadow-2xl border border-emerald-650 z-[9999] flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 max-w-sm text-xs leading-normal">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-300 animate-bounce" />
            <div className="flex-1">
              <span className="font-bold block text-[10px] uppercase tracking-wider text-emerald-200">Limpeza Automática de Rota Concluída</span>
              <p className="text-[11px] font-medium text-white/95 mt-0.5">{completionNotification}</p>
            </div>
            <button 
              type="button"
              onClick={() => setCompletionNotification(null)}
              className="text-white hover:text-emerald-200 transition-colors p-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
        
        {/* Main Maps Canvas Area */}
        <div className="flex-1 h-full min-h-[300px] bg-slate-100 relative">
          {useFallbackMap ? (
            (() => {
              // Get projected local 2D vector coordinate mapping on custom SVG
              const getSvgCoords = (lat: number, lng: number) => {
                if (!bounds) return { x: 400, y: 220 };
                const latRange = bounds.maxLat - bounds.minLat || 0.01;
                const lngRange = bounds.maxLng - bounds.minLng || 0.01;
                // Scale within 800x440 viewBox
                const x = ((lng - bounds.minLng) / lngRange) * 700 + 50;
                const y = 390 - (((lat - bounds.minLat) / latRange) * 340) + 25;
                return { x, y };
              };

              return (
                <div className="w-full h-full bg-slate-950 relative overflow-hidden select-none">
                  {/* Status Info Banner overlay over the vector canvas */}
                  <div className="absolute top-2.5 right-2 text-white/95 left-2 z-20 pointer-events-auto flex items-center justify-between gap-3 bg-slate-900/95 px-3.5 py-2.5 rounded-xl border border-slate-800 shadow-xl">
                    <div className="flex items-center gap-2">
                      {mapLoadError ? (
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 animate-pulse" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                      <div className="text-[11px] leading-tight">
                        <span className="font-bold">
                          {mapLoadError ? "Back-up: Roteamento Vetorial de Precision" : "Roteamento em Vetor Ativado"}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {mapLoadError 
                             ? `Status: ${mapLoadError}` 
                             : "Itinerário geo-espacial construído com vetores de proximidade local em tempo real."}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => {
                          setMapLoadError(null);
                          setUseFallbackMap(false);
                        }}
                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold text-[9px] uppercase transition-colors cursor-pointer"
                      >
                        Tentar Google Maps
                      </button>
                    </div>
                  </div>

                  {/* SVG background grid lines */}
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
                  
                  <svg className="w-full h-full" viewBox="0 0 800 440" style={{ pointerEvents: 'auto' }}>
                    {/* Draw grid metrics labels */}
                    {bounds && (
                      <g opacity="0.35" className="font-mono text-[8px] fill-slate-500">
                        <text x="20" y="32">S {bounds.maxLat.toFixed(4)}°</text>
                        <text x="20" y="418">S {bounds.minLat.toFixed(4)}°</text>
                        <text x="715" y="418">W {bounds.maxLng.toFixed(4)}°</text>
                        <text x="24" y="418">W {bounds.minLng.toFixed(4)}°</text>
                      </g>
                    )}

                    {/* Render Route Paths */}
                    {filteredRoutes.map((r, rIdx) => {
                      const colors = ['#2563eb', '#9333ea', '#db2777', '#0d9488', '#ea580c'];
                      const routeColor = colors[rIdx % colors.length];
                      const whCoords = getSvgCoords(r.originLat, r.originLng);
                      
                      const pathPoints = [whCoords];
                      r.stops.forEach(s => {
                        if (s.lat && s.lng) {
                          pathPoints.push(getSvgCoords(s.lat, s.lng));
                        }
                      });

                      if (pathPoints.length < 2) return null;

                      // Build SVG d route path
                      const pathD = pathPoints.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');

                      return (
                        <g key={`fallback-route-${r.id}`}>
                          {/* Underlying route shadow trail */}
                          <path
                            d={pathD}
                            fill="none"
                            stroke={routeColor}
                            strokeWidth={5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            opacity={0.15}
                          />
                          {/* Animated flow dash paths */}
                          <path
                            d={pathD}
                            fill="none"
                            stroke={routeColor}
                            strokeWidth={2}
                            strokeDasharray="8,6"
                            strokeDashoffset={dashOffset}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </g>
                      );
                    })}

                    {/* Render CD warehouse centers */}
                    {filteredRoutes.map(r => {
                      const wh = getSvgCoords(r.originLat, r.originLng);
                      return (
                        <g key={`fallback-wh-${r.id}`} className="cursor-pointer">
                          <circle cx={wh.x} cy={wh.y} r={9} fill="#0f172a" stroke="#3b82f6" strokeWidth={2} className="animate-pulse" />
                          <circle cx={wh.x} cy={wh.y} r={14} fill="none" stroke="#2563eb" strokeWidth={1} opacity={0.25} />
                          <path d={`M ${wh.x} ${wh.y - 4} L ${wh.x} ${wh.y + 4} M ${wh.x - 4} ${wh.y} L ${wh.x + 4} ${wh.y}`} stroke="#3b82f6" strokeWidth={1.5} />
                        </g>
                      );
                    })}

                    {/* Draw breadcrumbs */}
                    {singleRouteMode && breadcrumbs && Array.isArray(breadcrumbs[singleRouteMode.driverId]) && (
                      breadcrumbs[singleRouteMode.driverId].map((pt, pidx) => {
                        const pointCoords = getSvgCoords(pt.lat, pt.lng);
                        const trail = breadcrumbs[singleRouteMode.driverId];
                        const opacity = Math.max(0.2, (pidx + 1) / trail.length * 0.85);
                        const scale = Math.max(0.6, (pidx + 1) / trail.length);
                        return (
                          <circle 
                            key={`fallback-bread-${pidx}`}
                            cx={pointCoords.x}
                            cy={pointCoords.y}
                            r={3.5 * scale}
                            fill="#10b981"
                            opacity={opacity}
                            className="pointer-events-none"
                          />
                        );
                      })
                    )}

                    {!singleRouteMode && breadcrumbs && filteredRoutes.map(r => {
                      const trail = breadcrumbs[r.driverId];
                      if (!trail || !Array.isArray(trail)) return null;
                      return trail.map((pt, pidx) => {
                        const pointCoords = getSvgCoords(pt.lat, pt.lng);
                        const opacity = Math.max(0.2, (pidx + 1) / trail.length * 0.75);
                        const scale = Math.max(0.6, (pidx + 1) / trail.length);
                        return (
                          <circle 
                            key={`fallback-bread-multi-${r.driverId}-${pidx}`}
                            cx={pointCoords.x}
                            cy={pointCoords.y}
                            r={3 * scale}
                            fill="#6366f1"
                            opacity={opacity}
                            className="pointer-events-none"
                          />
                        );
                      });
                    })}

                    {/* Draw Stops Pins */}
                    {filteredRoutes.map(r => (
                      r.stops.map((stop, idx) => {
                        if (!stop.lat || !stop.lng || isNaN(stop.lat) || isNaN(stop.lng) || (stop.lat === 0 && stop.lng === 0)) return null;
                        const pt = getSvgCoords(stop.lat, stop.lng);
                        const isCompleted = stop.status === 'completed';
                        const isChegando = stop.status === 'Chegando';
                        const isNextTarget = r.status === 'active' && idx === r.currentStopIndex;

                        const markerColor = isCompleted 
                          ? '#64748b' 
                          : isChegando
                          ? '#10b981'
                          : isNextTarget 
                          ? '#f59e0b'
                          : '#2563eb';

                        const isSelected = selectedStop?.stop?.id === stop.id;

                        return (
                          <g 
                            key={`fallback-stop-${stop.id}`} 
                            className="cursor-pointer group"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStop({ stop, routeName: r.name });
                            }}
                          >
                            {isChegando && (
                              <circle cx={pt.x} cy={pt.y} r={14} fill="none" stroke="#10b981" strokeWidth={1} className="animate-ping" style={{ transformOrigin: `${pt.x}px ${pt.y}px` }} />
                            )}
                            
                            {isNextTarget && (
                              <circle cx={pt.x} cy={pt.y} r={12} fill="none" stroke="#f59e0b" strokeWidth={2} opacity={0.45} className="animate-pulse" style={{ transformOrigin: `${pt.x}px ${pt.y}px` }} />
                            )}

                            <circle 
                              cx={pt.x} 
                              cy={pt.y} 
                              r={isSelected ? 10 : 7.5} 
                              fill={markerColor} 
                              stroke="#ffffff" 
                              strokeWidth={1.5}
                              className="transition-all duration-200"
                              style={{ transformOrigin: `${pt.x}px ${pt.y}px` }}
                            />

                            <text 
                              x={pt.x} 
                              y={pt.y + 3} 
                              fill="#ffffff" 
                              className="font-sans font-black text-[8px] select-none pointer-events-none" 
                              textAnchor="middle"
                            >
                              {idx + 1}
                            </text>
                          </g>
                        );
                      })
                    ))}

                    {/* Draw Driver Live Markers */}
                    {singleRouteMode && singleDriverLocation && (
                      (() => {
                        const pt = getSvgCoords(singleDriverLocation.lat, singleDriverLocation.lng);
                        return (
                          <g 
                            className="cursor-pointer"
                            onClick={() => setHoveredDriver({ 
                              driverName: singleRouteMode.driverName, 
                              location: singleDriverLocation,
                              plate: singleRouteMode.driverPlate
                            })}
                          >
                            <circle cx={pt.x} cy={pt.y} r={16} fill="none" stroke="#10b981" strokeWidth={2} opacity={0.3} className="animate-ping" style={{ transformOrigin: `${pt.x}px ${pt.y}px` }} />
                            <rect x={pt.x - 11} y={pt.y - 11} width={22} height={22} rx={6} fill="#10b981" stroke="#ffffff" strokeWidth={2} className="shadow-lg" />
                            <svg x={pt.x - 6.5} y={pt.y - 6.5} width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white">
                              <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
                              <path d="M19 18h2a1 1 0 0 0 1-1v-5.14a1 1 0 0 0-.29-.71l-3.3-3.3a1 1 0 0 0-.71-.29H14" />
                              <circle cx="7.5" cy="18.5" r="2.5" />
                              <circle cx="17.5" cy="18.5" r="2.5" />
                            </svg>
                          </g>
                        );
                      })()
                    )}

                    {!singleRouteMode && filteredRoutes.map(r => {
                      const drvLoc = locations[r.driverId];
                      if (!drvLoc) return null;
                      const pt = getSvgCoords(drvLoc.lat, drvLoc.lng);
                      return (
                        <g 
                          key={`fallback-drv-marker-${r.id}`}
                          className="cursor-pointer"
                          onClick={() => setHoveredDriver({
                            driverName: r.driverName,
                            location: drvLoc,
                            plate: r.driverPlate
                          })}
                        >
                          <circle cx={pt.x} cy={pt.y} r={14} fill="none" stroke="#6366f1" strokeWidth={2} opacity={0.3} className="animate-ping" style={{ transformOrigin: `${pt.x}px ${pt.y}px` }} />
                          <rect x={pt.x - 10} y={pt.y - 10} width={20} height={20} rx={5} fill="#4f46e5" stroke="#ffffff" strokeWidth={1.5} className="shadow-lg" />
                          <svg x={pt.x - 5.5} y={pt.y - 5.5} width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white">
                            <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
                            <path d="M19 18h2a1 1 0 0 0 1-1v-5.14a1 1 0 0 0-.29-.71l-3.3-3.3a1 1 0 0 0-.71-.29H14" />
                            <circle cx="7.5" cy="18.5" r="2.5" />
                            <circle cx="17.5" cy="18.5" r="2.5" />
                          </svg>
                          <text x={pt.x} y={pt.y + 17} fill="#c7d2fe" className="font-sans font-bold text-[7.5px]" textAnchor="middle">
                            {r.driverName.split(' ')[0]}
                          </text>
                        </g>
                      );
                    })}
                  </svg>

                  {/* Absolute InfoWindows in local coordinates absolute alignment */}
                  {selectedStop && (
                    (() => {
                      const pt = getSvgCoords(selectedStop.stop.lat, selectedStop.stop.lng);
                      return (
                        <div 
                          className="absolute bg-slate-900 border border-slate-800 text-white rounded-xl shadow-2xl p-3 text-xs w-60 z-30 font-sans cursor-default transition-all duration-250 pointer-events-auto"
                          style={{ 
                            left: `${pt.x}px`, 
                            top: `${pt.y - 145}px`, 
                            transform: 'translateX(-50%)'
                          }}
                        >
                          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1.5 font-bold uppercase text-[9px] text-blue-400">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" />
                              Ponto de Entrega #{selectedStop.stop.id}
                            </span>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStop(null);
                              }} 
                              className="hover:text-white text-slate-500 font-black px-1.5 select-none text-[11px] hover:scale-115 transition-transform"
                            >
                              ✕
                            </button>
                          </div>
                          <strong className="text-slate-100 block font-semibold truncate">{selectedStop.stop.clientName}</strong>
                          <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-tight">{selectedStop.stop.address}</p>
                          
                          <div className="mt-2.5 flex items-center justify-between text-[9px] font-mono">
                            <span className={`px-1.5 py-0.5 rounded font-bold ${selectedStop.stop.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                              {selectedStop.stop.status === 'completed' ? 'CONCLUÍDO ✔' : 'PENDENTE ⏳'}
                            </span>
                            <span className="text-slate-500">Rota: {selectedStop.routeName}</span>
                          </div>

                          {/* One-tap navigation buttons for drivers */}
                          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-800 pt-2">
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${selectedStop.stop.lat},${selectedStop.stop.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="py-1.5 px-2 bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 font-bold rounded-lg text-[9px] uppercase tracking-wider text-center flex items-center justify-center gap-1 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <svg className="w-2.5 h-2.5 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                              </svg> Google Maps
                            </a>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(`waze://?ll=${selectedStop.stop.lat},${selectedStop.stop.lng}&navigate=yes`, '_self');
                                setTimeout(() => {
                                  window.open(`https://waze.com/ul?ll=${selectedStop.stop.lat},${selectedStop.stop.lng}&navigate=yes`, '_blank');
                                }, 300);
                              }}
                              className="py-1.5 px-2 bg-sky-950 hover:bg-sky-900 border border-sky-800 text-sky-300 font-bold rounded-lg text-[9px] uppercase tracking-wider text-center flex items-center justify-center gap-1 transition-colors"
                            >
                              <svg className="w-2.5 h-2.5 text-sky-400" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1.61 14.88c-1 .61-2.11-.22-2.11-1.38v-.5h-2a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1h2v-.5c0-1.16 1.11-2 2.11-1.38l3.19 1.88a1 1 0 0 1 0 1.76z" />
                              </svg> Waze
                            </button>
                          </div>

                          {currentUserRole === 2 && selectedStop.stop.status !== 'completed' && onStopClick && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onStopClick(selectedStop.stop);
                                setSelectedStop(null);
                              }}
                              className="mt-3 w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold rounded-lg text-[10px] uppercase shadow-md transition-all active:scale-95 text-center cursor-pointer tracking-wider"
                            >
                              Confirmar Entrega
                            </button>
                          )}
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-slate-900 border-r border-b border-slate-800" />
                        </div>
                      );
                    })()
                  )}

                  {hoveredDriver && (
                    (() => {
                      const pt = getSvgCoords(hoveredDriver.location.lat, hoveredDriver.location.lng);
                      return (
                        <div 
                          className="absolute bg-slate-900 border border-slate-800 text-white rounded-xl shadow-2xl p-3 text-xs w-60 z-30 font-sans cursor-default transition-all duration-250 pointer-events-auto"
                          style={{ 
                            left: `${pt.x}px`, 
                            top: `${pt.y - 140}px`, 
                            transform: 'translateX(-50%)'
                          }}
                        >
                          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1.5 font-bold uppercase text-[9px] text-emerald-400 font-mono">
                            <span className="flex items-center gap-1">
                              <Signal className="w-3 h-3 animate-pulse text-emerald-500" />
                              Satélite Ativo
                            </span>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setHoveredDriver(null);
                              }} 
                              className="hover:text-white text-slate-500 font-black px-1.5 select-none text-[11px] hover:scale-115 transition-transform"
                            >
                              ✕
                            </button>
                          </div>
                          <strong className="text-slate-100 block font-bold">{hoveredDriver.driverName}</strong>
                          <p className="text-[10px] text-slate-400 mt-0.5 font-mono">Placa: {hoveredDriver.plate}</p>
                          
                          <div className="mt-2.5 bg-slate-950 p-1.5 border border-slate-800/80 rounded-lg grid grid-cols-2 gap-2 text-[9px] font-mono">
                            <div>
                              <span className="text-slate-500 block text-[8px] uppercase font-bold">Velocidade</span>
                              <strong className="text-emerald-400 font-black">{hoveredDriver.location.speed} km/h</strong>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[8px] uppercase font-bold">Rumo GPS</span>
                              <strong className="text-slate-300 font-semibold">{Math.round(hoveredDriver.location.heading)}°</strong>
                            </div>
                          </div>
                          <p className="text-[8px] text-slate-500 mt-2 text-right">Atualizado: {new Date(hoveredDriver.location.lastUpdated).toLocaleTimeString()}</p>
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-slate-900 border-r border-b border-slate-800" />
                        </div>
                      );
                    })()
                  )}
                </div>
              );
            })()
          ) : (
            <div className="w-full h-full relative" style={{ minHeight: '300px', height: '100%' }}>
              {!hasValidKey ? (
                <div className="flex flex-col items-center justify-center p-8 bg-slate-950 text-center text-white h-full border border-slate-900">
                  <Compass className="w-12 h-12 text-slate-600 mb-3 animate-pulse" />
                  <h3 className="text-sm font-black uppercase tracking-wider mb-2 font-sans">Chave do Google Maps Requerida</h3>
                  <p className="text-xs text-slate-400 max-w-sm mb-4 leading-relaxed">
                    Adicione o segredo <code>GOOGLE_MAPS_PLATFORM_KEY</code> no painel de configurações para habilitar a visualização satélite em tempo real.
                  </p>
                  <button
                    type="button"
                    onClick={() => setUseFallbackMap(true)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold font-sans uppercase transition-colors tracking-wider shadow-md cursor-pointer active:scale-95"
                  >
                    Exibir Backup em Vetor CD
                  </button>
                </div>
              ) : (
                <APIProvider apiKey={API_KEY} version="weekly">
                  <Map
                    defaultCenter={mapCenter}
                    defaultZoom={singleRouteMode ? 14 : 12}
                    mapId="DEMO_MAP_ID"
                    internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                    style={{ width: '100%', height: '100%' }}
                    gestureHandling="cooperative"
                  >
                    <FitMapBounds 
                      routes={filteredRoutes} 
                      locations={locations} 
                      singleRouteMode={singleRouteMode} 
                      singleDriverLocation={singleDriverLocation} 
                    />

                    {/* 1. Warehouse Centers */}
                    {filteredRoutes.map(r => (
                      <AdvancedMarker
                        key={`wh-${r.id}`}
                        position={{ lat: r.originLat, lng: r.originLng }}
                        title={`CD Principal (${r.region})`}
                      >
                        <div className="w-8 h-8 rounded-full bg-blue-900 border-2 border-white flex items-center justify-center text-white shadow-lg">
                          <Warehouse className="w-4 h-4" />
                        </div>
                      </AdvancedMarker>
                    ))}

                    {/* 2. Stops / Delivery Pins */}
                    {filteredRoutes.map(r => 
                      r.stops.map((stop, sIdx) => {
                        if (!stop.lat || !stop.lng || isNaN(stop.lat) || isNaN(stop.lng) || (stop.lat === 0 && stop.lng === 0)) return null;

                        const isCompleted = stop.status === 'completed';
                        const isChegando = stop.status === 'Chegando';
                        const isNextTarget = r.status === 'active' && sIdx === r.currentStopIndex;

                        const pinColor = isCompleted 
                          ? '#64748b' 
                          : isChegando
                          ? '#10b981'
                          : isNextTarget 
                          ? '#f59e0b'
                          : '#2563eb';

                        return (
                          <AdvancedMarker
                            key={`stop-${stop.id}`}
                            position={{ lat: stop.lat, lng: stop.lng }}
                            onClick={() => setSelectedStop({ stop, routeName: r.name })}
                          >
                            <div className="flex flex-col items-center select-none" style={{ transform: 'translateY(-20px)', width: '28px', height: '40px' }}>
                              <div 
                                className="w-7 h-7 rounded-full flex items-center justify-center border-2 border-white text-white font-extrabold text-[11px] shadow-lg"
                                style={{ backgroundColor: pinColor }}
                              >
                                {sIdx + 1}
                              </div>
                              <div 
                                className="w-2 h-2 -mt-1 rotate-45 border-r border-b border-white"
                                style={{ backgroundColor: pinColor }}
                              ></div>
                            </div>
                          </AdvancedMarker>
                        );
                      })
                    )}

                    {/* 3. Driver Live Markers */}
                    {filteredRoutes.map(r => {
                      const drvLoc = singleRouteMode && singleDriverLocation ? singleDriverLocation : locations[r.driverId];
                      if (!drvLoc) return null;

                      return (
                        <AdvancedMarker
                          key={`driver-${r.driverId}`}
                          position={{ lat: drvLoc.lat, lng: drvLoc.lng }}
                          onClick={() => setHoveredDriver({
                            driverName: r.driverName,
                            location: drvLoc,
                            plate: r.driverPlate
                          })}
                        >
                          <div className="cursor-pointer bg-indigo-650 border-2 border-white text-white px-2.5 py-1 rounded-xl shadow-lg flex items-center gap-1.5 font-mono text-[10px] font-bold" style={{ width: 'auto', whiteSpace: 'nowrap' }}>
                            <Truck className="w-4 h-4 shrink-0" />
                            <span>{r.driverName.split(' ')[0]}</span>
                          </div>
                        </AdvancedMarker>
                      );
                    })}

                    {/* 4. Polylines representing active routes */}
                    {filteredRoutes.map((r, idx) => {
                      const colors = ['#2563eb', '#9333ea', '#db2777', '#0d9488', '#ea580c'];
                      const color = colors[idx % colors.length];

                      const pathPoints: google.maps.LatLngLiteral[] = [{ lat: r.originLat, lng: r.originLng }];
                      r.stops.forEach(s => {
                        if (s.lat && s.lng && !isNaN(s.lat) && !isNaN(s.lng) && !(s.lat === 0 && s.lng === 0)) {
                          pathPoints.push({ lat: s.lat, lng: s.lng });
                        }
                      });

                      if (pathPoints.length < 2) return null;

                      return (
                        <MapPolyline 
                          key={`poly-${r.id}`} 
                          path={pathPoints} 
                          color={color} 
                        />
                      );
                    })}

                    {/* 5. Breadcrumbs representing recent trajectory history */}
                    {breadcrumbs && filteredRoutes.map(r => {
                      const trail = breadcrumbs[r.driverId];
                      if (!trail || !Array.isArray(trail)) return null;

                      return trail.map((pt, pidx) => {
                        const opacity = Math.max(0.2, (pidx + 1) / trail.length * 0.75);
                        const scale = Math.max(0.6, (pidx + 1) / trail.length);
                        const color = singleRouteMode ? '#10b981' : '#6366f1';

                        return (
                          <AdvancedMarker
                            key={`bread-${r.driverId}-${pidx}`}
                            position={{ lat: pt.lat, lng: pt.lng }}
                          >
                            <div 
                              style={{ 
                                width: `${8 * scale}px`, 
                                height: `${8 * scale}px`, 
                                backgroundColor: color, 
                                borderRadius: '50%', 
                                opacity: opacity 
                              }} 
                            />
                          </AdvancedMarker>
                        );
                      });
                    })}

                    {/* 6. Information Popups (Selected Stop & Hovered Driver) */}
                    {selectedStop && (
                      <InfoWindow 
                        position={{ lat: selectedStop.stop.lat, lng: selectedStop.stop.lng }}
                        onCloseClick={() => setSelectedStop(null)}
                      >
                        <div className="p-1 font-sans text-xs max-w-sm text-slate-800 leading-normal">
                          <div className="flex items-center gap-1 text-slate-850 font-bold mb-1 border-b border-slate-100 pb-1 uppercase text-[10px]">
                            <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            Ponto de Entrega #{selectedStop.stop.id}
                          </div>
                          <strong className="text-slate-900 font-bold block">{selectedStop.stop.clientName}</strong>
                          <p className="text-[10px] text-slate-500 mt-1">{selectedStop.stop.address}</p>
                          <div className="mt-2.5 flex items-center justify-between gap-1 text-[9px] font-semibold">
                            <span className={`px-1.5 py-0.5 rounded ${selectedStop.stop.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold' : 'bg-amber-50 text-amber-700 border border-amber-100 font-bold'}`}>
                              {selectedStop.stop.status === 'completed' ? 'Entregue ✔' : 'Pendente ⏳'}
                            </span>
                            <span className="text-slate-400 font-normal font-mono">Sessão: {selectedStop.routeName}</span>
                          </div>
                          
                          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-2">
                            <button
                              type="button"
                              onClick={() => {
                                window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedStop.stop.lat},${selectedStop.stop.lng}`, '_blank');
                              }}
                              className="py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold rounded-lg text-[9px] uppercase tracking-wider text-center cursor-pointer flex items-center justify-center gap-1"
                            >
                              Google Maps
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                window.open(`waze://?ll=${selectedStop.stop.lat},${selectedStop.stop.lng}&navigate=yes`, '_self');
                                setTimeout(() => {
                                  window.open(`https://waze.com/ul?ll=${selectedStop.stop.lat},${selectedStop.stop.lng}&navigate=yes`, '_blank');
                                }, 300);
                              }}
                              className="py-1.5 px-2 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 font-bold rounded-lg text-[9px] uppercase tracking-wider text-center cursor-pointer flex items-center justify-center gap-1"
                            >
                              Waze
                            </button>
                          </div>

                          {currentUserRole === 2 && selectedStop.stop.status !== 'completed' && onStopClick && (
                            <button
                              type="button"
                              onClick={() => {
                                onStopClick(selectedStop.stop);
                                setSelectedStop(null);
                              }}
                              className="mt-3 w-full py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-extrabold rounded-lg text-[10px] uppercase shadow-sm text-center cursor-pointer tracking-wider"
                            >
                              Confirmar Entrega
                            </button>
                          )}
                        </div>
                      </InfoWindow>
                    )}

                    {hoveredDriver && (
                      <InfoWindow
                        position={{ lat: hoveredDriver.location.lat, lng: hoveredDriver.location.lng }}
                        onCloseClick={() => setHoveredDriver(null)}
                      >
                        <div className="p-1 font-sans text-xs max-w-sm text-slate-800 leading-normal">
                          <div className="flex items-center gap-1.5 text-emerald-700 font-bold mb-1 border-b border-slate-100 pb-1 uppercase text-[10px]">
                            <Signal className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                            Telemetria Ativa
                          </div>
                          <strong className="text-slate-900 block font-bold">{hoveredDriver.driverName}</strong>
                          <p className="text-[10px] text-slate-500 mt-0.5 font-mono">Placa: {hoveredDriver.plate}</p>
                          <div className="mt-2 bg-slate-50 p-1.5 border border-slate-200/60 rounded-lg grid grid-cols-2 gap-2 text-[9px] font-mono">
                            <div>
                              <span className="text-slate-450 block uppercase font-bold">VELOCIDADE:</span>
                              <strong className="text-slate-700 text-xs">{hoveredDriver.location.speed} km/h</strong>
                            </div>
                            <div>
                              <span className="text-slate-450 block uppercase font-bold">DIREÇÃO:</span>
                              <strong className="text-slate-700">{Math.round(hoveredDriver.location.heading)}°</strong>
                            </div>
                          </div>
                          <p className="text-[8px] text-slate-400 mt-2 text-right font-mono">Ping: {new Date(hoveredDriver.location.lastUpdated).toLocaleTimeString()}</p>
                        </div>
                      </InfoWindow>
                    )}
                  </Map>
                </APIProvider>
              )}
            </div>
          )}
        </div>

        {/* Floating dashboard metadata cards over the map */}
        <div className="absolute top-2.5 left-2.5 pointer-events-none select-none hidden md:flex flex-col gap-2">
          {/* Active stats counter float */}
          <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl shadow-lg max-w-[200px] text-white">
            <span className="text-[9px] text-slate-400 uppercase tracking-widest font-mono">TELEMETRIA ATIVA</span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <strong className="text-lg font-extrabold text-blue-400 leading-none">
                {filteredRoutes.length}
              </strong>
              <span className="text-[10px] text-slate-400">itinerários</span>
            </div>
            <div className="h-0.5 bg-slate-800 my-1.5"></div>
            <p className="text-[10px] text-slate-400 leading-normal">
              Conexões de GPS integradas ao barramento regional de visualização.
            </p>
          </div>
        </div>

      </div>

      {/* Footer bar */}
      <div className="bg-slate-50 border-t border-slate-200 p-2 flex justify-between px-4 font-mono text-[9px] text-slate-400 shrink-0 select-none">
        <span>● SISTEMA DE MONITORAÇÃO OFICIAL - ADVANCED MARKERS ACTIVATED</span>
        <span>REGIONAL ISOLATION STATE: ACTIVE</span>
      </div>
    </div>
  );
}
