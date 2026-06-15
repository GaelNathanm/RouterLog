import React, { useState, useEffect } from 'react';

export function NetworkGpsStatusWidget() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [gpsStatus, setGpsStatus] = useState<'high' | 'medium' | 'none'>('high');

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

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
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-[11px] shadow-sm font-sans shrink-0">
      {/* Network Sincronização Status */}
      <div className="flex items-center gap-1.5 pr-3 border-r border-slate-200">
        <span className="relative flex h-2 w-2">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
            isOnline ? 'bg-emerald-400' : 'bg-red-400'
          }`}></span>
          <span className={`relative inline-flex rounded-full h-2 w-2 ${
            isOnline ? 'bg-emerald-500' : 'bg-red-500'
          }`}></span>
        </span>
        <span className={`font-semibold ${isOnline ? 'text-emerald-700' : 'text-red-700'}`}>
          {isOnline ? 'Sincronia: Online' : 'Rede Off-line'}
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
