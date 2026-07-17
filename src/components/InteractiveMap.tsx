/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Truck, MapPin, Navigation, Warehouse, Play, Signal } from 'lucide-react';
import { Rota, GPSLocation, Parada } from '../types';

interface MapProps {
  rota: Rota | null;
  driverLocation: GPSLocation | null;
  region: string;
  onStopClick?: (stop: Parada) => void;
}

function InteractiveMap({ rota, driverLocation, region, onStopClick }: MapProps) {
  
  // GV1 Region Default Bounding Box
  const boundingDefaults: Record<string, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
    GV1: { minLat: -20.302529, maxLat: -20.394869, minLng: -40.401693, maxLng: -40.365705 },
    MG: { minLat: -19.945, maxLat: -19.920, minLng: -43.950, maxLng: -43.930 }
  };

  const bounds = useMemo(() => {
    const activeRegion = region || 'GV1';
    const def = boundingDefaults[activeRegion] || boundingDefaults.GV1;

    if (!rota) return def;

    // Collate all points to compute accurate bounds, filtering out invalid values (0 or NaNs)
    const pts = [
      { lat: rota.originLat, lng: rota.originLng },
      ...rota.stops
        .filter(s => s.lat && s.lng && !isNaN(s.lat) && !isNaN(s.lng) && s.lat !== 0 && s.lng !== 0)
        .map(s => ({ lat: s.lat, lng: s.lng })),
      ...(driverLocation ? [{ lat: driverLocation.lat, lng: driverLocation.lng }] : [])
    ].filter(p => p.lat && p.lng && !isNaN(p.lat) && !isNaN(p.lng) && p.lat !== 0 && p.lng !== 0);

    if (pts.length === 0) return def;

    let minLat = Math.min(...pts.map(p => p.lat));
    let maxLat = Math.max(...pts.map(p => p.lat));
    let minLng = Math.min(...pts.map(p => p.lng));
    let maxLng = Math.max(...pts.map(p => p.lng));

    // Add padding
    const latPad = Math.max((maxLat - minLat) * 0.15, 0.005);
    const lngPad = Math.max((maxLng - minLng) * 0.15, 0.005);

    return {
      minLat: minLat - latPad,
      maxLat: maxLat + latPad,
      minLng: minLng - lngPad,
      maxLng: maxLng + lngPad
    };
  }, [rota, driverLocation, region]);

  // Coordinate Projector (linear mapping to SVG coords 600x380)
  const project = (lat: number, lng: number) => {
    const width = 600;
    const height = 340;
    const padding = 40;

    const latSpan = bounds.maxLat - bounds.minLat;
    const lngSpan = bounds.maxLng - bounds.minLng;

    // SVG y goes downwards, so invert lat
    const x = padding + ((lng - bounds.minLng) / (lngSpan || 1)) * (width - padding * 2);
    const y = height - padding - ((lat - bounds.minLat) / (latSpan || 1)) * (height - padding * 2);

    return { x: isNaN(x) ? width / 2 : x, y: isNaN(y) ? height / 2 : y };
  };

  const polylinePoints = useMemo(() => {
    if (!rota) return '';
    const originProj = project(rota.originLat, rota.originLng);
    const stopsProj = rota.stops
      .filter(s => s.lat && s.lng && !isNaN(s.lat) && !isNaN(s.lng) && s.lat !== 0 && s.lng !== 0)
      .map(s => project(s.lat, s.lng));

    return [
      `${originProj.x},${originProj.y}`,
      ...stopsProj.map(p => `${p.x},${p.y}`)
    ].join(' ');
  }, [rota, bounds]);

  return (
    <div id="vector-map-frame" className="bg-slate-950 rounded-xl relative border border-slate-900 overflow-hidden flex flex-col h-full">
      {/* Map Header Status Overlay */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10 pointer-events-none">
        <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 text-slate-200 text-[10px] uppercase font-mono px-2.5 py-1 rounded-full shadow-lg backdrop-blur-md">
          <span className={`w-2 h-2 rounded-full ${rota?.status === 'active' ? 'bg-amber-500 animate-pulse' : 'bg-slate-500'}`}></span>
          Region: {region || 'Default'}
        </div>

        {driverLocation && (
          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 text-emerald-400 text-[10px] uppercase font-mono px-2.5 py-1 rounded-full shadow-lg backdrop-blur-md">
            <Signal className="w-3.5 h-3.5 animate-pulse shrink-0" />
            Live GPS Active ({driverLocation.speed} km/h)
          </div>
        )}
      </div>

      {/* Main Map SVG Board */}
      <div className="flex-1 min-h-[290px] relative">
        <svg className="w-full h-full min-h-[290px] bg-slate-950 select-none">
          {/* Ambient Grid Lines */}
          <g stroke="#1e293b" strokeWidth="0.5">
            <line x1="10%" y1="0" x2="10%" y2="100%" />
            <line x1="20%" y1="0" x2="20%" y2="100%" strokeDasharray="5 5" />
            <line x1="30%" y1="0" x2="30%" y2="100%" />
            <line x1="40%" y1="0" x2="40%" y2="100%" strokeDasharray="5 5" />
            <line x1="50%" y1="0" x2="50%" y2="100%" />
            <line x1="60%" y1="0" x2="60%" y2="100%" strokeDasharray="5 5" />
            <line x1="70%" y1="0" x2="70%" y2="100%" />
            <line x1="80%" y1="0" x2="80%" y2="100%" strokeDasharray="5 5" />
            <line x1="90%" y1="0" x2="90%" y2="100%" />
            
            <line x1="0" y1="20%" x2="100%" y2="20%" />
            <line x1="0" y1="40%" x2="100%" y2="40%" />
            <line x1="0" y1="60%" x2="100%" y2="60%" />
            <line x1="0" y1="80%" x2="100%" y2="80%" />
          </g>

          {/* SVG Road Layout Lines Simulation */}
          <g stroke="#0f172a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none">
            {rota && (
              <>
                <path d={`M 50,220 Q 250,90 400,200 T 550,150`} />
                <path d={`M 120,40 L 120,300`} strokeDasharray="3 3" strokeWidth="2" stroke="#1e293b" />
                <path d={`M 480,45 L 480,310`} strokeDasharray="3 3" strokeWidth="2" stroke="#1e293b" />
              </>
            )}
          </g>

          {/* Render Route Trajectory Polyline */}
          {rota && polylinePoints && (
            <>
              {/* Route Glow Path */}
              <polyline
                points={polylinePoints}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity="0.3"
              />
              {/* Core Active Path */}
              <polyline
                points={polylinePoints}
                fill="none"
                stroke="#2563eb"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={rota.status === 'active' ? '8 4' : 'none'}
                className={rota.status === 'active' ? 'animate-[dash_15s_linear_infinite]' : ''}
              />
            </>
          )}

          {/* Render Origin Warehouse Center */}
          {rota && (
            <g transform={`translate(${project(rota.originLat, rota.originLng).x}, ${project(rota.originLat, rota.originLng).y})`}>
              <circle r="14" fill="#1e293b" stroke="#2563eb" strokeWidth="1.5" className="animate-ping opacity-20" />
              <circle r="10" fill="#1e3a8a" stroke="#2563eb" strokeWidth="2" />
              {/* Small Warehouse visual */}
              <circle r="3" fill="#ffffff" />
            </g>
          )}

          {/* Render Stops Pins */}
          {rota?.stops.map((stop, index) => {
            if (!stop.lat || !stop.lng || isNaN(stop.lat) || isNaN(stop.lng) || (stop.lat === 0 && stop.lng === 0)) {
              return null;
            }
            const { x, y } = project(stop.lat, stop.lng);
            const isCompleted = stop.status === 'completed';
            const isNextTarget = rota.status === 'active' && index === rota.currentStopIndex;

            return (
              <g 
                key={stop.id} 
                transform={`translate(${x}, ${y})`} 
                className="cursor-pointer group select-none"
                onClick={() => onStopClick?.(stop)}
              >
                <title>{`Clique para confirmar entrega para ${stop.clientName}`}</title>
                {/* Ping wave for target stop */}
                {isNextTarget && (
                  <circle r="16" fill="#f59e0b" stroke="#f59e0b" strokeWidth="2" className="animate-ping opacity-35" />
                )}

                {/* Pin pinhead */}
                <path
                  d="M0 -15 C-6 -15 -10 -11 -10 -5 C-10 2 0 10 0 10 C0 10 10 2 10 -5 C10 -11 6 -15 0 -15 Z"
                  fill={isCompleted ? '#475569' : isNextTarget ? '#d97706' : '#2563eb'}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
                
                {/* Stop Serial Number */}
                <text x="0" y="-7.5" textAnchor="middle" fill="#ffffff" className="font-mono text-[9px] font-bold">
                  {index + 1}
                </text>

                {/* Mini client name label display on hover */}
                <text x="0" y="22" textAnchor="middle" fill="#94a3b8" className="text-[9px] font-sans font-medium">
                  {stop.clientName}
                </text>
              </g>
            );
          })}

          {/* Render Active Moving Truck (Vehicle) */}
          {driverLocation && (
            <g 
              transform={`translate(${project(driverLocation.lat, driverLocation.lng).x}, ${project(driverLocation.lat, driverLocation.lng).y}) rotate(${driverLocation.heading - 90})`}
              className="transition-all duration-300 ease-out"
            >
              {/* Truck Ping Sensor Aura */}
              <circle r="22" fill="#10b981" stroke="#10b981" strokeWidth="1.5" className="animate-ping opacity-15" />
              
              {/* Direction compass cone */}
              <polygon points="-8,-4 0,-18 8,-4" fill="#059669" opacity="0.4" />

              <rect x="-9" y="-9" width="18" height="18" rx="4" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" className="shadow-lg" />
              
              {/* Truck internal windshield */}
              <rect x="-6" y="-6" width="12" height="4" fill="#ffffff" opacity="0.8" />
            </g>
          )}
        </svg>

        {/* Floating Mini Compass Card */}
        {rota && (
          <div className="absolute bottom-3 left-3 bg-slate-900/90 border border-slate-800 p-2 rounded-lg text-[9px] font-mono text-slate-400 max-w-[140px] pointer-events-none">
            <div className="text-slate-200 uppercase font-semibold text-[10px] mb-1 flex items-center gap-1">
              <Warehouse className="w-3.5 h-3.5 text-blue-400" />
              CD {region || 'GV1'}
            </div>
            <p className="line-clamp-1">{rota.origin}</p>
          </div>
        )}

        {/* Fallback Display if no active route is running */}
        {!rota && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center select-text">
            <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center text-slate-500 mb-3 border border-slate-800">
              <Navigation className="w-5 h-5 animate-pulse" />
            </div>
            <h4 className="text-slate-200 text-xs font-semibold uppercase tracking-wider">Aguardando Início de Viagem</h4>
            <p className="text-[11px] text-slate-500 max-w-[280px] mt-1.5 leading-relaxed">
              As transmissões e polylines GPS reativas são geradas logo que o motorista clicar em <strong className="text-slate-400 font-medium">Iniciar Rota</strong> na equipe regional.
            </p>
          </div>
        )}
      </div>

      {/* Telemetry Footer Dashboard */}
      {driverLocation && (
        <div className="bg-slate-900 border-t border-slate-800/80 p-3 grid grid-cols-3 gap-2 text-center text-xs font-mono text-slate-300 select-text">
          <div className="border-r border-slate-800/50">
            <span className="text-[9px] text-slate-500 uppercase block">Velocidade</span>
            <strong className="text-emerald-400 text-sm">{driverLocation.speed}</strong> km/h
          </div>
          <div className="border-r border-slate-800/50">
            <span className="text-[9px] text-slate-500 uppercase block">Direção (CNH)</span>
            <strong className="text-slate-200">{Math.round(driverLocation.heading)}°</strong> {driverLocation.heading > 315 || driverLocation.heading <= 45 ? 'Norte' : driverLocation.heading > 45 && driverLocation.heading <= 135 ? 'Leste' : driverLocation.heading > 135 && driverLocation.heading <= 225 ? 'Sul' : 'Oeste'}
          </div>
          <div>
            <span className="text-[9px] text-slate-500 uppercase block">Último Ping</span>
            <span className="text-slate-400 text-[10px]">{new Date(driverLocation.lastUpdated).toLocaleTimeString('pt-BR')}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(InteractiveMap, (prevProps, nextProps) => {
  if (prevProps.region !== nextProps.region) return false;

  const prevLoc = prevProps.driverLocation;
  const nextLoc = nextProps.driverLocation;
  if (!prevLoc !== !nextLoc) return false;
  if (prevLoc && nextLoc) {
    if (
      prevLoc.lat !== nextLoc.lat ||
      prevLoc.lng !== nextLoc.lng ||
      prevLoc.heading !== nextLoc.heading ||
      prevLoc.speed !== nextLoc.speed
    ) {
      return false; // main coordinates changed
    }
  }

  const prevRota = prevProps.rota;
  const nextRota = nextProps.rota;
  if (!prevRota !== !nextRota) return false;
  if (prevRota && nextRota) {
    if (prevRota.id !== nextRota.id) return false;
    if (prevRota.status !== nextRota.status) return false;
    if (prevRota.currentStopIndex !== nextRota.currentStopIndex) return false;
    if (prevRota.originLat !== nextRota.originLat || prevRota.originLng !== nextRota.originLng) return false;
    
    if (prevRota.stops.length !== nextRota.stops.length) return false;
    for (let i = 0; i < prevRota.stops.length; i++) {
      const pS = prevRota.stops[i];
      const nS = nextRota.stops[i];
      if (
        pS.id !== nS.id ||
        pS.status !== nS.status ||
        pS.lat !== nS.lat ||
        pS.lng !== nS.lng
      ) {
        return false; // stops or coordinates changed
      }
    }
  }

  return true; // no changes of coordinates or status, skip render!
});

