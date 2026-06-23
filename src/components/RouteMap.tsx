/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, animate } from 'motion/react';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useMap } from '@vis.gl/react-google-maps';
import { Rota, GPSLocation, Parada, Region, UserRole } from '../types';
import { INITIAL_REGIONS } from '../mockData';
import { 
  Truck, MapPin, Navigation, Warehouse, Play, Signal, 
  Filter, Info, ShieldAlert, CheckCircle2, AlertTriangle, HelpCircle, Layers, Compass
} from 'lucide-react';

interface SmoothDriverMarkerProps {
  key?: string;
  position: { lat: number; lng: number };
  onClick?: () => void;
  children: React.ReactNode;
}

function SmoothDriverMarker({ position, onClick, children }: SmoothDriverMarkerProps) {
  const [currentPos, setCurrentPos] = useState(position);

  useEffect(() => {
    let active = true;
    const latControls = animate(currentPos.lat, position.lat, {
      type: "spring",
      stiffness: 80,
      damping: 15,
      onUpdate: (latest) => {
        if (active) {
          setCurrentPos(prev => ({ ...prev, lat: latest }));
        }
      }
    });
    const lngControls = animate(currentPos.lng, position.lng, {
      type: "spring",
      stiffness: 80,
      damping: 15,
      onUpdate: (latest) => {
        if (active) {
          setCurrentPos(prev => ({ ...prev, lng: latest }));
        }
      }
    });

    return () => {
      active = false;
      latControls.stop();
      lngControls.stop();
    };
  }, [position.lat, position.lng]);

  return (
    <AdvancedMarker position={currentPos} onClick={onClick}>
      <motion.div
        initial={{ scale: 0.8, y: 10, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.8, y: 10, opacity: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 15 }}
      >
        {children}
      </motion.div>
    </AdvancedMarker>
  );
}

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY' && API_KEY.trim() !== '';

// Mini component to dynamically draw Polylines for a route using Google Maps DirectionsService
function RoutePolyline({
  origin,
  stops,
  color = '#2563eb',
  weight = 4,
}: {
  key?: string;
  origin: { lat: number; lng: number };
  stops: Parada[];
  color?: string;
  weight?: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // Filter valid stops
    const validStops = stops.filter(s => s.lat && s.lng && !isNaN(s.lat) && !isNaN(s.lng) && !(s.lat === 0 && s.lng === 0));

    let activePolyline: google.maps.Polyline | null = null;

    // Try tracing via DirectionsService for precise street-following paths
    if (typeof window !== 'undefined' && (window as any).google && (window as any).google.maps) {
      try {
        const directionsService = new google.maps.DirectionsService();
        
        // Match exact geocoded addresses sequence
        const waypointsList = validStops.map(s => ({
          location: new google.maps.LatLng(s.lat, s.lng),
          stopover: true
        }));

        if (waypointsList.length > 0) {
          const originLatLng = new google.maps.LatLng(origin.lat, origin.lng);
          // Destination is the final stop in sequence
          const destLatLng = waypointsList[waypointsList.length - 1].location;
          // Intermediate waypoints
          const intermediateWaypoints = waypointsList.slice(0, -1);

          directionsService.route({
            origin: originLatLng,
            destination: destLatLng,
            waypoints: intermediateWaypoints,
            travelMode: google.maps.TravelMode.DRIVING,
          }, (response, status) => {
            if (status === google.maps.DirectionsStatus.OK && response && response.routes && response.routes[0]) {
              const overviewPath = response.routes[0].overview_path;
              if (overviewPath && overviewPath.length > 0) {
                // Draw precise directions polyline on streets
                activePolyline = new google.maps.Polyline({
                  path: overviewPath,
                  strokeColor: color,
                  strokeOpacity: 0.85,
                  strokeWeight: weight,
                  map,
                });
                console.log(`[Google Directions API] Succeeded. Drawing street-following route path with ${overviewPath.length} dynamic nodes.`);
                return;
              }
            }
            
            // Fallback inside callback if Directions fails
            drawFallbackLine();
          });
        } else {
          drawFallbackLine();
        }
      } catch (err) {
        console.warn('Directions polyline calculation failed, tracing straightforward fallback:', err);
        drawFallbackLine();
      }
    } else {
      drawFallbackLine();
    }

    // Straight-line fallback generator
    function drawFallbackLine() {
      const fallbackPath = [
        origin,
        ...validStops.map(s => ({ lat: s.lat, lng: s.lng }))
      ];
      activePolyline = new google.maps.Polyline({
        path: fallbackPath,
        strokeColor: color,
        strokeOpacity: 0.70,
        strokeWeight: weight - 1,
        map,
      });
    }

    return () => {
      if (activePolyline) {
        activePolyline.setMap(null);
      }
    };
  }, [map, origin, stops, color, weight]);

  return null;
}

