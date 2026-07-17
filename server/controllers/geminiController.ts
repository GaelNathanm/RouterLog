import { Request, Response } from 'express';
import { Type } from '@google/genai';
import { ai } from '../services/gemini';
import { haversineDistance } from '../services/gis';
import fetch from 'node-fetch'; // wait, node-fetch is preinstalled or we can use global fetch in Node 18+. Let's use global fetch which is standard.

// API endpoint for Gemini route sequence recommendations
export const suggestStops = async (req: Request, res: Response) => {
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
    console.warn('[Gemini Suggest Fallback] Gemini API indisponível ou erro na análise. Usando fallback de presets locais...', error.message || error);
    try {
      const { region, presets } = req.body;
      const cleanRegion = region || 'Geral';
      
      const suggestedStops = (presets && presets.length > 0)
        ? presets.slice(0, 3).map((p: any) => ({
            clientName: p.name || 'Cliente Regional',
            address: p.address || 'Endereço Padrão',
            lat: p.lat || -18.852,
            lng: p.lng || -41.952,
            clientWhatsApp: '5533991234567'
          }))
        : [
            {
              clientName: 'Supermercado Central',
              address: 'Av. Israel Pinheiro, 2500 - Centro',
              lat: -18.852,
              lng: -41.952,
              clientWhatsApp: '5533991234567'
            },
            {
              clientName: 'Drogaria do Povo',
              address: 'Av. Minas Gerais, 980 - Nossa Senhora das Graças',
              lat: -18.858,
              lng: -41.939,
              clientWhatsApp: '5533991234567'
            }
          ];

      return res.json({
        routeName: `Sugestão Inteligente (Fallback) - ${cleanRegion}`,
        stops: suggestedStops
      });
    } catch (fallbackError: any) {
      console.error('Falha crítica ao gerar sugestão padrão de fallback:', fallbackError);
      return res.status(500).json({ error: 'Erro crítico na geração de sugestões.' });
    }
  }
};

