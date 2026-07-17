import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

// Import Controllers
import * as gisController from './server/controllers/gisController';
import * as geminiController from './server/controllers/geminiController';
import * as syncController from './server/controllers/syncController';

// Load environment variables (useful for local testing)
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// GIS Routes
app.get('/api/gis/autocomplete', gisController.autocomplete);
app.post('/api/gis/validate', gisController.validate);
app.post('/api/gis/directions', gisController.directions);

// Sync Routes
app.get('/api/chats', syncController.getChats);
app.post('/api/chats', syncController.createChat);
app.get('/api/notifications', syncController.getNotifications);
app.post('/api/notifications', syncController.createNotification);
app.get('/api/push-logs', syncController.getPushLogs);
app.post('/api/push-logs', syncController.createPushLog);

// Gemini/Optimization Routes
app.post('/api/gemini/suggest-stops', geminiController.suggestStops);
app.post('/api/gemini/optimize-route', geminiController.optimizeRoute);
app.post('/api/google/directions-optimize', geminiController.googleDirectionsOptimize);

// Route to serve service worker directly
app.get('/service-worker.js', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'service-worker.js'));
});

// Setup Vite Dev Server / Static Hosting Middleware
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[RouteLog Backend] Servidor full-stack rodando em http://localhost:${PORT}`);
  });
}

start();
