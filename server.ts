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

  // ── Защита Origin ────────────────────────────────────────────────────────
  // Пропускает только запросы с нашего домена.
  // В dev-режиме (VITE_APP_ORIGIN не задан) проверка отключена.
  const ALLOWED_ORIGIN = process.env.VITE_APP_ORIGIN || '';

  const originGuard = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (!ALLOWED_ORIGIN) return next();
    const origin = (req.headers['origin'] || req.headers['referer'] || '') as string;
    if (!origin.startsWith(ALLOWED_ORIGIN)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };

  // ── Supabase Proxy ───────────────────────────────────────────────────────
  // ВАЖНО: до express.json() — иначе body-parser съест тело запроса
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  if (SUPABASE_URL) {
    console.log(`[Supabase Proxy] → ${SUPABASE_URL}`);
    app.use('/api/supabase-proxy', originGuard, createProxyMiddleware({
      target: SUPABASE_URL,
      changeOrigin: true,
      secure: true,
      pathRewrite: { '^/api/supabase-proxy': '' },
      timeout: 25_000,
      proxyTimeout: 25_000,
      on: {
        proxyReq: (proxyReq) => {
          proxyReq.setHeader('origin', SUPABASE_URL);
          proxyReq.setHeader('host', new URL(SUPABASE_URL).host);
        },
        error: (err, _req, res) => {
          console.error('[Supabase Proxy Error]', err.message);
          if (res && 'writeHead' in res) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              error: 'Bad Gateway',
              message: err.message,
              code: (err as any).code,
            }));
          }
        },
      },
    }));
  } else {
    console.warn('[Supabase Proxy] VITE_SUPABASE_URL not set — proxy disabled');
  }

  // ── Telegram Proxy ───────────────────────────────────────────────────────
  // ВАЖНО: до express.json()
  console.log('[Telegram Proxy] → https://api.telegram.org');
  app.use('/api/telegram-proxy', originGuard, createProxyMiddleware({
    target: 'https://api.telegram.org',
    changeOrigin: true,
    secure: true,
    pathRewrite: { '^/api/telegram-proxy': '' },
    timeout: 20_000,
    proxyTimeout: 20_000,
    on: {
      proxyReq: (proxyReq, req) => {
        // Базовая защита: только /bot... пути Telegram Bot API
        if (!req.path.startsWith('/bot')) {
          proxyReq.destroy(new Error('Invalid Telegram API path'));
        }
      },
      error: (err, _req, res) => {
        console.error('[Telegram Proxy Error]', err.message);
        if (res && 'writeHead' in res) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Bad Gateway', message: err.message }));
        }
      },
    },
  }));

  // ── Body parser — ПОСЛЕ прокси ───────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));

  // ── Request logger ───────────────────────────────────────────────────────
  app.use((req, _res, next) => {
    if (req.url.includes('/api')) {
      console.log(`[API] ${req.method} ${req.url}`);
    }
    next();
  });

  // ── API: Создание платёжной сессии ───────────────────────────────────────
  app.post('/api/payments/create-session', async (req, res) => {
    try {
      const { orgId, planType, termMonths, invoiceId, extraMachines, extraUsers } = req.body;
      const sessionId = Math.random().toString(36).substring(7);
      let confirmationUrl = `/payment-success?session_id=${sessionId}&orgId=${orgId}&plan=${planType}&term=${termMonths || 1}`;
      if (invoiceId) confirmationUrl += `&invoiceId=${invoiceId}`;
      if (extraMachines) confirmationUrl += `&extraMachines=${extraMachines}`;
      if (extraUsers) confirmationUrl += `&extraUsers=${extraUsers}`;
      res.json({ url: confirmationUrl });
    } catch (error) {
      console.error('Payment session error:', error);
      res.status(500).json({ error: 'Failed to create payment session' });
    }
  });

  // ── API: Webhook подтверждения платежа ───────────────────────────────────
  app.post('/api/payments/webhook', (req, res) => {
    const { type, data } = req.body;
    if (type === 'payment.succeeded') {
      console.log(`Payment succeeded for org ${data?.orgId}, plan ${data?.planType}`);
    }
    res.json({ received: true });
  });

  // ── API: MAX уведомления ─────────────────────────────────────────────────
  app.post('/api/max/send', async (req, res) => {
    try {
      const { botToken, chatId, message } = req.body;
      if (!botToken || !chatId || !message?.trim()) {
        return res.status(400).json({ error: 'botToken, chatId and message are required' });
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);

      const response = await fetch(`https://api.max.ru/v1/bot/${botToken}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
      });
      clearTimeout(timer);

      const data = await response.json();
      if (!data.ok) throw new Error(data.description || 'Failed to send');
      res.json({ success: true });
    } catch (error: any) {
      const isTimeout = error.name === 'AbortError';
      console.error('Max notification error:', isTimeout ? 'Timeout' : error.message);
      res.status(isTimeout ? 504 : 500).json({
        error: isTimeout ? 'Max API timeout' : 'Failed to send Max notification',
      });
    }
  });

  // ── API: Health check ────────────────────────────────────────────────────
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', env: process.env.NODE_ENV, time: new Date().toISOString() });
  });

  // ── API: Telegram — отправка сообщения ───────────────────────────────────
  app.post('/api/telegram/send', async (req, res) => {
    try {
      const { botToken, chatId, message } = req.body;
      if (!botToken || !chatId || !message?.trim()) {
        return res.status(400).json({ success: false, error: 'botToken, chatId and message are required' });
      }
      if (message.length > 4096) {
        return res.status(400).json({ success: false, error: 'Message exceeds 4096 characters' });
      }

      console.log(`[Telegram] Sending to chat ${chatId}...`);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);

      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
      });
      clearTimeout(timer);

      const data = await response.json();
      if (!data.ok) {
        console.error(`[Telegram] API error: ${data.description}`);
        return res.status(400).json({ success: false, error: data.description });
      }

      console.log('[Telegram] Sent successfully');
      res.json({ success: true, messageId: data.result?.message_id });
    } catch (error: any) {
      const isTimeout = error.name === 'AbortError';
      console.error('[Telegram Send]', isTimeout ? 'Timeout' : error.message);
      res.status(isTimeout ? 504 : 502).json({
        success: false,
        error: isTimeout ? 'Telegram API timeout' : 'Failed to reach Telegram',
      });
    }
  });

  // ── API: Telegram — получение chat_id ────────────────────────────────────
  app.get('/api/telegram/getUpdates', async (req, res) => {
    try {
      const { botToken } = req.query as { botToken: string };
      if (!botToken) return res.status(400).json({ error: 'botToken is required' });

      console.log('[Telegram] Fetching updates...');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);

      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/getUpdates`,
        { signal: controller.signal }
      );
      clearTimeout(timer);

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      const isTimeout = error.name === 'AbortError';
      console.error('[Telegram getUpdates]', isTimeout ? 'Timeout' : error.message);
      res.status(isTimeout ? 504 : 502).json({
        ok: false,
        error: isTimeout ? 'Timeout' : 'Failed to reach Telegram',
      });
    }
  });

  // ── Vite / Static ────────────────────────────────────────────────────────
  const isProduction = process.env.NODE_ENV === 'production';
  const distExists = fs.existsSync(path.join(process.cwd(), 'dist'));

  console.log(`[Server] Mode: ${isProduction ? 'Production' : 'Development'}`);
  console.log(`[Server] Dist exists: ${distExists}`);

  if (!isProduction || !distExists) {
    if (isProduction && !distExists) {
      console.warn("⚠️ Production mode but 'dist' missing — falling back to Vite dev mode");
    }
    console.log('🛠️ Starting Vite in development mode...');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: { usePolling: true, interval: 100 },
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);

    app.get('*all', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) return next();
      try {
        const indexPath = path.resolve(__dirname, 'index.html');
        if (!fs.existsSync(indexPath)) {
          return res.status(404).send('index.html not found');
        }
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    console.log('🚀 Serving static files from dist...');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // ── 404 fallback ─────────────────────────────────────────────────────────
  app.use((req, res) => {
    console.log(`[404] ${req.url}`);
    res.status(404).send(`404: Not Found (${req.url})`);
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();