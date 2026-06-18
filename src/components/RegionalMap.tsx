/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Truck, MapPin, Navigation, Warehouse, Play, Signal, Eye, Info } from 'lucide-react';
import { Rota, GPSLocation, Parada, RouteUser, UserRole } from '../types';

interface RegionalMapProps {
  rotas: Rota[];
  locations: { [driverId: string]: GPSLocation };
  region: string;
  breadcrumbs?: { [driverId: string]: { lat: number; lng: number }[] };
}

export default function RegionalMap({ rotas, locations, region, breadcrumbs }: RegionalMapProps) {
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{ label: string; details: string; x: number; y: number } | null>(null);

  // Filter routes of this region
  const regionalRoutes = useMemo(() => {
    return rotas.filter(r => r.region === region && r.status === 'active');
  }, [rotas, region]);

  // GV1 vs MG coordinates
  const bounds = useMemo(() => {
    if (region === 'ES/MG') {
      return { minLat: -20.309455, maxLat: -19.925, minLng: -40.409505, maxLng: -40.409305 };
    }
    // Default GV1
    return { minLat: -20.309455, maxLat: -20.309205, minLng: -40.409505, maxLng: -43.945 };
  }, [region]);

  // SVG Projector
  const project = (lat: number, lng: number) => {
    const width = 600;
    const height = 340;
    const padding = 50;

    const latSpan = bounds.maxLat - bounds.minLat;
    const lngSpan = bounds.maxLng - bounds.minLng;

    const x = padding + ((lng - bounds.minLng) / lngSpan) * (width - padding * 2);
    const y = height - padding - ((lat - bounds.minLat) / latSpan) * (height - padding * 2);

    return { 
      x: isNaN(x) ? width / 2 : Math.max(padding, Math.min(width - padding, x)), 
      y: isNaN(y) ? height / 2 : Math.max(padding, Math.min(height - padding, y)) 
    };
  };

  // Coordinates of our Center Warehouse
  const originCoord = useMemo(() => {
    if (regionalRoutes.length > 0) {
      return { lat: regionalRoutes[0].originLat, lng: regionalRoutes[0].originLng };
    }
    return region === 'ES/MG' 
      ? { lat: -20.309455, lng: -40.409505 } 
      : { lat: -18.845, lng: -41.945 };
  }, [regionalRoutes, region]);

  const originProj = project(originCoord.lat, originCoord.lng);

  return (
    <div id="regional-visual-map" className="bg-slate-950 rounded-xl relative border border-slate-900 overflow-hidden flex flex-col h-full select-text shadow-sm">
      
      {/* Absolute Header Overlay */}
      <div className="absolute top-3 left-4 right-4 flex items-center justify-between z-10 pointer-events-none">
        <div className="flex items-center gap-1.5 bg-slate-900/95 border border-slate-850 text-slate-200 text-[10px] uppercase font-mono px-3 py-1 rounded-full shadow-lg backdrop-blur-md">
          <Warehouse className="w-3 h-3 text-blue-500 shrink-0" />
          Coordenação Regional: <span className="text-blue-400 font-bold ml-0.5">{region}</span>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-900/95 border border-slate-850 text-emerald-400 text-[10px] uppercase font-mono px-3 py-1 rounded-full shadow-lg backdrop-blur-md">
          <Signal className="w-3.5 h-3.5 animate-pulse shrink-0" />
          Frotistas Ativos: {regionalRoutes.length}
        </div>
      </div>

      {/* Main Interactive Map Frame */}
      <div className="flex-1 min-h-[300px] relative">
        <svg className="w-full h-full min-h-[300px] bg-slate-950">
          {/* Ambient Coordinates grid layout */}
          <g stroke="#1b253b" strokeWidth="0.5">
            <line x1="15%" y1="0" x2="15%" y2="100%" />
            <line x1="30%" y1="0" x2="30%" y2="100%" strokeDasharray="3 3" />
            <line x1="45%" y1="0" x2="45%" y2="100%" />
            <line x1="60%" y1="0" x2="60%" y2="100%" strokeDasharray="3 3" />
            <line x1="75%" y1="0" x2="75%" y2="100%" />
            <line x1="90%" y1="0" x2="90%" y2="100%" strokeDasharray="3 3" />
            
            <line x1="0" y1="20%" x2="100%" y2="20%" />
            <line x1="0" y1="40%" x2="100%" y2="40%" strokeDasharray="3 3" />
            <line x1="0" y1="60%" x2="100%" y2="60%" />
            <line x1="0" y1="80%" x2="100%" y2="80%" strokeDasharray="3 3" />
          </g>

          {/* Render Breadcrumbs (Trilha de Pão / Recent Geographic History) */}
          {breadcrumbs && regionalRoutes.map((route, rIdx) => {
            const trail = breadcrumbs[route.driverId];
            if (!trail || trail.length === 0) return null;
            
            const dotColor = rIdx % 2 === 0 ? '#60a5fa' : '#c084fc';
            
            return (
              <g key={`trail-group-${route.driverId}`}>
                {trail.map((pt, pidx) => {
                  const { x, y } = project(pt.lat, pt.lng);
                  const opacity = Math.max(0.15, (pidx + 1) / trail.length * 0.7);
                  const radius = Math.max(1.5, (pidx + 1) / trail.length * 3.5);
                  
                  return (
                    <circle
                      key={`trail-pt-${route.driverId}-${pidx}`}
                      cx={x}
                      cy={y}
                      r={radius}
                      fill={dotColor}
                      opacity={opacity}
                      className="transition-all duration-300"
                    />
                  );
                })}
              </g>
            );
          })}

          {/* Render Route Polylines */}
          {regionalRoutes.map((route, rIdx) => {
            const locProj = route.stops.map(s => project(s.lat, s.lng));
            const pathPoints = [
              `${originProj.x},${originProj.y}`,
              ...locProj.map(p => `${p.x},${p.y}`)
            ].join(' ');

            // Alternate colors for distinct routes
            const strokeColor = rIdx % 2 === 0 ? '#3b82f6' : '#a855f7';
            const hoverStrokeColor = rIdx % 2 === 0 ? '#2563eb' : '#9333ea';
            const isSelected = selectedDriverId === route.driverId;

            return (
              <g key={route.id} className="transition-all">
                {/* Glow route path */}
                <polyline
                  points={pathPoints}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={isSelected ? "5" : "3.5"}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeOpacity={isSelected ? "0.45" : "0.2"}
                />
                <polyline
                  points={pathPoints}
                  fill="none"
                  stroke={isSelected ? hoverStrokeColor : strokeColor}
                  strokeWidth={isSelected ? "3" : "2"}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="6 4"
                  className="animate-[dash_15s_linear_infinite]"
                />
              </g>
            );
          })}

          {/* Render Warehouse Center */}
          <g transform={`translate(${originProj.x}, ${originProj.y})`}>
            <circle r="14" fill="#3b82f6" className="animate-ping opacity-15" />
            <circle r="9" fill="#1d4ed8" stroke="#ffffff" strokeWidth="1.5" />
            <circle r="3" fill="#ffffff" />
          </g>

          {/* Render stops for all regional routes */}
          {regionalRoutes.map(route => {
            return route.stops.map((stop, sIdx) => {
              const { x, y } = project(stop.lat, stop.lng);
              const isCompleted = stop.status === 'completed';
              const isCurrent = route.currentStopIndex === sIdx;

              return (
                <g 
                  key={stop.id} 
                  transform={`translate(${x}, ${y})`}
                  onMouseEnter={() => setHoveredPoint({
                    label: stop.clientName,
                    details: `Status: ${stop.status === 'completed' ? 'Entregue ✅' : 'Pendente ⏳'} (Parada #${sIdx + 1} de ${route.driverName})\nEndereço: ${stop.address}`,
                    x,
                    y
                  })}
                  onMouseLeave={() => setHoveredPoint(null)}
                  className="cursor-pointer"
                >
                  {isCurrent && (
                    <circle r="12" fill="#eab308" className="animate-ping opacity-30" />
                  )}
                  {/* Pinhead shape */}
                  <path
                    d="M0 -12 C-5 -12 -8 -9 -8 -4 C-8 2 0 8 0 8 C0 8 8 2 8 -4 C8 -9 5 -12 0 -12 Z"
                    fill={isCompleted ? '#64748b' : isCurrent ? '#d97706' : '#3b82f6'}
                    stroke="#ffffff"
                    strokeWidth="1.2"
                  />
                  <text x="0" y="-5.5" textAnchor="middle" fill="#ffffff" className="font-mono text-[8px] font-bold">
                    {sIdx + 1}
                  </text>
                </g>
              );
            });
          })}

          {/* Render Driver live locations */}
          {regionalRoutes.map((route, rIdx) => {
            const driverLoc = locations[route.driverId];
            if (!driverLoc) return null;

            const { x, y } = project(driverLoc.lat, driverLoc.lng);
            const isSelected = selectedDriverId === route.driverId;
            const headingAngle = driverLoc.heading - 90;

            const iconColors = rIdx % 2 === 0 ? '#3b82f6' : '#a855f7';

            return (
              <g
                key={route.driverId}
                transform={`translate(${x}, ${y})`}
                onClick={() => setSelectedDriverId(isSelected ? null : route.driverId)}
                onMouseEnter={() => setHoveredPoint({
                  label: route.driverName,
                  details: `Placa: ${route.driverPlate} | Vel: ${driverLoc.speed} km/h\nParada Atual: ${route.stops[route.currentStopIndex]?.clientName || 'Concluído'}`,
                  x,
                  y
                })}
                onMouseLeave={() => setHoveredPoint(null)}
                className="cursor-pointer"
              >
                {/* Sensors pulse ring */}
                <circle r="22" fill={iconColors} className="animate-ping opacity-10" />
                
                {/* Truck arrow direction cone */}
                <g transform={`rotate(${headingAngle})`}>
                  <polygon points="-6,-3 0,-15 6,-3" fill={iconColors} opacity="0.45" />
                  <rect x="-8" y="-8" width="16" height="16" rx="3.5" fill={isSelected ? '#10b981' : iconColors} stroke="#ffffff" strokeWidth="1.5" />
                  {/* Windshield */}
                  <rect x="-5" y="-5" width="10" height="3" fill="#ffffff" opacity="0.8" />
                </g>

                {/* Floating Driver Label */}
                <g transform="translate(0, 18)">
                  <rect x="-40" y="-7" width="80" height="12" rx="3" fill="#0f172a" stroke="#334155" strokeWidth="0.5" />
                  <text textAnchor="middle" y="2" fill="#f8fafc" className="font-mono text-[8px] font-bold">
                    {route.driverName.split(' ')[0]}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>

        {/* Live popup details rendering on hovering */}
        {hoveredPoint && (
          <div 
            style={{ 
              left: `${Math.min(380, hoveredPoint.x + 10)}px`, 
              top: `${Math.min(235, hoveredPoint.y - 45)}px` 
            }}
            className="absolute bg-slate-900 border border-slate-800 text-slate-100 p-2.5 rounded-lg text-[10px] max-w-[210px] shadow-xl pointer-events-none z-50 font-sans"
          >
            <strong className="text-blue-400 block font-semibold mb-0.5">{hoveredPoint.label}</strong>
            <p className="text-slate-350 leading-normal whitespace-pre-line">{hoveredPoint.details}</p>
          </div>
        )}

        {/* Selected driver detail panel overlay */}
        {selectedDriverId && (() => {
          const matchedRoute = regionalRoutes.find(r => r.driverId === selectedDriverId);
          const matchedLoc = locations[selectedDriverId];
          if (!matchedRoute || !matchedLoc) return null;

          const progress = matchedRoute.stops.length > 0
            ? Math.round((matchedRoute.stops.filter(s => s.status === 'completed').length / matchedRoute.stops.length) * 100)
            : 0;

          return (
            <div className="absolute bottom-3 left-3 right-3 bg-slate-905 border border-slate-800/80 rounded-xl p-3 select-text shadow-2xl backdrop-blur-md text-xs text-slate-200">
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-800/60">
                <div className="flex items-center gap-1.5 font-bold">
                  <Truck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{matchedRoute.driverName}</span>
                  <span className="font-mono text-[10px] text-slate-450">({matchedRoute.driverPlate})</span>
                </div>
                <button 
                  onClick={() => setSelectedDriverId(null)}
                  className="font-mono text-[9px] text-slate-400 hover:text-white cursor-pointer hover:bg-slate-800/50 px-1.5 py-0.5 rounded"
                >
                  X
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] font-mono leading-relaxed mt-1">
                <div>
                  <span className="text-slate-500 block">DURAÇÃO / KM:</span>
                  <strong className="text-slate-200">Roteamento {region}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">VELOCIDADE:</span>
                  <strong className="text-emerald-400">{matchedLoc.speed} km/h</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">ATIVO EM:</span>
                  <strong className="text-slate-200 truncate block max-w-[120px]">{matchedRoute.name}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">PROGRESSO:</span>
                  <div className="flex items-center gap-1">
                    <div className="flex-1 bg-slate-850 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full" style={{ width: `${progress}%` }}></div>
                    </div>
                    <strong>{progress}%</strong>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Fallback info when no active route is detected in this region */}
        {regionalRoutes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-slate-950/80">
            <div className="w-11 h-11 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-2">
              <Navigation className="w-5 h-5 animate-pulse" />
            </div>
            <strong className="text-xs text-slate-300 block uppercase tracking-wider">Monitoramento Desativado</strong>
            <p className="text-[11px] text-slate-500 max-w-xs mt-1.5 leading-relaxed">
              Não há caminhões ou motoristas transmitindo coordenadas de posicionamento satélite ativo na região <strong className="text-slate-400 font-medium">{region}</strong> no momento.
            </p>
          </div>
        )}
      </div>

      <div className="bg-slate-900 border-t border-slate-850/60 p-2 text-center text-[9px] font-mono text-slate-500 flex justify-between px-3">
        <span>● CLICK ON ANY TRUCK TO PIN TELEMETRY CARD OVERLAY</span>
        <span>SYS CODE: [FCM_GEO_REACTIVITY]</span>
      </div>
    </div>
  );
}
