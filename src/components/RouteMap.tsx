/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, animate } from 'motion/react';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useMap } from '@vis.gl/react-google-maps';
import { Rota, GPSLocation, Parada } from '../types';
import { 
  Truck, MapPin, Navigation, Warehouse, Play, Signal, 
  Filter, Info, ShieldAlert, CheckCircle2, AlertTriangle, HelpCircle, Layers 
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
}

export default function RouteMap({ 
  rotas, 
  locations, 
  currentUserRegion, 
  currentUserRole,
  singleRouteMode = null,
  singleDriverLocation = null,
  breadcrumbs
}: RouteMapProps) {
  
  // States
  const [selectedRegion, setSelectedRegion] = useState<string>(currentUserRegion || 'all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'hybrid' | 'terrain'>('roadmap');
  const [selectedStop, setSelectedStop] = useState<{ stop: Parada; routeName: string } | null>(null);
  const [hoveredDriver, setHoveredDriver] = useState<{ driverName: string; location: GPSLocation; plate: string } | null>(null);
  const [driverFilter, setDriverFilter] = useState<{ [drvId: string]: boolean }>({});

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

  if (!hasValidKey) {
    return (
      <div id="maps-credential-panel" className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl p-8 border border-slate-800 shadow-xl max-w-2xl mx-auto flex flex-col justify-between items-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-5 animate-pulse">
          <ShieldAlert className="w-7 h-7" />
        </div>
        
        <h3 className="text-lg font-extrabold text-slate-100 uppercase tracking-tight">
          Chave da API do Google Maps Requerida
        </h3>
        
        <p className="text-xs text-slate-400 max-w-md mt-2.5 leading-relaxed">
          Para visualizar roteamentos reais, polilinhas de vetores, traçados baseados em satélite e pins georreferenciados interativos de telemetria, configure sua credencial do Google Cloud.
        </p>

        <div className="my-6 p-4 rounded-xl bg-slate-950/80 border border-slate-800/60 text-left w-full space-y-3 font-sans text-xs">
          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-md bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5">1</span>
            <div>
              <strong className="text-slate-200">Adquirir Chave do Google Maps Platform</strong>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Crie um projeto e gere uma chave de API com as bibliotecas do Maps JavaScript habilitadas: <a href="https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Iniciar no Console Cloud</a>
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-md bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5">2</span>
            <div>
              <strong className="text-slate-200">Inserir nos Segredos do AI Studio</strong>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                Clique na engrenagem de configurações <strong className="text-slate-350">Settings (⚙️)</strong> no canto superior direito do workspace de desenvolvimento, selecione <strong className="text-slate-350">Secrets</strong>, crie uma chave com o nome <code className="bg-slate-805 text-amber-300 font-mono text-[9px] px-1 py-0.5 rounded font-bold">GOOGLE_MAPS_PLATFORM_KEY</code>, insira o valor correspondente e confirme.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-850/50 border border-slate-800/80 px-4 py-2.5 rounded-lg text-[11px] text-slate-400 font-mono w-full justify-center">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-ping"></span>
          AGUARDANDO COMPILAÇÃO REATIVA APÓS ADIÇÃO
        </div>
      </div>
    );
  }

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
                  {['GV1', 'GV2', 'GV3', 'ES/MG', 'Norte', 'Sul', '262'].map(r => (
                    <option key={r} value={r}>Região {r}</option>
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
              >
                <option value="roadmap">Mapa Padrão</option>
                <option value="satellite">Visão Satélite</option>
                <option value="hybrid">Visão Híbrida</option>
                <option value="terrain">Visão Relevo</option>
              </select>
            </div>
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
          <APIProvider apiKey={API_KEY} version="weekly">
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