// Controller component to center the map when bounds change
function MapCenterController({ 
  bounds 
}: { 
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number } | null 
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || !bounds) return;

    try {
      const googleBounds = new google.maps.LatLngBounds(
        { lat: bounds.minLat, lng: bounds.minLng },
        { lat: bounds.maxLat, lng: bounds.maxLng }
      );
      map.fitBounds(googleBounds);
    } catch (e) {
      console.warn("Could not adjust bounds: ", e);
    }
  }, [map, bounds]);

  return null;
}

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
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'hybrid' | 'terrain'>('roadmap');
  const [selectedStop, setSelectedStop] = useState<{ stop: Parada; routeName: string } | null>(null);
  const [hoveredDriver, setHoveredDriver] = useState<{ driverName: string; location: GPSLocation; plate: string } | null>(null);
  const [driverFilter, setDriverFilter] = useState<{ [drvId: string]: boolean }>({});

  // Local physical layout fallback states
  const [mapLoadError, setMapLoadError] = useState<string | null>(null);
  const [useFallbackMap, setUseFallbackMap] = useState<boolean>(!hasValidKey);
  const [dashOffset, setDashOffset] = useState<number>(0);

  // Sync fallback view status if credentials change
  useEffect(() => {
    setUseFallbackMap(!hasValidKey);
  }, [hasValidKey]);

  // Listen for Google Maps global authorization/billing failure
  useEffect(() => {
    const originalAuthFailure = (window as any).gm_authFailure;
    (window as any).gm_authFailure = () => {
      console.warn("Google Maps Auth/Billing Failure detected. Falling back to Vector grid.");
      setMapLoadError("BillingNotEnabledMapError: O Google Maps retornou erro de faturamento ou expiração de chave. O simulador vetorial foi ativado automaticamente.");
      setUseFallbackMap(true);
      if (originalAuthFailure) {
        try {
          originalAuthFailure();
        } catch (e) {}
      }
    };

    return () => {
      if ((window as any).gm_authFailure === originalAuthFailure) {
        (window as any).gm_authFailure = originalAuthFailure;
      }
    };
  }, []);

  // Vector animation trace
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
      const matchesStatus = selectedStatus === 'all' || r.status === selectedStatus;
      
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
      pts.push({ lat: r.originLat, lng: r.originLng });
      r.stops.forEach(s => pts.push({ lat: s.lat, lng: s.lng }));
      
      const drvLoc = locations[r.driverId];
      if (drvLoc) {
        pts.push({ lat: drvLoc.lat, lng: drvLoc.lng });
      }
    });

    if (singleDriverLocation) {
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
              Acompanhamento Satélite (Google Maps)
            </h4>
            <p className="text-[10px] text-slate-400">Roteador ativo com polilinhas imutáveis e telemetria de precisão.</p>
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

            {/* Map Type toggle */}
            <div className="flex items-center gap-1 border border-slate-250 bg-white px-2 py-1 rounded-lg">
              <select 
                value={mapType}
                onChange={e => setMapType(e.target.value as any)}
                className="bg-transparent font-semibold text-slate-700 outline-none"
                disabled={useFallbackMap}
              >
                <option value="roadmap">Visão do Google</option>
                <option value="satellite">Visão Satélite</option>
                <option value="hybrid">Visão Híbrida</option>
                <option value="terrain">Visão Relevo</option>
              </select>
            </div>

            {/* Google Maps vs Vector fallback toggle button */}
            {hasValidKey && (
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
            )}
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

      {/* Main Row layout composed of Sidebar (if singleRouteMode) + Google Map */}
      <div className="flex-1 flex items-stretch overflow-hidden relative">
        
        {/* Main Google Maps API Canvas */}
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
                      ) : !hasValidKey ? (
                        <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                      <div className="text-[11px] leading-tight">
                        <span className="font-bold">
                          {mapLoadError ? "Back-up: Roteamento Vetorial de Precisão" : !hasValidKey ? "Modo de Back-up Ativado (Sem Chave)" : "Roteamento em Vetor Ativado"}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {mapLoadError 
                             ? "A chave de API inserida retornou erro de acesso (403). Exibindo simulador vetorial." 
                             : !hasValidKey 
                             ? "Configurações (⚙️) -> Secrets -> GOOGLE_MAPS_PLATFORM_KEY para ativar Google Maps." 
                             : "Itinerário geo-espacial construído com vetores de proximidade local em tempo real."}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!hasValidKey && (
                        <a 
                          href="https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded font-bold text-[9px] uppercase tracking-wider transition-colors cursor-pointer"
                        >
                          Obter Chave do Google
                        </a>
                      )}
                      {hasValidKey && (
                        <button
                          onClick={() => {
                            setMapLoadError(null);
                            setUseFallbackMap(false);
                          }}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold text-[9px] uppercase transition-colors cursor-pointer"
                        >
                          Tentar Google Maps
                        </button>
                      )}
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
                    {singleRouteMode && breadcrumbs && breadcrumbs[singleRouteMode.driverId] && (
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
                      if (!trail) return null;
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
                              <circle cx={pt.x} cy={pt.y} r={12} fill="none" stroke="#f59e0b" strokeWidth={2} opacity={0.45} className="animate-pulse" />
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
            <APIProvider 
              apiKey={API_KEY} 
              version="weekly"
              onError={(err) => {
                console.warn("APIProvider load error, fallback to vector grid:", err);
                setMapLoadError(String(err || "Auth error 403 / restricted key"));
                setUseFallbackMap(true);
              }}
            >
              <Map
                defaultCenter={mapCenter}
                defaultZoom={singleRouteMode ? 14 : 12}
                mapTypeId={mapType}
                mapId="ROUTE_MONITOR_MAP_ID"
                internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                style={{ width: '100%', height: '100%' }}
                gestureHandling="cooperative"
                disableDefaultUI={false}
              >
                
                <MapCenterController bounds={bounds} />

              {/* Render Center Warehouse CD Marker for each rendered route */}
              {filteredRoutes.map(r => (
                <AdvancedMarker 
                  key={`wh-${r.id}`}
                  position={{ lat: r.originLat, lng: r.originLng }}
                >
                  <Pin background="#1e3a8a" borderColor="#2563eb" glyphColor="#ffffff" scale={1.1}>
                    <Warehouse className="w-3.5 h-3.5 text-white" />
                  </Pin>
                </AdvancedMarker>
              ))}

              {/* Render Stop Markers */}
              {filteredRoutes.map((r, rIdx) => (
                r.stops.map((stop, idx) => {
                  // Only render dynamically if coordinates are resolved and valid
                  if (!stop.lat || !stop.lng || isNaN(stop.lat) || isNaN(stop.lng) || (stop.lat === 0 && stop.lng === 0)) {
                    return null;
                  }

                  const isCompleted = stop.status === 'completed';
                  const isChegando = stop.status === 'Chegando';
                  const isNextTarget = r.status === 'active' && idx === r.currentStopIndex;

                  return (
                    <AdvancedMarker 
                      key={`stop-${stop.id}`}
                      position={{ lat: stop.lat, lng: stop.lng }}
                      onClick={() => setSelectedStop({ stop, routeName: r.name })}
                    >
                      <div className="relative group cursor-pointer flex flex-col items-center select-none">
                        {/* Interactive Floating Label with sequence number */}
                        <div className="absolute -top-9 bg-slate-900/95 text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-lg whitespace-nowrap opacity-90 group-hover:opacity-100 transition-opacity flex items-center gap-1 border border-slate-700 pointer-events-none z-10">
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] text-white ${
                            isCompleted ? 'bg-slate-500' : isNextTarget ? 'bg-amber-500' : 'bg-blue-500'
                          }`}>
                            {idx + 1}
                          </span>
                          <span>{stop.clientName}</span>
                        </div>
                        
                        {/* Custom Map Pin showing optimized sequence number */}
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 border-white text-white font-extrabold text-[11px] shadow-lg transition-transform group-hover:scale-110 ${
                          isCompleted 
                            ? 'bg-slate-500' 
                            : isChegando
                            ? 'bg-emerald-500 animate-pulse ring-4 ring-emerald-400/30'
                            : isNextTarget 
                            ? 'bg-amber-500 ring-4 ring-amber-400/30 font-black' 
                            : 'bg-blue-600'
                        }`}>
                          {idx + 1}
                        </div>
                        {/* Downward map pin pointer tip */}
                        <div className={`w-2 h-2 -mt-1 rotate-45 border-r border-b border-white ${
                          isCompleted 
                            ? 'bg-slate-500' 
                            : isChegando
                            ? 'bg-emerald-500'
                            : isNextTarget 
                            ? 'bg-amber-500' 
                            : 'bg-blue-600'
                        }`} />
                      </div>
                    </AdvancedMarker>
                  );
                })
              ))}

              {/* Render Route Polylines */}
              {filteredRoutes.map((r, idx) => {
                const colors = ['#2563eb', '#9333ea', '#db2777', '#0d9488', '#ea580c'];
                return (
                  <RoutePolyline 
                    key={`line-${r.id}`}
                    origin={{ lat: r.originLat, lng: r.originLng }}
                    stops={r.stops}
                    color={colors[idx % colors.length]}
                    weight={4}
                  />
                );
              })}

              {/* Render Breadcrumbs for Single Route Driver */}
              {singleRouteMode && breadcrumbs && breadcrumbs[singleRouteMode.driverId] && (
                breadcrumbs[singleRouteMode.driverId].map((pt, pidx) => {
                  const trail = breadcrumbs[singleRouteMode.driverId];
                  const opacity = Math.max(0.2, (pidx + 1) / trail.length * 0.82);
                  const scale = Math.max(0.6, (pidx + 1) / trail.length);
                  return (
                    <AdvancedMarker 
                      key={`bread-single-${singleRouteMode.driverId}-${pidx}`}
                      position={{ lat: pt.lat, lng: pt.lng }}
                    >
                      <div 
                        className="bg-emerald-400 rounded-full border border-white/95 shadow-sm" 
                        style={{
                          width: `${10 * scale}px`,
                          height: `${10 * scale}px`,
                          opacity: opacity
                        }}
                        title="Histórico de GPS Recente (Trilha de Pão)" 
                      />
                    </AdvancedMarker>
                  );
                })
              )}

              {/* Render Breadcrumbs for Multiple Drivers */}
              {!singleRouteMode && breadcrumbs && filteredRoutes.map(r => {
                const trail = breadcrumbs[r.driverId];
                if (!trail) return null;
                return trail.map((pt, pidx) => {
                  const opacity = Math.max(0.2, (pidx + 1) / trail.length * 0.75);
                  const scale = Math.max(0.6, (pidx + 1) / trail.length);
                  return (
                    <AdvancedMarker 
                      key={`bread-multi-${r.driverId}-${pidx}`}
                      position={{ lat: pt.lat, lng: pt.lng }}
                    >
                      <div 
                        className="bg-indigo-400 rounded-full border border-white/80 shadow-sm"
                        style={{
                          width: `${8 * scale}px`,
                          height: `${8 * scale}px`,
                          opacity: opacity
                        }}
                        title={`Histórico da Rota de ${r.driverName}`} 
                      />
                    </AdvancedMarker>
                  );
                });
              })}

              {/* Render Active Driver GPS Markers */}
              {singleRouteMode && singleDriverLocation && (
                <SmoothDriverMarker 
                  position={{ lat: singleDriverLocation.lat, lng: singleDriverLocation.lng }}
                  onClick={() => setHoveredDriver({ 
                    driverName: singleRouteMode.driverName, 
                    location: singleDriverLocation,
                    plate: singleRouteMode.driverPlate
                  })}
                >
                  <div className="cursor-pointer bg-emerald-500 hover:bg-emerald-600 border-2 border-white text-white p-2.5 rounded-full shadow-xl animate-bounce duration-500 flex items-center justify-center">
                    <Truck className="w-5 h-5" />
                  </div>
                </SmoothDriverMarker>
              )}

              {/* Render Multiple Driver Live Markers on Global mode */}
              {!singleRouteMode && filteredRoutes.map(r => {
                const drvLoc = locations[r.driverId];
                if (!drvLoc) return null;

                return (
                  <SmoothDriverMarker 
                    key={`drv-marker-${r.id}-${r.driverId}`}
                    position={{ lat: drvLoc.lat, lng: drvLoc.lng }}
                    onClick={() => setHoveredDriver({
                      driverName: r.driverName,
                      location: drvLoc,
                      plate: r.driverPlate
                    })}
                  >
                    <div className="cursor-pointer bg-indigo-600 border-2 border-white text-white p-2 rounded-xl shadow-lg flex items-center gap-1.5 font-mono text-[10px] font-bold">
                      <Truck className="w-4 h-4 shrink-0" />
                      <span>{r.driverName.split(' ')[0]}</span>
                    </div>
                  </SmoothDriverMarker>
                );
              })}

              {/* InfoWindow for selected stop pin */}
              {selectedStop && (
                <InfoWindow 
                  position={{ lat: selectedStop.stop.lat, lng: selectedStop.stop.lng }}
                  onCloseClick={() => setSelectedStop(null)}
                >
                  <div className="p-1 font-sans text-xs max-w-sm">
                    <div className="flex items-center gap-1 text-slate-800 font-bold mb-1 border-b border-slate-100 pb-1 uppercase text-[10px]">
                      <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      Ponto de Entrega
                    </div>
                    <strong className="text-slate-900 font-semibold block">{selectedStop.stop.clientName}</strong>
                    <p className="text-[10px] text-slate-500 mt-1">{selectedStop.stop.address}</p>
                    <div className="mt-2.5 flex items-center justify-between gap-1 text-[9px] font-semibold">
                      <span className={`px-1.5 py-0.5 rounded ${selectedStop.stop.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                        {selectedStop.stop.status === 'completed' ? 'Entregue ✔' : 'Pendente ⏳'}
                      </span>
                      <span className="text-slate-400 font-normal">Sessão: {selectedStop.routeName}</span>
                    </div>

                    {currentUserRole === 2 && selectedStop.stop.status !== 'completed' && onStopClick && (
                      <button
                        type="button"
                        onClick={() => {
                          onStopClick(selectedStop.stop);
                          setSelectedStop(null);
                        }}
                        className="mt-3 w-full py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-extrabold rounded-lg text-[10px] uppercase shadow-sm transition-all active:scale-95 text-center cursor-pointer tracking-wider"
                      >
                        Confirmar Entrega
                      </button>
                    )}
                  </div>
                </InfoWindow>
              )}

              {/* InfoWindow for selected driver live location */}
              {hoveredDriver && (
                <InfoWindow
                  position={{ lat: hoveredDriver.location.lat, lng: hoveredDriver.location.lng }}
                  onCloseClick={() => setHoveredDriver(null)}
                >
                  <div className="p-1 font-sans text-xs max-w-sm">
                    <div className="flex items-center gap-1.5 text-emerald-700 font-bold mb-1 border-b border-slate-100 pb-1 uppercase text-[10px]">
                      <Signal className="w-3.5 h-3.5 animate-pulse text-emerald-500" />
                      Status de Satélite Ativo
                    </div>
                    <strong className="text-slate-900 block font-semibold">{hoveredDriver.driverName}</strong>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-mono">Placa: {hoveredDriver.plate}</p>
                    <div className="mt-2 bg-slate-50 p-1.5 border border-slate-200/60 rounded-lg grid grid-cols-2 gap-2 text-[9px] font-mono">
                      <div>
                        <span className="text-slate-450 block uppercase">VELOCIDADE:</span>
                        <strong className="text-slate-700 text-xs">{hoveredDriver.location.speed} km/h</strong>
                      </div>
                      <div>
                        <span className="text-slate-450 block uppercase">DIREÇÃO:</span>
                        <strong className="text-slate-700">{Math.round(hoveredDriver.location.heading)}°</strong>
                      </div>
                    </div>
                    <p className="text-[8px] text-slate-400 mt-2 text-right">Ping: {new Date(hoveredDriver.location.lastUpdated).toLocaleTimeString()}</p>
                  </div>
                </InfoWindow>
              )}

            </Map>
          </APIProvider>
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
              Conexões de GPS integradas ao barramento regional.
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
