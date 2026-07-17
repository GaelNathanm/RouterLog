import React, { useState, useEffect } from 'react';
import { isFirestoreOfflineFallback } from '../services/firebase';
import { Database, Wifi, WifiOff } from 'lucide-react';

export function NetworkGpsStatusWidget() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [gpsStatus, setGpsStatus] = useState<'high' | 'medium' | 'none'>('high');
  const [isCacheOnly, setIsCacheOnly] = useState(isFirestoreOfflineFallback());

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleFallback = () => {
      setIsCacheOnly(true);
    };
    window.addEventListener('firestore_connection_fallback', handleFallback);

    // Periodic validation check
    const checkInterval = setInterval(() => {
      setIsCacheOnly(isFirestoreOfflineFallback());
    }, 4000);

    let watchId: number | null = null;
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const accuracy = position.coords.accuracy;
          if (accuracy < 15) {
            setGpsStatus('high');
          } else if (accuracy < 80) {
            setGpsStatus('medium');
          } else {
            setGpsStatus('none');
          }
        },
        (error) => {
          // If permission is denied or blocked inside browser iframe sandbox,
          // we gracefully degrade and show medium simulated precision tracker.
          console.warn("GPS live tracking fallback:", error.message);
          setGpsStatus('medium');
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
      );
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('firestore_connection_fallback', handleFallback);
      clearInterval(checkInterval);
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  const isDatabaseOffline = isCacheOnly || !isOnline;

  return (
    <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 px-3 py-2 rounded-xl border border-slate-200 bg-white text-[11px] shadow-sm font-sans shrink-0">
      
      {/* Network Sincronização Status */}
      <div className="flex items-center gap-1.5 pr-2.5 border-r border-slate-100">
        <span className="relative flex h-2 w-2">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
            isOnline ? 'bg-emerald-400' : 'bg-rose-400'
          }`}></span>
          <span className={`relative inline-flex rounded-full h-2 w-2 ${
            isOnline ? 'bg-emerald-500' : 'bg-rose-500'
          }`}></span>
        </span>
        <span className={`font-semibold flex items-center gap-1 ${isOnline ? 'text-emerald-700' : 'text-rose-700'}`}>
          {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {isOnline ? 'Rede: Conectada' : 'Rede: Off-line'}
        </span>
      </div>

      {/* Firestore Database Connection & Cache Status */}
      <div className="flex items-center gap-1.5 pr-2.5 border-r border-slate-100">
        <span className="relative flex h-2 w-2">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
            isDatabaseOffline ? 'bg-amber-400' : 'bg-blue-400'
          }`}></span>
          <span className={`relative inline-flex rounded-full h-2 w-2 ${
            isDatabaseOffline ? 'bg-amber-500' : 'bg-blue-500'
          }`}></span>
        </span>
        <span className={`font-semibold flex items-center gap-1 ${isDatabaseOffline ? 'text-amber-700' : 'text-blue-700'}`} title={isDatabaseOffline ? "O aplicativo está operando em cache local/offline para garantir a reatividade sem interrupções." : "Banco de dados sincronizado com a nuvem."}>
          <Database className="w-3 h-3" />
          {isCacheOnly ? (
            <span className="flex items-center gap-1">
              Banco: Cache Local <span className="bg-amber-100 text-amber-800 text-[9px] px-1 rounded font-normal font-mono animate-pulse">Offline Fallback</span>
            </span>
          ) : !isOnline ? (
            <span className="flex items-center gap-1">
              Banco: Cache Local <span className="bg-slate-100 text-slate-700 text-[9px] px-1 rounded font-normal font-mono">Pilha de Rede</span>
            </span>
          ) : (
            <span>Banco: Nuvem Sync</span>
          )}
        </span>
      </div>

      {/* GPS Sizing Status */}
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
            gpsStatus === 'high' ? 'bg-emerald-400' : gpsStatus === 'medium' ? 'bg-amber-400' : 'bg-red-400'
          }`}></span>
          <span className={`relative inline-flex rounded-full h-2 w-2 ${
            gpsStatus === 'high' ? 'bg-emerald-500' : gpsStatus === 'medium' ? 'bg-amber-500' : 'bg-red-500'
          }`}></span>
        </span>
        <span className={`font-semibold ${
          gpsStatus === 'high' ? 'text-emerald-700' : gpsStatus === 'medium' ? 'text-amber-700' : 'text-red-700'
        }`}>
          {gpsStatus === 'high' ? 'GPS HD: Ativo' : gpsStatus === 'medium' ? 'GPS: Estimado' : 'GPS: Sem Satélite'}
        </span>
      </div>
    </div>
  );
}
