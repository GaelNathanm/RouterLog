/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { db, seedDatabaseIfEmpty, saveCloudUser, saveCloudRoute, deleteCloudRoute, saveCloudGPSLocation, saveCloudChat, saveCloudNotification, saveCloudAuditLog, saveCloudPerformanceLog, saveCloudPushLog, resetCloudDatabaseAll } from './firebase';
import { 
  UserRole, RouteUser, Rota, Parada, GPSLocation, 
  ChatMessage, NotificationLog, AuditLogEntry,
  RoutePerformanceLog, PushDeliveryLog, PushConfig, StopTelemetry
} from './types';
import { 
  INITIAL_USERS, INITIAL_ROTAS, INITIAL_LOCATIONS, 
  INITIAL_CHAT, INITIAL_NOTIFICATIONS, INITIAL_AUDIT_LOGS,
  INITIAL_PERFORMANCE_LOGS, INITIAL_PUSH_LOGS
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

  // Firestore Real-Time Subscriptions Setup (Eliminating polling completely)
  useEffect(() => {
    let unsubscribed = false;

    const initFirebaseSync = async () => {
      // Seed if necessary first
      await seedDatabaseIfEmpty();
      if (unsubscribed) return;

      // Subscribe to users
      const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
        const list: RouteUser[] = [];
        snap.forEach(d => list.push(d.data() as RouteUser));
        setUsers(list);
      });

      // Subscribe to routes
      const unsubRotas = onSnapshot(collection(db, 'rotas'), (snap) => {
        const list: Rota[] = [];
        snap.forEach(d => list.push(d.data() as Rota));
        setRotas(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      });

      // Subscribe to driver current locations
      const unsubLocations = onSnapshot(collection(db, 'locations'), (snap) => {
        const map: { [driverId: string]: GPSLocation } = {};
        snap.forEach(d => {
          const loc = d.data() as GPSLocation;
          map[loc.driverId] = loc;
        });
        setLocations(map);
      });

      // Subscribe to active chats
      const unsubChats = onSnapshot(collection(db, 'chats'), (snap) => {
        const list: ChatMessage[] = [];
        snap.forEach(d => list.push(d.data() as ChatMessage));
        setChats(list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
      });

      // Subscribe to notifications
      const unsubNotifs = onSnapshot(collection(db, 'notifications'), (snap) => {
        const list: NotificationLog[] = [];
        snap.forEach(d => list.push(d.data() as NotificationLog));
        setNotifications(list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      });

      // Subscribe to auditLogs
      const unsubAudits = onSnapshot(collection(db, 'auditLogs'), (snap) => {
        const list: AuditLogEntry[] = [];
        snap.forEach(d => list.push(d.data() as AuditLogEntry));
        setAuditLogs(list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      });

      // Subscribe to performanceLogs
      const unsubPerformance = onSnapshot(collection(db, 'performanceLogs'), (snap) => {
        const list: RoutePerformanceLog[] = [];
        snap.forEach(d => list.push(d.data() as RoutePerformanceLog));
        setPerformanceLogs(list.sort((a, b) => new Date(b.startTimestamp).getTime() - new Date(a.startTimestamp).getTime()));
      });

      // Subscribe to pushLogs
      const unsubPushLogs = onSnapshot(collection(db, 'pushLogs'), (snap) => {
        const list: PushDeliveryLog[] = [];
        snap.forEach(d => list.push(d.data() as PushDeliveryLog));
        setPushLogs(list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
      });

      unsubsRef.current = [
        unsubUsers, unsubRotas, unsubLocations, unsubChats, 
        unsubNotifs, unsubAudits, unsubPerformance, unsubPushLogs
      ];
    };

    initFirebaseSync();

    return () => {
      unsubscribed = true;
      if (unsubsRef.current) {
        unsubsRef.current.forEach(fn => fn());
      }
    };
  }, []);

  // Active user represents the current session (can be impersonated)
  const activeSessionUser = impersonatingUser ? impersonatingUser : currentUser;

  // Real-time GPS movement simulation
  useEffect(() => {
    // Look for active routes and move driver towards the next pending stop sequentially
    gpsTickRef.current = setInterval(() => {
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

  // Auth Operations
  const handleLogin = (email: string, role?: UserRole) => {
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

  const handleRegister = (userData: Partial<RouteUser>) => {
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

    saveCloudUser(newUser);
    setCurrentUser(newUser);
    return newUser;
  };

  const handleLogout = () => {
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

    await deleteDoc(doc(db, 'users', targetUserId));
    await saveCloudAuditLog(newAudit);

    if (impersonatingUser && impersonatingUser.id === targetUserId) {
      setImpersonatingUser(null);
    }
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
    handleDeleteUser,
    dispatchCustomPush,
    handleCreateRoute,
    handleUpdateRoute,
    handleDeleteRoute,
    handleOptimizeRoute,
    handleStartRoute,
    handlePostMessage,
    resetAllData
  };
}
