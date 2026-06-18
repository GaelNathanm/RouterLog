/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { 
  seedDatabaseIfEmpty, saveCloudUser, saveCloudRoute, deleteCloudRoute, 
  saveCloudGPSLocation, saveCloudChat, saveCloudNotification, 
  saveCloudAuditLog, saveCloudPerformanceLog, saveCloudPushLog, 
  resetCloudDatabaseAll, saveCloudRegion, deleteCloudRegion, 
  subscribeToCollection, deleteCloudUser, supabase
} from './supabase';
import { 
  UserRole, RouteUser, Rota, Parada, GPSLocation, 
  ChatMessage, NotificationLog, AuditLogEntry,
  RoutePerformanceLog, PushDeliveryLog, PushConfig, StopTelemetry, Region
} from './types';
import { 
  INITIAL_USERS, INITIAL_ROTAS, INITIAL_LOCATIONS, 
  INITIAL_CHAT, INITIAL_NOTIFICATIONS, INITIAL_AUDIT_LOGS,
  INITIAL_PERFORMANCE_LOGS, INITIAL_PUSH_LOGS, INITIAL_REGIONS
} from './mockData';

const getDistanceInMeters = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371e3; // metres
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
};

export function useRouteLogState() {
  // Local reactive states matched with Firestore Single Source of Truth updates
  const [users, setUsers] = useState<RouteUser[]>(INITIAL_USERS);
  const [rotas, setRotas] = useState<Rota[]>(INITIAL_ROTAS);
  const [locations, setLocations] = useState<{ [driverId: string]: GPSLocation }>(INITIAL_LOCATIONS);
  const [breadcrumbs, setBreadcrumbs] = useState<{ [driverId: string]: { lat: number; lng: number }[] }>(() => {
    const saved = localStorage.getItem('routelog_breadcrumbs');
    return saved ? JSON.parse(saved) : {};
  });
  const [chats, setChats] = useState<ChatMessage[]>(INITIAL_CHAT);
  const [notifications, setNotifications] = useState<NotificationLog[]>(INITIAL_NOTIFICATIONS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);
  const [performanceLogs, setPerformanceLogs] = useState<RoutePerformanceLog[]>(INITIAL_PERFORMANCE_LOGS);
  const [pushLogs, setPushLogs] = useState<PushDeliveryLog[]>(INITIAL_PUSH_LOGS);
  const [regions, setRegions] = useState<Region[]>(INITIAL_REGIONS);

  const [pushConfig, setPushConfig] = useState<PushConfig>(() => {
    const saved = localStorage.getItem('routelog_push_config');
    return saved ? JSON.parse(saved) : {
      fcmToken: 'fcm_token_rl_' + Math.random().toString(36).substring(2, 10),
      fcmServerKey: 'key_fcm_route_log_prod_08e2f89caef3893a',
      apnsSandbox: false,
      status: 'connected' as const
    };
  });

  // Simulator control state
  const [currentUser, setCurrentUser] = useState<RouteUser | null>(() => {
    const saved = localStorage.getItem('routelog_curr_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Admin Impersonation view mode
  const [impersonatingUser, setImpersonatingUser] = useState<RouteUser | null>(() => {
    const saved = localStorage.getItem('routelog_imp_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Tracking reference for live subscriptions and active logs
  const gpsTickRef = useRef<NodeJS.Timeout | null>(null);
  const unsubsRef = useRef<(() => void)[] | null>(null);

  // References for automated GPS coordinate Geofencing tracking
  const previousGeofenceState = useRef<{ [driverId: string]: { [regionId: string]: boolean } }>({});
  const isGeofenceInitDone = useRef(false);

  // Enterprise production control: simulation is disabled in standard daily use operation
  const [isDemoSimulationActive, setIsDemoSimulationActive] = useState<boolean>(false);

  // Sync auxiliary states to localStorage as cache
  useEffect(() => {
    localStorage.setItem('routelog_breadcrumbs', JSON.stringify(breadcrumbs));
  }, [breadcrumbs]);

  useEffect(() => {
    localStorage.setItem('routelog_push_config', JSON.stringify(pushConfig));
  }, [pushConfig]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('routelog_curr_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('routelog_curr_user');
    }
  }, [currentUser]);

  // Sync logged in user status in real-time when snapshot list of users updates (e.g. real-time ban/suspend)
  useEffect(() => {
    if (currentUser) {
      const liveUser = users.find(u => u.id === currentUser.id);
      if (liveUser && liveUser.status !== currentUser.status) {
        console.log(`REALTIME FORCE SYNC: Logged user status transitioned to ${liveUser.status}`);
        setCurrentUser(liveUser);
      }
    }
  }, [users, currentUser]);

  useEffect(() => {
    if (impersonatingUser) {
      localStorage.setItem('routelog_imp_user', JSON.stringify(impersonatingUser));
    } else {
      localStorage.removeItem('routelog_imp_user');
    }
  }, [impersonatingUser]);

  // Service Worker offline persistence synchronization listener
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const handleServiceWorkerMessage = async (event: MessageEvent) => {
        const data = event.data;
        if (!data) return;

        if (data.type === 'SYNC_PENDING_QUEUE') {
          console.log('[useRouteLogState] SW requested syncing of queue:', data.queue);
          for (const item of data.queue) {
            const { routeId, stopId, signatureUrl, photoUrl, completedAt } = item;
            
            // Find current route in latest state
            const route = rotas.find(r => r.id === routeId);
            if (route) {
              const stopIndex = route.stops.findIndex(s => s.id === stopId);
              if (stopIndex !== -1) {
                const updatedStops = [...route.stops];
                updatedStops[stopIndex] = {
                  ...updatedStops[stopIndex],
                  status: 'completed' as const,
                  signatureUrl,
                  photoUrl,
                  completedAt
                };

                let nextIndex = route.currentStopIndex;
                if (stopIndex === route.currentStopIndex) {
                  nextIndex = stopIndex + 1;
                }

                const isRouteFinished = nextIndex >= updatedStops.length;
                const updatedStatus = isRouteFinished ? 'completed' : 'active';

                await handleUpdateRoute(routeId, {
                  stops: updatedStops,
                  currentStopIndex: nextIndex,
                  status: updatedStatus
                });
                console.log(`[useRouteLogState] Successfully synced offline confirmation for route ${routeId}, stop ${stopId}`);
              }
            }
          }
        }
      };

      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
      
      const handleOnline = () => {
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'TRIGGER_SYNC' });
        }
      };
      
      window.addEventListener('online', handleOnline);

      return () => {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
        window.removeEventListener('online', handleOnline);
      };
    }
  }, [rotas]);

  // Supabase Real-Time Subscriptions Setup (Eliminating polling completely)
  useEffect(() => {
    let unsubscribed = false;

    const initSupabaseSync = async () => {
      // Seed if necessary first
      await seedDatabaseIfEmpty();
      if (unsubscribed) return;

      // Subscribe to users with resilient error handling
      const unsubUsers = subscribeToCollection<RouteUser>('users', (list) => {
        setUsers(list);
      }, (err) => {
        console.warn('[Supabase Sync Offline] Users subscription currently unavailable (working with offline/cache data):', err.message);
      });

      // Subscribe to routes with resilient error handling
      const unsubRotas = subscribeToCollection<Rota>('rotas', (list) => {
        setRotas(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      }, (err) => {
        console.warn('[Supabase Sync Offline] Rotas subscription currently unavailable (working with offline/cache data):', err.message);
      });

      // Subscribe to driver current locations with resilient error handling
      const unsubLocations = subscribeToCollection<GPSLocation>('locations', (list) => {
        const map: { [driverId: string]: GPSLocation } = {};
        list.forEach(loc => {
          map[loc.driverId] = loc;
        });
        setLocations(map);
      }, (err) => {
        console.warn('[Supabase Sync Offline] Locations subscription currently unavailable (working with offline/cache data):', err.message);
      });

      // Subscribe to active chats with resilient error handling
      const unsubChats = subscribeToCollection<ChatMessage>('chats', (list) => {
        setChats(list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
      }, (err) => {
        console.warn('[Supabase Sync Offline] Chats subscription currently unavailable (working with offline/cache data):', err.message);
      });

      // Subscribe to notifications with resilient error handling
      const unsubNotifs = subscribeToCollection<NotificationLog>('notifications', (list) => {
        setNotifications(list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      }, (err) => {
        console.warn('[Supabase Sync Offline] Notifications subscription currently unavailable (working with offline/cache data):', err.message);
      });

      // Subscribe to auditLogs with resilient error handling
      const unsubAudits = subscribeToCollection<AuditLogEntry>('audit_logs', (list) => {
        setAuditLogs(list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      }, (err) => {
        console.warn('[Supabase Sync Offline] AuditLogs subscription currently unavailable (working with offline/cache data):', err.message);
      });

      // Subscribe to performanceLogs with resilient error handling
      const unsubPerformance = subscribeToCollection<RoutePerformanceLog>('performance_logs', (list) => {
        setPerformanceLogs(list.sort((a, b) => new Date(b.startTimestamp).getTime() - new Date(a.startTimestamp).getTime()));
      }, (err) => {
        console.warn('[Supabase Sync Offline] PerformanceLogs subscription currently unavailable (working with offline/cache data):', err.message);
      });

      // Subscribe to pushLogs with resilient error handling
      const unsubPushLogs = subscribeToCollection<PushDeliveryLog>('push_logs', (list) => {
        setPushLogs(list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
      }, (err) => {
        console.warn('[Supabase Sync Offline] PushLogs subscription currently unavailable (working with offline/cache data):', err.message);
      });

      // Subscribe to regions with resilient error handling
      const unsubRegions = subscribeToCollection<Region>('regions', (list) => {
        if (list.length > 0) {
          setRegions(list);
        } else {
          setRegions(INITIAL_REGIONS);
        }
      }, (err) => {
        console.warn('[Supabase Sync Offline] Regions subscription currently unavailable (working with offline/cache data):', err.message);
      });

      unsubsRef.current = [
        unsubUsers, unsubRotas, unsubLocations, unsubChats, 
        unsubNotifs, unsubAudits, unsubPerformance, unsubPushLogs, unsubRegions
      ];
    };

    initSupabaseSync();

    return () => {
      unsubscribed = true;
      if (unsubsRef.current) {
        unsubsRef.current.forEach(fn => fn());
      }
    };
  }, []);

  // Supabase Auth Integration and Session Persistence
  useEffect(() => {
    if (!supabase) return;

    const checkCurrentSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user) {
          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          if (profile) {
            setCurrentUser(profile as RouteUser);
          } else {
            // Self-register in users table if matching auth session exists but user row doesn't
            const defaultUser = {
              id: session.user.id,
              name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Operador',
              email: session.user.email || '',
              phone: '',
              address: '',
              role: UserRole.MOTORISTA,
              status: 'active',
              createdAt: new Date().toISOString(),
              region: 'GV1',
              cnh: '',
              cnhCategory: 'B',
              cnhExpiration: '',
              vehicleModel: '',
              plate: ''
            } as any as RouteUser;
            await supabase.from('users').upsert(defaultUser as any);
            setCurrentUser(defaultUser);
          }
        }
      } catch (err) {
        console.warn('[Supabase Session Sync] Session restoring error:', err);
      }
    };

    checkCurrentSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (session && session.user) {
          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          if (profile) {
            setCurrentUser(profile as RouteUser);
          }
        } else if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
        }
      } catch (err) {
        console.error('[Supabase OnAuthStateChange] sync error:', err);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Active user represents the current session (can be impersonated)
  const activeSessionUser = impersonatingUser ? impersonatingUser : currentUser;

  // Real-time GPS movement simulation
  useEffect(() => {
    // Look for active routes and move driver towards the next pending stop sequentially
    gpsTickRef.current = setInterval(() => {
      if (!isDemoSimulationActive) return;
      rotas.forEach(async (rota) => {
        if (rota.status === 'active') {
          const stops = rota.stops;
          const currentStopIdx = rota.currentStopIndex;
          
          if (currentStopIdx < stops.length) {
            const targetStop = stops[currentStopIdx];
            const driverLoc = locations[rota.driverId] || {
              driverId: rota.driverId,
              lat: rota.originLat,
              lng: rota.originLng,
              heading: 0,
              speed: 40,
              lastUpdated: new Date().toISOString()
            };

            if (driverLoc.isSharing === false) {
              // Location sharing is paused! Do not update or simulate movement for this driver.
              return;
            }

            const dLat = targetStop.lat - driverLoc.lat;
            const dLng = targetStop.lng - driverLoc.lng;
            const distance = Math.sqrt(dLat * dLat + dLng * dLng);

            if (distance < 0.003) {
              // Arrived at stop! Complete it.
              const newStops = stops.map((item, idx) => 
                idx === currentStopIdx ? { ...item, status: 'completed' as const } : item
              );
              
              const updatedRota: Rota = {
                ...rota,
                stops: newStops,
                currentStopIndex: currentStopIdx + 1
              };
              await saveCloudRoute(updatedRota);

              // Add notification about delivery
              const newNotif: NotificationLog = {
                id: `notif_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
                region: rota.region,
                title: `Entrega Realizada - Rota ${rota.name}`,
                body: `O motorista ${rota.driverName} completou a entrega para: ${targetStop.clientName}`,
                timestamp: new Date().toISOString(),
                senderName: rota.driverName
              };
              await saveCloudNotification(newNotif);

              // Record Stop Performance Telemetry
              const timeSpent = Math.floor(Math.random() * 11) + 12; // 12-22 min spent
              const departureTime = new Date();
              const arrivalTime = new Date(departureTime.getTime() - timeSpent * 60000);
              
              const pRecord = performanceLogs.find(p => p.routeId === rota.id);
              if (pRecord) {
                const updatedTelemetry: StopTelemetry[] = [
                  ...pRecord.stopTelemetry,
                  {
                    stopId: targetStop.id,
                    clientName: targetStop.clientName,
                    plannedLat: targetStop.lat,
                    plannedLng: targetStop.lng,
                    arrivalTimestamp: arrivalTime.toISOString(),
                    departureTimestamp: departureTime.toISOString(),
                    timeSpentMinutes: timeSpent
                  }
                ];
                
                const hasDeviation = Math.random() > 0.6;
                const addedDist = hasDeviation ? 0.8 : 0.1;
                const nextActualDist = Math.round((pRecord.actualDistanceKm + addedDist) * 10) / 10;
                const nextDeviations = pRecord.routeDeviations + (hasDeviation ? 1 : 0);

                const updatedPerf: RoutePerformanceLog = {
                  ...pRecord,
                  completedStopsCount: pRecord.completedStopsCount + 1,
                  stopTelemetry: updatedTelemetry,
                  actualDistanceKm: nextActualDist,
                  routeDeviations: nextDeviations
                };
                await saveCloudPerformanceLog(updatedPerf);
              }

              // Fire simulated FCM toast push notifications
              const titleStr = 'Entrega Concluída Checklist ✅';
              const bodyStr = `A parada #${currentStopIdx + 1} (${targetStop.clientName}) da rota "${rota.name}" foi concluída. Tempo de permanência: ${timeSpent} minutos.`;
              
              const newPush: PushDeliveryLog = {
                id: `push_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
                title: titleStr,
                body: bodyStr,
                targetRole: UserRole.GERENTE,
                targetRegion: rota.region,
                sentCount: 1,
                timestamp: new Date().toISOString(),
                success: true,
                type: 'status_parada'
              };
              await saveCloudPushLog(newPush);

              window.dispatchEvent(new CustomEvent('fcm_notification_received', {
                detail: {
                  title: titleStr,
                  body: bodyStr,
                  type: 'status_parada',
                  region: rota.region,
                  role: UserRole.GERENTE
                }
              }));

            } else {
              // Move gradually towards the target
              const step = 0.0015;
              const ratio = step / distance;
              const nextLat = driverLoc.lat + dLat * ratio;
              const nextLng = driverLoc.lng + dLng * ratio;
              const angle = Math.atan2(dLng, dLat) * (180 / Math.PI);

              const nextLoc: GPSLocation = {
                driverId: rota.driverId,
                lat: nextLat,
                lng: nextLng,
                heading: angle >= 0 ? angle : 360 + angle,
                speed: 55,
                lastUpdated: new Date().toISOString()
              };
              await saveCloudGPSLocation(nextLoc);

              setBreadcrumbs(prev => {
                const currentList = prev[rota.driverId] || [];
                const updatedList = [...currentList, { lat: nextLat, lng: nextLng }].slice(-50);
                return {
                  ...prev,
                  [rota.driverId]: updatedList
                };
              });

              // Geofencing Check (Alert close drivers)
              const distToStop = getDistanceInMeters(nextLat, nextLng, targetStop.lat, targetStop.lng);
              if (distToStop <= 500 && targetStop.status === 'pending') {
                const updatedStops = stops.map((item, sIdx) => 
                  sIdx === currentStopIdx ? { ...item, status: 'Chegando' as const } : item
                );

                const updatedRota: Rota = {
                  ...rota,
                  stops: updatedStops
                };
                await saveCloudRoute(updatedRota);

                const titleStr = 'Motorista Próximo - Geofence 📍';
                const bodyStr = `O condutor ${rota.driverName} atingiu o raio de 500m do cliente "${targetStop.clientName}". Status atualizado para 'Chegando'.`;

                const newNotif: NotificationLog = {
                  id: `notif_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
                  region: rota.region,
                  title: titleStr,
                  body: bodyStr,
                  timestamp: new Date().toISOString(),
                  senderName: rota.driverName
                };
                await saveCloudNotification(newNotif);

                // Target FCM alerts
                const pushMgr: PushDeliveryLog = {
                  id: `push_${Date.now()}_${Math.floor(Math.random() * 1000000)}_m`,
                  title: titleStr,
                  body: bodyStr,
                  targetRole: UserRole.GERENTE,
                  targetRegion: rota.region,
                  sentCount: 1,
                  timestamp: new Date().toISOString(),
                  success: true,
                  type: 'geofence'
                };
                await saveCloudPushLog(pushMgr);

                const pushVend: PushDeliveryLog = {
                  id: `push_${Date.now()}_${Math.floor(Math.random() * 1000000)}_v`,
                  title: titleStr,
                  body: bodyStr,
                  targetRole: UserRole.VENDEDOR,
                  targetRegion: rota.region,
                  sentCount: 1,
                  timestamp: new Date().toISOString(),
                  success: true,
                  type: 'geofence'
                };
                await saveCloudPushLog(pushVend);

                window.dispatchEvent(new CustomEvent('fcm_notification_received', {
                  detail: { title: titleStr, body: bodyStr, type: 'status_parada', region: rota.region, role: UserRole.GERENTE }
                }));
                window.dispatchEvent(new CustomEvent('fcm_notification_received', {
                  detail: { title: titleStr, body: bodyStr, type: 'status_parada', region: rota.region, role: UserRole.VENDEDOR }
                }));
              }
            }
          } else {
            // Completed all stops! Complete the route
            const updatedRota: Rota = {
              ...rota,
              status: 'completed'
            };
            await saveCloudRoute(updatedRota);

            const newNotif: NotificationLog = {
              id: `notif_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
              region: rota.region,
              title: `Rota Finalizada - ${rota.driverName}`,
              body: `A rota de entregas "${rota.name}" foi totalmente concluída com sucesso!`,
              timestamp: new Date().toISOString(),
              senderName: rota.driverName
            };
            await saveCloudNotification(newNotif);

            const pRecord = performanceLogs.find(p => p.routeId === rota.id);
            if (pRecord) {
              const avgTime = pRecord.stopTelemetry.length > 0 
                ? Math.round(pRecord.stopTelemetry.reduce((sum, s) => sum + s.timeSpentMinutes, 0) / pRecord.stopTelemetry.length)
                : 15;
              const updatedPerf: RoutePerformanceLog = {
                ...pRecord,
                status: 'completed',
                endTimestamp: new Date().toISOString(),
                averageTimePerStopMinutes: avgTime
              };
              await saveCloudPerformanceLog(updatedPerf);
            }

            const titleStr = 'Rota Finalizada com Sucesso 🌍';
            const bodyStr = `A rota regional "${rota.name}" do motorista ${rota.driverName} foi totalmente concluída com sucesso!`;
            
            const pushAll: PushDeliveryLog = {
              id: `push_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
              title: titleStr,
              body: bodyStr,
              targetRole: 'all',
              targetRegion: rota.region,
              sentCount: 3,
              timestamp: new Date().toISOString(),
              success: true,
              type: 'status_parada'
            };
            await saveCloudPushLog(pushAll);

            window.dispatchEvent(new CustomEvent('fcm_notification_received', {
              detail: { title: titleStr, body: bodyStr, type: 'status_parada', region: rota.region, role: 'all' }
            }));
          }
        }
      });
    }, 4500);

    return () => {
      if (gpsTickRef.current) clearInterval(gpsTickRef.current);
    };
  }, [rotas, locations, performanceLogs]);

  // Integrated GPS Geofencing logic: trigger notifications on region enter or exit crossing
  useEffect(() => {
    if (Object.keys(locations).length === 0 || regions.length === 0) return;

    const isFirstRun = !isGeofenceInitDone.current;

    (Object.values(locations) as GPSLocation[]).forEach(async (loc) => {
      const driverId = loc.driverId;
      if (!driverId) return;

      const driverUser = users.find(u => u.id === driverId);
      const driverName = driverUser?.name || 'Motorista';

      if (!previousGeofenceState.current[driverId]) {
        previousGeofenceState.current[driverId] = {};
      }

      regions.forEach(async (reg) => {
        if (!reg.lat || !reg.lng || !reg.radius) return;

        const distance = getDistanceInMeters(loc.lat, loc.lng, reg.lat, reg.lng);
        const isInside = distance <= reg.radius;
        const wasInside = previousGeofenceState.current[driverId][reg.id];

        if (isFirstRun) {
          // Initialize silently on startup
          previousGeofenceState.current[driverId][reg.id] = isInside;
          return;
        }

        const hasPrev = wasInside !== undefined;
        const prevInside = !!wasInside;

        if (isInside && (!hasPrev || !prevInside)) {
          // Entering Geofence crossing!
          previousGeofenceState.current[driverId][reg.id] = true;

          const titleStr = `Entrou na Região: ${reg.id} 🏢`;
          const bodyStr = `O motorista ${driverName} adentrou a área geofenciada da filial "${reg.name}". Raio operacional: ${Math.round(distance)}m.`;

          const newNotif: NotificationLog = {
            id: `notif_geof_in_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
            region: reg.id,
            title: titleStr,
            body: bodyStr,
            timestamp: new Date().toISOString(),
            senderName: 'SISTEMA GEOFENCE'
          };
          await saveCloudNotification(newNotif);

          const pushLog: PushDeliveryLog = {
            id: `push_geof_in_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
            title: titleStr,
            body: bodyStr,
            targetRole: UserRole.GERENTE,
            targetRegion: reg.id,
            sentCount: 1,
            timestamp: new Date().toISOString(),
            success: true,
            type: 'geofence'
          };
          await saveCloudPushLog(pushLog);

          window.dispatchEvent(new CustomEvent('fcm_notification_received', {
            detail: { title: titleStr, body: bodyStr, type: 'status_parada', region: reg.id, role: UserRole.GERENTE }
          }));

        } else if (!isInside && hasPrev && prevInside) {
          // Leaving Geofence crossing!
          previousGeofenceState.current[driverId][reg.id] = false;

          const titleStr = `Saiu da Região: ${reg.id} 🛣️`;
          const bodyStr = `O motorista ${driverName} saiu da área geofenciada da filial "${reg.name}". Distância atual: ${Math.round(distance)}m (Raio geofence: ${reg.radius}m).`;

          const newNotif: NotificationLog = {
            id: `notif_geof_out_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
            region: reg.id,
            title: titleStr,
            body: bodyStr,
            timestamp: new Date().toISOString(),
            senderName: 'SISTEMA GEOFENCE'
          };
          await saveCloudNotification(newNotif);

          const pushLog: PushDeliveryLog = {
            id: `push_geof_out_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
            title: titleStr,
            body: bodyStr,
            targetRole: UserRole.GERENTE,
            targetRegion: reg.id,
            sentCount: 1,
            timestamp: new Date().toISOString(),
            success: true,
            type: 'geofence'
          };
          await saveCloudPushLog(pushLog);

          window.dispatchEvent(new CustomEvent('fcm_notification_received', {
            detail: { title: titleStr, body: bodyStr, type: 'status_parada', region: reg.id, role: UserRole.GERENTE }
          }));
        }
      });
    });

    if (isFirstRun) {
      isGeofenceInitDone.current = true;
    }
  }, [locations, regions, users]);

  // Auth Operations
  const handleLogin = async (email: string, role?: UserRole) => {
    // Handle special master admin bypass
    if (email.toLowerCase() === 'adminzte@email.com') {
      const adminUser = users.find(u => u.email.toLowerCase() === 'adminzte@email.com') || {
        id: 'admin_master_zte',
        name: 'Administrador Master ZTE',
        email: 'adminzte@email.com',
        phone: '+55 (31) 98888-9999',
        address: 'Av. Afonso Pena, 1500 - Belo Horizonte, MG',
        role: UserRole.ADMIN,
        status: 'active',
        createdAt: new Date().toISOString()
      } as RouteUser;

      if (supabase) {
        try {
          await saveCloudUser(adminUser);
        } catch (e) {
          console.warn('Could not save master admin to cloud database, proceeding local', e);
        }
      }
      setCurrentUser(adminUser);
      setImpersonatingUser(null);
      return { success: true, user: adminUser };
    }

    if (supabase) {
      try {
        const defaultPassword = 'Password123!';
        
        // Handle special master admin bypass or pre-register check
        let loginEmail = email;
        if (email === 'admin' || email === 'admin@routelog.com') {
          loginEmail = 'admin@routelog.com';
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password: defaultPassword,
        });

        if (error) {
          // If the profile exists in baseline but not in Auth yet, auto-bootstrap Auth registration
          const matchedUser = users.find(u => u.email.toLowerCase() === loginEmail.toLowerCase());
          if (matchedUser) {
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
              email: loginEmail,
              password: defaultPassword,
              options: {
                data: { name: matchedUser.name }
              }
            });
            if (!signUpError && signUpData.user) {
              const updatedUser = { ...matchedUser, id: signUpData.user.id };
              // Delete old mock record if it was indexed by the old preset id
              if (matchedUser.id !== signUpData.user.id) {
                await supabase.from('users').delete().eq('id', matchedUser.id);
              }
              await supabase.from('users').upsert(updatedUser as any);
              setCurrentUser(updatedUser);
              setImpersonatingUser(null);
              return { success: true, user: updatedUser };
            }
          }
          return { success: false, error: 'Autenticação Supabase falhou: ' + error.message };
        }

        if (data && data.user) {
          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', data.user.id)
            .maybeSingle();

          if (profile) {
            setCurrentUser(profile as RouteUser);
            setImpersonatingUser(null);
            return { success: true, user: profile as RouteUser };
          } else {
            // Re-create user profile row for matching credentials if it went missing
            const matchedUser = users.find(u => u.email.toLowerCase() === loginEmail.toLowerCase()) || {
              id: data.user.id,
              name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'Operador',
              email: loginEmail,
              role: loginEmail.includes('admin') ? UserRole.ADMIN : UserRole.MOTORISTA,
              status: 'active',
              createdAt: new Date().toISOString(),
              region: 'GV1'
            };
            const updatedUser = { ...matchedUser, id: data.user.id };
            await supabase.from('users').upsert(updatedUser as any);
            setCurrentUser(updatedUser as any);
            setImpersonatingUser(null);
            return { success: true, user: updatedUser as any };
          }
        }
      } catch (err: any) {
        console.error('Supabase Auth execution error:', err);
      }
    }

    // Fallback sandbox simulation if supabase is not initialized
    if (email === 'admin' || email === 'admin@routelog.com') {
      const admin = users.find(u => u.role === UserRole.ADMIN) || users[0];
      setCurrentUser(admin);
      setImpersonatingUser(null);
      return { success: true, user: admin };
    }

    const matched = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (matched) {
      if (matched.status === 'banned') {
        return { success: false, error: 'Esta conta foi permanentemente banida da plataforma.' };
      }
      if (matched.status === 'suspended') {
        return { success: false, error: 'Esta conta foi suspensa temporariamente por auditoria.' };
      }
      setCurrentUser(matched);
      setImpersonatingUser(null);
      return { success: true, user: matched };
    }

    return { success: false, error: 'Usuário não encontrado. Crie uma conta ou use logins pré-definidos!' };
  };

  const handleRegister = async (userData: Partial<RouteUser>) => {
    const tempId = `user_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
    const defaultPassword = 'Password123!';
    const email = userData.email || '';

    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email: email,
          password: defaultPassword,
          options: {
            data: { name: userData.name || 'Nova Conta' }
          }
        });

        if (error) {
          console.warn('[Supabase Reg Log] Auth signup error occurred (maybe already registered in cognito/auth?):', error.message);
        }

        const finalId = data?.user?.id || tempId;
        const newUser = {
          id: finalId,
          name: userData.name || 'Nova Conta',
          email: email,
          phone: userData.phone || '',
          address: userData.address || '',
          role: userData.role ?? UserRole.MOTORISTA,
          status: 'active',
          createdAt: new Date().toISOString(),
          ...(userData.role === UserRole.GERENTE ? { region: (userData as any).region || 'GV1' } : {}),
          ...(userData.role === UserRole.VENDEDOR ? { region: (userData as any).region || 'GV1' } : {}),
          ...(userData.role === UserRole.MOTORISTA ? {
            region: (userData as any).region || 'GV1',
            cnh: (userData as any).cnh || '',
            cnhCategory: (userData as any).cnhCategory || 'B',
            cnhExpiration: (userData as any).cnhExpiration || '',
            vehicleModel: (userData as any).vehicleModel || '',
            plate: (userData as any).plate || ''
          } : {})
        } as RouteUser;

        await saveCloudUser(newUser);
        setCurrentUser(newUser);
        return newUser;
      } catch (err) {
        console.error('Supabase registration fail:', err);
      }
    }

    // Local Sandbox Mode
    const newUserLocal = {
      id: tempId,
      name: userData.name || 'Nova Conta',
      email: email,
      phone: userData.phone || '',
      address: userData.address || '',
      role: userData.role ?? UserRole.MOTORISTA,
      status: 'active',
      createdAt: new Date().toISOString(),
      ...(userData.role === UserRole.GERENTE ? { region: (userData as any).region || 'GV1' } : {}),
      ...(userData.role === UserRole.VENDEDOR ? { region: (userData as any).region || 'GV1' } : {}),
      ...(userData.role === UserRole.MOTORISTA ? {
        region: (userData as any).region || 'GV1',
        cnh: (userData as any).cnh || '',
        cnhCategory: (userData as any).cnhCategory || 'B',
        cnhExpiration: (userData as any).cnhExpiration || '',
        vehicleModel: (userData as any).vehicleModel || '',
        plate: (userData as any).plate || ''
      } : {})
    } as RouteUser;

    saveCloudUser(newUserLocal);
    setCurrentUser(newUserLocal);
    return newUserLocal;
  };

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setCurrentUser(null);
    setImpersonatingUser(null);
  };

  const handleImpersonate = async (targetUser: RouteUser | null) => {
    if (!currentUser || currentUser.role !== UserRole.ADMIN) return;
    
    setImpersonatingUser(targetUser);

    if (targetUser) {
      const newAudit: AuditLogEntry = {
        id: `audit_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
        adminId: currentUser.id,
        adminName: currentUser.name,
        action: 'Visualizar Como',
        targetUserId: targetUser.id,
        targetUserName: targetUser.name,
        details: `Simulando interface do usuário: ${targetUser.name} (${UserRole[targetUser.role]})`,
        timestamp: new Date().toISOString()
      };
      await saveCloudAuditLog(newAudit);
    }
  };

  // Moderation Suite
  const handleModerateUser = async (targetUserId: string, action: 'activate' | 'suspend' | 'ban') => {
    if (!currentUser || currentUser.role !== UserRole.ADMIN) return;

    const u = users.find(usr => usr.id === targetUserId);
    if (!u) return;

    const nextStatus = action === 'activate' ? 'active' : action === 'suspend' ? 'suspended' : 'banned';
    const updatedUser = { ...u, status: nextStatus } as RouteUser;

    const newAudit: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
      adminId: currentUser.id,
      adminName: currentUser.name,
      action: action === 'activate' ? 'Ativar Conta' : action === 'suspend' ? 'Suspender Temporariamente' : 'Banimento Permanente',
      targetUserId: u.id,
      targetUserName: u.name,
      details: `Status alterado de ${u.status} para ${nextStatus}.`,
      timestamp: new Date().toISOString()
    };

    await saveCloudUser(updatedUser);
    await saveCloudAuditLog(newAudit);
  };

  const handleUpdateUser = async (updatedUser: RouteUser) => {
    if (!currentUser || currentUser.role !== UserRole.ADMIN) return;

    const newAudit: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
      adminId: currentUser.id,
      adminName: currentUser.name,
      action: 'Editar Ficha Cadastral',
      targetUserId: updatedUser.id,
      targetUserName: updatedUser.name,
      details: `Dados cadastrais de ${updatedUser.name} foram alterados pelo Administrador.`,
      timestamp: new Date().toISOString()
    };

    await saveCloudUser(updatedUser);
    await saveCloudAuditLog(newAudit);
  };

  const handleDeleteUser = async (targetUserId: string) => {
    if (!currentUser || currentUser.role !== UserRole.ADMIN) return;

    const userToDelete = users.find(u => u.id === targetUserId);
    if (!userToDelete) return;

    const newAudit: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
      adminId: currentUser.id,
      adminName: currentUser.name,
      action: 'Excluir Usuário',
      targetUserId: userToDelete.id,
      targetUserName: userToDelete.name,
      details: `Usuário ${userToDelete.name} (${userToDelete.email}) foi excluído definitivamente da base de dados.`,
      timestamp: new Date().toISOString()
    };

    await deleteCloudUser(targetUserId);
    await saveCloudAuditLog(newAudit);

    if (impersonatingUser && impersonatingUser.id === targetUserId) {
      setImpersonatingUser(null);
    }
  };

  const handleSaveRegion = async (region: Region) => {
    if (!currentUser || currentUser.role !== UserRole.ADMIN) return;

    const existing = regions.find(r => r.id === region.id);
    let detailsStr = '';
    let actionStr = '';

    if (existing) {
      actionStr = 'Região Alterada';
      const nameChanged = existing.name !== region.name;
      const descChanged = existing.description !== region.description;
      const changes: string[] = [];
      if (nameChanged) changes.push(`Nome anterior: [${existing.name}] -> Novo nome: [${region.name}]`);
      if (descChanged) changes.push(`Descrição anterior: [${existing.description || ''}] -> Nova descrição: [${region.description || ''}]`);
      
      detailsStr = `Região "${region.id}" atualizada. ${changes.length > 0 ? changes.join(' | ') : 'Sem mudanças estruturais.'}`;
    } else {
      actionStr = 'Região Criada';
      detailsStr = `Nova região "${region.id}" criada pelo Administrador. Nome: [${region.name}] | Território: [${region.description || ''}]`;
    }

    const newAudit: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
      adminId: currentUser.id,
      adminName: currentUser.name,
      action: actionStr,
      targetUserId: 'region_' + region.id,
      targetUserName: region.name,
      details: detailsStr,
      timestamp: new Date().toISOString()
    };

    await saveCloudRegion(region);
    await saveCloudAuditLog(newAudit);
  };

  const handleDeleteRegion = async (regionId: string) => {
    if (!currentUser || currentUser.role !== UserRole.ADMIN) return;

    const reg = regions.find(r => r.id === regionId);
    if (!reg) return;

    const newAudit: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
      adminId: currentUser.id,
      adminName: currentUser.name,
      action: 'Excluir Região',
      targetUserId: 'region_' + regionId,
      targetUserName: reg.name,
      details: `Região "${reg.name}" (${regionId}) foi excluída pelo Administrador.`,
      timestamp: new Date().toISOString()
    };

    await deleteCloudRegion(regionId);
    await saveCloudAuditLog(newAudit);
  };

  const dispatchCustomPush = async (title: string, body: string, selectedRegion: string) => {
    const sender = activeSessionUser?.name || 'Administrador';
    const newNotif: NotificationLog = {
      id: `notif_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
      region: selectedRegion,
      title,
      body,
      timestamp: new Date().toISOString(),
      senderName: sender
    };
    await saveCloudNotification(newNotif);
  };

  // Route Actions
  const handleCreateRoute = (routeData: Partial<Rota>) => {
    if (!activeSessionUser) return;

    const newRoute: Rota = {
      id: `rota_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
      driverId: routeData.driverId || activeSessionUser.id,
      driverName: routeData.driverName || activeSessionUser.name,
      driverPlate: routeData.driverPlate || (activeSessionUser as any).plate || 'RTL-1234',
      name: routeData.name || 'Nova Rota Cadastrada',
      origin: routeData.origin || 'Origem não informada',
      originLat: routeData.originLat ?? -18.845,
      originLng: routeData.originLng ?? -41.945,
      stops: routeData.stops || [],
      status: 'draft',
      currentStopIndex: 0,
      region: routeData.region || (activeSessionUser as any).region || 'GV1',
      createdAt: new Date().toISOString(),
      optimized: routeData.optimized ?? false,
      sentByGerente: routeData.sentByGerente ?? false
    };

    saveCloudRoute(newRoute);
    return newRoute;
  };

  const handleUpdateRoute = async (id: string, updatedFields: Partial<Rota>) => {
    const matched = rotas.find(r => r.id === id);
    if (matched) {
      await saveCloudRoute({ ...matched, ...updatedFields });
    }
  };

  const handleDeleteRoute = async (id: string) => {
    await deleteCloudRoute(id);
  };

  const handleOptimizeRoute = async (stopsList: Parada[], originLat: number, originLng: number): Promise<Parada[]> => {
    if (stopsList.length <= 1) return stopsList;
    try {
      const response = await fetch('/api/google/directions-optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          stops: stopsList,
          originLat,
          originLng
        })
      });
      if (!response.ok) {
        throw new Error('API optimization failed');
      }
      const data = await response.json();
      return data.stops;
    } catch (err) {
      console.warn('Backend optimize failed, utilizing local fallback:', err);
      // Fallback: nearest-neighbor layout
      const sorted: Parada[] = [];
      const remaining = [...stopsList];
      let currLat = originLat;
      let currLng = originLng;

      while (remaining.length > 0) {
        let nearestIdx = 0;
        let minDistance = Infinity;

        for (let i = 0; i < remaining.length; i++) {
          const dLat = remaining[i].lat - currLat;
          const dLng = remaining[i].lng - currLng;
          const d = dLat * dLat + dLng * dLng;
          if (d < minDistance) {
            minDistance = d;
            nearestIdx = i;
          }
        }

        const nextStop = remaining.splice(nearestIdx, 1)[0];
        sorted.push(nextStop);
        currLat = nextStop.lat;
        currLng = nextStop.lng;
      }

      return sorted;
    }
  };

  const handleStartRoute = async (routeId: string) => {
    const r = rotas.find(v => v.id === routeId);
    if (!r) return;

    const updatedRoute: Rota = {
      ...r,
      status: 'active' as const,
      currentStopIndex: 0,
      stops: r.stops.map(s => ({ ...s, status: 'pending' as const }))
    };
    await saveCloudRoute(updatedRoute);

    const newNotif: NotificationLog = {
      id: `notif_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
      region: r.region,
      title: `Nova Rota Iniciada - ${r.driverName}`,
      body: `O motorista ${r.driverName} da placa ${r.driverPlate} às ${new Date().toLocaleTimeString('pt-BR')} iniciou o trajeto: ${r.name}`,
      timestamp: new Date().toISOString(),
      senderName: r.driverName
    };
    await saveCloudNotification(newNotif);

    const initialPerformance: RoutePerformanceLog = {
      id: `perf_${routeId}`,
      routeId: r.id,
      routeName: r.name,
      driverId: r.driverId,
      driverName: r.driverName,
      driverPlate: r.driverPlate,
      region: r.region,
      plannedDistanceKm: parseFloat((r.stops.length * 7.5 + 4.2).toFixed(1)),
      actualDistanceKm: parseFloat((r.stops.length * 7.5 + 4.2).toFixed(1)),
      plannedStopsCount: r.stops.length,
      completedStopsCount: 0,
      startTimestamp: new Date().toISOString(),
      endTimestamp: null,
      stopTelemetry: [],
      routeDeviations: 0,
      averageTimePerStopMinutes: 0,
      status: 'active'
    };
    await saveCloudPerformanceLog(initialPerformance);

    const pushTitle = 'Motorista em Trânsito 🚚';
    const pushBody = `O motorista ${r.driverName} iniciou a rota "${r.name}" na região ${r.region}. Rastreamento ativo!`;

    const newPush: PushDeliveryLog = {
      id: `push_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
      title: pushTitle,
      body: pushBody,
      targetRole: UserRole.GERENTE,
      targetRegion: r.region,
      sentCount: 1,
      timestamp: new Date().toISOString(),
      success: true,
      type: 'rota_iniciada'
    };
    await saveCloudPushLog(newPush);

    window.dispatchEvent(new CustomEvent('fcm_notification_received', {
      detail: {
        title: pushTitle,
        body: pushBody,
        type: 'rota_iniciada',
        region: r.region,
        role: UserRole.GERENTE
      }
    }));

    const nextLoc: GPSLocation = {
      driverId: r.driverId,
      lat: r.originLat,
      lng: r.originLng,
      heading: 0,
      speed: 0,
      lastUpdated: new Date().toISOString()
    };
    await saveCloudGPSLocation(nextLoc);

    setBreadcrumbs(prev => ({
      ...prev,
      [r.driverId]: [{ lat: r.originLat, lng: r.originLng }]
    }));
  };

  const handlePostMessage = async (text: string, audioUrl?: string) => {
    if (!activeSessionUser) return;
    const userRegion = (activeSessionUser as any).region || 'MG';

    const newMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
      senderId: activeSessionUser.id,
      senderName: activeSessionUser.name + (activeSessionUser.role === UserRole.ADMIN ? ' (Admin)' : ''),
      senderRole: activeSessionUser.role,
      region: userRegion,
      message: text,
      audioUrl: audioUrl,
      timestamp: new Date().toISOString()
    };

    await saveCloudChat(newMessage);

    window.dispatchEvent(new CustomEvent('fcm_notification_received', {
      detail: {
        title: `Novo Chat de ${activeSessionUser.name} (${userRegion}) 💬`,
        body: text,
        type: 'urgente_chat',
        region: userRegion,
        role: 'all',
        senderId: activeSessionUser.id
      }
    }));
  };

  const sendSegmentedPush = (
    templateType: 'nova_rota' | 'rota_iniciada' | 'status_parada' | 'urgente_chat' | 'custom',
    profileSegment: 'all' | UserRole,
    regionSegment: string,
    customTitle?: string,
    customBody?: string
  ) => {
    const matchingUsers = users.filter(usr => {
      const roleMatch = profileSegment === 'all' || usr.role === profileSegment;
      const regionMatch = regionSegment === 'all' || (usr as any).region === regionSegment;
      return roleMatch && regionMatch && usr.status === 'active';
    });

    const titleStr = customTitle || (templateType === 'nova_rota' ? 'Nova Rota Atribuída 📦' :
                     templateType === 'rota_iniciada' ? 'Motorista em Trânsito 🚚' :
                     templateType === 'status_parada' ? 'Entrega Concluída Checklist ✅' :
                     templateType === 'urgente_chat' ? 'Mensagem Urgente da Central ⚠️' : 'Alerta de Logística 📢');
                     
    const bodyStr = customBody || (
      templateType === 'nova_rota' ? `Uma nova rota regional planejada foi atribuída no setor ${regionSegment}.` :
      templateType === 'rota_iniciada' ? 'O motorista iniciou sua viagem de entregas. Telemetria ativa.' :
      templateType === 'status_parada' ? 'Uma das paradas programadas foi registrada como entregue.' :
      templateType === 'urgente_chat' ? `Central de Controle emitiu comunicado para ${regionSegment}.` :
      'Notificação push do sistema RouteLog.'
    );

    const newPush: PushDeliveryLog = {
      id: `push_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
      title: titleStr,
      body: bodyStr,
      targetRole: profileSegment,
      targetRegion: regionSegment,
      sentCount: Math.max(1, matchingUsers.length),
      timestamp: new Date().toISOString(),
      success: true,
      type: templateType
    };
    saveCloudPushLog(newPush);

    const newNotif: NotificationLog = {
      id: `notif_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
      region: regionSegment === 'all' ? 'GV1' : regionSegment,
      title: titleStr,
      body: bodyStr,
      timestamp: new Date().toISOString(),
      senderName: activeSessionUser?.name || 'Controle central'
    };
    saveCloudNotification(newNotif);

    window.dispatchEvent(new CustomEvent('fcm_notification_received', {
      detail: {
        title: titleStr,
        body: bodyStr,
        type: templateType,
        region: regionSegment,
        role: profileSegment,
        senderId: activeSessionUser?.id || 'central'
      }
    }));

    return newPush;
  };

  const resetAllData = async () => {
    await resetCloudDatabaseAll();
    setPushConfig({
      fcmToken: 'fcm_token_rl_' + Math.random().toString(36).substring(2, 10),
      fcmServerKey: 'key_fcm_route_log_prod_08e2f89caef3893a',
      apnsSandbox: false,
      status: 'connected'
    });
    setCurrentUser(null);
    setImpersonatingUser(null);
    localStorage.clear();
  };

  return {
    users,
    rotas,
    locations,
    breadcrumbs,
    chats,
    notifications,
    auditLogs,
    performanceLogs,
    setPerformanceLogs,
    pushLogs,
    setPushLogs,
    regions,
    pushConfig,
    setPushConfig,
    sendSegmentedPush,
    currentUser,
    impersonatingUser,
    activeSessionUser,
    handleLogin,
    handleRegister,
    handleLogout,
    handleImpersonate,
    handleModerateUser,
    handleUpdateUser,
    handleDeleteUser,
    handleSaveRegion,
    handleDeleteRegion,
    dispatchCustomPush,
    handleCreateRoute,
    handleUpdateRoute,
    handleDeleteRoute,
    handleOptimizeRoute,
    handleStartRoute,
    handlePostMessage,
    resetAllData,
    isDemoSimulationActive,
    setIsDemoSimulationActive
  };
}
