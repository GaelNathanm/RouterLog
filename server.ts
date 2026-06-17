import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

// Load environment variables (useful for local testing)
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Shared in-memory databases to facilitate actual multi-channel real-time sync between rolls
let serverChats: any[] = [];
let serverNotifications: any[] = [];
let serverPushLogs: any[] = [];

// API endpoints for real-time chat and notification sync
app.get('/api/chats', (req, res) => {
  res.json(serverChats);
});

app.post('/api/chats', (req, res) => {
  const msg = req.body;
  if (msg && msg.id) {
    if (!serverChats.some(c => c.id === msg.id)) {
      serverChats.push(msg);
    }
  }
  res.json(serverChats);
});

app.get('/api/notifications', (req, res) => {
  res.json(serverNotifications);
});

app.post('/api/notifications', (req, res) => {
  const notif = req.body;
  if (notif && notif.id) {
    if (!serverNotifications.some(n => n.id === notif.id)) {
      serverNotifications.push(notif);
    }
  }
  res.json(serverNotifications);
});

app.get('/api/push-logs', (req, res) => {
  res.json(serverPushLogs);
});

app.post('/api/push-logs', (req, res) => {
  const log = req.body;
  if (log && log.id) {
    if (!serverPushLogs.some(p => p.id === log.id)) {
      serverPushLogs.push(log);
    }
  }
  res.json(serverPushLogs);
});

// Initialize Gemini SDK with User-Agent header for telemetry as required
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// API endpoint for Gemini route sequence recommendations
app.post('/api/gemini/suggest-stops', async (req, res) => {
  try {
    if (!ai) {
      return res.status(500).json({
        error: 'Chave de API GEMINI_API_KEY não configurada no servidor. Por favor, adicione-a em Configurações > Secrets.',
      });
    }

    const { driverName, region, previousRoutes, presets } = req.body;

    const previousRoutesSummary = previousRoutes && previousRoutes.length > 0
      ? previousRoutes.map((r: any) => `- Rota: "${r.name}" com paradas para: ${r.stops ? r.stops.map((s: any) => s.clientName).join(', ') : 'nenhuma'}`).join('\n')
      : 'Nenhuma rota registrada anteriormente.';

    const presetsSummary = presets && presets.length > 0
      ? presets.map((p: any) => `- ${p.name} no endereço "${p.address}" (Coordenadas: ${p.lat}, ${p.lng})`).join('\n')
      : 'Uso das localizações padrão do CD.';

    const prompt = `
      Você é um especialista em logística e inteligência de tráfego. Sua missão é apoiar o motorista de entregas "${driverName}" que atua na região "${region}".
      Com base no histórico do motorista de rotas anteriores e locais padrão disponíveis para seleção:

      [HISTÓRICO DE ROTAS OUTRAS VEZES FEITAS]
      ${previousRoutesSummary}

      [LOCAIS PADRÕES DISPONÍVEIS NA REGIÃO]
      ${presetsSummary}

      Analise se há repetição de paradas ou se o motorista frequenta certos clientes. Sugira uma proposta inteligente de SEQUÊNCIA DE PARADAS para uma nova rota diária chamada "Sugestão Inteligente IA [Data Atual]" que otimize o trânsito dele. Evite caminhos zigue-zague, prefira sequenciar racionalmente.

      Forneça de 2 a 4 paradas realistas na lista de paradas ("stops"), copiando os dados (nome, endereço, lat, lng) corretos dos locais ou criando variações lógicas complementares. Insira também um número WhatsApp válido e fictício no formato pt-br (ex: 5533991234567).
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        systemInstruction: 'Você é um assistente de despacho logístico que responde unicamente em formato JSON em conformidade estrita com o esquema fornecido.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            routeName: {
              type: Type.STRING,
              description: 'O nome identificador da rota gerado (ex: "Entregas Inteligentes - GV1 [Padrão]")',
            },
            stops: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  clientName: { type: Type.STRING },
                  address: { type: Type.STRING },
                  lat: { type: Type.NUMBER },
                  lng: { type: Type.NUMBER },
                  clientWhatsApp: { type: Type.STRING },
                },
                required: ['clientName', 'address', 'lat', 'lng', 'clientWhatsApp'],
              },
            },
          },
          required: ['routeName', 'stops'],
        },
      },
    });

    const textOutput = response.text || '';
    const suggestedData = JSON.parse(textOutput.trim());

    return res.json(suggestedData);
  } catch (error: any) {
    console.error('Erro na chamada da API do Gemini:', error);
    return res.status(500).json({ error: error.message || 'Falha na análise inteligente.' });
  }
});

// API endpoint for Google Directions optimizeWaypoints integration
app.post('/api/google/directions-optimize', async (req, res) => {
  try {
    const { stops, originLat, originLng } = req.body;
    if (!stops || stops.length === 0) {
      return res.json({ stops: [] });
    }

    const mapKey = process.env.GOOGLE_MAPS_PLATFORM_KEY || process.env.GOOGLE_DIRECTIONS_API_KEY;

    if (mapKey && mapKey !== 'YOUR_API_KEY' && mapKey.trim() !== '') {
      // Real Directions API key present! Let's call the actual google endpoint.
      // Waypoints require form: optimize:true|lat1,lng1|lat2,lng2...
      const waypointsArray = stops.map((s: any) => `${s.lat},${s.lng}`);
      const waypointsStr = `optimize:true|${waypointsArray.join('|')}`;
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originLat},${originLng}&destination=${originLat},${originLng}&waypoints=${encodeURIComponent(waypointsStr)}&key=${mapKey}`;
      
      console.log(`[Google Directions API] Performing real TSP optimization call for ${stops.length} stops...`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Google api error status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.status === 'OK' && data.routes && data.routes[0]) {
        const order: number[] = data.routes[0].waypoint_order; // array of indices like [1, 0, 2]
        console.log(`[Google Directions API] Reordering completed. Optimal sequence order indices:`, order);
        
        // Re-order the stops array based on Google Waypoint Optimization Order
        const optimizedStops = order.map(index => stops[index]);
        return res.json({ 
          stops: optimizedStops,
          source: 'Google Directions API (Real-time optimizeWaypoints)'
        });
      } else {
        console.warn(`[Google Directions API] Google returned status: ${data.status || 'unknown'}. Falling back to Backend TSP routing.`);
      }
    }

    // Fallback: Let's do a robust nearest-neighbor tsp (Traveling Salesman Problem) ordering on backend!
    console.log(`[Backend Optimizer] Executing Traveling Salesperson search...`);
    const sorted: any[] = [];
    const remaining = [...stops];
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

    return res.json({ 
      stops: sorted,
      source: 'RouteLog TSPOptimizer (Calculado no Servidor)'
    });
  } catch (error: any) {
    console.error('Error optimizing stops:', error);
    return res.status(500).json({ error: error.message || 'Falha na otimização.' });
  }
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
