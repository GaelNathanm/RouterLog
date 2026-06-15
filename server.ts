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
