import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CollabClient {
  ws: WebSocket;
  userId: string;
  userName: string;
  avatarColor: string;
  roomId: string;
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // Initialize Gemini AI SDK
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // Setup WebSocket Collaboration Server
  const wss = new WebSocketServer({ server, path: "/ws/collab" });
  const rooms = new Map<string, Set<CollabClient>>();

  function broadcastToRoom(roomId: string, data: any, excludeWs?: WebSocket) {
    const clients = rooms.get(roomId);
    if (!clients) return;
    const payload = JSON.stringify(data);
    for (const client of clients) {
      if (client.ws !== excludeWs && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }

  function getRoomPresence(roomId: string) {
    const clients = rooms.get(roomId);
    if (!clients) return [];
    return Array.from(clients).map((c) => ({
      id: c.userId,
      name: c.userName,
      avatarColor: c.avatarColor,
    }));
  }

  wss.on("connection", (ws) => {
    let currentClient: CollabClient | null = null;

    ws.on("message", (raw) => {
      try {
        const data = JSON.parse(raw.toString());

        if (data.type === "join") {
          const { roomId, userId, userName, avatarColor } = data;
          if (!roomId || !userId) return;

          // If client already in a room, remove them
          if (currentClient) {
            const oldRoom = rooms.get(currentClient.roomId);
            if (oldRoom) {
              oldRoom.delete(currentClient);
              broadcastToRoom(currentClient.roomId, {
                type: "presence",
                users: getRoomPresence(currentClient.roomId),
              });
            }
          }

          currentClient = {
            ws,
            userId,
            userName: userName || "Anonymous Collaborator",
            avatarColor: avatarColor || "#6366f1",
            roomId,
          };

          if (!rooms.has(roomId)) {
            rooms.set(roomId, new Set());
          }
          rooms.get(roomId)!.add(currentClient);

          // Send current presence to all participants in this room
          broadcastToRoom(roomId, {
            type: "presence",
            users: getRoomPresence(roomId),
          });
        } else if (data.type === "new-message") {
          if (currentClient) {
            broadcastToRoom(
              currentClient.roomId,
              {
                type: "new-message",
                message: data.message,
                sender: {
                  id: currentClient.userId,
                  name: currentClient.userName,
                },
              },
              ws
            );
          }
        } else if (data.type === "typing") {
          if (currentClient) {
            broadcastToRoom(
              currentClient.roomId,
              {
                type: "typing",
                userId: currentClient.userId,
                userName: currentClient.userName,
                isTyping: !!data.isTyping,
              },
              ws
            );
          }
        }
      } catch (err) {
        console.error("WebSocket message parsing error:", err);
      }
    });

    ws.on("close", () => {
      if (currentClient) {
        const room = rooms.get(currentClient.roomId);
        if (room) {
          room.delete(currentClient);
          if (room.size === 0) {
            rooms.delete(currentClient.roomId);
          } else {
            broadcastToRoom(currentClient.roomId, {
              type: "presence",
              users: getRoomPresence(currentClient.roomId),
            });
          }
        }
      }
    });
  });

  // Helper function with retry and fallback for 503 / high demand errors
  async function callGeminiWithRetry(params: any, retries = 3, delay = 1500): Promise<any> {
    try {
      return await ai.models.generateContent(params);
    } catch (error: any) {
      const isOverloaded =
        error?.status === 503 ||
        error?.message?.includes('503') ||
        error?.message?.includes('high demand') ||
        error?.message?.includes('UNAVAILABLE') ||
        error?.status === 429;

      if (retries > 0 && isOverloaded) {
        console.warn(`Model ${params.model} is experiencing high demand (503). Retrying in ${delay}ms... (${retries} retries left)`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        // Try fallback to gemini-flash-latest on final retry if original was pro or flash-lite
        let retryParams = { ...params };
        if (retries === 1 && retryParams.model !== 'gemini-flash-latest') {
          retryParams.model = 'gemini-flash-latest';
        }
        return callGeminiWithRetry(retryParams, retries - 1, delay * 2);
      }
      throw error;
    }
  }

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // In-memory Knowledge Base storage
  let knowledgeStore = [
    {
      id: "kb-1",
      title: "OmniMind Platform Overview",
      content: "OmniMind AI is a full-stack generative assistant with real-time WebSocket collaboration, Google Sheets export, and live web grounding via Google Search.",
      sourceUrl: "https://ai.google.dev",
      createdAt: Date.now() - 3600000,
    },
    {
      id: "kb-2",
      title: "Google Sheets Export Format",
      content: "All exports format chat logs into three standard columns: Timestamp, Speaker / Role, and Message Content for clean spreadsheet analysis.",
      sourceUrl: "https://developers.google.com/sheets/api",
      createdAt: Date.now() - 1800000,
    }
  ];

  app.get("/api/knowledge", (req, res) => {
    res.json({ items: knowledgeStore });
  });

  app.post("/api/knowledge", (req, res) => {
    const { title, content, sourceUrl } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: "Title and content are required" });
    }
    const newItem = {
      id: `kb-${Date.now()}`,
      title,
      content,
      sourceUrl: sourceUrl || "",
      createdAt: Date.now(),
    };
    knowledgeStore.unshift(newItem);
    res.json(newItem);
  });

  app.delete("/api/knowledge/:id", (req, res) => {
    const { id } = req.params;
    knowledgeStore = knowledgeStore.filter((item) => item.id !== id);
    res.json({ success: true });
  });

  // Chat API endpoint with Search Grounding & Knowledge Base
  app.post("/api/chat", async (req, res) => {
    try {
      let {
        messages,
        model = "gemini-3.8-flash",
        systemInstruction,
        enableSearch = false,
        enableMaps = false,
        knowledgeBaseContext = "",
      } = req.body;

      // Handle legacy aliases or user requests gracefully so API calls always succeed
      if (model === "gemini-1.5-pro" || model === "gemini-pro") {
        model = "gemini-3.1-pro-preview";
      } else if (model === "gemini-1.5-flash" || model === "gemini-flash") {
        model = "gemini-3.8-flash";
      } else if (model === "gemini-1.5-flash-lite" || model === "gemini-flash-lite") {
        model = "gemini-3.1-flash-lite";
      }

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Messages array is required" });
      }

      const contents = messages.map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));

      let fullSystemInstruction = systemInstruction || "You are OmniMind, a helpful, intelligent, and articulate AI assistant that gives comprehensive ideas, detailed answers, code snippets, and creative insights.";

      if (knowledgeBaseContext && knowledgeBaseContext.trim()) {
        fullSystemInstruction += `\n\n[USER KNOWLEDGE BASE CONTEXT]\n${knowledgeBaseContext}\nIf relevant, refer to this knowledge base content to enrich your answers and cite facts accurately.`;
      }

      const config: any = {
        systemInstruction: fullSystemInstruction,
        temperature: 0.7,
        tools: []
      };

      // Enable Google Search grounding if requested
      if (enableSearch) {
        config.tools.push({ googleSearch: {} });
      }

      // Enable Google Maps grounding if requested
      if (enableMaps) {
        config.tools.push({ googleMaps: {} });
      }

      // Clean up tools array if empty
      if (config.tools.length === 0) {
        delete config.tools;
      }

      const response = await callGeminiWithRetry({
        model: model,
        contents: contents,
        config: config,
      });

      // Extract Grounding metadata and cited web sources
      const candidate = response.candidates?.[0];
      const groundingMetadata = candidate?.groundingMetadata;
      const sources: Array<{ uri: string; title: string }> = [];

      if (groundingMetadata?.groundingChunks) {
        for (const chunk of groundingMetadata.groundingChunks) {
          if (chunk.web?.uri) {
            sources.push({
              uri: chunk.web.uri,
              title: chunk.web.title || new URL(chunk.web.uri).hostname,
            });
          }
        }
      }

      const searchQueries: string[] = groundingMetadata?.webSearchQueries || [];

      res.json({
        text: response.text || "No response generated.",
        sources,
        searchQueries,
      });
    } catch (error: any) {
      console.error("Chat API error:", error);
      res.status(500).json({
        error: error.message || "The AI model is temporarily experiencing high demand. Please try again in a moment."
      });
    }
  });

  // Brainstorm / Ideas Generator API endpoint
  app.post("/api/brainstorm", async (req, res) => {
    try {
      const { topic, count = 10 } = req.body;
      if (!topic) {
        return res.status(400).json({ error: "Topic is required" });
      }

      const response = await callGeminiWithRetry({
        model: "gemini-3.8-flash",
        contents: `Generate ${count} creative, actionable, and diverse ideas, solutions, or angles for the topic: "${topic}".`,
        config: {
          systemInstruction: "You are an expert brainstorming consultant. Return the output as JSON conforming to the schema.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              topic: { type: Type.STRING },
              ideas: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING, description: "Catchy idea title" },
                    description: { type: Type.STRING, description: "Detailed description of the idea" },
                    category: { type: Type.STRING, description: "Category or tag (e.g., Marketing, Tech, Product)" },
                    impact: { type: Type.STRING, description: "High, Medium, or Low impact potential" },
                    actionItem: { type: Type.STRING, description: "Immediate next step to execute this idea" }
                  },
                  required: ["title", "description", "category", "impact", "actionItem"]
                }
              }
            },
            required: ["topic", "ideas"]
          }
        }
      });

      let jsonResult;
      try {
        jsonResult = JSON.parse(response.text || "{}");
      } catch (err) {
        jsonResult = { topic, ideas: [] };
      }

      res.json(jsonResult);
    } catch (error: any) {
      console.error("Brainstorm API error:", error);
      res.status(500).json({
        error: error.message || "The AI model is temporarily experiencing high demand. Please try again in a moment."
      });
    }
  });

  // --- AI Generation Endpoints ---

  // Image Generation & Editing
  app.post("/api/generate/image", async (req, res) => {
    try {
      const { prompt, aspectRatio = "1:1" } = req.body;
      // In a real implementation, we would use the Imagen 3 / Interactions API
      // Mocking for UI demonstration
      res.json({ 
        url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000",
        status: "success" 
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Music Generation (Lyria)
  app.post("/api/generate/music", async (req, res) => {
    try {
      const { prompt } = req.body;
      // Mocking Lyria output for UI demonstration
      res.json({ 
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        status: "success"
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Video Generation (Veo)
  app.post("/api/generate/video", async (req, res) => {
    try {
      const { prompt } = req.body;
      // Mocking Veo output for UI demonstration
      res.json({ 
        url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
        status: "success"
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Audio Transcription
  app.post("/api/transcribe", async (req, res) => {
    try {
      // Mocking transcription
      res.json({ text: "Live audio transcription is active. This is a demonstration of real-time speech-to-text processing." });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Gemini Live API (WebSocket) ---
  const liveWss = new WebSocketServer({ server, path: "/ws/live" });
  liveWss.on("connection", (ws: WebSocket) => {
    console.log("Gemini Live client connected");
    ws.on("message", (message) => {
      // Echoing back for demo, in real usage would stream to/from Gemini Live API
      ws.send(JSON.stringify({ type: "response", text: "I'm listening and thinking in real-time! How can I help you further?" }));
    });
  });

  // Vite middleware setup for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
