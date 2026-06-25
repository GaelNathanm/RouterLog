import React, { useState, useEffect } from 'react';
import { 
  Compass, 
  HelpCircle, 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  Map, 
  Radio, 
  Database, 
  Smartphone, 
  ShieldAlert, 
  TrendingUp, 
  Users,
  CheckCircle 
} from 'lucide-react';
import { UserRole } from '../types';

interface TutorialStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  highlightText: string;
}

interface WelcomeTutorialProps {
  role: UserRole;
  activeTab?: string;
  onClose?: () => void;
  forceOpen?: boolean;
}

export default function WelcomeTutorial({ role, activeTab, onClose, forceOpen = false }: WelcomeTutorialProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const getLocalStorageKey = () => `routelog_welcome_seen_${UserRole[role].toLowerCase()}`;

  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
      setCurrentStep(0);
      return;
    }

    const seenKey = getLocalStorageKey();
    if (typeof window !== 'undefined') {
      const hasSeen = localStorage.getItem(seenKey);
      if (!hasSeen) {
        // Auto open after a small delay to let transitions finish
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 1200);
        return () => clearTimeout(timer);
      }
    }
  }, [forceOpen, role]);

  const handleDismiss = () => {
    setIsOpen(false);
    const seenKey = getLocalStorageKey();
    localStorage.setItem(seenKey, 'true');
    if (onClose) onClose();
  };

  // Helper step configs based on User Role and current sub-tab
  const getStepsByRole = (): TutorialStep[] => {
    switch (role) {
      case UserRole.ADMIN:
        return [
          {
            title: "Bem-vindo ao Command Center Master",
            description: "Você está no topo da hierarquia operacional do RouteLog. Aqui você tem controle total de segurança e supervisão de dados.",
            icon: <ShieldAlert className="w-8 h-8 text-red-500" />,
            highlightText: "Controle Centralizado Total"
          },
          {
            title: "User Impersonation (Espelhamento)",
            description: "Clique no botão 'Visualizar como' em qualquer usuário para emular a perspectiva exata dele (Motoristas, Gerentes, Vendedores) sem precisar de senhas.",
            icon: <Users className="w-8 h-8 text-blue-500" />,
            highlightText: "Auditoria Sem Atrito"
          },
          {
            title: "Auditoria Reativa & Enforcement de 1s",
            description: "Gerencie permissões em tempo real. Suspenda ou bana operadoras com suspeita de desvio. O RouteLog encerra sessões ativas instantaneamente via Security Rules.",
            icon: <Sparkles className="w-8 h-8 text-amber-500" />,
            highlightText: "Segurança de Dados com Alta Reatividade"
          }
        ];

      case UserRole.GERENTE:
        return [
          {
            title: "Painel de Logística Regional",
            description: "Bem-vindo à sala de controle regional! Suas ações estão isoladas para garantir máxima autonomia de frotas locais e entrega ágil.",
            icon: <Compass className="w-8 h-8 text-indigo-500 animate-pulse" />,
            highlightText: "Seção de Despacho e Rotas"
          },
          {
            title: "Importação e Validação de Clientes",
            description: "Adicionamos o assistente inteligente na aba 'Clientes'! Arraste arquivos Excel (XLSX) ou CSV, filtre registros e edite dados problemáticos diretamente na tabela interativa antes de planejar.",
            icon: <Database className="w-8 h-8 text-emerald-500" />,
            highlightText: "Assistente Corporativo Flexível"
          },
          {
            title: "Monitoramento GIS Real-time",
            description: "Acompanhe seus motoristas no mapa nativo ou mude para o Google Maps Platform para ver rotas otimizadas e telemetria de trânsito em tempo real.",
            icon: <Map className="w-8 h-8 text-blue-500" />,
            highlightText: "Observabilidade 360°"
          },
          {
            title: "Canal de Rádio e Push Central",
            description: "Troque mensagens com a equipe em trânsito ou grave áudios que serão reproduzidos no app dos motoristas. E envie notificações push customizadas via canais Google FCM.",
            icon: <Radio className="w-8 h-8 text-rose-500 animate-bounce" style={{ animationDuration: '3s' }} />,
            highlightText: "Comunicação de Equipe Unificada"
          }
        ];

      case UserRole.MOTORISTA:
        return [
          {
            title: "Central de bordo do Condutor",
            description: "Seu aplicativo de rota foi otimizado para navegação ao vivo. Toda a sua jornada logística é reportada em segurança à sua gerência.",
            icon: <Smartphone className="w-8 h-8 text-emerald-500" />,
            highlightText: "Foco Total nas Entregas"
          },
          {
            title: "Navegação por GPS Nativos",
            description: "Você conta com um radar bússola em tempo real. Cada ponto de parada exibe direções simplificadas para evitar desvios geográficos acidentais.",
            icon: <Compass className="w-8 h-8 text-indigo-505" />,
            highlightText: "Eficácia de Combustível e Tempo"
          },
          {
            title: "Comunicação em Tempo Real",
            description: "O painel transmite sua localização via GPS a cada 4 segundos. Se houver problemas na rota ou alteração de parada, o chat com sua gerência está sempre ativo.",
            icon: <Radio className="w-8 h-8 text-amber-500 animate-pulse" />,
            highlightText: "Segurança de Frota Monitorada"
          }
        ];

      case UserRole.VENDEDOR:
        return [
          {
            title: "Assistente de Vendas e Pedidos",
            description: "Consulte clientes e monitore se as remessas estão sendo despachadas no prazo pelas frotas de sua região de negócios.",
            icon: <TrendingUp className="w-8 h-8 text-purple-500" />,
            highlightText: "Consistência de Portfólio"
          }
        ];

      default:
        return [
          {
            title: "Bem-vindo ao ecossistema RouteLog",
            description: "O maior ecossistema integrado para inteligência de despacho de frotas metropolitanas.",
            icon: <Compass className="w-8 h-8 text-blue-650" />,
            highlightText: "Planejamento Otimizado"
          }
        ];
    }
  };

  if (!isOpen) return null;

  const steps = getStepsByRole();
  const stepCount = steps.length;
  const current = steps[currentStep] || steps[0];

  const hasNext = currentStep < stepCount - 1;
  const hasPrev = currentStep > 0;

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      {/* Central Interactive Card Tour Overlay */}
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl relative select-text animate-fade-in flex flex-col">
        
        {/* Visual Splash Banner with abstract grid pattern */}
        <div className="bg-gradient-to-br from-indigo-700 via-blue-800 to-indigo-900 text-white p-6 relative overflow-hidden shrink-0">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0c_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0c_1px,transparent_1px)] bg-[size:1.5rem_1.5rem]"></div>
          
          <button 
            type="button"
            onClick={handleDismiss}
            className="absolute top-4 right-4 text-slate-300 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-all cursor-pointer outline-none"
            title="Pular Tutorial"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Icon bubble holder container */}
          <div className="w-14 h-14 rounded-2xl bg-white/12 border border-white/15 shadow-inner flex items-center justify-center backdrop-blur-md mb-4 animate-pulse" style={{ animationDuration: '4s' }}>
            {current.icon}
          </div>

          <span className="text-[9px] font-mono font-black uppercase tracking-wider text-indigo-200 bg-indigo-950/40 border border-indigo-400/20 px-2.5 py-1 rounded-full inline-block mb-1.5">
            {current.highlightText}
          </span>
          
          <h2 className="text-lg font-black tracking-tight leading-snug">
            {current.title}
          </h2>
        </div>

        {/* Central Explanatory Bullet Body area */}
        <div className="p-6 flex-grow flex flex-col justify-between space-y-6">
          <p className="text-xs text-slate-600 leading-relaxed font-sans">
            {current.description}
          </p>

          <div className="bg-slate-50 border border-slate-200/60 p-3 rounded-2xl text-[10.5px] text-slate-500 font-sans leading-normal flex items-start gap-2 select-none">
            <Sparkles className="w-4 h-4 text-indigo-650 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-800 font-bold">Dica de aprendizagem:</strong> Você pode reiniciar este passo de assistência clicando a qualquer momento na interrogação flutuante de help.
            </div>
          </div>

          {/* Stepper Progress Bar Dot indicator controls */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 shrink-0">
            <div className="flex gap-1.5">
              {steps.map((_, idx) => (
                <span 
                  key={idx} 
                  className={`h-1.5 rounded-full transition-all ${
                    idx === currentStep ? 'w-5.5 bg-indigo-650' : 'w-1.5 bg-slate-200'
                  }`}
                />
              ))}
            </div>

            <div className="flex gap-2">
              {hasPrev ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep(prev => prev - 1)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-650 rounded-xl hover:bg-slate-50 text-[10.5px] font-extrabold flex items-center gap-1 transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Anterior
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="px-3 py-1.5 border border-slate-100 text-slate-400 rounded-xl text-[10.5px] font-semibold transition-all cursor-pointer hover:text-slate-550"
                >
                  Sair do Guia
                </button>
              )}

              {hasNext ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep(prev => prev + 1)}
                  className="px-3.5 py-1.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-[10.5px] font-extrabold flex items-center gap-1 transition-all cursor-pointer shadow-sm shadow-indigo-950/25"
                >
                  Próximo <ChevronRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10.5px] font-extrabold flex items-center gap-1 transition-all cursor-pointer shadow-sm shadow-emerald-950/20"
                >
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-100" /> Começar Agora!
                </button>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
