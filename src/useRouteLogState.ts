/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { 
  UserRole, RouteUser, Rota, Parada, GPSLocation, 
  ChatMessage, NotificationLog, AuditLogEntry,
  RoutePerformanceLog, PushDeliveryLog, PushConfig, StopTelemetry
} from './types';
import { 
  INITIAL_USERS, INITIAL_ROTAS, INITIAL_LOCATIONS, 
  INITIAL_CHAT, INITIAL_NOTIFICATIONS, INITIAL_AUDIT_LOGS,
  INITIAL_PERFORMANCE_LOGS, INITIAL_PUSH_LOGS, INITIAL_NOTIF_TEMPLATES
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
  const [users, setUsers] = useState<RouteUser[]>(() => {
    const saved = localStorage.getItem('routelog_users');
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  });

  const [rotas, setRotas] = useState<Rota[]>(() => {
    const saved = localStorage.getItem('routelog_rotas');
    return saved ? JSON.parse(saved) : INITIAL_ROTAS;
  });

  const [locations, setLocations] = useState<{ [driverId: string]: GPSLocation }>(() => {
    const saved = localStorage.getItem('routelog_locations');
    return saved ? JSON.parse(saved) : INITIAL_LOCATIONS;
  });

  const [breadcrumbs, setBreadcrumbs] = useState<{ [driverId: string]: { lat: number; lng: number }[] }>(() => {
    const saved = localStorage.getItem('routelog_breadcrumbs');
    return saved ? JSON.parse(saved) : {};
  });

  const [chats, setChats] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('routelog_chats');
    return saved ? JSON.parse(saved) : INITIAL_CHAT;
  });

  const [notifications, setNotifications] = useState<NotificationLog[]>(() => {
    const saved = localStorage.getItem('routelog_notifications');
    return saved ? JSON.parse(saved) : INITIAL_NOTIFICATIONS;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => {
    const saved = localStorage.getItem('routelog_audit');
    return saved ? JSON.parse(saved) : INITIAL_AUDIT_LOGS;
  });

  const [performanceLogs, setPerformanceLogs] = useState<RoutePerformanceLog[]>(() => {
    const saved = localStorage.getItem('routelog_performance');
    return saved ? JSON.parse(saved) : INITIAL_PERFORMANCE_LOGS;
  });

  const [pushLogs, setPushLogs] = useState<PushDeliveryLog[]>(() => {
    const saved = localStorage.getItem('routelog_push_logs');
    return saved ? JSON.parse(saved) : INITIAL_PUSH_LOGS;
  });

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
    if (saved) return JSON.parse(saved);
    // Default to a driver to showcase flows easily (or none to show login screen)
    return null;
  });

  // Admin Impersonation view mode
  const [impersonatingUser, setImpersonatingUser] = useState<RouteUser | null>(() => {
    const saved = localStorage.getItem('routelog_imp_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Tracking the interval for simulated real-time GPS movement of active drivers
  const gpsTickRef = useRef<NodeJS.Timeout | null>(null);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem('routelog_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('routelog_rotas', JSON.stringify(rotas));
  }, [rotas]);

  useEffect(() => {
    localStorage.setItem('routelog_locations', JSON.stringify(locations));
  }, [locations]);

  useEffect(() => {
    localStorage.setItem('routelog_breadcrumbs', JSON.stringify(breadcrumbs));
  }, [breadcrumbs]);

  useEffect(() => {
    localStorage.setItem('routelog_chats', JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    localStorage.setItem('routelog_notifications', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem('routelog_audit', JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    localStorage.setItem('routelog_performance', JSON.stringify(performanceLogs));
  }, [performanceLogs]);

  useEffect(() => {
    localStorage.setItem('routelog_push_logs', JSON.stringify(pushLogs));
  }, [pushLogs]);

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

  useEffect(() => {
    if (impersonatingUser) {
      localStorage.setItem('routelog_imp_user', JSON.stringify(impersonatingUser));
    } else {
      localStorage.removeItem('routelog_imp_user');
    }
  }, [impersonatingUser]);

  // Active user represents the current session (can be impersonated)
  const activeSessionUser = impersonatingUser ? impersonatingUser : currentUser;

  // Real-time GPS movement simulation
  useEffect(() => {
    // Look for active routes and move driver towards the next pending stop sequentially
    gpsTickRef.current = setInterval(() => {
      setRotas(prevRotas => {
        let updated = false;
        const newRotas = prevRotas.map(rota => {
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

              // Interpolate coordinate step
              const dLat = targetStop.lat - driverLoc.lat;
              const dLng = targetStop.lng - driverLoc.lng;
              const distance = Math.sqrt(dLat * dLat + dLng * dLng);

              // Speeds and offsets
              if (distance < 0.003) {
                // Arrived at stop! Complete it.
                updated = true;
                const newStops = stops.map((item, idx) => 
                  idx === currentStopIdx ? { ...item, status: 'completed' as const } : item
                );
                
                // Add notification about delivery
                setNotifications(prevNotifs => [
                  {
                    id: `notif_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
                    region: rota.region,
                    title: `Entrega Realizada - Rota ${rota.name}`,
                    body: `O motorista ${rota.driverName} completou a entrega para: ${targetStop.clientName}`,
                    timestamp: new Date().toISOString(),
                    senderName: rota.driverName
                  },
                  ...prevNotifs
                ]);

                // Record Stop Performance Telemetry
                const timeSpent = Math.floor(Math.random() * 11) + 12; // 12-22 min spent
                const departureTime = new Date();
                const arrivalTime = new Date(departureTime.getTime() - timeSpent * 60000);
                
                setPerformanceLogs(prevPerf => {
                  return prevPerf.map(p => {
                    if (p.routeId === rota.id) {
                      const updatedTelemetry: StopTelemetry[] = [
                        ...p.stopTelemetry,
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
                      const nextActualDist = Math.round((p.actualDistanceKm + addedDist) * 10) / 10;
                      const nextDeviations = p.routeDeviations + (hasDeviation ? 1 : 0);

                      return {
                        ...p,
                        completedStopsCount: p.completedStopsCount + 1,
                        stopTelemetry: updatedTelemetry,
                        actualDistanceKm: nextActualDist,
                        routeDeviations: nextDeviations
                      };
                    }
                    return p;
                  });
                });

                // Dispatch FCM mock push notification for STOPSTATUS
                const titleStr = 'Entrega Concluída Checklist ✅';
                const bodyStr = `A parada #${currentStopIdx + 1} (${targetStop.clientName}) da rota "${rota.name}" foi concluída. Tempo de permanência: ${timeSpent} minutos.`;
                
                setPushLogs(prevPushes => [
                  {
                    id: `push_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
                    title: titleStr,
                    body: bodyStr,
                    targetRole: UserRole.GERENTE, // Focused on Managers
                    targetRegion: rota.region,  // Scoped to region
                    sentCount: 1,
                    timestamp: new Date().toISOString(),
                    success: true,
                    type: 'status_parada'
                  },
                  ...prevPushes
                ]);

                // Fire custom FCM toast event
                window.dispatchEvent(new CustomEvent('fcm_notification_received', {
                  detail: {
                    title: titleStr,
                    body: bodyStr,
                    type: 'status_parada',
                    region: rota.region,
                    role: UserRole.GERENTE
                  }
                }));

                return {
                  ...rota,
                  stops: newStops,
                  currentStopIndex: currentStopIdx + 1
                };
              } else {
                // Move gradually towards the target
                updated = true;
                const step = 0.0015; // movement speed step
                const ratio = step / distance;
                const nextLat = driverLoc.lat + dLat * ratio;
                const nextLng = driverLoc.lng + dLng * ratio;

                // Calculate angle for truck direction heading
                const angle = Math.atan2(dLng, dLat) * (180 / Math.PI);

                setLocations(prevLocs => ({
                  ...prevLocs,
                  [rota.driverId]: {
                    driverId: rota.driverId,
                    lat: nextLat,
                    lng: nextLng,
                    heading: angle >= 0 ? angle : 360 + angle,
                    speed: 55, // 55 km/h simulated
                    lastUpdated: new Date().toISOString()
                  }
                }));

                setBreadcrumbs(prev => {
                  const currentList = prev[rota.driverId] || [];
                  const lastPoint = currentList[currentList.length - 1];
                  if (lastPoint && Math.abs(lastPoint.lat - nextLat) < 0.0001 && Math.abs(lastPoint.lng - nextLng) < 0.0001) {
                    return prev;
                  }
                  const updatedList = [...currentList, { lat: nextLat, lng: nextLng }].slice(-50); // Keep last 50 points
                  return {
                    ...prev,
                    [rota.driverId]: updatedList
                  };
                });

                // GEOFENCING CHECK: If within 500 meters of a stop, update to 'Chegando' and trigger alerts
                const distToStop = getDistanceInMeters(nextLat, nextLng, targetStop.lat, targetStop.lng);
                if (distToStop <= 500 && targetStop.status === 'pending') {
                  const updatedStops = stops.map((item, sIdx) => 
                    sIdx === currentStopIdx ? { ...item, status: 'Chegando' as const } : item
                  );

                  const titleStr = 'Motorista Próximo - Geofence 📍';
                  const bodyStr = `O condutor ${rota.driverName} atingiu o raio de 500m do cliente "${targetStop.clientName}". Status atualizado para 'Chegando'.`;

                  setNotifications(prevNotifs => [
                    {
                      id: `notif_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
                      region: rota.region,
                      title: titleStr,
                      body: bodyStr,
                      timestamp: new Date().toISOString(),
                      senderName: rota.driverName
                    },
                    ...prevNotifs
                  ]);

                  setPushLogs(prevPushes => [
                    {
                      id: `push_${Date.now()}_${Math.floor(Math.random() * 1000000)}_g`,
                      title: titleStr,
                      body: bodyStr,
                      targetRole: UserRole.GERENTE,
                      targetRegion: rota.region,
                      sentCount: 1,
                      timestamp: new Date().toISOString(),
                      success: true,
                      type: 'geofence'
                    },
                    {
                      id: `push_${Date.now()}_${Math.floor(Math.random() * 1000000)}_v`,
                      title: titleStr,
                      body: bodyStr,
                      targetRole: UserRole.VENDEDOR,
                      targetRegion: rota.region,
                      sentCount: 1,
                      timestamp: new Date().toISOString(),
                      success: true,
                      type: 'geofence'
                    },
                    ...prevPushes
                  ]);

                  window.dispatchEvent(new CustomEvent('fcm_notification_received', {
                    detail: {
                      title: titleStr,
                      body: bodyStr,
                      type: 'status_parada',
                      region: rota.region,
                      role: UserRole.GERENTE
                    }
                  }));

                  window.dispatchEvent(new CustomEvent('fcm_notification_received', {
                    detail: {
                      title: titleStr,
                      body: bodyStr,
                      type: 'status_parada',
                      region: rota.region,
                      role: UserRole.VENDEDOR
                    }
                  }));

                  return {
                    ...rota,
                    stops: updatedStops
                  };
                }
              }
            } else {
              // Completed all stops! Complete the route
              updated = true;
              
              setNotifications(prevNotifs => [
                {
                  id: `notif_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
                  region: rota.region,
                  title: `Rota Finalizada - ${rota.driverName}`,
                  body: `A rota de entregas "${rota.name}" foi totalmente concluída com sucesso!`,
                  timestamp: new Date().toISOString(),
                  senderName: rota.driverName
                },
                ...prevNotifs
              ]);

              // Update Performance Log to status: completed
              setPerformanceLogs(prevPerf => {
                return prevPerf.map(p => {
                  if (p.routeId === rota.id) {
                    const avgTime = p.stopTelemetry.length > 0 
                      ? Math.round(p.stopTelemetry.reduce((sum, s) => sum + s.timeSpentMinutes, 0) / p.stopTelemetry.length)
                      : 15;
                    return {
                      ...p,
                      status: 'completed',
                      endTimestamp: new Date().toISOString(),
                      averageTimePerStopMinutes: avgTime
                    };
                  }
                  return p;
                });
              });

              // Dispatch FCM mock push notification for COMPLETED ROUTE
              const titleStr = 'Rota Finalizada com Sucesso 🌍';
              const bodyStr = `A rota regional "${rota.name}" do motorista ${rota.driverName} foi totalmente concluída com sucesso!`;
              
              setPushLogs(prevPushes => [
                {
                  id: `push_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
                  title: titleStr,
                  body: bodyStr,
                  targetRole: 'all',
                  targetRegion: rota.region,
                  sentCount: 3,
                  timestamp: new Date().toISOString(),
                  success: true,
                  type: 'status_parada'
                },
                ...prevPushes
              ]);

              window.dispatchEvent(new CustomEvent('fcm_notification_received', {
                detail: {
                  title: titleStr,
                  body: bodyStr,
                  type: 'status_parada',
                  region: rota.region,
                  role: 'all'
                }
              }));

              return {
                ...rota,
                status: 'completed'
              };
            }
          }
          return rota;
        });

        return updated ? newRotas : prevRotas;
      });
    }, 4500); // Trigger micro GPS movement iteration every 4.5 seconds

    return () => {
      if (gpsTickRef.current) clearInterval(gpsTickRef.current);
    };
  }, [locations]);

  // Auth Operations
  const handleLogin = (email: string, role?: UserRole) => {
    // Admin login bypass detection or standard mock system
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

    // Default if not found and role specified (simulate self registration first check)
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

    setUsers(prev => [...prev, newUser]);
    setCurrentUser(newUser);
    return newUser;
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setImpersonatingUser(null);
  };

  const handleImpersonate = (targetUser: RouteUser | null) => {
    if (!currentUser || currentUser.role !== UserRole.ADMIN) return;
    
    setImpersonatingUser(targetUser);

    if (targetUser) {
      // Log audit
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
      setAuditLogs(prev => [newAudit, ...prev]);
    }
  };

  // Moderation Suite
  const handleModerateUser = (targetUserId: string, action: 'activate' | 'suspend' | 'ban') => {
    if (!currentUser || currentUser.role !== UserRole.ADMIN) return;

    setUsers(prev => prev.map(u => {
      if (u.id === targetUserId) {
        const nextStatus = action === 'activate' ? 'active' : action === 'suspend' ? 'suspended' : 'banned';
        
        // Log audit
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
        setAuditLogs(prevLogs => [newAudit, ...prevLogs]);

        return { ...u, status: nextStatus };
      }
      return u;
    }));
  };

  // Dispatch custom push notify from Admin or Manager
  const dispatchCustomPush = (title: string, body: string, selectedRegion: string) => {
    const sender = activeSessionUser?.name || 'Administrador';
    const newNotif: NotificationLog = {
      id: `notif_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
      region: selectedRegion,
      title,
      body,
      timestamp: new Date().toISOString(),
      senderName: sender
    };
    setNotifications(prev => [newNotif, ...prev]);
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

    setRotas(prev => [newRoute, ...prev]);
    return newRoute;
  };

  const handleUpdateRoute = (id: string, updatedFields: Partial<Rota>) => {
    setRotas(prev => prev.map(r => r.id === id ? { ...r, ...updatedFields } : r));
  };

  const handleDeleteRoute = (id: string) => {
    setRotas(prev => prev.filter(r => r.id !== id));
  };

  // Optimize Route simulates the Traveling Salesperson algorithm
  const handleOptimizeRoute = (stopsList: Parada[], originLat: number, originLng: number) => {
    if (stopsList.length <= 1) return stopsList;
    
    // Sort stops based on simple geometric distance from origin (greedy TSP simulation)
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
  };

  const handleStartRoute = (routeId: string) => {
    setRotas(prev => prev.map(r => {
      if (r.id === routeId) {
        // Broadcast notification
        setNotifications(prevNotifs => [
          {
            id: `notif_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
            region: r.region,
            title: `Nova Rota Iniciada - ${r.driverName}`,
            body: `O motorista ${r.driverName} da placa ${r.driverPlate} às ${new Date().toLocaleTimeString('pt-BR')} iniciou o trajeto: ${r.name}`,
            timestamp: new Date().toISOString(),
            senderName: r.driverName
          },
          ...prevNotifs
        ]);

        // Create initial Route Performance Log
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

        setPerformanceLogs(prevLogs => [initialPerformance, ...prevLogs]);

        // Push template triggered notification
        const pushTitle = 'Motorista em Trânsito 🚚';
        const pushBody = `O motorista ${r.driverName} iniciou a rota "${r.name}" na região ${r.region}. Rastreamento ativo!`;

        setPushLogs(prevPushes => [
          {
            id: `push_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
            title: pushTitle,
            body: pushBody,
            targetRole: UserRole.GERENTE,
            targetRegion: r.region,
            sentCount: 1,
            timestamp: new Date().toISOString(),
            success: true,
            type: 'rota_iniciada'
          },
          ...prevPushes
        ]);

        window.dispatchEvent(new CustomEvent('fcm_notification_received', {
          detail: {
            title: pushTitle,
            body: pushBody,
            type: 'rota_iniciada',
            region: r.region,
            role: UserRole.GERENTE
          }
        }));

        // Place driver at the origin point initially
        setLocations(prevLocs => ({
          ...prevLocs,
          [r.driverId]: {
            driverId: r.driverId,
            lat: r.originLat,
            lng: r.originLng,
            heading: 0,
            speed: 0,
            lastUpdated: new Date().toISOString()
          }
        }));

        setBreadcrumbs(prev => ({
          ...prev,
          [r.driverId]: [{ lat: r.originLat, lng: r.originLng }]
        }));

        return {
          ...r,
          status: 'active' as const,
          currentStopIndex: 0,
          stops: r.stops.map(s => ({ ...s, status: 'pending' as const }))
        };
      }
      return r;
    }));
  };

  // Chat actions
  const handlePostMessage = (text: string, audioUrl?: string) => {
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

    setChats(prev => [...prev, newMessage]);
  };

  // Send simulated segmented push notification reproducing FCM targeting
  const sendSegmentedPush = (
    templateType: 'nova_rota' | 'rota_iniciada' | 'status_parada' | 'urgente_chat' | 'custom',
    profileSegment: 'all' | UserRole,
    regionSegment: string, // 'all' or specific region code
    customTitle?: string,
    customBody?: string
  ) => {
    // Resolve matching users count in our active user list to simulate real FCM subscriber delivery
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

    setPushLogs(prev => [newPush, ...prev]);

    // Track in notification logs too to let standard notifications catch it
    const newNotif: NotificationLog = {
      id: `notif_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
      region: regionSegment === 'all' ? 'GV1' : regionSegment,
      title: titleStr,
      body: bodyStr,
      timestamp: new Date().toISOString(),
      senderName: activeSessionUser?.name || 'Controle central'
    };
    setNotifications(prev => [newNotif, ...prev]);

    // Dispatch a browser-level custom event so the floating notification toaster highlights it live
    window.dispatchEvent(new CustomEvent('fcm_notification_received', {
      detail: {
        title: titleStr,
        body: bodyStr,
        type: templateType,
        region: regionSegment,
        role: profileSegment
      }
    }));

    return newPush;
  };

  const resetAllData = () => {
    setUsers(INITIAL_USERS);
    setRotas(INITIAL_ROTAS);
    setLocations(INITIAL_LOCATIONS);
    setChats(INITIAL_CHAT);
    setNotifications(INITIAL_NOTIFICATIONS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setPerformanceLogs(INITIAL_PERFORMANCE_LOGS);
    setPushLogs(INITIAL_PUSH_LOGS);
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
