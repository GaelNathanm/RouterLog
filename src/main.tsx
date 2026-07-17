import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import './index.css';

// Prevent benign logs like WebSocket connection issues or harmless offline fetch rejections from polluting screen
if (typeof window !== 'undefined') {
  const originalWarn = console.warn;
  const originalError = console.error;

  let wsFailureCount = 0;
  const MAX_WS_FAILURES = 3;

  const showReloadNotification = () => {
    if (document.getElementById('ws-reload-notification')) {
      return;
    }

    const div = document.createElement('div');
    div.id = 'ws-reload-notification';
    div.className = 'fixed bottom-4 right-4 z-[9999] max-w-sm bg-slate-900 text-white rounded-xl shadow-2xl p-4 border border-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-300 font-sans';
    div.style.transition = 'all 0.3s ease-in-out';
    div.innerHTML = `
      <div class="flex flex-col gap-3">
        <div class="flex items-start gap-2.5">
          <div class="p-2 bg-amber-500/10 text-amber-400 rounded-lg shrink-0 border border-amber-500/20">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <h4 class="text-xs font-bold text-slate-100 tracking-tight">Conexão de Desenvolvimento (Vite)</h4>
            <p class="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
              O WebSocket de live reload falhou repetidamente. Deseja recarregar a página para recuperar a sincronização de desenvolvimento?
            </p>
          </div>
        </div>
        <div class="flex items-center justify-end gap-2 text-[11px]">
          <button 
            id="ws-reload-dismiss" 
            class="px-2.5 py-1.5 text-slate-400 hover:text-slate-200 font-medium transition-colors cursor-pointer rounded-md hover:bg-slate-800/80"
          >
            Dispensar
          </button>
          <button 
            id="ws-reload-confirm" 
            class="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-md shadow-sm transition-colors cursor-pointer"
          >
            Recarregar Página
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(div);

    const dismissBtn = document.getElementById('ws-reload-dismiss');
    const confirmBtn = document.getElementById('ws-reload-confirm');

    if (dismissBtn) {
      dismissBtn.onclick = () => {
        wsFailureCount = 0;
        div.style.opacity = '0';
        div.style.transform = 'translateY(10px)';
        setTimeout(() => {
          div.remove();
        }, 300);
      };
    }

    if (confirmBtn) {
      confirmBtn.onclick = () => {
        window.location.reload();
      };
    }
  };

  const handleWsFailure = () => {
    wsFailureCount++;
    if (wsFailureCount >= MAX_WS_FAILURES) {
      showReloadNotification();
    }
  };

  const isWsError = (msg: string) => {
    return (
      msg.includes('WebSocket') || 
      msg.includes('websocket') || 
      msg.includes('closed without opened') || 
      msg.includes('HMR')
    );
  };

  console.warn = function (...args) {
    const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
    if (isWsError(msg)) {
      handleWsFailure();
      return;
    }
    originalWarn.apply(console, args);
  };

  console.error = function (...args) {
    const msg = args.map(arg => typeof arg === 'object' ? (arg?.message || JSON.stringify(arg)) : String(arg)).join(' ');
    if (isWsError(msg)) {
      handleWsFailure();
      return;
    }
    originalError.apply(console, args);
  };

  window.addEventListener('unhandledrejection', (event) => {
    const msg = event?.reason?.message || String(event?.reason || '');
    const isWs = isWsError(msg);
    if (isWs) {
      handleWsFailure();
    }
    if (
      isWs || 
      msg.includes('Failed to fetch') || 
      msg.includes('fetch') || 
      msg.includes('Failed to execute')
    ) {
      event.preventDefault();
    }
  });

  window.addEventListener('error', (event) => {
    const msg = event?.message || '';
    const isWs = isWsError(msg);
    if (isWs) {
      handleWsFailure();
    }
    if (
      isWs || 
      msg.includes('Failed to fetch')
    ) {
      event.preventDefault();
    }
  });
}

// Register Service Worker for caching and offline queues
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((reg) => {
        console.log('[Service Worker] Registration succeeded. Scope:', reg.scope);
      })
      .catch((err) => {
        console.error('[Service Worker] Registration failed:', err);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
