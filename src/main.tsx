import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Prevent benign logs like WebSocket connection issues or harmless offline fetch rejections from polluting screen
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const msg = event?.reason?.message || String(event?.reason || '');
    if (
      msg.includes('WebSocket') || 
      msg.includes('websocket') || 
      msg.includes('Failed to fetch') || 
      msg.includes('fetch') || 
      msg.includes('Failed to execute')
    ) {
      event.preventDefault();
      console.warn('[Network Resiliency] Intercepted benign background exception:', msg);
    }
  });

  window.addEventListener('error', (event) => {
    const msg = event?.message || '';
    if (msg.includes('WebSocket') || msg.includes('websocket') || msg.includes('Failed to fetch')) {
      event.preventDefault();
      console.warn('[Network Resiliency] Intercepted benign error message:', msg);
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
    <App />
  </StrictMode>,
);