// API endpoint for Gemini route sequence optimization (TSP/VRP)
export const optimizeRoute = async (req: Request, res: Response) => {
  const { stops, originLat, originLng } = req.body;
  try {
    if (!ai) {
      return res.status(500).json({
        error: 'Chave de API GEMINI_API_KEY não configurada no servidor. Por favor, adicione-a em Configurações > Secrets.',
      });
    }

    if (!stops || stops.length === 0) {
      return res.json({ stops: [] });
    }

    // Map input to the requested "REGRAS DE ENTRADA" JSON format
    const promptInput = {
      ponto_partida: { lat: originLat, lng: originLng },
      paradas: stops.map((s: any) => ({
        id: s.id,
        lat: s.lat,
        lng: s.lng,
        janela_inicio: s.janela_inicio || undefined,
        janela_fim: s.janela_fim || undefined,
        prioridade: s.prioridade || 'media'
      }))
    };

    const prompt = `
      Você é o motor de inteligência artificial do sistema RouteLog, especializado em otimização de rotas logísticas com múltiplas paradas (Vehicle Routing Problem - VRP).
      Seu objetivo é receber uma lista de paradas pendentes e devolvê-las ordenadas de forma lógica e otimizada, visando menor tempo total e eficiência de deslocamento.

      ---

      ### REGRAS DE ENTRADA
      Você receberá um objeto JSON contendo:
      1. "ponto_partida": Coordenadas {lat, lng} de onde o motorista inicia a rota.
      2. "paradas": Uma lista de objetos de paradas, onde cada um contém:
         - "id": ID único da parada.
         - "lat": Latitude.
         - "lng": Longitude.
         - "janela_inicio" (opcional): Horário sugerido para entrega (ex: "08:00").
         - "janela_fim" (opcional): Horário limite para entrega (ex: "12:00").
         - "prioridade" (opcional): "alta", "media" ou "baixa".

      ---

      ### LOGICA DE OTIMIZAÇÃO (Seus Critérios de Decisão)
      Para ordenar as paradas, você deve aplicar os seguintes critérios, do mais importante ao menos importante:
      1. Proximidade Geográfica (Distância Euclidiana/Haversine calculada de forma aproximada entre as coordenadas).
      2. Janela de Horário: Paradas com "janela_fim" mais cedo devem ser priorizadas caso a rota geográfica faça sentido.
      3. Prioridade: Paradas com prioridade "alta" devem ser movidas para o início da fila, desde que não causem um desvio geográfico absurdo (backtracking).
      4. Evitar cruzamento de caminhos (a rota deve seguir um fluxo contínuo e não ir e voltar pela mesma região).

      ---

      ### ENTRADA DA ROTA A SER OTIMIZADA:
      ${JSON.stringify(promptInput, null, 2)}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        systemInstruction: 'Você é o motor de inteligência artificial do sistema RouteLog, especializado em otimização de rotas logísticas com múltiplas paradas (Vehicle Routing Problem - VRP). Você responde unicamente em formato JSON em conformidade estrita com o esquema fornecido.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            rota_otimizada: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  posicao: { type: Type.INTEGER, description: 'Posição sequencial das entregas' },
                  id: { type: Type.STRING, description: 'ID da parada correspondente' },
                  justificativa: { type: Type.STRING, description: 'Breve justificativa de 1 frase do porquê esta parada ficou nesta posição' }
                },
                required: ['posicao', 'id', 'justificativa']
              }
            },
            tempo_estimado_total_minutos: { type: Type.INTEGER, description: 'Tempo total estimado em minutos para completar todo o percurso' },
            insights_do_trajeto: { type: Type.STRING, description: 'Uma frase resumindo o padrão de entrega ou alertas' }
          },
          required: ['rota_otimizada', 'tempo_estimado_total_minutos', 'insights_do_trajeto']
        }
      }
    });

    const textOutput = response.text || '';
    const optimizedResult = JSON.parse(textOutput.trim());

    if (optimizedResult.rota_otimizada && optimizedResult.rota_otimizada.length > 0) {
      // Safely map back using original stops to ensure NO fields are lost or modified
      const reorderedStops = optimizedResult.rota_otimizada.map((ro: any) => {
        const originalStop = stops.find((s: any) => s.id === ro.id);
        if (originalStop) {
          return {
            ...originalStop,
            posicao: ro.posicao,
            justificativa: ro.justificativa
          };
        }
        return null;
      }).filter(Boolean);

      // If mapping was fully successful, return it
      if (reorderedStops.length === stops.length) {
        return res.json({
          stops: reorderedStops,
          tempo_estimado_total_minutos: optimizedResult.tempo_estimado_total_minutos,
          insights_do_trajeto: optimizedResult.insights_do_trajeto,
          source: 'Gemini VRP AI Optimizer'
        });
      }
    }

    // Fallback if schema match is incomplete
    return res.json({
      stops: stops, // return original
      source: 'Gemini Optimizer Fallback'
    });

  } catch (error: any) {
    console.warn('[Gemini Optimize Fallback] Otimizador Gemini indisponível (503/Error). Iniciando fallback...', error.message || error);
    try {
      const mapKey = process.env.GOOGLE_MAPS_PLATFORM_KEY || process.env.GOOGLE_DIRECTIONS_API_KEY;
      if (mapKey && mapKey !== 'YOUR_API_KEY' && mapKey.trim() !== '') {
        const waypointsArray = stops.map((s: any) => `${s.lat},${s.lng}`);
        const waypointsStr = `optimize:true|${waypointsArray.join('|')}`;
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originLat},${originLng}&destination=${originLat},${originLng}&waypoints=${encodeURIComponent(waypointsStr)}&key=${mapKey}`;
        
        console.log(`[Gemini Fallback -> Google Directions] Executando otimização via API do Google...`);
        const response = await fetch(url);
        if (response.ok) {
          const data = (await response.json()) as any;
          if (data.status === 'OK' && data.routes && data.routes[0]) {
            const order: number[] = data.routes[0].waypoint_order;
            const optimizedStops = order.map(index => stops[index]);
            return res.json({ 
              stops: optimizedStops,
              source: 'Google Directions API (Fallback de Gemini)'
            });
          }
        }
      }

      // Backend Nearest-Neighbor TSP fallback
      console.log(`[Gemini Fallback -> TSP] Executando algoritmo TSP local para fallback...`);
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
        source: 'RouteLog TSPOptimizer (Fallback local de Gemini)'
      });
    } catch (fallbackError: any) {
      console.error('Falha crítica ao gerar sugestão padrão de fallback:', fallbackError);
      return res.json({
        stops: stops,
        source: 'Sem Otimização (Erro crítico)'
      });
    }
  }
};

// API endpoint for Google Directions optimizeWaypoints integration
export const googleDirectionsOptimize = async (req: Request, res: Response) => {
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
      
      const data = (await response.json()) as any;
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
};
