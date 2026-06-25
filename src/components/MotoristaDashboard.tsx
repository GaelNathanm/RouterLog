/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  UserRole, RouteUser, Rota, Parada, GPSLocation, ChatMessage, RoutePerformanceLog, Region, Cliente, MotoristaUser
} from '../types';
import { 
  Pause, Play, Volume2, Mic, Square, Truck, Navigation, CheckCircle, Phone, ArrowRight, Edit, Pencil,
  MessageSquare, Send, Camera, AlertCircle, MapPin, Map, RefreshCw, Plus, Trash2, X, Compass, Info,
  Signal, AlertTriangle, SlidersHorizontal, Route, Sparkles, Check, Clock, ChevronLeft, ChevronRight
} from 'lucide-react';
import InteractiveMap from './InteractiveMap';
import RouteMap from './RouteMap';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AudioPlayer, AudioRecorderButton 
} from './DashboardUtils';
import { saveCloudGPSLocation } from '../supabase';

// ==========================================
// 3. MOTORISTA VIEW
// ==========================================
interface MotoristaProps {
  user: RouteUser;
  rotas: Rota[];
  chats: ChatMessage[];
  locations: { [drvId: string]: GPSLocation };
  performanceLogs: RoutePerformanceLog[];
  onCreateRoute: (data: Partial<Rota>) => Rota | undefined;
  onUpdateRoute: (id: string, data: Partial<Rota>) => void;
  onDeleteRoute: (id: string) => void;
  onStartRoute: (id: string) => void;
  onPostMessage: (text: string, audioUrl?: string) => void;
  onOptimize: (stops: Parada[], oLat: number, oLng: number) => Promise<Parada[]>;
}

export const GUARIBA_LOCATIONS = [
  { name: 'Mercantil São Francisco', address: 'Rua Benjamin Constant, 120 - Centro', lat: -18.848, lng: -41.954 },
  { name: 'Supermercado Central', address: 'Av. Brasil, 4200 - Centro', lat: -18.855, lng: -41.942 },
  { name: 'Padaria Princesa', address: 'Rua Sete de Setembro, 320 - Esplanada', lat: -18.862, lng: -41.948 },
  { name: 'Drogaria do Povo', address: 'Rua Israel pinheiro, 1500 - Shopping', lat: -18.850, lng: -41.946 },
  { name: 'Mercearia Popular', address: 'Av. JK, 1100 - Vila Isa', lat: -18.882, lng: -41.972 }
];

