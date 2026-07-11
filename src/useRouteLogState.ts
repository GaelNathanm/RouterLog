/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { 
  seedDatabaseIfEmpty, saveCloudUser, saveCloudRoute, deleteCloudRoute, 
  saveCloudGPSLocation, saveCloudChat, saveCloudNotification, 
  saveCloudAuditLog, saveCloudPerformanceLog, saveCloudPushLog, 
  resetCloudDatabaseAll, saveCloudRegion, deleteCloudRegion, 
  subscribeToCollection, deleteCloudUser, saveCloudClient, deleteCloudClient, auth,
  getCloudUser, getCloudUserByEmail
} from './supabase';
import { 
  UserRole, RouteUser, Rota, Parada, GPSLocation, 
  ChatMessage, NotificationLog, AuditLogEntry,
  RoutePerformanceLog, PushDeliveryLog, PushConfig, StopTelemetry, Region, MotoristaUser, AdminUser, Cliente
} from './types';
import { 
  INITIAL_USERS, INITIAL_ROTAS, INITIAL_LOCATIONS, 
  INITIAL_CHAT, INITIAL_NOTIFICATIONS, INITIAL_AUDIT_LOGS,
  INITIAL_PERFORMANCE_LOGS, INITIAL_PUSH_LOGS, INITIAL_REGIONS, INITIAL_CLIENTS
} from './mockData';
import { geocodeAddress } from './utils/geocoder';

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
  const [clients, setClients] = useState<Cliente[]>(INITIAL_CLIENTS);
  const [offlineQueueLength, setOfflineQueueLength] = useState<number>(0);

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

  // References for automated GPS coordinate Geofencing tracking
  const previousGeofenceState = useRef<{ [driverId: string]: { [regionId: string]: boolean } }>({});
  const isGeofenceInitDone = useRef(false);

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

  // Firebase Auth and unified session handler
  useEffect(() => {
    if (!auth) return;

    const syncAuthedSession = async (firebaseUser: any) => {
      if (!firebaseUser) return;
      const email = firebaseUser.email;
      const authId = firebaseUser.uid; // Real secure Firebase Auth UUID
      const fullName = firebaseUser.displayName || email?.split('@')[0] || 'Usuário Autenticado';

      if (email) {
        let matchedUser: RouteUser | null = null;
        
        // 1. First, query directly from Firestore by UID to ensure we get the latest data without state race conditions
        matchedUser = await getCloudUser(authId);
        
        // 2. Fallback to searching by email in case we have a pre-existing/pre-seeded profile
        if (!matchedUser) {
          matchedUser = await getCloudUserByEmail(email);
        }

        const isAdminEmail = email.toLowerCase() === 'linkalexanderlink@gmail.com' || email.toLowerCase().includes('admin');

        if (matchedUser) {
          if (matchedUser.status === 'banned' || matchedUser.status === 'suspended') {
            console.warn('[Firebase Auth] User status is not active:', matchedUser.status);
            return;
          }
          if (isAdminEmail && matchedUser.role !== UserRole.ADMIN) {
            console.log('[Firebase Auth] Upgrading user role to ADMIN:', email);
            const oldId = matchedUser.id;
            const upgradedUser: AdminUser = {
              id: authId,
              name: matchedUser.name,
              email: matchedUser.email,
              phone: matchedUser.phone || '',
              address: matchedUser.address || '',
              role: UserRole.ADMIN,
              status: 'active',
              createdAt: matchedUser.createdAt || new Date().toISOString()
            };
            matchedUser = upgradedUser;
            await saveCloudUser(upgradedUser);
            setUsers(prev => prev.map(u => u.id === oldId ? upgradedUser : u));
          } else if (matchedUser.id !== authId) {
            const oldId = matchedUser.id;
            console.log('[Firebase Auth] Migrating user ID from mock to secure auth UUID:', oldId, '->', authId);
            await deleteCloudUser(oldId);
            matchedUser = { ...matchedUser, id: authId };
            await saveCloudUser(matchedUser);

            // Cascade ID updates to ensure assigned rotas are protected under new rules settings
            const affectedRotas = rotas.filter(r => r.driverId === oldId);
            for (const r of affectedRotas) {
              await saveCloudRoute({ ...r, driverId: authId });
            }
          }
          console.log('[Firebase Auth] Matched existing operator profile:', matchedUser);
          setCurrentUser(matchedUser);
        } else {
          // Create new user profile linked with real Auth ID
          const finalRole = isAdminEmail ? UserRole.ADMIN : UserRole.MOTORISTA;
          let newUser: RouteUser;

          if (finalRole === UserRole.ADMIN) {
            newUser = {
              id: authId,
              name: fullName,
              email: email,
              phone: '',
              address: '',
              role: UserRole.ADMIN,
              status: 'active',
              createdAt: new Date().toISOString()
            } as AdminUser;
          } else {
            newUser = {
              id: authId,
              name: fullName,
              email: email,
              phone: '',
              address: '',
              role: UserRole.MOTORISTA,
              status: 'active',
              createdAt: new Date().toISOString(),
              region: 'GV1',
              cnh: 'GGL-' + Math.floor(100000 + Math.random() * 900000),
              cnhCategory: 'B',
              cnhExpiration: '2030-12-31',
              vehicleModel: 'Padrão Real-Auth',
              plate: 'OAU-3921'
            } as MotoristaUser;
          }

          console.log('[Firebase Auth] Creating new authenticated operator profile in database:', newUser);
          await saveCloudUser(newUser);
          setCurrentUser(newUser);

          setUsers(prev => {
            if (prev.some(u => u.email.toLowerCase() === email.toLowerCase() || u.id === authId)) return prev;
            return [...prev, newUser];
          });
        }
      }
    };

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('[Firebase Auth State Changed]:', firebaseUser);
      if (firebaseUser) {
        await syncAuthedSession(firebaseUser);
      } else {
        setCurrentUser(null);
        setImpersonatingUser(null);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [users, rotas]);

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

        if (data.type === 'DELIVERY_QUEUED_SUCCESS') {
          console.log('[useRouteLogState] SW confirmed offline delivery queued:', data.payload);
          setOfflineQueueLength(data.queueLength || 0);
        } else if (data.type === 'SYNC_PENDING_QUEUE') {
          setOfflineQueueLength(0);
          console.log('[useRouteLogState] SW requested syncing of queue:', data.queue);
          for (const item of data.queue) {
            const { routeId, stopId, signatureUrl, photoUrl, completedAt, canhotoPhotoUrl, localPhotoUrl, photoUrls } = item;
            
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
                  canhotoPhotoUrl: canhotoPhotoUrl || undefined,
                  localPhotoUrl: localPhotoUrl || undefined,
                  photoUrls: photoUrls || undefined,
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

  // 1. Database Seeding on Mount
  useEffect(() => {
    seedDatabaseIfEmpty().catch(err => {
      console.warn('[Firestore] Initial seeding failed or was skipped:', err);
    });
  }, []);

  // 2. Synchronous Real-Time Subscriptions Setup (Eliminating polling completely)
  useEffect(() => {
    // Subscribe to users with resilient error handling
    const unsubUsers = subscribeToCollection<RouteUser>('users', (list) => {
      setUsers(list);
    }, (err) => {
      console.warn('[Firestore Sync Offline] Users subscription currently unavailable (working with offline/cache data):', err.message);
    });

    // Subscribe to routes with resilient error handling
    const unsubRotas = subscribeToCollection<Rota>('rotas', (list) => {
      setRotas(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, (err) => {
      console.warn('[Firestore Sync Offline] Rotas subscription currently unavailable (working with offline/cache data):', err.message);
    });

    // Subscribe to driver current locations with resilient error handling
    const unsubLocations = subscribeToCollection<GPSLocation>('locations', (list) => {
      const map: { [driverId: string]: GPSLocation } = {};
      list.forEach(loc => {
        map[loc.driverId] = loc;
      });
      setLocations(map);
    }, (err) => {
      console.warn('[Firestore Sync Offline] Locations subscription currently unavailable (working with offline/cache data):', err.message);
    });

    // Subscribe to active chats with resilient error handling
    const unsubChats = subscribeToCollection<ChatMessage>('chats', (list) => {
      setChats(list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
    }, (err) => {
      console.warn('[Firestore Sync Offline] Chats subscription currently unavailable (working with offline/cache data):', err.message);
    });

    // Subscribe to notifications with resilient error handling
    const unsubNotifs = subscribeToCollection<NotificationLog>('notifications', (list) => {
      setNotifications(list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    }, (err) => {
      console.warn('[Firestore Sync Offline] Notifications subscription currently unavailable (working with offline/cache data):', err.message);
    });

    // Subscribe to auditLogs with resilient error handling
    const unsubAudits = subscribeToCollection<AuditLogEntry>('audit_logs', (list) => {
      setAuditLogs(list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    }, (err) => {
      console.warn('[Firestore Sync Offline] AuditLogs subscription currently unavailable (working with offline/cache data):', err.message);
    });

    // Subscribe to performanceLogs with resilient error handling
    const unsubPerformance = subscribeToCollection<RoutePerformanceLog>('performance_logs', (list) => {
      setPerformanceLogs(list.sort((a, b) => new Date(b.startTimestamp).getTime() - new Date(a.startTimestamp).getTime()));
    }, (err) => {
      console.warn('[Firestore Sync Offline] PerformanceLogs subscription currently unavailable (working with offline/cache data):', err.message);
    });

    // Subscribe to pushLogs with resilient error handling
    const unsubPushLogs = subscribeToCollection<PushDeliveryLog>('push_logs', (list) => {
      setPushLogs(list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
    }, (err) => {
      console.warn('[Firestore Sync Offline] PushLogs subscription currently unavailable (working with offline/cache data):', err.message);
    });

    // Subscribe to regions with resilient error handling
    const unsubRegions = subscribeToCollection<Region>('regions', (list) => {
      setRegions(list);
    }, (err) => {
      console.warn('[Firestore Sync Offline] Regions subscription currently unavailable (working with offline/cache data):', err.message);
    });

    // Subscribe to clients with resilient error handling
    const unsubClients = subscribeToCollection<Cliente>('clients', (list) => {
      setClients(list);
    }, (err) => {
      console.warn('[Firestore Sync Offline] Clients subscription currently unavailable (working with offline/cache data):', err.message);
    });

    // Subscribe to breadcrumbs in real-time
    const unsubBreadcrumbs = subscribeToCollection<{ driverId: string; trail: { lat: number; lng: number; timestamp: string }[] }>('breadcrumbs', (list) => {
      const map: { [driverId: string]: { lat: number; lng: number }[] } = {};
      list.forEach(b => {
        if (b && b.driverId) {
          map[b.driverId] = b.trail || [];
        }
      });
      setBreadcrumbs(map);
    }, (err) => {
      console.warn('[Firestore Sync] Breadcrumbs subscription currently unavailable:', err.message);
    });

    return () => {
      unsubUsers();
      unsubRotas();
      unsubLocations();
      unsubChats();
      unsubNotifs();
      unsubAudits();
      unsubPerformance();
      unsubPushLogs();
      unsubRegions();
      unsubClients();
      unsubBreadcrumbs();
    };
  }, []);

  // Active user represents the current session (can be impersonated)
  const activeSessionUser = impersonatingUser ? impersonatingUser : currentUser;

  // Diagnostic tracing for activeSessionUser role and status
  useEffect(() => {
    if (activeSessionUser) {
      const rawRole = activeSessionUser.role;
      const roleType = typeof rawRole;
      const numericRole = Number(rawRole);
      const isStrictNumberMatch = rawRole === UserRole.ADMIN;
      const isStringZeroMatch = String(rawRole) === '0';
      const isStringAdminTextMatch = String(rawRole).toLowerCase() === 'admin';
      const resolvedIsAdmin = isStrictNumberMatch || isStringZeroMatch || isStringAdminTextMatch;

      console.group('🛡️ [Auth Diagnostic] Active Session Validation');
      console.log('👤 Profile ID:', activeSessionUser.id);
      console.log('👤 Profile Name:', activeSessionUser.name);
      console.log('📬 Profile Email:', (activeSessionUser as any).email || 'No email');
      console.log('🔑 Raw Role Value:', rawRole);
      console.log('⚡ Raw Role JS Type:', roleType);
      console.log('🔢 Parsed Role (Number):', numericRole);
      console.log('🎯 Expected Admin Enum:', UserRole.ADMIN);
      console.log('🔍 Strict Type Match (=== 0):', isStrictNumberMatch);
      console.log('🔍 String "0" Match:', isStringZeroMatch);
      console.log('🔍 Lowercase "admin" Match:', isStringAdminTextMatch);
      console.log('🔥 Resolved isAdmin Final Flag:', resolvedIsAdmin);
      console.log('📋 Resolved Role Name:', UserRole[numericRole] || 'UNDEF');
      console.groupEnd();
    } else {
      console.log('🛡️ [Auth Diagnostic] Active Session status updated: No active session (logged out).');
    }

    console.log('[Auth Diagnostic] Active Session status brief summary:', {
      currentUser: currentUser ? { id: currentUser.id, name: currentUser.name, email: currentUser.email, role: currentUser.role, roleName: UserRole[Number(currentUser.role)] } : null,
      impersonatingUser: impersonatingUser ? { id: impersonatingUser.id, name: impersonatingUser.name, role: impersonatingUser.role } : null,
      activeSessionUser: activeSessionUser ? { id: activeSessionUser.id, name: activeSessionUser.name, role: activeSessionUser.role, roleName: UserRole[Number(activeSessionUser.role)] } : null,
      isAdmin: activeSessionUser ? (Number(activeSessionUser.role) === UserRole.ADMIN || String(activeSessionUser.role) === '0' || String(activeSessionUser.role).toLowerCase() === 'admin') : false
    });
  }, [currentUser, impersonatingUser, activeSessionUser]);

  // Real-time GPS movement simulation is disabled in live production mode
  useEffect(() => {
    // Live system relies purely on actual driver device background GPS telemetry
    return;
    gpsTickRef.current = setInterval(() => {
      if (true) return; // Disabled in live system
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

              // Geofencing Check (Alert close drivers) - 100 meters high-precision virtual fence
              const distToStop = getDistanceInMeters(nextLat, nextLng, targetStop.lat, targetStop.lng);
              if (distToStop <= 100 && targetStop.status === 'pending') {
                const updatedStops = stops.map((item, sIdx) => 
                  sIdx === currentStopIdx ? { ...item, status: 'Chegando' as const, arrivalTime: new Date().toISOString() } : item
                );

                const updatedRota: Rota = {
                  ...rota,
                  stops: updatedStops
                };
                await saveCloudRoute(updatedRota);

                const titleStr = 'Cerca Virtual - Chegada Automatizada 📍';
                const bodyStr = `O condutor ${rota.driverName} entrou na cerca virtual de 100m do cliente "${targetStop.clientName}". Entrada registrada automaticamente às ${new Date().toLocaleTimeString('pt-BR')}.`;

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
  const handleLogin = async (email: string, password?: string, role?: UserRole) => {
    console.log('[Auth Diagnostic] handleLogin triggered:', { email, password, role });
    
    // If Firebase Auth is active and password is provided, try real Firebase authentication first
    if (auth && password && email.includes('@')) {
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;
        if (firebaseUser) {
          const profileEmail = firebaseUser.email;
          const authId = firebaseUser.uid;
          if (profileEmail) {
            let matched = await getCloudUser(authId);
            if (!matched) {
              matched = await getCloudUserByEmail(profileEmail);
            }
            if (matched) {
              if (matched.status === 'banned') {
                return { success: false, error: 'Esta conta foi permanentemente banida da plataforma.' };
              }
              if (matched.status === 'suspended') {
                return { success: false, error: 'Esta conta foi suspensa temporariamente por auditoria.' };
              }
              if (matched.id !== authId) {
                const oldId = matched.id;
                console.log('[Firebase Auth] Migrating user ID on Login:', oldId, '->', authId);
                await deleteCloudUser(oldId);
                matched = { ...matched, id: authId };
                await saveCloudUser(matched);

                // Cascade preassigned routes
                const affectedRotas = rotas.filter(r => r.driverId === oldId);
                for (const r of affectedRotas) {
                  await saveCloudRoute({ ...r, driverId: authId });
                }
              }
              setCurrentUser(matched);
              setImpersonatingUser(null);
              return { success: true, user: matched };
            } else {
              // Fallback: create dynamic operator profile for this authenticated session
              const isManagerEmail = profileEmail.toLowerCase().includes('gerente') || profileEmail.toLowerCase().includes('manager');
              const finalRole = isManagerEmail ? UserRole.GERENTE : UserRole.MOTORISTA;
              const newUser: RouteUser = {
                id: authId,
                name: profileEmail.split('@')[0],
                email: profileEmail,
                phone: '',
                address: '',
                role: finalRole,
                status: 'active',
                createdAt: new Date().toISOString(),
                region: 'GV1',
                ...(finalRole === UserRole.MOTORISTA ? {
                  cnh: 'GGL-' + Math.floor(100000 + Math.random() * 900000),
                  cnhCategory: 'B',
                  cnhExpiration: '2030-12-31',
                  vehicleModel: 'Automático',
                  plate: 'OAU-3921'
                } : {})
              } as any;
              await saveCloudUser(newUser);
              setCurrentUser(newUser);
              setUsers(prev => {
                if (prev.some(u => u.email.toLowerCase() === profileEmail.toLowerCase() || u.id === authId)) return prev;
                return [...prev, newUser];
              });
              return { success: true, user: newUser };
            }
          }
        }
      } catch (err: any) {
        return { success: false, error: `Falha no Firebase: ${err.message}` };
      }
    }

    if (email === 'admin' || email === 'admin@routelog.com') {
      let admin = users.find(u => u.email.toLowerCase() === 'admin@routelog.com' || u.role === UserRole.ADMIN || String(u.role) === '0' || String(u.role).toUpperCase() === 'ADMIN');
      if (!admin || (admin.role !== UserRole.ADMIN && String(admin.role) !== '0')) {
        console.warn('[Auth Diagnostic] Admin not found dynamically or was incorrectly mapped. Falling back to master admin record.');
        admin = INITIAL_USERS.find(u => u.role === UserRole.ADMIN) || {
          id: 'admin_1',
          name: 'Carlos Oliveira (Super Admin)',
          email: 'admin@routelog.com',
          phone: '+55 (31) 98888-1111',
          address: 'Av. Afonso Pena, 1500 - Belo Horizonte, MG',
          role: UserRole.ADMIN,
          status: 'active',
          createdAt: '2026-01-10T08:00:00Z'
        };
      }
      console.log('[Auth Diagnostic] Setting currentUser to admin:', admin);
      setCurrentUser(admin);
      setImpersonatingUser(null);
      return { success: true, user: admin };
    }

    let matched = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!matched) {
      matched = await getCloudUserByEmail(email);
    }
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

    return { success: false, error: 'Usuário não encontrado. Para credenciais reais, forneça uma senha de acesso ou mude para o modo Cadastro.' };
  };

  const handleRegister = async (userData: Partial<RouteUser> & { password?: string }) => {
    let finalId = `user_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
    // If live Firebase Auth connection is active and password is provided, trigger real credentials signUp
    if (auth && userData.password && userData.email) {
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
        if (userCredential.user) {
          finalId = userCredential.user.uid;
        }
      } catch (err: any) {
        throw new Error(`Erro de Registro no Firebase: ${err.message}`);
      }
    }

    const newUser = {
      id: finalId,
      name: userData.name || 'Nova Conta',
      email: userData.email || '',
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
  };

  const handleLogout = async () => {
    if (auth) {
      try {
        await auth.signOut();
      } catch (err) {
        console.error('Error signing out from Firebase:', err);
      }
    }
    setCurrentUser(null);
    setImpersonatingUser(null);
  };

  const handleImpersonate = async (targetUser: RouteUser | null) => {
    const isUserAdmin = currentUser && (Number(currentUser.role) === UserRole.ADMIN || String(currentUser.role) === '0' || String(currentUser.role).toLowerCase() === 'admin');
    if (!isUserAdmin) return;
    
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
    const isUserAdmin = currentUser && (Number(currentUser.role) === UserRole.ADMIN || String(currentUser.role) === '0' || String(currentUser.role).toLowerCase() === 'admin');
    if (!isUserAdmin) return;

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

    // Immediate state update for responsive feedback
    setUsers(prev => prev.map(usr => usr.id === u.id ? updatedUser : usr));
  };

  const handleUpdateUser = async (updatedUser: RouteUser) => {
    const isUserAdmin = currentUser && (Number(currentUser.role) === UserRole.ADMIN || String(currentUser.role) === '0' || String(currentUser.role).toLowerCase() === 'admin');
    if (!isUserAdmin) return;

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

    // Immediate state update for responsive feedback
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
  };

  const handleSelfProfileUpdate = async (updatedUser: RouteUser) => {
    await saveCloudUser(updatedUser);
    
    if (currentUser && currentUser.id === updatedUser.id) {
      setCurrentUser(updatedUser);
    }
    
    if (impersonatingUser && impersonatingUser.id === updatedUser.id) {
      setImpersonatingUser(updatedUser);
    }
    
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));

    const newAudit: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
      adminId: updatedUser.id,
      adminName: updatedUser.name,
      action: 'Editar Perfil Pessoal',
      targetUserId: updatedUser.id,
      targetUserName: updatedUser.name,
      details: `${updatedUser.name} editou seu próprio perfil e dados personalizados.`,
      timestamp: new Date().toISOString()
    };
    await saveCloudAuditLog(newAudit);
  };

  const handleCreateUser = async (userData: Partial<RouteUser>) => {
    const isUserAdmin = currentUser && (Number(currentUser.role) === UserRole.ADMIN || String(currentUser.role) === '0' || String(currentUser.role).toLowerCase() === 'admin');
    if (!isUserAdmin) return;

    const id = `user_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
    const newUser = {
      id,
      name: userData.name || 'Nova Conta',
      email: userData.email || '',
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

    const newAudit: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
      adminId: currentUser.id,
      adminName: currentUser.name,
      action: 'Criar Usuário',
      targetUserId: newUser.id,
      targetUserName: newUser.name,
      details: `Novo usuário ${newUser.name} (${newUser.email}) foi criado pelo Administrador com papel ${UserRole[newUser.role]}.`,
      timestamp: new Date().toISOString()
    };

    await saveCloudUser(newUser);
    await saveCloudAuditLog(newAudit);

    // Immediate state update for responsive feedback
    setUsers(prev => {
      if (prev.some(u => u.id === newUser.id)) return prev;
      return [...prev, newUser];
    });

    return newUser;
  };

  const handleDeleteUser = async (targetUserId: string) => {
    const isUserAdmin = currentUser && (Number(currentUser.role) === UserRole.ADMIN || String(currentUser.role) === '0' || String(currentUser.role).toLowerCase() === 'admin');
    if (!isUserAdmin) return;

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

    // Immediate state update for responsive feedback
    setUsers(prev => prev.filter(u => u.id !== targetUserId));
  };

  const handleSaveRegion = async (region: Region) => {
    const isUserAdmin = currentUser && (Number(currentUser.role) === UserRole.ADMIN || String(currentUser.role) === '0' || String(currentUser.role).toLowerCase() === 'admin');
    if (!isUserAdmin) return;

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

    setRegions(prev => {
      const idx = prev.findIndex(r => r.id === region.id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = region;
        return next;
      } else {
        return [...prev, region];
      }
    });
  };

  const handleDeleteRegion = async (regionId: string) => {
    const activeSessionUser = impersonatingUser ? impersonatingUser : currentUser;
    const isUserAdmin = (currentUser && (Number(currentUser.role) === UserRole.ADMIN || String(currentUser.role) === '0' || String(currentUser.role).toLowerCase() === 'admin')) ||
                        (activeSessionUser && (Number(activeSessionUser.role) === UserRole.ADMIN || String(activeSessionUser.role) === '0' || String(activeSessionUser.role).toLowerCase() === 'admin'));
    
    if (!isUserAdmin) {
      console.warn('[handleDeleteRegion] Unauthorized attempt to delete region:', regionId);
      return;
    }

    const reg = regions.find(r => r.id === regionId);
    const regName = reg ? reg.name : regionId;

    const newAudit: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
      adminId: currentUser?.id || 'admin',
      adminName: currentUser?.name || 'Administrador',
      action: 'Excluir Região',
      targetUserId: 'region_' + regionId,
      targetUserName: regName,
      details: `Região "${regName}" (${regionId}) foi excluída pelo Administrador.`,
      timestamp: new Date().toISOString()
    };

    try {
      await deleteCloudRegion(regionId);
      await saveCloudAuditLog(newAudit);
    } catch (err) {
      console.error('[handleDeleteRegion] Firestore delete failed:', err);
    }

    // Immediate state update for responsive feedback
    setRegions(prev => prev.filter(r => r.id !== regionId));
  };

  const handleSaveClient = async (client: Cliente) => {
    let finalClient = { ...client };
    
    // Always geocode if coordinates are missing, zero, or if the address changed or we want absolute accuracy
    if (!finalClient.lat || !finalClient.lng || finalClient.lat === 0 || finalClient.lng === 0) {
      try {
        const coords = await geocodeAddress(finalClient.address, finalClient.region);
        finalClient.lat = coords.lat;
        finalClient.lng = coords.lng;
      } catch (err) {
        console.error('[handleSaveClient] Geocoding error:', err);
      }
    }

    await saveCloudClient(finalClient);

    const newAudit: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
      adminId: activeSessionUser?.id || 'system',
      adminName: activeSessionUser?.name || 'Sistema',
      action: clients.some(c => c.id === client.id) ? 'Cliente Atualizado' : 'Cliente Criado',
      targetUserId: 'client_' + finalClient.id,
      targetUserName: finalClient.name,
      details: `Cliente ${finalClient.name} no endereço "${finalClient.address}" foi salvo no banco de clientes com coordenadas [${finalClient.lat}, ${finalClient.lng}].`,
      timestamp: new Date().toISOString()
    };
    await saveCloudAuditLog(newAudit);

    // Immediate state update for responsive feedback
    setClients(prev => {
      const idx = prev.findIndex(c => c.id === finalClient.id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = finalClient;
        return next;
      } else {
        return [...prev, finalClient];
      }
    });
  };

  const handleDeleteClient = async (clientId: string) => {
    const matched = clients.find(c => c.id === clientId);
    if (!matched) return;

    await deleteCloudClient(clientId);

    const newAudit: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
      adminId: activeSessionUser?.id || 'system',
      adminName: activeSessionUser?.name || 'Sistema',
      action: 'Cliente Removido',
      targetUserId: 'client_' + clientId,
      targetUserName: matched.name,
      details: `Cliente ${matched.name} foi removido do banco de clientes.`,
      timestamp: new Date().toISOString()
    };
    await saveCloudAuditLog(newAudit);

    // Immediate state update for responsive feedback
    setClients(prev => prev.filter(c => c.id !== clientId));
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

    // Immediate state update for responsive feedback
    setRotas(prev => {
      if (prev.some(r => r.id === newRoute.id)) return prev;
      return [newRoute, ...prev];
    });

    return newRoute;
  };

  const handleUpdateRoute = async (id: string, updatedFields: Partial<Rota>) => {
    const matched = rotas.find(r => r.id === id);
    if (matched) {
      const updatedRoute = { ...matched, ...updatedFields };
      await saveCloudRoute(updatedRoute);

      // Immediate state update for responsive feedback
      setRotas(prev => prev.map(r => r.id === id ? updatedRoute : r));
    }
  };

  const handleDeleteRoute = async (id: string) => {
    await deleteCloudRoute(id);

    // Immediate state update for responsive feedback
    setRotas(prev => prev.filter(r => r.id !== id));
  };

  const handleOptimizeRoute = async (stopsList: Parada[], originLat: number, originLng: number): Promise<Parada[]> => {
    if (stopsList.length <= 1) return stopsList;
    try {
      // 1. Try Gemini AI optimization first (Server-Side)
      const response = await fetch('/api/gemini/optimize-route', {
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
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Gemini optimization failed');
      }
      const data = await response.json();
      return data.stops;
    } catch (err: any) {
      console.warn('Gemini optimization failed, falling back to Google Directions API / TSP:', err);
      try {
        // 2. Fallback to Google Directions API
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
          throw new Error('Google Directions API optimization failed');
        }
        const data = await response.json();
        return data.stops;
      } catch (fallbackErr) {
        console.warn('Google optimization failed, utilizing local fallback:', fallbackErr);
        // 3. Last resort fallback: local nearest-neighbor TSP
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
    handleSelfProfileUpdate,
    handleCreateUser,
    handleDeleteUser,
    handleSaveRegion,
    handleDeleteRegion,
    dispatchCustomPush,
    clients,
    handleSaveClient,
    handleDeleteClient,
    handleCreateRoute,
    handleUpdateRoute,
    handleDeleteRoute,
    handleOptimizeRoute,
    handleStartRoute,
    handlePostMessage,
    resetAllData,
    offlineQueueLength,
    setOfflineQueueLength
  };
}
