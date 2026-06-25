/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { 
  Truck, Navigation, Signal, Maximize2, 
  Minimize2, Search, AlertCircle, Compass
} from 'lucide-react';
import { Rota, GPSLocation, RouteUser, Region } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface ControlPanelMockMapProps {
  locations: { [driverId: string]: GPSLocation };
  users: RouteUser[];
  rotas: Rota[];
  regions: Region[];
  activeUserRegion?: string;
}

export default function ControlPanelMockMap({ 
  locations, 
  users, 
  rotas, 
  regions,
  activeUserRegion = "all" 
}: ControlPanelMockMapProps) {
  const [isSectionCollapsed, setIsSectionCollapsed] = useState<boolean>(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [hoveredDriverId, setHoveredDriverId] = useState<string | null>(null);
  const [selectedRegionFilter, setSelectedRegionFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Extrapolate list of drivers and enrich with user metadata
  const driversWithTelemetry = useMemo(() => {
    return Object.keys(locations).map(driverId => {
      const liveLoc = locations[driverId];
      const matchUser = users.find(u => u.id === driverId) as any;
      
      // Get route details
      const activeRoute = rotas.find(r => r.driverId === driverId && r.status === 'active');
      
      return {
        driverId,
        lat: liveLoc.lat,
        lng: liveLoc.lng,
        heading: liveLoc.heading || 0,
        speed: liveLoc.speed || 0,
        lastUpdated: liveLoc.lastUpdated,
        isSharing: liveLoc.isSharing !== false,
        name: matchUser?.name || `Motorista #${driverId.slice(-4)}`,
        plate: matchUser?.plate || 'N/A',
        vehicleModel: matchUser?.vehicleModel || 'Veículo Padrão',
        region: matchUser?.region || 'GV1',
        phone: matchUser?.phone || '',
        activeRouteName: activeRoute?.name || null,
        activeRouteStopsCount: activeRoute?.stops.length || 0,
      };
    });
  }, [locations, users, rotas]);

  // Filters based on region option & search state
  const filteredDrivers = useMemo(() => {
    return driversWithTelemetry.filter(d => {
      const matchRegion = selectedRegionFilter === "all" || d.region === selectedRegionFilter;
      const matchSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          d.plate.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          d.vehicleModel.toLowerCase().includes(searchQuery.toLowerCase());
      return matchRegion && matchSearch;
    });
  }, [driversWithTelemetry, selectedRegionFilter, searchQuery]);

  // Compute bounding box dynamic coordinates to map coordinates to screen percentages
  const mapBounds = useMemo(() => {
    const basicDefaultBounds = {
      minLat: -20.5,
      maxLat: -18.5,
      minLng: -44.5,
      maxLng: -40.0
    };

    if (filteredDrivers.length === 0) {
      return basicDefaultBounds;
    }

    // Add warehouse coordinates to bounds to keep things centered
    const boundsPoints = [
      ...filteredDrivers.map(d => ({ lat: d.lat, lng: d.lng })),
      { lat: -18.845, lng: -41.945 }, // CD Governador Valadares
      { lat: -19.932, lng: -43.942 }  // CD Belo Horizonte
    ];

    let minLat = Math.min(...boundsPoints.map(p => p.lat));
    let maxLat = Math.max(...boundsPoints.map(p => p.lat));
    let minLng = Math.min(...boundsPoints.map(p => p.lng));
    let maxLng = Math.max(...boundsPoints.map(p => p.lng));

    // Pad latitude and longitude ranges
    const latSpan = maxLat - minLat;
    const lngSpan = maxLng - minLng;
    const paddingMultiplier = 0.25;

    return {
      minLat: minLat - Math.max(latSpan * paddingMultiplier, 0.15),
      maxLat: maxLat + Math.max(latSpan * paddingMultiplier, 0.15),
      minLng: minLng - Math.max(lngSpan * paddingMultiplier, 0.15),
      maxLng: maxLng + Math.max(lngSpan * paddingMultiplier, 0.15)
    };
  }, [filteredDrivers]);

  // Linear projection helper
  const projectCoordinates = (lat: number, lng: number) => {
    const latSpan = mapBounds.maxLat - mapBounds.minLat;
    const lngSpan = mapBounds.maxLng - mapBounds.minLng;

    const xPercent = ((lng - mapBounds.minLng) / (lngSpan || 1)) * 100;
    // Invert Y direction since latitude goes up and SVG/pixel Y goes down
    const yPercent = 100 - (((lat - mapBounds.minLat) / (latSpan || 1)) * 100);

    return {
      x: `${Math.max(4, Math.min(96, xPercent))}%`,
      y: `${Math.max(4, Math.min(92, yPercent))}%`
    };
  };

  const activeDriverSelected = useMemo(() => {
    return driversWithTelemetry.find(d => d.driverId === selectedDriverId) || null;
  }, [driversWithTelemetry, selectedDriverId]);

  return (
    <div id="control-panel-mock-map-widget" className="bg-white border border-slate-200/90 rounded-2xl shadow-sm mb-6 overflow-hidden flex flex-col">
      {/* Widget Header with telemetries */}
      <div className="bg-slate-50 px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100/50">
            <Compass className="w-4 h-4 animate-spin-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 tracking-tight flex items-center gap-1.5">
              Monitor de Telemetria e Rastreamento Vetorial 
              <span className="p-0.5 px-1.5 bg-emerald-50 text-emerald-600 text-[9px] border border-emerald-100 uppercase rounded-md tracking-wider font-extrabold font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                REDE ATIVA
              </span>
            </h3>
            <p className="text-[10px] text-slate-400">Canal de rastreamento redundante e offline do Centro de Distribuição.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Collapse/Expand state */}
          <button
            id="map-toggle-collapse-btn"
            onClick={() => setIsSectionCollapsed(!isSectionCollapsed)}
            className="p-1.5 text-slate-450 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
            title={isSectionCollapsed ? "Expandir Visualização" : "Recolher Visualização"}
          >
            {isSectionCollapsed ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {!isSectionCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden flex flex-col lg:flex-row h-[420px] divide-y lg:divide-y-0 lg:divide-x divide-slate-100"
          >
            {/* Map Frame Side Panel: Driver Telemetry List with query and filters */}
            <div className="w-full lg:w-72 bg-slate-50 flex flex-col h-full shrink-0">
              {/* Search and regional filter controls */}
              <div className="p-3 border-b border-slate-100 space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <input
                    id="driver-telemetry-search"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar motorista, placa..."
                    className="w-full pl-8 pr-2.5 py-1.5 text-[11px] placeholder:text-slate-400 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-400 transition-colors"
                  />
                </div>

                <div className="flex gap-1">
                  <button
                    id="filter-region-all"
                    onClick={() => setSelectedRegionFilter("all")}
                    className={`flex-1 py-1 px-1.5 rounded-md text-[9px] font-bold uppercase tracking-wider border transition-all ${
                      selectedRegionFilter === "all"
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                        : "bg-white text-slate-500 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    Geral
                  </button>
                  <button
                    id="filter-region-gv"
                    onClick={() => setSelectedRegionFilter("GV1")}
                    className={`flex-1 py-1 px-1.5 rounded-md text-[9px] font-bold uppercase tracking-wider border transition-all ${
                      selectedRegionFilter === "GV1"
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                        : "bg-white text-slate-500 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    GV1
                  </button>
                  <button
                    id="filter-region-mg"
                    onClick={() => setSelectedRegionFilter("ES/MG")}
                    className={`flex-1 py-1 px-1.5 rounded-md text-[9px] font-bold uppercase tracking-wider border transition-all ${
                      selectedRegionFilter === "ES/MG"
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                        : "bg-white text-slate-500 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    ES/MG
                  </button>
                </div>
              </div>

              {/* Dynamic Drivers List */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100/60 p-1">
                {filteredDrivers.length === 0 ? (
                  <div className="text-center py-12 px-4 selection:bg-slate-100">
                    <AlertCircle className="w-5 h-5 text-slate-350 mx-auto mb-1.5" />
                    <span className="text-[10px] text-slate-450 block font-bold uppercase font-mono tracking-wider">Nenhum Frotista Encontrado</span>
                    <p className="text-[9px] text-slate-400 mt-0.5 leading-relaxed">
                      Não há rastreamento correspondente aos critérios aplicados.
                    </p>
                  </div>
                ) : (
                  filteredDrivers.map(driver => {
                    const isSelected = selectedDriverId === driver.driverId;
                    const isHovered = hoveredDriverId === driver.driverId;
                    
                    return (
                      <div
                        id={`driver-card-${driver.driverId}`}
                        key={driver.driverId}
                        onClick={() => setSelectedDriverId(isSelected ? null : driver.driverId)}
                        onMouseEnter={() => setHoveredDriverId(driver.driverId)}
                        onMouseLeave={() => setHoveredDriverId(null)}
                        className={`p-3 rounded-xl cursor-pointer transition-all text-left flex items-start gap-2.5 ${
                          isSelected 
                            ? "bg-indigo-50/100 border border-indigo-100/80 shadow-xs" 
                            : isHovered 
                            ? "bg-slate-100/80" 
                            : "bg-transparent border border-transparent"
                        }`}
                      >
                        <div className={`p-2 rounded-lg shrink-0 transition-colors ${
                          isSelected ? "bg-indigo-100 text-indigo-700" : "bg-slate-200/70 text-slate-500"
                        }`}>
                          <Truck className="w-4 h-4" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-extrabold text-slate-800 truncate block">
                              {driver.name}
                            </span>
                            <span className="p-0.5 px-1 bg-slate-200/70 text-slate-605 text-[8px] rounded font-mono font-bold uppercase tracking-wide">
                              {driver.region}
                            </span>
                          </div>

                          <span className="text-[10px] text-slate-450 block font-mono">
                            {driver.vehicleModel} ({driver.plate})
                          </span>

                          <div className="flex items-center gap-3 mt-1 text-[9px] text-slate-400 font-mono">
                            <span className="flex items-center gap-0.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${driver.speed > 0 ? "bg-emerald-500 animate-pulse" : "bg-amber-400"}`}></span>
                              {driver.speed > 0 ? `${driver.speed} KM/H` : "PARADO"}
                            </span>
                            <span>•</span>
                            <span className="truncate">
                              {driver.activeRouteName ? `Rota: ${driver.activeRouteName}` : "Sem rota"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Simulated 2D Telemetry Space (Interactive Grid Mapping) */}
            <div className="flex-1 bg-slate-950 relative overflow-hidden flex flex-col justify-between">
              
              {/* Alert Overlap indicating Fallback Mode */}
              <div className="absolute top-2.5 left-3 z-10 pointer-events-none select-none max-w-[280px] lg:max-w-md">
                <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 text-amber-400 text-[9px] uppercase font-mono px-2.5 py-1 rounded-full shadow-lg backdrop-blur-xs">
                  <Signal className="w-3 h-3 animate-pulse text-amber-400" />
                  <span>Espaço de Coordenadas de Contingência local</span>
                </div>
              </div>

              <div className="absolute top-2.5 right-3 z-10 pointer-events-none select-none">
                <span className="p-0.5 px-1.5 bg-slate-900/90 border border-slate-800 text-slate-400 text-[8px] uppercase tracking-widest font-mono rounded-md">
                  GRID SCALE: LINEAR PROJECTION
                </span>
              </div>

              {/* Central Map Workspace container with Grid Canvas representation */}
              <div className="flex-1 w-full h-full relative cursor-crosshair">
                
                {/* Background Tech Mesh lines */}
                <div className="absolute inset-0 select-none opacity-[0.22] pointer-events-none">
                  <div className="w-full h-full bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:28px_28px]"></div>
                  {/* Concentric rings from center */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border border-dashed border-slate-800 rounded-full"></div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] h-[440px] border border-dashed border-slate-800/60 rounded-full"></div>
                </div>

                {/* Plot: Distribution Centers (CD Reference points) */}
                {/* CD 1: Governador Valadares */}
                {(selectedRegionFilter === 'all' || selectedRegionFilter === 'GV1') && (
                  <div 
                    id="cd-point-gv"
                    style={{
                      left: projectCoordinates(-18.845, -41.945).x,
                      top: projectCoordinates(-18.845, -41.945).y
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 z-5 group cursor-help transition-all"
                  >
                    <div className="w-3 h-3 bg-blue-500 rounded-full border border-white flex items-center justify-center shadow-lg relative">
                      <div className="absolute -inset-2 bg-blue-500 animate-ping rounded-full opacity-15"></div>
                    </div>
                    {/* Hover label for CD */}
                    <div className="absolute left-4 -top-3 bg-slate-900 border border-slate-800 rounded-md p-1.5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-xl">
                      <span className="text-[10px] font-black text-blue-400 block font-mono">CD GOVERNADOR VALADARES</span>
                      <span className="text-[9px] text-slate-300 block">Sede Operacional Regional</span>
                    </div>
                  </div>
                )}

                {/* CD 2: Belo Horizonte */}
                {(selectedRegionFilter === 'all' || selectedRegionFilter === 'ES/MG') && (
                  <div 
                    id="cd-point-bh"
                    style={{
                      left: projectCoordinates(-19.932, -43.942).x,
                      top: projectCoordinates(-19.932, -43.942).y
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 z-5 group cursor-help transition-all"
                  >
                    <div className="w-3 h-3 bg-indigo-500 rounded-full border border-white flex items-center justify-center shadow-lg relative">
                      <div className="absolute -inset-2 bg-indigo-500 animate-ping rounded-full opacity-15"></div>
                    </div>
                    {/* Hover info for CD */}
                    <div className="absolute left-4 -top-3 bg-slate-900 border border-slate-800 rounded-md p-1.5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-xl">
                      <span className="text-[10px] font-black text-indigo-400 block font-mono">CD BELO HORIZONTE</span>
                      <span className="text-[9px] text-slate-300 block">Sede Região Central & ES/MG</span>
                    </div>
                  </div>
                )}

                {/* Render Driver vehicle coordinates markers */}
                {filteredDrivers.map(d => {
                  const isSelected = selectedDriverId === d.driverId;
                  const isHovered = hoveredDriverId === d.driverId;
                  const coords = projectCoordinates(d.lat, d.lng);
                  const angle = d.heading || 0;

                  return (
                    <div
                      id={`marker-${d.driverId}`}
                      key={d.driverId}
                      style={{
                        left: coords.x,
                        top: coords.y,
                      }}
                      onMouseEnter={() => setHoveredDriverId(d.driverId)}
                      onMouseLeave={() => setHoveredDriverId(null)}
                      onClick={() => setSelectedDriverId(isSelected ? null : d.driverId)}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 z-10 cursor-pointer transition-all ${
                        isSelected ? "z-30 scale-110" : "hover:scale-105"
                      }`}
                    >
                      {/* Interactive pulsed ring around vehicle based on selection state */}
                      <div className={`absolute -inset-3.5 rounded-full transition-all duration-300 ${
                        isSelected 
                          ? "bg-indigo-500/25 border border-indigo-400 animate-ping" 
                          : isHovered 
                          ? "bg-slate-200/10 border border-slate-700/50" 
                          : "bg-transparent border border-transparent"
                      }`}></div>

                      {/* Direction pin pointer */}
                      <div className={`p-2 rounded-xl border flex items-center justify-center relative shadow-xl transition-colors ${
                        isSelected 
                          ? "bg-indigo-600 text-white border-white" 
                          : isHovered 
                          ? "bg-indigo-500 text-white border-indigo-400" 
                          : "bg-slate-900 text-slate-200 border-slate-800 hover:border-indigo-400"
                      }`}>
                        
                        {/* Heading arrow representing active displacement heading direction */}
                        <div 
                          style={{ transform: `rotate(${angle}deg)` }}
                          className="absolute -top-1.5 -right-1.5 bg-slate-900 border border-slate-700 text-emerald-400 p-0.5 rounded-full"
                        >
                          <Navigation className="w-2 h-2 fill-current" />
                        </div>

                        <Truck className="w-3.5 h-3.5" />
                      </div>

                      {/* Floating tooltip block above pin */}
                      <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2 shadow-2xl transition-all duration-200 whitespace-nowrap select-none pointer-events-none ${
                        isSelected || isHovered ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-1"
                      }`}>
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                          <span className="text-[10px] font-extrabold text-white block truncate">
                            {d.name}
                          </span>
                          <span className="text-[9px] px-1 bg-slate-800 text-slate-400 rounded">
                            {d.region}
                          </span>
                        </div>
                        
                        <div className="text-[9px] text-slate-400 leading-tight mt-0.5 font-mono">
                          <div>Lat: {d.lat.toFixed(5)} / Lng: {d.lng.toFixed(5)}</div>
                          <div>Velocidade: <span className="text-emerald-400 font-bold">{d.speed} km/h</span></div>
                          {d.activeRouteName && (
                            <div className="text-indigo-400 uppercase text-[8px] font-black mt-0.5">
                              {d.activeRouteName} ({d.activeRouteStopsCount} paradas)
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Telemetry readouts block inside telemetry grid map */}
              <div className="bg-slate-900/40 border-t border-slate-800 px-4 py-2 flex items-center justify-between text-left shrink-0 select-none pointer-events-none">
                <div className="flex gap-4">
                  <div className="text-slate-500 text-[9px] uppercase tracking-wider font-mono">
                    Frotistas Monitorados: 
                    <span className="text-slate-300 font-black font-sans ml-1 text-[10px]/none">
                      {driversWithTelemetry.length}
                    </span>
                  </div>
                  <div className="text-slate-500 text-[9px] uppercase tracking-wider font-mono">
                    Rotas Ativas: 
                    <span className="text-slate-300 font-black font-sans ml-1 text-[10px]/none">
                      {rotas.filter(r => r.status === 'active').length}
                    </span>
                  </div>
                </div>
                
                <div className="text-[9px] text-slate-500 font-mono flex items-center gap-1 truncate max-w-[200px] lg:max-w-none">
                  {activeDriverSelected ? (
                    <span className="text-indigo-400 animate-pulse truncate font-semibold">
                      FOCADO: {activeDriverSelected.name} ({activeDriverSelected.plate}) • {activeDriverSelected.speed} km/h
                    </span>
                  ) : (
                    <span>Selecione um frotista ao lado para ancorar telemetria</span>
                  )}
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