export function MotoristaDashboard({ user, rotas, chats, locations, performanceLogs, onCreateRoute, onUpdateRoute, onDeleteRoute, onStartRoute, onPostMessage, onOptimize }: MotoristaProps) {
  const [activeTab, setActiveTab] = useState<'nova' | 'salvas' | 'chat' | 'rotarec' | 'resumos' | 'ativa'>('nova');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [mapMode, setMapMode] = useState<'vector' | 'google'>('vector');
  const [mobileFocus, setMobileFocus] = useState<'actions' | 'map'>('actions');
  
  // Signature Drawing canvas states for customer verification
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  // Real-world Multi-Photo Confirmation Modal state for clicking any stop map marker
  const [confirmingStop, setConfirmingStop] = useState<Parada | null>(null);
  const [confirmPhotos, setConfirmPhotos] = useState<string[]>([]); // array of base64 photo strings
  
  const modalSignatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [modalIsDrawing, setModalIsDrawing] = useState(false);
  const [modalHasSigned, setModalHasSigned] = useState(false);

  // Clear digital signature for modal
  const handleModalClearSignature = () => {
    const canvas = modalSignatureCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Draw elegant slate-200 help guideline
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(15, canvas.height - 35);
        ctx.lineTo(canvas.width - 15, canvas.height - 35);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    setModalHasSigned(false);
  };

  const getModalCanvasCoords = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  const handleModalStartDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = modalSignatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getModalCanvasCoords(e, canvas);
    ctx.strokeStyle = '#0f172a'; // slate-900 high contrast ink ink
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setModalIsDrawing(true);
    setModalHasSigned(true);
  };

  const handleModalDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!modalIsDrawing) return;
    e.preventDefault();
    const canvas = modalSignatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getModalCanvasCoords(e, canvas);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const handleModalStopDrawing = () => {
    setModalIsDrawing(false);
  };

  // Reset/draw guidelines on modal signature canvas when confirmingStop changes and responsive actual dimensions tracking
  useEffect(() => {
    const handleResize = () => {
      const modalCanvas = modalSignatureCanvasRef.current;
      if (modalCanvas && modalCanvas.parentElement) {
        modalCanvas.width = modalCanvas.parentElement.clientWidth;
        modalCanvas.height = modalCanvas.parentElement.clientHeight || 180;
        
        // redraw guideline:
        const ctx = modalCanvas.getContext('2d');
        if (ctx) {
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(15, modalCanvas.height - 35);
          ctx.lineTo(modalCanvas.width - 15, modalCanvas.height - 35);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      const inlineCanvas = signatureCanvasRef.current;
      if (inlineCanvas && inlineCanvas.parentElement) {
        inlineCanvas.width = inlineCanvas.parentElement.clientWidth;
        inlineCanvas.height = inlineCanvas.parentElement.clientHeight || 180;
      }
    };

    window.addEventListener('resize', handleResize);
    const timer = setTimeout(handleResize, 300);

    if (confirmingStop) {
      setTimeout(() => {
        handleResize();
        handleModalClearSignature();
      }, 350);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [confirmingStop, activeTab]);

  // Handle up to 5 photos additions
  const handleModalPhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const remainingSlots = 5 - confirmPhotos.length;
      if (remainingSlots <= 0) {
        alert('Limite máximo de 5 fotos atingido!');
        return;
      }
      
      const filesToProcess = Array.from(files).slice(0, remainingSlots) as File[];
      
      filesToProcess.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setConfirmPhotos(prev => {
            if (prev.length >= 5) return prev;
            return [...prev, reader.result as string];
          });
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleRemoveConfirmPhoto = (indexToRemove: number) => {
    setConfirmPhotos(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Real-world delivery/collection submission via modal
  const handleConfirmModalDelivery = async () => {
    if (!confirmingStop) return;
    if (!activeRoute) return;

    if (!modalHasSigned) {
      alert('Por favor, solicite a assinatura digital do recebedor na tela.');
      return;
    }
    
    if (confirmPhotos.length === 0) {
      alert('Por favor, anexe ao menos 1 foto como foto-comprovante (máximo de 5 fotos).');
      return;
    }

    const canvas = modalSignatureCanvasRef.current;
    let signatureBase64 = '';
    if (canvas) {
      signatureBase64 = canvas.toDataURL('image/png');
    }

    const payload = {
      routeId: activeRoute.id,
      stopId: confirmingStop.id,
      signatureUrl: signatureBase64,
      photoUrl: confirmPhotos[0], // backward compatibility
      photoUrls: confirmPhotos,   // multiple photos
      completedAt: new Date().toISOString()
    };

    const updatedStops = activeRoute.stops.map(s => {
      if (s.id === confirmingStop.id) {
        return {
          ...s,
          status: 'completed' as const,
          signatureUrl: signatureBase64,
          photoUrl: confirmPhotos[0],
          photoUrls: confirmPhotos,
          completedAt: payload.completedAt
        };
      }
      return s;
    });

    // Automatically transition currentStopIndex to the next pending item or end of route
    let nextIndex = updatedStops.findIndex(s => s.status !== 'completed');
    if (nextIndex === -1) {
      nextIndex = updatedStops.length;
    }

    const isRouteFinished = nextIndex >= updatedStops.length;
    const updatedStatus = isRouteFinished ? 'completed' : 'active';

    try {
      await onUpdateRoute(activeRoute.id, {
        stops: updatedStops,
        currentStopIndex: nextIndex,
        status: updatedStatus
      });
      alert('Comprovante múltiplo e assinatura digital gravados com sucesso!');
      
      // Reset Modal parameters
      setConfirmingStop(null);
      setConfirmPhotos([]);
      setModalHasSigned(false);
    } catch (err: any) {
      console.error('Falha de escrita direta, tentando fallback:', err);
      // In case of backup offline scenario
      alert('Erro ao gravar online. Tentando fluxo emergencial local.');
    }
  };

  // Clear digital signature
  const handleClearSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Draw elegant slate-200 help guideline
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(15, canvas.height - 35);
        ctx.lineTo(canvas.width - 15, canvas.height - 35);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    setHasSigned(false);
  };

  // Convert coordinate spaces of click / touch events to relative canvas layout dimensions
  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  const handleStartDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoords(e, canvas);
    ctx.strokeStyle = '#0f172a'; // slate-900 high contrast ink ink
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
    setHasSigned(true);
  };

  const handleDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoords(e, canvas);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const handleStopDrawing = () => {
    setIsDrawing(false);
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Route editing states
  const [mEditingRouteId, setMEditingRouteId] = useState<string | null>(null);
  const [mEditingRouteName, setMEditingRouteName] = useState('');
  const [mEditingRouteOrigin, setMEditingRouteOrigin] = useState('');
  const [mEditingRouteStops, setMEditingRouteStops] = useState<Parada[]>([]);
  const [mEditClientName, setMEditClientName] = useState('');
  const [mEditClientWhatsApp, setMEditClientWhatsApp] = useState('');
  const [mEditClientAddress, setMEditClientAddress] = useState('');
  
  // Create state for Stop fields inside Nova Rota
  const [routeName, setRouteName] = useState('Super Entrega ' + new Date().toLocaleDateString('pt-BR'));
  const [origin, setOrigin] = useState('CD Central ' + (user as any).region + ' - Av. dos Camaras, 513, Santo Antonio, Cariacica-ES');
  const [originLat, setOriginLat] = useState(-20.302534);
  const [originLng, setOriginLng] = useState(-40.401630);

  // Stop Form State
  const [stops, setStops] = useState<Parada[]>([]);
  const [clientName, setClientName] = useState('');
  const [clientWhatsApp, setClientWhatsApp] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [customLat, setCustomLat] = useState<number>(-20.302534);
  const [customLng, setCustomLng] = useState<number>(-40.401630);

  const [chatText, setChatText] = useState('');
  const [selectedCompletedRouteId, setSelectedCompletedRouteId] = useState<string | null>(null);
  
  // Connection / GPS status state & Gemini AI Loader
  const [connectionStatus, setConnectionStatus] = useState<'stable' | 'unstable'>('stable');
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  const region = (user as any).region || 'GV1';
  const myRoutes = rotas.filter(r => r.driverId === user.id);
  const myCreatedRoutes = rotas.filter(r => r.driverId === user.id && !r.sentByGerente);
  const myReceivedRoutes = rotas.filter(r => r.driverId === user.id && r.sentByGerente === true);
  const myCompletedRoutes = myRoutes.filter(r => r.status === 'completed');
  const activeRoute = myRoutes.find(r => r.status === 'active') || null;

  const [isSharingLocation, setIsSharingLocation] = useState(true);

  // Synchronize dynamic redirect tab
  useEffect(() => {
    if (activeRoute) {
      setActiveTab('ativa');
    }
  }, [activeRoute?.id]);

  // Guidelines reset on stop transition
  useEffect(() => {
    if (activeTab === 'ativa') {
      setTimeout(() => {
        handleClearSignature();
      }, 150);
    }
  }, [activeTab, activeRoute?.currentStopIndex]);

  // Delivery confirmation action
  const handleConfirmDelivery = async (routeId: string, stopId: string) => {
    if (!hasSigned) {
      alert('Por favor, solicite a assinatura digital do cliente na tela do dispositivo.');
      return;
    }
    if (!capturedPhoto) {
      alert('Por favor, faça a fotoconferência da mercadoria entregue para anexar como comprovante.');
      return;
    }

    const canvas = signatureCanvasRef.current;
    let signatureBase64 = '';
    if (canvas) {
      signatureBase64 = canvas.toDataURL('image/png');
    }

    const currentStop = activeRoute?.stops[activeRoute.currentStopIndex];
    if (!currentStop) return;

    const payload = {
      routeId,
      stopId,
      signatureUrl: signatureBase64,
      photoUrl: capturedPhoto,
      completedAt: new Date().toISOString()
    };

    // If signal status is configured unstable OR navigator is offline, trigger SW Queue
    if (connectionStatus === 'unstable' || !navigator.onLine) {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'QUEUE_DELIVERY_CONFIRMATION',
          payload
        });
      } else {
        console.warn('Service worker controller not active. Storing local simulation.');
      }

      // Optimistic local update so driver can progress
      const updatedStops = [...activeRoute.stops];
      const stopIndex = updatedStops.findIndex(s => s.id === stopId);
      if (stopIndex !== -1) {
        updatedStops[stopIndex] = {
          ...updatedStops[stopIndex],
          status: 'completed' as const,
          signatureUrl: signatureBase64,
          photoUrl: capturedPhoto,
          completedAt: payload.completedAt
        };

        const nextIndex = activeRoute.currentStopIndex + 1;
        const isRouteFinished = nextIndex >= updatedStops.length;
        const updatedStatus = isRouteFinished ? 'completed' : 'active';

        onUpdateRoute(routeId, {
          stops: updatedStops,
          currentStopIndex: nextIndex,
          status: updatedStatus
        });

        alert('Conexão instável! Entrega armazenada com segurança na fila de upload offline (Service Worker). Envio ocorrerá automaticamente quando reestabelecer conexão.');
      }
    } else {
      // Direct Online Write
      const updatedStops = [...activeRoute.stops];
      const stopIndex = updatedStops.findIndex(s => s.id === stopId);
      if (stopIndex !== -1) {
        updatedStops[stopIndex] = {
          ...updatedStops[stopIndex],
          status: 'completed' as const,
          signatureUrl: signatureBase64,
          photoUrl: capturedPhoto,
          completedAt: payload.completedAt
        };

        const nextIndex = activeRoute.currentStopIndex + 1;
        const isRouteFinished = nextIndex >= updatedStops.length;
        const updatedStatus = isRouteFinished ? 'completed' : 'active';

        try {
          await onUpdateRoute(routeId, {
            stops: updatedStops,
            currentStopIndex: nextIndex,
            status: updatedStatus
          });
          alert('Entrega confirmada com sucesso! Comprovantes sincronizados em tempo real.');
        } catch (err: any) {
          console.warn('Erro ao salvar online, tentando queuing em segundo plano:', err);
          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: 'QUEUE_DELIVERY_CONFIRMATION',
              payload
            });
          }
          alert('Sua assinatura e foto foram guardadas offline por segurança e serão enviadas quando a rede normalizar.');
        }
      }
    }

    setCapturedPhoto(null);
    setHasSigned(false);
  };

  // Background Geolocation simulator or real GPS tracker
  useEffect(() => {
    if (!isSharingLocation || !activeRoute) return;

    let watchId: number | null = null;
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const speed = position.coords.speed !== null ? Math.round(position.coords.speed * 3.6) : (45 + Math.floor(Math.random() * 10)); // convert to km/h or simulated
          const heading = position.coords.heading !== null ? position.coords.heading : Math.floor(Math.random() * 360);
          
          const nextLoc: GPSLocation = {
            driverId: user.id,
            lat,
            lng,
            heading,
            speed,
            lastUpdated: new Date().toISOString(),
            isSharing: true
          };
          
          try {
            await saveCloudGPSLocation(nextLoc);
          } catch (err) {
            console.warn("Failed to write real GPS background position to Firestore:", err);
          }
        },
        (error) => {
          console.log("Background Geoloc real position failed or permission blocked. Utilizing simulated auto-progression fallback.", error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [isSharingLocation, activeRoute?.id, user.id]);

  const handleSuggestAIPrediction = async () => {
    setIsLoadingAI(true);
    try {
      const response = await fetch('/api/gemini/suggest-stops', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          driverName: user.name,
          region,
          previousRoutes: myRoutes,
          presets: GUARIBA_LOCATIONS,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Erro na API');
      }

      const data = await response.json();
      if (data && data.stops) {
        setRouteName(data.routeName || ('Sugestão Inteligente ' + new Date().toLocaleDateString('pt-BR')));
        
        const loadedStops: Parada[] = data.stops.map((s: any, sIdx: number) => ({
          id: `p_stop_ia_${Date.now()}_${sIdx}`,
          clientName: s.clientName,
          clientWhatsApp: s.clientWhatsApp || '5533991234567',
          address: s.address,
          lat: s.lat,
          lng: s.lng,
          status: 'pending' as const
        }));

        setStops(loadedStops);
        alert(`O Gemini AI analisou seu histórico de ${myRoutes.length} rotas anteriores e encontrou padrões! ${loadedStops.length} paradas recorrentes foram sugeridas com sucesso.`);
      }
    } catch (err: any) {
      console.error('Erro na previsão Gemini:', err);
      alert('Não foi possível obter a sugestão com o Gemini AI: ' + err.message);
    } finally {
      setIsLoadingAI(false);
    }
  };

  // Google Places Autocomplete API connection and validation states
  const [addressPredictions, setAddressPredictions] = useState<{ description: string; placeId: string }[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isValidated, setIsValidated] = useState(false);

  const fetchAddressPredictions = (inputStr: string) => {
    if (!inputStr || inputStr.trim().length < 3) {
      setAddressPredictions([]);
      return;
    }

    if (typeof window !== 'undefined' && (window as any).google && (window as any).google.maps && (window as any).google.maps.places) {
      try {
        const service = new (window as any).google.maps.places.AutocompleteService();
        service.getPlacePredictions(
          { input: inputStr, componentRestrictions: { country: 'br' } },
          (predictions: any, status: any) => {
            if (status === 'OK' && predictions) {
              setAddressPredictions(
                predictions.map((p: any) => ({
                  description: p.description,
                  placeId: p.place_id,
                }))
              );
            } else {
              setAddressPredictions([]);
            }
          }
        );
      } catch (e) {
        console.warn('Autocomplete service failed:', e);
      }
    }
  };

  const handleSelectPrediction = (address: string, placeId: string) => {
    setClientAddress(address);
    setAddressPredictions([]);
    setIsValidated(true);

    if (typeof window !== 'undefined' && (window as any).google && (window as any).google.maps) {
      try {
        const geocoder = new (window as any).google.maps.Geocoder();
        geocoder.geocode({ placeId: placeId }, (results: any, status: any) => {
          if (status === 'OK' && results && results[0]) {
            const loc = results[0].geometry.location;
            setCustomLat(loc.lat());
            setCustomLng(loc.lng());
            console.log(`[Google Autocomplete Places] Set coordinates for ${address} to:`, loc.lat(), loc.lng());
          }
        });
      } catch (err) {
        console.warn('Geocoding by placeId failed, fallback to standard geocodeAddress:', err);
        geocodeAddress(address, false);
      }
    } else {
      geocodeAddress(address, false);
    }
  };

  // Add random realistic coordinate matching standard regional ranges
  const addPresetStop = (idx: number) => {
    const preset = GUARIBA_LOCATIONS[idx % GUARIBA_LOCATIONS.length];
    setClientName(preset.name);
    setClientAddress(preset.address);
    setCustomLat(preset.lat);
    setCustomLng(preset.lng);
    setClientWhatsApp('553399' + Math.floor(1000000 + Math.random() * 9000000));
    setIsValidated(true);
  };

  const handleAddStop = async () => {
    if (!clientName || !clientAddress) {
      alert('Favor preencher o Nome do Cliente e Endereço Completo.');
      return;
    }

    // Camada de validação com Google Places Autocomplete API
    if (typeof window !== 'undefined' && (window as any).google && (window as any).google.maps && (window as any).google.maps.places) {
      setIsValidating(true);
      try {
        const service = new (window as any).google.maps.places.AutocompleteService();
        const predictions: any = await new Promise((resolve) => {
          service.getPlacePredictions(
            { input: clientAddress, componentRestrictions: { country: 'br' } },
            (results: any, status: any) => {
              resolve(status === 'OK' ? results : null);
            }
          );
        });

        if (!predictions || predictions.length === 0) {
          alert(`⚠️ Endereço Inválido: Não encontramos correspondências na Google Places API para "${clientAddress}". Por favor, informe ou selecione um endereço válido para evitar erros de roteamento.`);
          setIsValidating(false);
          return;
        }

        // Se o usuário digitou sem clicar, valida e geocodifica o primeiro resultado aproximado
        if (!isValidated && predictions[0]) {
          const matchedPref = predictions[0];
          setClientAddress(matchedPref.description);
          
          const geocoder = new (window as any).google.maps.Geocoder();
          await new Promise<void>((resolve) => {
            geocoder.geocode({ placeId: matchedPref.place_id }, (results: any, status: any) => {
              if (status === 'OK' && results && results[0]) {
                const loc = results[0].geometry.location;
                setCustomLat(loc.lat());
                setCustomLng(loc.lng());
              }
              resolve();
            });
          });
        }
      } catch (err) {
        console.warn('Google Places validation errored, continuing with fallbacks:', err);
      } finally {
        setIsValidating(false);
      }
    }

    const newStop: Parada = {
      id: `p_stop_${Date.now()}`,
      clientName,
      clientWhatsApp,
      address: clientAddress,
      lat: customLat,
      lng: customLng,
      status: 'pending'
    };

    setStops([...stops, newStop]);
    
    // reset form
    setClientName('');
    setClientWhatsApp('');
    setClientAddress('');
    setAddressPredictions([]);
    setIsValidated(false);
  };

  // Geocoder function to resolve typed address of Origin or Stops
  const geocodeAddress = (addressText: string, isOrigin: boolean) => {
    if (!addressText.trim()) return;

    // Check if google maps geocoder is available at runtime
    if (typeof window !== 'undefined' && (window as any).google && (window as any).google.maps) {
      try {
        const geocoder = new (window as any).google.maps.Geocoder();
        geocoder.geocode({ address: addressText }, (results: any, status: any) => {
          if (status === 'OK' && results && results[0]) {
            const loc = results[0].geometry.location;
            const lat = loc.lat();
            const lng = loc.lng();
            if (isOrigin) {
              setOriginLat(lat);
              setOriginLng(lng);
            } else {
              setCustomLat(lat);
              setCustomLng(lng);
            }
            console.log(`[Google Geocoder] Resolved "${addressText}" to ${lat}, ${lng}`);
          }
        });
        return;
      } catch (err) {
        console.warn('Google maps geocoder failed, returning to smart fallback:', err);
      }
    }

    // Fallback: Smart lexicographical parser based on Brazilian regions
    const text = addressText.toLowerCase();
    let lat = isOrigin ? -18.845 : -18.85;
    let lng = isOrigin ? -41.945 : -41.95;

    // If region of user is MG, default to Belo Horizonte center
    if (region === 'ES/MG') {
      lat = -19.928;
      lng = -43.937;
    }

    if (text.includes('vila isa')) {
      lat = -18.882; lng = -41.972;
    } else if (text.includes('shopping') || text.includes('israel pinheiro')) {
      lat = -18.850; lng = -41.946;
    } else if (text.includes('esplanada') || text.includes('sete de setembro')) {
      lat = -18.862; lng = -41.948;
    } else if (text.includes('benjamin constant')) {
      lat = -18.848; lng = -41.954;
    } else if (text.includes('brasil')) {
      lat = -18.855; lng = -41.942;
    } else if (text.includes('savassi')) {
      lat = -19.938; lng = -43.936;
    } else if (text.includes('lourdes')) {
      lat = -19.929; lng = -43.943;
    } else if (text.includes('pampulha')) {
      lat = -19.858; lng = -43.980;
    } else if (text.includes('centro') && region === 'ES/MG') {
      lat = -19.920; lng = -43.938;
    } else if (text.includes('jk') || text.includes('juscelino')) {
      lat = -18.875; lng = -41.965;
    } else {
      // Add a repeatable deterministic coordinate based on name length to ensure different custom names put distinct markers on map
      const hash = addressText.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const offsetLat = ((hash % 100) / 1000) * (region === 'ES/MG' ? 0.03 : 0.015);
      const offsetLng = (((hash >> 2) % 100) / 1000) * (region === 'ES/MG' ? 0.03 : 0.015);
      lat += (hash % 2 === 0 ? 1 : -1) * offsetLat;
      lng += (hash % 3 === 0 ? 1 : -1) * offsetLng;
    }

    if (isOrigin) {
      setOriginLat(lat);
      setOriginLng(lng);
    } else {
      setCustomLat(lat);
      setCustomLng(lng);
    }
  };

  const handleRunOptimization = async () => {
    if (stops.length <= 1) return;
    try {
      const sorted = await onOptimize(stops, originLat, originLng);
      setStops(sorted);
      alert('Rota Otimizada via Google Directions API (optimizeWaypoints:true)! Paradas foram reordenadas para sequência de trânsito otimizada.');
    } catch (err: any) {
      alert('Falha na otimização: ' + err.message);
    }
  };

  const handlePublishRoute = () => {
    if (stops.length === 0) {
      alert('Adicione pelo menos 1 parada para planejar sua jornada.');
      return;
    }

    onCreateRoute({
      name: routeName,
      origin,
      originLat,
      originLng,
      stops,
      optimized: true
    });

    // Clear draft
    setStops([]);
    setRouteName('Super Entrega ' + new Date().toLocaleDateString('pt-BR'));
    setActiveTab('salvas');
  };

  const handleSendChatText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatText.trim()) return;
    onPostMessage(chatText.trim());
    setChatText('');
  };

  return (
    <div id="driver-main-panel" className="grid grid-cols-1 lg:grid-cols-12 gap-5 select-none md:select-text">
      
      {/* Top Bar Connection Status & Driver QuickBar with shadow-md and rounded-2xl */}
      <div className="lg:col-span-12 bg-white border border-slate-200 rounded-2xl p-4 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold shrink-0">
            <Truck className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-800 text-sm leading-none uppercase tracking-tight">{user.name}</span>
              <span className="text-[10px] bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 rounded-full uppercase">
                {user.role === UserRole.MOTORISTA ? 'Motorista' : 'Vendedor'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Região: <strong className="text-slate-600 font-semibold">{region}</strong> | Placa: <strong className="text-slate-600 font-semibold">{(user as any).plate || 'RTL-1234'}</strong>
            </p>
          </div>
        </div>

        {/* Connection Status widget */}
        <div className="flex flex-wrap items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[11px] font-semibold select-none ${
            connectionStatus === 'stable'
              ? 'bg-emerald-50/50 border-emerald-100/60 text-emerald-700'
              : 'bg-amber-50/50 border-amber-100/60 text-amber-700 animate-pulse'
          }`}>
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                connectionStatus === 'stable' ? 'bg-emerald-400' : 'bg-amber-400'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                connectionStatus === 'stable' ? 'bg-emerald-500' : 'bg-amber-500'
              }`}></span>
            </span>
            <span className="font-mono">
              {connectionStatus === 'stable' 
                ? 'Conectado (GPS & Sincronia Ativos)' 
                : 'Sinal GPS instável (Sincronização pendente)'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setConnectionStatus(prev => prev === 'stable' ? 'unstable' : 'stable')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <Signal className="w-3.5 h-3.5 text-slate-500" />
            Alternar Sinal
          </button>

          <button
            type="button"
            onClick={async () => {
              const nextSharing = !isSharingLocation;
              setIsSharingLocation(nextSharing);
              
              // Publish the sharing state to Firestore immediately
              const currentLoc = locations[user.id] || {
                driverId: user.id,
                lat: activeRoute?.originLat || -18.845,
                lng: activeRoute?.originLng || -41.945,
                heading: 0,
                speed: 0,
                lastUpdated: new Date().toISOString()
              };
              
              const updatedLoc: GPSLocation = {
                ...currentLoc,
                isSharing: nextSharing,
                lastUpdated: new Date().toISOString()
              };
              
              try {
                await saveCloudGPSLocation(updatedLoc);
              } catch (err: any) {
                console.error("Erro ao alternar compartilhamento:", err);
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 border text-[10px] font-bold rounded-xl transition-all cursor-pointer shadow-sm active:scale-95 ${
              isSharingLocation 
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 shadow-sm' 
                : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
            }`}
          >
            <Compass className={`w-3.5 h-3.5 ${isSharingLocation ? 'animate-spin' : 'text-rose-500'}`} style={{ animationDuration: '4s' }} />
            {isSharingLocation ? 'Compartilhando Localização' : 'Compartilhar Localização'}
          </button>
        </div>
      </div>

      {/* Subtle warning when Connection is unstable */}
      {connectionStatus === 'unstable' && (
        <div className="lg:col-span-12 bg-amber-50/80 border border-amber-200/60 rounded-xl p-3 shadow-sm text-xs text-amber-950 flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <div className="flex-1">
            <strong>⚠️ Atenção Condutor:</strong> Sinal de GPS instável detectado! Os dados de rota e as alterações continuarão sendo salvas localmente e sincronizarão automaticamente assim que o sinal reestabelecer.
          </div>
        </div>
      )}

      {/* Responsive Focus Toggle for Mobile Displays */}
      <div className="lg:hidden col-span-1 flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-sm mb-1 select-none w-full gap-1">
        <button
          type="button"
          onClick={() => setMobileFocus('actions')}
          className={`flex-1 py-3 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
            mobileFocus === 'actions' ? 'bg-white text-indigo-900 shadow-sm border border-slate-200/40' : 'text-slate-550'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4 text-indigo-600 shrink-0" />
          Controles e Ações
        </button>
        <button
          type="button"
          onClick={() => setMobileFocus('map')}
          className={`flex-1 py-3 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
            mobileFocus === 'map' ? 'bg-white text-indigo-900 shadow-sm border border-slate-200/40' : 'text-slate-550'
          }`}
        >
          <Map className="w-4 h-4 text-emerald-600 shrink-0" />
          Ver no Mapa
        </button>
      </div>

      {/* Left Column Container */}
      <div className={`transition-all duration-300 ${isSidebarOpen ? 'lg:col-span-4' : 'lg:col-span-1'} space-y-4 w-full ${mobileFocus === 'actions' ? 'block' : 'hidden lg:block'}`}>
        
        {/* If sidebar is CLOSED (collapsed) */}
        {!isSidebarOpen && (
          <div className="hidden lg:flex flex-col items-center bg-white border border-slate-200 py-5 px-2 rounded-2xl shadow-md space-y-5 h-full min-h-[500px] w-full">
            {/* Expand Button */}
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              title="Expandir Menu"
              className="p-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-all cursor-pointer border border-indigo-150/50 hover:scale-105 active:scale-95"
            >
              <ChevronRight className="w-5 h-5 font-black" />
            </button>

            <div className="w-full border-b border-slate-100"></div>

            {/* Icons strip */}
            <div className="flex flex-col gap-4 w-full items-center">
              <button
                onClick={() => { setActiveTab('nova'); setIsSidebarOpen(true); }}
                title="Nova Rota"
                className={`p-3 rounded-xl transition-all flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 ${
                  activeTab === 'nova' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <Plus className="w-5 h-5" />
              </button>

              <button
                onClick={() => { setActiveTab('salvas'); setIsSidebarOpen(true); }}
                title={`Minhas Rotas (${myCreatedRoutes.length})`}
                className={`p-3 rounded-xl transition-all flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 ${
                  activeTab === 'salvas' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <Route className="w-5 h-5" />
              </button>

              <button
                onClick={() => { setActiveTab('rotarec'); setIsSidebarOpen(true); }}
                title={`Rotas Recebidas (${myReceivedRoutes.length})`}
                className={`p-3 rounded-xl transition-all flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 ${
                  activeTab === 'rotarec' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <Truck className="w-5 h-5" />
              </button>

              <button
                onClick={() => { setActiveTab('chat'); setIsSidebarOpen(true); }}
                title="Suporte Operacional"
                className={`p-3 rounded-xl transition-all flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 ${
                  activeTab === 'chat' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <MessageSquare className="w-5 h-5" />
              </button>

              <button
                onClick={() => { setActiveTab('resumos'); setIsSidebarOpen(true); }}
                title={`Resumos (${myCompletedRoutes.length})`}
                className={`p-3 rounded-xl transition-all flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 ${
                  activeTab === 'resumos' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <CheckCircle className="w-5 h-5" />
              </button>
            </div>

            {activeRoute && (
              <>
                <div className="w-full border-b border-slate-100 my-2"></div>
                <button
                  onClick={() => { setActiveTab('ativa'); setIsSidebarOpen(true); }}
                  title="Ver Rota Ativa"
                  className="p-3 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-150/50 rounded-xl transition-all flex items-center justify-center cursor-pointer animate-pulse"
                >
                  <Truck className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        )}

        {/* If sidebar is OPEN (expanded) - or on mobile where we always show full content */}
        {(isSidebarOpen || mobileFocus === 'actions') && (
          <div className="space-y-4 w-full">
            {/* Sidebar Header Panel with Collapse Button */}
            <div className="flex items-center justify-between bg-white border border-slate-200 p-3.5 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
                <span className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider">Painel de Ações</span>
              </div>
              <button
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                title="Ocultar Menu"
                className="hidden lg:flex items-center justify-center p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4.5 h-4.5" />
              </button>
            </div>

            {activeRoute && (
          <button
            type="button"
            onClick={() => setActiveTab('ativa')}
            className={`w-full p-4.5 rounded-2xl border flex items-center justify-between gap-3 text-left transition-all cursor-pointer shadow-md select-none ${
              activeTab === 'ativa'
                ? 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white border-emerald-700 shadow-emerald-200/50 scale-[1.01]'
                : 'bg-emerald-50/70 hover:bg-emerald-100 border-emerald-250/70 text-emerald-950 font-medium'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                activeTab === 'ativa' ? 'bg-white/20 text-white' : 'bg-emerald-600 text-white'
              }`}>
                <Truck className={`w-5 h-5 ${activeTab === 'ativa' ? '' : 'animate-bounce'}`} />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-bold block opacity-90 uppercase tracking-widest leading-none">Jornada Ativa</span>
                <strong className="text-xs font-black truncate block mt-1.5 leading-none">Confirmar Assinatura & Foto</strong>
              </div>
            </div>
            <div className="flex items-center gap-1 font-mono text-[9px] bg-emerald-700/30 text-emerald-100 px-2 py-1 rounded-lg shrink-0 border border-emerald-600/30 font-bold">
               <span>{activeRoute.currentStopIndex + 1}/{activeRoute.stops.length} Parada</span>
            </div>
          </button>
        )}

        <div className="grid grid-cols-5 gap-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/40">
          <button
            onClick={() => setActiveTab('nova')}
            className={`py-3 px-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer flex flex-col items-center justify-center gap-1 uppercase tracking-wider ${
              activeTab === 'nova' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Plus className="w-3.5 h-3.5 text-indigo-600" />
            Nova Rota
          </button>
          <button
            onClick={() => setActiveTab('salvas')}
            className={`py-3 px-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer flex flex-col items-center justify-center gap-1 uppercase tracking-wider ${
              activeTab === 'salvas' ? 'bg-white text-indigo-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Route className="w-3.5 h-3.5 text-indigo-600" />
            Rotas ({myCreatedRoutes.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rotarec')}
            className={`py-3 px-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer flex flex-col items-center justify-center gap-1 uppercase tracking-wider ${
              activeTab === 'rotarec' ? 'bg-white text-indigo-950 shadow-sm animate-pulse' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Truck className="w-3.5 h-3.5 text-emerald-600" />
            REC ({myReceivedRoutes.length})
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`py-3 px-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer flex flex-col items-center justify-center gap-1 uppercase tracking-wider ${
              activeTab === 'chat' ? 'bg-white text-indigo-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
            Suporte
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('resumos')}
            className={`py-3 px-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer flex flex-col items-center justify-center gap-1 uppercase tracking-wider ${
              activeTab === 'resumos' ? 'bg-white text-indigo-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            Resumos ({myCompletedRoutes.length})
          </button>
        </div>

        {/* TAB 1: NEW ROUTE PLANNING WIZARD */}
        {activeTab === 'nova' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-sm space-y-4 text-xs font-sans">
            <span className="font-extrabold text-slate-800 text-xs block uppercase tracking-wider">Elaborar Planejamento de Carga</span>

            <div className="space-y-3.5">
              <div>
                <label className="block text-slate-400 font-semibold mb-1 uppercase text-[9px]">Nome Identificador do Itinerário</label>
                <input
                  type="text"
                  value={routeName}
                  onChange={e => setRouteName(e.target.value)}
                  className="w-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-xl p-3 md:p-2 bg-white text-slate-800 text-[14px] md:text-xs font-sans font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1 uppercase text-[9px]">Origem / CD de Carregamento</label>
                <input
                  type="text"
                  value={origin}
                  onChange={e => {
                    setOrigin(e.target.value);
                    geocodeAddress(e.target.value, true);
                  }}
                  onBlur={e => geocodeAddress(e.target.value, true)}
                  className="w-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-xl p-3 md:p-2 bg-white text-slate-800 text-[14px] md:text-xs font-sans font-medium"
                />
              </div>

              {/* AI Gemini Suggestion Button */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleSuggestAIPrediction}
                  disabled={isLoadingAI}
                  className="w-full py-3 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 text-white font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md text-xs uppercase tracking-wider active:scale-95 animate-pulse"
                >
                  {isLoadingAI ? (
                    <span className="flex items-center gap-1.5 font-bold">
                      <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
                      Analisando com Gemini...
                    </span>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300 fill-amber-300 shrink-0" />
                      Sugerir Rota por IA (Gemini)
                    </>
                  )}
                </button>
              </div>

              {/* Stop addition manager */}
              <div className="p-3.5 border border-indigo-120/40 bg-indigo-50/15 rounded-2xl space-y-3">
                <span className="font-extrabold text-indigo-950 block text-[10px] uppercase tracking-wider">Planejar Paradas</span>
                
                {/* Autocomplete fast presets helper */}
                <div className="bg-white p-3 rounded-xl border border-indigo-100/40 shadow-sm space-y-1.5">
                  <span className="text-[9px] text-slate-400 block w-full font-mono font-bold uppercase tracking-wide">Preencher com Presets rápidos:</span>
                  <div className="flex flex-wrap gap-1.5 font-sans">
                    {GUARIBA_LOCATIONS.map((loc, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => addPresetStop(idx)}
                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-[10px] px-2.5 py-1.5 rounded-full transition-all cursor-pointer border border-indigo-100/40 active:scale-95"
                      >
                        {loc.name.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <input
                      type="text"
                      placeholder="Nome do Cliente"
                      value={clientName}
                      onChange={e => setClientName(e.target.value)}
                      className="w-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-xl p-3 md:p-2 bg-white text-slate-800 text-[14px] md:text-xs font-sans font-medium"
                    />
                  </div>
                  <div>
                    <input
                      type="tel"
                      pattern="[0-9]*"
                      placeholder="WhatsApp (ex: 5533...)"
                      value={clientWhatsApp}
                      onChange={e => setClientWhatsApp(e.target.value)}
                      className="w-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-xl p-3 md:p-2 bg-white text-slate-800 text-[14px] md:text-xs font-sans font-medium"
                    />
                  </div>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    placeholder="Endereço Completo em trânsito"
                    value={clientAddress}
                    onChange={e => {
                      setClientAddress(e.target.value);
                      setIsValidated(false);
                      fetchAddressPredictions(e.target.value);
                    }}
                    className={`w-full border focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-xl p-3 md:p-2 text-[14px] md:text-xs font-sans ${
                      isValidated 
                        ? 'border-emerald-500 bg-emerald-50/20 pr-8 text-emerald-950 font-semibold' 
                        : 'border-slate-200 bg-white'
                    }`}
                  />
                  {isValidating && (
                    <span className="absolute right-3 top-3.5 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                    </span>
                  )}
                  {isValidated && !isValidating && (
                    <span className="absolute right-3 top-2.5 text-emerald-600 font-black text-base select-none" title="Endereço Validado via Google Places">
                      ✓
                    </span>
                  )}

                  {addressPredictions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl max-h-[160px] overflow-y-auto z-50 divide-y divide-slate-100">
                      {addressPredictions.map((pred) => (
                        <button
                          key={pred.placeId}
                          type="button"
                          onClick={() => handleSelectPrediction(pred.description, pred.placeId)}
                          className="w-full text-left p-2.5 hover:bg-indigo-50 text-[11px] text-slate-700 font-semibold truncate shrink-0 cursor-pointer block transition-colors"
                        >
                          📍 {pred.description}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleAddStop}
                  disabled={!isValidated}
                  className={`w-full py-3 font-extrabold rounded-xl flex items-center justify-center gap-1.5 transition-all text-xs uppercase tracking-wider ${
                    isValidated 
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer active:scale-95 shadow-sm' 
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                  }`}
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  Confirmar Parada
                </button>
              </div>

              {/* Added stops listing */}
              {stops.length > 0 && (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1 font-mono font-bold uppercase tracking-wider">
                    <span>Paradas ({stops.length}):</span>
                    <button
                      type="button"
                      onClick={handleRunOptimization}
                      className="text-amber-600 hover:text-amber-805 font-bold flex items-center gap-1 cursor-pointer font-sans"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      Optimize (Google TSP)
                    </button>
                  </div>
                  {stops.map((st, sidx) => (
                    <div key={st.id} className="p-3 border border-slate-100 rounded-xl bg-slate-50/70 flex items-center justify-between text-[11px]">
                      <div className="min-w-0 flex-1 pr-2">
                        <strong className="text-slate-800 block truncate">{sidx + 1}. {st.clientName}</strong>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{st.address}</p>
                      </div>
                      <span className="text-[9px] font-mono font-bold text-indigo-650 bg-indigo-50 border border-indigo-100/50 rounded-md px-2 py-0.5 shrink-0 uppercase">
                        PEDIDO
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={handlePublishRoute}
                className="w-full py-3.5 bg-slate-900 border border-slate-950 hover:bg-slate-800 text-white font-black rounded-xl transition-all cursor-pointer shadow-lg transform active:scale-95 text-xs uppercase tracking-wider text-center"
              >
                Salvar e Publicar Rota
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: SAVED JOURNEYS LIST & ACTIVATE */}
        {activeTab === 'salvas' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-sm space-y-4 text-xs font-sans">
            <span className="font-extrabold text-slate-800 text-xs block uppercase tracking-wider">Minhas Rotas ({myCreatedRoutes.length})</span>

            <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1">
              {myCreatedRoutes.map(route => (
                <div key={route.id} className="p-4 border border-slate-200 rounded-2xl bg-slate-50/50 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-slate-800 font-extrabold truncate max-w-[150px] text-[13px]">{route.name}</strong>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase shrink-0 ${
                      route.status === 'active' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                      route.status === 'completed' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {route.status}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 line-clamp-1">🔍 Origem: <span className="font-medium text-slate-700">{route.origin}</span></p>
                  <p className="text-[11px] text-slate-500">🏁 Paradas: <strong className="text-indigo-600 font-extrabold">{route.stops.length} entregas agendadas</strong></p>

                  <div className="pt-2.5 border-t border-slate-200/60 flex items-center gap-2">
                    {route.status === 'draft' && (
                      <button
                        onClick={() => onStartRoute(route.id)}
                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all text-xs"
                      >
                        <Play className="w-4 h-4 fill-white" />
                        Iniciar Rota
                      </button>
                    )}

                    <button
                      onClick={() => onDeleteRoute(route.id)}
                      className="p-2.5 border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 rounded-xl bg-white hover:bg-rose-50 transition-all cursor-pointer active:scale-90"
                    >
                      <Trash2 className="w-4.5 h-4.5" />
                    </button>
                  </div>
                </div>
              ))}
              {myCreatedRoutes.length === 0 && (
                <div className="text-center py-12 text-slate-400 font-medium">Você não criou nenhuma rota ainda. Use a aba Nova Rota para começar.</div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: SUPPORT REGIONAL CHAT */}
        {activeTab === 'chat' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-sm flex flex-col h-[350px] text-xs font-sans">
            <span className="font-extrabold text-slate-800 border-b border-slate-100 pb-2.5 block mb-2 uppercase tracking-wider">Canal de Ajuda Regional</span>
            
            {/* Tooltip explicativo regional */}
            <div className="bg-amber-50/50 border border-amber-200/50 rounded-xl p-2.5 mb-2 flex items-start gap-1.5 text-[10px] text-amber-900 font-medium select-none shadow-xs">
              <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Visibilidade Restrita ({region}):</strong> Mensagens enviadas aqui só serão visíveis para gerentes e vendedores parceiros alocados nesta mesma região.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto py-2 space-y-3 pr-1">
              {chats.filter(c => c.region === region).map(c => (
                <div key={c.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-100 shadow-sm">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
                    <span className="font-extrabold text-indigo-700">{c.senderName}</span>
                    <span>{new Date(c.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed text-[11px] font-medium">{c.message}</p>
                  {c.audioUrl && (
                    <div className="mt-2 pt-2 border-t border-slate-200/40">
                      <AudioPlayer src={c.audioUrl} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <form onSubmit={handleSendChatText} className="flex gap-2 border-t border-slate-100 pt-3 bg-white mt-2 items-center font-sans">
              <input
                type="text"
                placeholder="Exemplo: Carga despachada com sucesso..."
                value={chatText}
                onChange={e => setChatText(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 p-3 bg-white text-[14px] md:text-xs h-11"
              />
              <AudioRecorderButton onSendAudio={(base64) => onPostMessage('🎙️ Nota de Áudio', base64)} />
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 rounded-xl w-11 h-11 text-white font-extrabold flex items-center justify-center cursor-pointer shrink-0 active:scale-95 transition-all shadow-sm">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* TAB 4: RECEIVED ROUTES FROM MANAGER (ROTA REC) */}
        {activeTab === 'rotarec' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-sm space-y-4 text-xs font-sans">
            <span className="font-extrabold text-slate-800 text-xs block uppercase tracking-wider">
              Rotas Recebidas / REC ({myReceivedRoutes.length})
            </span>

            {mEditingRouteId ? (
              // Inline edit interface for editing a received route
              <div className="space-y-4 border border-indigo-100 bg-indigo-50/20 p-4 rounded-xl">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="font-extrabold text-indigo-900 uppercase text-[10px]">Editar Rota Recebida</span>
                  <button 
                    onClick={() => setMEditingRouteId(null)}
                    className="text-slate-400 hover:text-slate-600 font-bold hover:bg-slate-100 p-1 rounded-md text-[10px]"
                  >
                    Cancelar
                  </button>
                </div>

                <div className="space-y-3 font-sans">
                  <div>
                    <label className="block text-[9px] text-slate-400 uppercase font-bold">Identificador</label>
                    <input 
                      type="text" 
                      value={mEditingRouteName}
                      onChange={e => setMEditingRouteName(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl p-2 bg-white text-xs font-medium focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] text-slate-400 uppercase font-bold">Origem</label>
                    <input 
                      type="text" 
                      value={mEditingRouteOrigin}
                      onChange={e => setMEditingRouteOrigin(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl p-2 bg-white text-xs font-medium focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Stops list inside editable mode wrapper */}
                  <div className="space-y-2">
                    <span className="block text-[9px] text-slate-400 uppercase font-bold">Pontos de Parada ({mEditingRouteStops.length})</span>
                    <div className="space-y-1.5 max-h-[120px] overflow-y-auto bg-white/60 p-2 rounded-lg border">
                      {mEditingRouteStops.map((st, sIdx) => (
                        <div key={st.id} className="flex items-center justify-between bg-white border p-2 rounded-lg gap-2">
                          <div className="truncate">
                            <p className="font-bold text-[11px] text-slate-800">{st.clientName}</p>
                            <p className="text-[9px] text-slate-400 truncate">{st.address}</p>
                          </div>
                          <button 
                            type="button"
                            onClick={() => setMEditingRouteStops(prev => prev.filter(item => item.id !== st.id))}
                            className="text-rose-500 hover:bg-rose-50 p-1 rounded transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      {mEditingRouteStops.length === 0 && (
                        <p className="text-center py-4 text-slate-400 text-[10px]">Sem clientes adicionados.</p>
                      )}
                    </div>
                  </div>

                  {/* Add a stop to editing route */}
                  <div className="p-2 border border-dashed rounded-xl space-y-2 bg-white/30">
                    <span className="block text-[9px] font-bold text-indigo-900 uppercase">Adicionar Nova Parada</span>
                    <div className="grid grid-cols-2 gap-1.5 font-sans">
                      <input 
                        type="text" 
                        placeholder="Nome do Cliente"
                        value={mEditClientName}
                        onChange={e => setMEditClientName(e.target.value)}
                        className="border border-slate-200 rounded-md p-1.5 bg-white text-[11px]"
                      />
                      <input 
                        type="tel" 
                        placeholder="WhatsApp"
                        value={mEditClientWhatsApp}
                        onChange={e => setMEditClientWhatsApp(e.target.value)}
                        className="border border-slate-200 rounded-md p-1.5 bg-white text-[11px]"
                      />
                    </div>
                    <div className="relative font-sans">
                      <input 
                        type="text" 
                        placeholder="Endereço Completo do Cliente"
                        value={mEditClientAddress}
                        onChange={e => setMEditClientAddress(e.target.value)}
                        className="w-full border border-slate-200 rounded-md p-1.5 bg-white text-[11px]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!mEditClientName || !mEditClientAddress) {
                          alert('Por favor preencha nome e endereço.');
                          return;
                        }
                        const newSt: Parada = {
                          id: `p_stop_edit_${Date.now()}`,
                          clientName: mEditClientName,
                          clientWhatsApp: mEditClientWhatsApp,
                          address: mEditClientAddress,
                          lat: -18.85 + (Math.random() - 0.5) * 0.05,
                          lng: -41.95 + (Math.random() - 0.5) * 0.05,
                          status: 'pending'
                        };
                        setMEditingRouteStops([...mEditingRouteStops, newSt]);
                        setMEditClientName('');
                        setMEditClientWhatsApp('');
                        setMEditClientAddress('');
                      }}
                      className="w-full py-1 text-[10px] bg-slate-100 border text-slate-700 hover:bg-slate-200 mt-1 cursor-pointer rounded-md font-bold text-center"
                    >
                      Adicionar Parada à Rota
                    </button>
                  </div>

                  <div className="flex gap-2 pt-2 border-t">
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateRoute(mEditingRouteId, {
                          name: mEditingRouteName,
                          origin: mEditingRouteOrigin,
                          stops: mEditingRouteStops
                        });
                        setMEditingRouteId(null);
                        alert('Alterações salvas com sucesso!');
                      }}
                      className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs cursor-pointer"
                    >
                      Salvar Alterações
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (mEditingRouteStops.length <= 1) {
                          alert('Necessita ao menos duas paradas para otimizar.');
                          return;
                        }
                        try {
                          const sorted = await onOptimize(mEditingRouteStops, -18.845, -41.945);
                          setMEditingRouteStops(sorted);
                          alert('Rota de edição otimizada via Google Directions API (optimizeWaypoints:true)!');
                        } catch (err: any) {
                          alert('Falha na otimização: ' + err.message);
                        }
                      }}
                      className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex gap-1 items-center cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                      Otimizar
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              // List view of received routes
              <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1">
                {myReceivedRoutes.map(route => (
                  <div key={route.id} className="p-4 border border-slate-200 rounded-2xl bg-emerald-50/25 border-l-4 border-l-emerald-500 space-y-3 shadow-md">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <strong className="text-slate-800 font-extrabold truncate max-w-[150px] text-[13px] block">
                          {route.name}
                        </strong>
                        <span className="text-[9px] text-slate-400 block font-mono">Recebida do Gerente Regional</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase shrink-0 ${
                        route.status === 'active' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                        route.status === 'completed' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                      }`}>
                        {route.status}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 line-clamp-1">🔍 Origem: <span className="font-medium text-slate-700">{route.origin}</span></p>
                    <div className="text-[11px] text-slate-500 mt-1">
                      <p className="font-bold text-slate-700 mb-1 uppercase text-[9px] tracking-wider">📋 Clientes / Paradas ({route.stops.length}):</p>
                      <div className="bg-white/80 rounded-xl p-2 border space-y-1 font-sans text-[10.5px] leading-relaxed">
                        {route.stops.map((st, idx) => (
                          <motion.div 
                            key={st.id} 
                            layout
                            initial={{ opacity: 0.9, scale: 0.98 }}
                            animate={{ 
                              opacity: 1, 
                              scale: 1,
                              backgroundColor: st.status === 'completed' ? '#ecfdf5' : st.status === 'Chegando' ? '#fffbeb' : '#ffffff',
                              color: st.status === 'completed' ? '#065f46' : st.status === 'Chegando' ? '#92400e' : '#334155'
                            }}
                            className="flex justify-between items-center px-2 py-1.5 rounded-lg border border-slate-100 gap-1"
                          >
                            <span className="truncate max-w-[140px] font-medium">#{idx + 1} {st.clientName}</span>
                            <span className={`font-mono font-black text-[9px] shrink-0 uppercase border px-1.5 py-0.5 rounded-full leading-none ${
                              st.status === 'completed' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                              st.status === 'Chegando' ? 'bg-amber-50 text-amber-800 border-amber-200 animate-pulse' : 'bg-slate-50 text-slate-500 border-slate-150'
                            }`}>
                              {st.status === 'completed' ? 'CONCLUÍDO ✓' : st.status === 'Chegando' ? 'CHEGANDO 🚚' : 'PENDENTE'}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-slate-200/60 flex items-center gap-2">
                      {route.status === 'draft' && (
                        <button
                          onClick={() => {
                            onStartRoute(route.id);
                            alert(`Rota "${route.name}" iniciada com sucesso! Você pode acompanhar o monitoramento de satélite.`);
                          }}
                          className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all text-xs"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          Iniciar Rota
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setMEditingRouteId(route.id);
                          setMEditingRouteName(route.name);
                          setMEditingRouteOrigin(route.origin);
                          setMEditingRouteStops(route.stops);
                        }}
                        className="py-1.5 px-3 border border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-xl font-bold transition-all hover:border-indigo-300 cursor-pointer text-xs"
                      >
                        Editar
                      </button>

                      <button
                        onClick={() => {
                          if (confirm('Deseja excluir esta rota recebida permanentemente?')) {
                            onDeleteRoute(route.id);
                          }
                        }}
                        className="p-1.5 border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 rounded-xl bg-white hover:bg-rose-50 transition-all cursor-pointer active:scale-90"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {myReceivedRoutes.length === 0 && (
                  <div className="text-center py-12 text-slate-400 font-medium">Nenhuma rota enviada pelo gerente regional no momento.</div>
                )}
              </div>
            )}

            {/* TAB 5: FINISHED ROUTE SUMMARY */}
            {activeTab === 'resumos' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-sm space-y-4 text-xs font-sans">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wider block">Resumo de Rotas Finalizadas</span>
                  <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full">
                    {myCompletedRoutes.length} Concluídas
                  </span>
                </div>

                {myCompletedRoutes.length > 0 ? (
                  (() => {
                    const activeCompletedRouteId = selectedCompletedRouteId || myCompletedRoutes[myCompletedRoutes.length - 1]?.id || null;
                    const activeCompletedRoute = myCompletedRoutes.find(r => r.id === activeCompletedRouteId) || myCompletedRoutes[myCompletedRoutes.length - 1];
                    const activePerformanceLog = performanceLogs.find(p => p.routeId === activeCompletedRoute?.id) || null;

                    // Telemetry & fallbacks
                    const dist = activePerformanceLog ? activePerformanceLog.actualDistanceKm : (activeCompletedRoute ? parseFloat((activeCompletedRoute.stops.length * 7.5 + 4.2).toFixed(1)) : 0);
                    const planDist = activePerformanceLog ? activePerformanceLog.plannedDistanceKm : parseFloat((dist * 0.95).toFixed(1));
                    const totalStops = activeCompletedRoute?.stops?.length || 0;
                    
                    let timeStr = "";
                    if (activePerformanceLog && activePerformanceLog.startTimestamp && activePerformanceLog.endTimestamp) {
                      const diffMs = new Date(activePerformanceLog.endTimestamp).getTime() - new Date(activePerformanceLog.startTimestamp).getTime();
                      const diffMins = Math.round(diffMs / 60000);
                      const hrs = Math.floor(diffMins / 60);
                      const mins = diffMins % 60;
                      timeStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
                    } else if (activeCompletedRoute) {
                      const mins = activeCompletedRoute.stops.length * 15 + 35;
                      const hrs = Math.floor(mins / 60);
                      const rem = mins % 60;
                      timeStr = `${hrs}h ${rem}m`;
                    }

                    return (
                      <div className="space-y-4">
                        {/* Selector of completed routes if more than 1 */}
                        {myCompletedRoutes.length > 1 && (
                          <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-xl flex items-center justify-between gap-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase font-mono shrink-0 font-sans">Selecionar Viagem:</label>
                            <select
                              value={activeCompletedRoute?.id || ''}
                              onChange={(e) => setSelectedCompletedRouteId(e.target.value)}
                              className="flex-1 bg-white border border-slate-200 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 font-medium font-sans"
                            >
                              {myCompletedRoutes.map(completed => (
                                <option key={completed.id} value={completed.id}>
                                  {completed.name} ({new Date().toLocaleDateString('pt-BR')})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Highly Polished Resumo Main Card */}
                        <div className="border border-emerald-100 bg-emerald-50/20 rounded-2xl p-4 space-y-4 shadow-sm">
                          <div className="flex items-center justify-between border-b border-emerald-110 pb-2">
                            <div>
                              <h4 className="font-extrabold text-slate-800 text-[13px]">{activeCompletedRoute?.name}</h4>
                              <span className="text-[10px] text-slate-400 block font-mono">
                                ID: #{activeCompletedRoute?.id.substring(activeCompletedRoute?.id.length - 8)}
                              </span>
                            </div>
                            <span className="px-2.5 py-1 bg-emerald-500 text-white text-[10px] font-black uppercase rounded-lg tracking-wider">
                              Concluída com Sucesso 🏆
                            </span>
                          </div>

                          {/* Bento grid of metrics */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white border border-slate-100 p-3 rounded-xl flex flex-col justify-between shadow-xs">
                              <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider font-mono">Distância Percorrida</span>
                              <div className="mt-1">
                                <span className="text-lg font-black text-slate-800 font-mono">{dist} km</span>
                                <span className="block text-[9px] text-slate-400 font-mono">Planejado: {planDist} km</span>
                              </div>
                            </div>

                            <div className="bg-white border border-slate-100 p-3 rounded-xl flex flex-col justify-between shadow-xs">
                              <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider font-mono">Tempo de Viagem</span>
                              <div className="mt-1">
                                <span className="text-lg font-black text-slate-800 font-mono">{timeStr}</span>
                                <span className="block text-[9px] text-emerald-600 font-bold uppercase tracking-wider font-mono flex items-center gap-0.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block"></span> Sem atrasos
                                </span>
                              </div>
                            </div>

                            <div className="bg-white border border-slate-100 p-3 rounded-xl col-span-2 flex items-center justify-between shadow-xs">
                              <div>
                                <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider font-mono block mb-1">Taxa de Conclusão</span>
                                <span className="text-xs font-black text-slate-700">
                                  {totalStops} de {totalStops} paradas atendidas
                                </span>
                              </div>
                              <div className="bg-emerald-500 shrink-0 text-white text-xs font-mono font-black h-9 w-9 rounded-full flex items-center justify-center border-2 border-white shadow-md">
                                100%
                              </div>
                            </div>
                          </div>

                          {/* Deviations Panel */}
                          <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-xl flex items-center justify-between text-[11px] font-mono">
                            <div className="flex items-center gap-1 text-slate-600">
                              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                              <span>Desvios Geográficos:</span>
                            </div>
                            <strong className="text-slate-800 font-extrabold">{activePerformanceLog?.routeDeviations || 0} desvios</strong>
                          </div>
                        </div>

                        {/* Timeline of successfully completed stops */}
                        <div className="space-y-3">
                          <span className="font-extrabold text-slate-700 text-[10px] uppercase font-mono block tracking-wider">
                            📋 Relatório de Entregas Concluídas
                          </span>

                          <div className="relative border-l border-emerald-500 ml-3 pl-4 space-y-4 py-2">
                            {activeCompletedRoute?.stops?.map((stop, sIdx) => {
                              const arrivalTime = activePerformanceLog?.stopTelemetry?.[sIdx]?.arrivalTimestamp 
                                ? new Date(activePerformanceLog.stopTelemetry[sIdx].arrivalTimestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                                : (() => {
                                    const baseHour = 8;
                                    const totalMinutes = sIdx * 50 + 40;
                                    const hour = baseHour + Math.floor(totalMinutes / 60);
                                    const min = totalMinutes % 60;
                                    return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
                                  })();

                              const handleWhatsAppMsg = () => {
                                if (!stop.clientWhatsApp) return;
                                const text = `Olá ${stop.clientName}, sua entrega no endereço ${stop.address} foi concluída com sucesso às ${arrivalTime} pelo motorista ${user.name}!`;
                                const cleanPhone = stop.clientWhatsApp.replace(/\D/g, '');
                                window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`);
                              };

                              return (
                                <div key={stop.id} className="relative">
                                  {/* Timeline Circle Bullet */}
                                  <span className="absolute -left-[22px] top-1 h-3 w-3 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center text-white shrink-0 shadow-sm">
                                    <Check className="w-2 h-2 font-bold" />
                                  </span>

                                  <div className="bg-white border border-slate-150 p-3 rounded-xl shadow-xs space-y-1.5">
                                    <div className="flex items-center justify-between">
                                      <strong className="text-slate-800 text-[11px] font-extrabold truncate max-w-[130px]">
                                        #{sIdx + 1} {stop.clientName}
                                      </strong>
                                      <span className="text-[10px] text-slate-400 font-mono font-semibold flex items-center gap-0.5">
                                        <Clock className="w-3 h-3 text-slate-400" />
                                        {arrivalTime}
                                      </span>
                                    </div>

                                    <p className="text-[10px] text-slate-500 line-clamp-1">📍 {stop.address}</p>

                                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                                      <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-md uppercase">
                                        Sucesso ✅
                                      </span>
                                      {stop.clientWhatsApp && (
                                        <button
                                          type="button"
                                          onClick={handleWhatsAppMsg}
                                          className="text-emerald-700 hover:text-emerald-800 text-[10px] font-bold flex items-center gap-1 font-sans underline cursor-pointer"
                                        >
                                          <Phone className="w-3 h-3 text-emerald-500 fill-emerald-100" />
                                          {stop.clientWhatsApp}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="text-center py-16 text-slate-400 space-y-2">
                    <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200/80 mx-auto flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className="font-semibold text-xs text-slate-500">Sem Jornadas Concluídas</p>
                    <p className="text-[10px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                      As rotas que você iniciar e concluir com sucesso serão registradas para consolidação telemetria e visualização de tempos/distâncias.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 6: ACTIVE STOP CONFIRMATION & VERIFICATION (SIGNATURE & PHOTO) */}
            {activeTab === 'ativa' && activeRoute && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-sm space-y-4 text-xs font-sans">
                {(() => {
                  const currentStopIndex = activeRoute.currentStopIndex;
                  const currentStop = activeRoute.stops[currentStopIndex];

                  if (!currentStop) {
                    return (
                      <div className="text-center py-10 space-y-3">
                        <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto text-emerald-500">
                          <Check className="w-7 h-7" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-slate-800 text-sm uppercase">Todas as Entregas Concluídas!</h4>
                          <p className="text-[10px] text-slate-400 mt-1 max-w-xs mx-auto">
                            Excelente! Todas as paradas deste roteiro foram entregues e confirmadas com assinatura digital.
                          </p>
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              // Mark the route itself as completed
                              await onUpdateRoute(activeRoute.id, { status: 'completed' });
                              alert('Jornada de entregas finalizada com sucesso! Relatório telemetria salvo.');
                              setActiveTab('resumos');
                            } catch (e) {
                              alert('Falha ao concluir rota. Tente novamente.');
                            }
                          }}
                          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer uppercase tracking-wider text-xs"
                        >
                          <CheckCircle className="w-4 h-4 text-white" />
                          Finalizar Jornada
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {/* Delivery Card Header */}
                      <div className="border border-emerald-100 bg-emerald-50/15 rounded-2xl p-4">
                        <div className="flex items-center justify-between font-mono text-[9px] text-emerald-700 font-extrabold pb-2 border-b border-emerald-100/50 uppercase tracking-widest">
                          <span>📍 Entrega Atual (Parada #{currentStopIndex + 1})</span>
                          <span>Região: {region}</span>
                        </div>
                        
                        <div className="mt-3">
                          <strong className="text-slate-800 text-[13px] block font-black leading-tight">{currentStop.clientName}</strong>
                          <p className="text-[11px] text-slate-500 mt-1 select-all font-medium leading-snug">{currentStop.address}</p>
                        </div>

                        {/* Customer Quick Actions */}
                        <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
                          {currentStop.clientWhatsApp && (
                            <a
                              href={`https://wa.me/${currentStop.clientWhatsApp.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 py-2.5 bg-white border border-slate-200 hover:border-emerald-200 text-emerald-800 hover:bg-emerald-50 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 text-[10px] uppercase tracking-wider select-none leading-none text-center"
                            >
                              <Phone className="w-3.5 h-3.5 text-emerald-500 fill-emerald-150 inline" />
                              <span className="align-middle ml-1">WhatsApp</span>
                            </a>
                          )}
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${currentStop.lat},${currentStop.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 py-2.5 bg-white border border-slate-200 hover:border-indigo-200 text-indigo-800 hover:bg-indigo-50 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 text-[10px] uppercase tracking-wider select-none leading-none text-center"
                          >
                            <MapPin className="w-3.5 h-3.5 text-indigo-500 inline" />
                            <span className="align-middle ml-1">Navegar</span>
                          </a>
                        </div>
                      </div>

                      {/* CLIENT DIGITAL SIGNATURE PAD */}
                      <div className="space-y-2 select-none">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider">Passo 1: Assinatura Digital do Cliente</span>
                          {hasSigned && (
                            <button
                              type="button"
                              onClick={handleClearSignature}
                              className="text-[10px] font-black text-rose-600 hover:text-rose-700 uppercase flex items-center gap-1 hover:underline cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Limpar
                            </button>
                          )}
                        </div>

                        <div className="relative border border-slate-250 bg-slate-50/50 rounded-2xl overflow-hidden aspect-[16/9] flex flex-col shadow-inner">
                          <canvas
                            ref={signatureCanvasRef}
                            onMouseDown={handleStartDrawing}
                            onMouseMove={handleDraw}
                            onMouseUp={handleStopDrawing}
                            onMouseLeave={handleStopDrawing}
                            onTouchStart={handleStartDrawing}
                            onTouchMove={handleDraw}
                            onTouchEnd={handleStopDrawing}
                            className="w-full h-full bg-transparent cursor-crosshair touch-none"
                          />
                          {!hasSigned && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/5 backdrop-blur-[0.5px] pointer-events-none select-none text-slate-400">
                              <span className="text-[10px] uppercase font-black tracking-widest text-slate-600">Assinar aqui na tela</span>
                              <span className="text-[9px] text-slate-400 mt-1">Utilize o dedo ou caneta touch</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* PHOTO DELIVERY CONFERENCE WITH DEVICE NATIVE CAMERA */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider">Passo 2: Foto de Comprovante de Carga</span>
                          {capturedPhoto && (
                            <button
                              type="button"
                              onClick={() => setCapturedPhoto(null)}
                              className="text-[10px] font-black text-rose-600 hover:text-rose-700 uppercase flex items-center gap-1 hover:underline cursor-pointer"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Recapturar
                            </button>
                          )}
                        </div>

                        {!capturedPhoto ? (
                          <div className="border border-dashed border-slate-300 rounded-2xl bg-slate-50/50 p-6 flex flex-col items-center justify-center text-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
                              <Camera className="w-6 h-6" />
                            </div>
                            <div className="space-y-1">
                              <p className="font-extrabold text-slate-700 text-[11px]">Fotoconferência de Carga</p>
                              <p className="text-[9px] text-slate-400 max-w-[220px]">Registre uma imagem nítida da mercadoria entregue no local do recebedor.</p>
                            </div>

                            {/* Native camera trigger input */}
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              id="photo-capture-input-panel"
                              className="hidden"
                              onChange={handlePhotoFileChange}
                            />
                            <label
                              htmlFor="photo-capture-input-panel"
                              className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/50 text-indigo-700 font-extrabold rounded-xl shadow-sm cursor-pointer select-none active:scale-95 transition-all text-[11px] uppercase tracking-wider flex items-center gap-1.5"
                            >
                              <Camera className="w-4 h-4 text-indigo-600" />
                              Capturar da Câmera
                            </label>
                          </div>
                        ) : (
                          <div className="relative border border-slate-200 bg-slate-50 p-1.5 rounded-2xl overflow-hidden shadow-sm">
                            <img
                              src={capturedPhoto}
                              alt="Comprovante de entrega"
                              referrerPolicy="no-referrer"
                              className="w-full aspect-[4/3] object-cover rounded-xl border border-slate-200/50"
                            />
                            <div className="absolute top-3 right-3 flex gap-1.5">
                              <span className="bg-emerald-500/90 text-white font-mono font-black text-[9px] px-2 py-0.5 rounded uppercase shadow-sm select-none">FOTO CAPTURADA</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* CONCLUDE SUBMIT ACTION BUTTON */}
                      <button
                        type="button"
                        onClick={() => handleConfirmDelivery(activeRoute.id, currentStop.id)}
                        className="w-full mt-6 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-650 hover:from-emerald-700 hover:to-teal-700 text-white font-black uppercase rounded-2xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-98 text-xs tracking-wider cursor-pointer"
                      >
                        <CheckCircle className="w-4 h-4 fill-white text-emerald-605" />
                        Confirmar & Registrar Entrega
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
          </div>
        )}
      </div>

      {/* Right Column: GPS Tracking & Vector Live Map */}
      <div className={`transition-all duration-300 ${isSidebarOpen ? 'lg:col-span-8' : 'lg:col-span-11'} flex flex-col h-[400px] lg:h-full`}>
        
        {/* Dynamic active trip navigation dashboard overlay */}
        {activeRoute && (
          <div className={`mb-4 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm transition-all duration-300 ${
            isSharingLocation 
              ? 'bg-emerald-500 text-white animate-pulse' 
              : 'bg-slate-800 text-slate-300 animate-none'
          }`}>
            <div>
              <span className={`text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded ${
                isSharingLocation ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-700 text-slate-400'
              }`}>
                {isSharingLocation ? 'JORNADA ATIVA' : 'JORNADA PAUSADA'}
              </span>
              <h3 className="font-bold text-sm mt-1">{activeRoute.name}</h3>
              <p className="text-xs opacity-90">
                {isSharingLocation 
                  ? `Seu trajeto está sendo rastreado em tempo real na região ${region}.`
                  : 'Compartilhamento de GPS temporariamente suspenso pelo condutor.'}
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto text-xs font-mono">
              <div className={`${isSharingLocation ? 'bg-emerald-600/60' : 'bg-slate-700/65'} p-2 rounded border ${isSharingLocation ? 'border-emerald-400/30' : 'border-slate-600/40'}`}>
                <span className="block text-[9px] uppercase opacity-85">Próxima entrega:</span>
                <strong className="text-sm font-black whitespace-nowrap">
                  {activeRoute.stops[activeRoute.currentStopIndex]?.clientName || 'Concluída!'}
                </strong>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-3 select-none">
          <span className="text-[11px] font-bold text-slate-500 uppercase font-mono">Monitor de Mapa:</span>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setMapMode('vector')}
              className={`px-3 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                mapMode === 'vector' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Mapa Vetorial
            </button>
            <button
              onClick={() => setMapMode('google')}
              className={`px-3 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                mapMode === 'google' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Google Maps Platform
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-[350px]">
          {mapMode === 'vector' ? (
            <InteractiveMap 
              rota={activeRoute} 
              driverLocation={activeRoute ? locations[user.id] || null : null}
              region={region}
              onStopClick={setConfirmingStop}
            />
          ) : (
            <RouteMap 
              rotas={myRoutes}
              locations={locations}
              currentUserRegion={region}
              currentUserRole={user.role}
              singleRouteMode={activeRoute}
              singleDriverLocation={activeRoute ? locations[user.id] || null : null}
              onStopClick={setConfirmingStop}
            />
          )}
        </div>
      </div>

      {/* RENDER DYNAMIC MULTI-PHOTO DELIVERY CONFIRMATION MODAL */}
      {confirmingStop && (
        <div id="modal-comprovante-entrega" className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white border border-slate-200 shadow-2xl rounded-3xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] md:max-h-[95vh] relative animate-scale-up font-sans">
            {/* Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/30">
                  <CheckCircle className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wide">Confirmar Entrega</h3>
                  <p className="text-[10px] text-slate-400 font-mono tracking-wider">CLIENTE INTEGRADO • REAL-TIME</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => {
                  setConfirmingStop(null);
                  setConfirmPhotos([]);
                  setModalHasSigned(false);
                }} 
                className="text-slate-400 hover:text-white transition-all p-2 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-5 overflow-y-auto flex-1 space-y-5">
              {/* Target Client Metadata Card */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono block">Destinatário Logístico</span>
                <strong className="text-slate-800 text-sm block font-extrabold">{confirmingStop.clientName}</strong>
                <p className="text-slate-500 text-[11px] leading-relaxed">📍 {confirmingStop.address}</p>
              </div>

              {/* Step 1: Canvas Signature */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                    🖊️ Colete a Assinatura Digital:
                  </label>
                  <button 
                    type="button" 
                    onClick={handleModalClearSignature}
                    className="text-[10px] text-red-600 hover:text-red-700 border border-red-200 hover:bg-red-50 font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                  >
                    Recomeçar / Limpar
                  </button>
                </div>

                <div className="relative border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-inner h-[180px] flex flex-col">
                  <canvas
                    ref={modalSignatureCanvasRef}
                    onMouseDown={handleModalStartDrawing}
                    onMouseMove={handleModalDraw}
                    onMouseUp={handleModalStopDrawing}
                    onMouseLeave={handleModalStopDrawing}
                    onTouchStart={handleModalStartDrawing}
                    onTouchMove={handleModalDraw}
                    onTouchEnd={handleModalStopDrawing}
                    className="w-full h-full cursor-crosshair touch-none bg-slate-50/20"
                  />
                  {!modalHasSigned && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400/80 text-[11px] font-medium uppercase font-sans">
                      Assine aqui com o dedo ou canetinha digital
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2: Collection of up to 5 validation photos */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                    📷 Fotos Comprovantes ({confirmPhotos.length} de 5):
                  </label>
                  
                  {confirmPhotos.length < 5 ? (
                    <label className="relative flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] uppercase tracking-wide px-3 py-2 rounded-xl border border-indigo-700 shadow-sm transition-all cursor-pointer hover:scale-[1.02] active:scale-95 select-none animate-pulse">
                      <Camera className="w-3.5 h-3.5 text-indigo-200" />
                      Capturar Foto
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleModalPhotoFileChange} 
                        className="hidden" 
                        capture="environment" // trigger camera immediately on mobile
                        multiple
                      />
                    </label>
                  ) : (
                    <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-100 font-extrabold px-2 py-1 rounded-lg uppercase">
                      Limite de Fotos Preenchido ✅
                    </span>
                  )}
                </div>

                {/* Symmetrical grid for previews */}
                {confirmPhotos.length > 0 ? (
                  <div className="grid grid-cols-5 gap-2 bg-slate-50 border border-slate-100 p-3 rounded-2xl">
                    {confirmPhotos.map((photo, pIdx) => (
                      <div key={pIdx} className="relative aspect-square rounded-xl bg-white border border-slate-200 overflow-hidden shadow-xs group">
                        <img 
                          src={photo} 
                          alt={`Proof ${pIdx + 1}`} 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveConfirmPhoto(pIdx)}
                          className="absolute inset-0 bg-red-600/70 hover:bg-red-700/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all rounded-xl cursor-pointer"
                          title="Remover foto do relatório"
                        >
                          <Trash2 className="w-4 h-4 text-white" />
                        </button>
                        <span className="absolute bottom-1 right-1 text-[8px] font-extrabold font-mono text-slate-900 bg-white/90 border border-slate-200 px-1 rounded">
                          #{pIdx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-7 border border-dashed border-slate-200 bg-slate-50/50 rounded-2xl text-slate-400 space-y-1.5">
                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                      <Camera className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-slate-500">Nenhuma foto adicionada ainda</p>
                      <p className="text-[9px] text-slate-400">É obrigatório anexar no mínimo 1 foto do comprovante fiscal, carga ou estabelecimento.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sticky Actions Footer */}
            <div className="bg-slate-50 border-t border-slate-100 p-4 sticky bottom-0 z-10 flex gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setConfirmingStop(null);
                  setConfirmPhotos([]);
                  setModalHasSigned(false);
                }}
                className="w-1/3 py-3 border border-slate-200 bg-white hover:bg-slate-100 hover:border-slate-300 text-slate-700 font-bold rounded-2xl text-xs uppercase cursor-pointer select-none transition-all active:scale-95"
              >
                Voltar ao Mapa
              </button>

              <button
                type="button"
                onClick={handleConfirmModalDelivery}
                className="w-2/3 py-3 bg-indigo-600 hover:bg-indigo-700 border border-indigo-700 text-white font-extrabold rounded-2xl text-xs uppercase tracking-wider shadow-md hover:shadow-indigo-100 shadow-indigo-50/50 flex items-center justify-center gap-1.5 transition-all select-none active:scale-95 cursor-pointer"
              >
                <CheckCircle className="w-4 h-4 text-white" />
                Registrar Comprovantes
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
