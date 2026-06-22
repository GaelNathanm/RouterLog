import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  const isHmrDisabled = process.env.DISABLE_HMR === 'true';

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GOOGLE_MAPS_PLATFORM_KEY': JSON.stringify(process.env.GOOGLE_MAPS_PLATFORM_KEY || ''),
      'process.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify(process.env.GOOGLE_MAPS_PLATFORM_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || '')
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Configuração inteligente para o WebSocket do Vite
      hmr: isHmrDisabled 
        ? false 
        : {
            protocol: 'wss', // Força WebSocket Seguro (impede o bloqueio do navegador)
            clientPort: 443, // Porta padrão de tráfego HTTPS/WSS seguro
          },
      // Desativa o monitoramento de arquivos quando HMR for false para economizar CPU
      watch: isHmrDisabled ? null : {},
    },
  };
});