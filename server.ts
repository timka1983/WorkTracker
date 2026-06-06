import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import fs from "fs";
import { createProxyMiddleware } from "http-proxy-middleware";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());

  // Supabase Proxy Route - MUST be before express.json() to avoid body parsing issues
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  if (SUPABASE_URL) {
    console.log(`[Supabase Proxy] Setting up proxy to ${SUPABASE_URL}`);
    app.use('/api/supabase-proxy', createProxyMiddleware({
      target: SUPABASE_URL,
      changeOrigin: true,
      secure: true,
      xfwd: true,
      timeout: 30000,
      proxyTimeout: 30000,
      pathRewrite: {
        '^/api/supabase-proxy': '',
      },
      on: {
        error: (err, _req, res) => {
          console.error('[Supabase Proxy Error]', err);
          if (res && 'writeHead' in res) {
            res.writeHead(500, {
              'Content-Type': 'application/json',
            });
            res.end(JSON.stringify({ 
              error: 'Proxy Error', 
              message: err.message,
              code: (err as any).code 
            }));
          }
        },
        proxyReq: (proxyReq, req, _res) => {
          proxyReq.setHeader('Origin', SUPABASE_URL);
        }
      }
    }));
  }

  // Telegram Proxy Route
  console.log('[Telegram Proxy] Setting up proxy to https://api.telegram.org');
  app.use('/api/telegram-proxy', createProxyMiddleware({
    target: 'https://api.telegram.org',
    changeOrigin: true,
    secure: true,
    xfwd: true,
    pathRewrite: {
      '^/api/telegram-proxy': '',
    },
    on: {
      error: (err, _req, res) => {
        console.error('[Telegram Proxy Error]', err);
        if (res && 'writeHead' in res) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Proxy Error', message: err.message }));
        }
      }
    }
  }));

  app.use(express.json());

  // Request logger for debugging
  app.use((req, res, next) => {
    if (req.url.includes('api')) {
      console.log(`[API] ${req.method} ${req.url}`);
    }
    next();
  });

  // API Routes
  app.post("/api/payments/create-session", async (req, res) => {
    try {
      const { orgId, planType, amount, termMonths, invoiceId, extraMachines, extraUsers } = req.body;
      
      // Here you would normally call Stripe or ЮKassa API
      // Example for a mock implementation:
      const sessionId = Math.random().toString(36).substring(7);
      
      // In a real app, this URL would be from the payment provider
      // For demo purposes, we'll redirect to a mock success page or just return success
      let confirmationUrl = `/payment-success?session_id=${sessionId}&orgId=${orgId}&plan=${planType}&term=${termMonths || 1}`;
      if (invoiceId) confirmationUrl += `&invoiceId=${invoiceId}`;
      if (extraMachines) confirmationUrl += `&extraMachines=${extraMachines}`;
      if (extraUsers) confirmationUrl += `&extraUsers=${extraUsers}`;

      res.json({ url: confirmationUrl });
    } catch (error) {
      console.error("Payment session error:", error);
      res.status(500).json({ error: "Failed to create payment session" });
    }
  });

  // Webhook for payment confirmation
  app.post("/api/payments/webhook", async (req, res) => {
    const { type, data } = req.body;
    
    if (type === "payment.succeeded") {
      const { orgId, planType } = data;
      // In a real app, you would update the database here using a service role key
      console.log(`Payment succeeded for org ${orgId}, plan ${planType}`);
    }
    
    res.json({ received: true });
  });

  // Max Notification Route
  app.post("/api/max/send", async (req, res) => {
    try {
      const { botToken, chatId, message } = req.body;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`https://api.max.ru/v1/bot/${botToken}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML'
        })
      });
      clearTimeout(timeoutId);
      
      const data = await response.json();
      if (!data.ok) {
        throw new Error(data.description || 'Failed to send');
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Max notification error:", error);
      res.status(500).json({ error: "Failed to send Max notification" });
    }
  });

  // Diagnostic Route
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      env: process.env.NODE_ENV,
      time: new Date().toISOString()
    });
  });

  // Telegram Notification Route
  app.post("/api/telegram/send", async (req, res) => {
    try {
      const { botToken, chatId, message } = req.body;
      console.log(`[Telegram] Sending message to chat ${chatId}...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // Увеличил таймаут до 8с
      
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML'
        })
      });
      clearTimeout(timeoutId);
      
      const data = await response.json();
      if (!data.ok) {
        console.error(`[Telegram] API error: ${data.description}`);
        return res.status(400).json({ success: false, error: data.description });
      }
      
      console.log(`[Telegram] Success!`);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Telegram] Proxy error:", error.name === 'AbortError' ? 'Timeout' : error.message);
      res.status(500).json({ 
        success: false, 
        error: error.name === 'AbortError' ? "Telegram API timeout" : "Server failed to reach Telegram" 
      });
    }
  });

  // Telegram getUpdates Proxy Route
  app.get("/api/telegram/getUpdates", async (req, res) => {
    try {
      const { botToken } = req.query as { botToken: string };
      if (!botToken) return res.status(400).json({ error: "botToken is required" });
      
      console.log(`[Telegram] Fetching updates...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("[Telegram] getUpdates proxy error:", error.message);
      res.status(500).json({ ok: false, error: "Failed to reach Telegram" });
    }
  });

  // Determine if we should use Vite or serve static files
  const isProduction = process.env.NODE_ENV === "production";
  const distExists = fs.existsSync(path.join(process.cwd(), "dist"));
  
  console.log(`[Server] NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`[Server] Mode: ${isProduction ? 'Production' : 'Development'}`);
  console.log(`[Server] Dist directory exists: ${distExists}`);

  // Vite middleware for development (or if production dist is missing)
  if (!isProduction || !distExists) {
    if (isProduction && !distExists) {
      console.warn("⚠️ Production mode requested but 'dist' folder is missing. Falling back to Vite development mode.");
    }
    
    console.log("🛠️ Starting Vite in development mode...");
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        watch: {
          usePolling: true,
          interval: 100
        }
      },
      appType: "spa",
    });
    
    // Use vite's connect instance as middleware
    app.use(vite.middlewares);

    // Serve index.html transformed by Vite
    app.get("*all", async (req, res, next) => {
      const url = req.originalUrl;
      
      // Skip API calls which should be handled by routes above
      if (url.startsWith('/api')) {
        return next();
      }

      try {
        const indexPath = path.resolve(__dirname, "index.html");
        
        if (!fs.existsSync(indexPath)) {
          console.error(`❌ index.html not found at ${indexPath}`);
          return res.status(404).send("index.html not found");
        }

        let template = fs.readFileSync(indexPath, "utf-8");
        template = await vite.transformIndexHtml(url, template);
        
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        if (vite) vite.ssrFixStacktrace(e as Error);
        console.error("Vite transformation error:", e);
        next(e);
      }
    });
  } else {
    console.log("🚀 Serving static files from dist...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Fallback for debugging
  app.use((req, res) => {
    console.log(`[404] ${req.url}`);
    res.status(404).send(`404: Not Found on this server (${req.url})`);
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
