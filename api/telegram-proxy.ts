// api/telegram-proxy.ts
// Vercel Serverless Function — прокси для Telegram Bot API
// Решает две проблемы: блокировку api.telegram.org в РФ и CORS в браузере

import type { VercelRequest, VercelResponse } from '@vercel/node';

const TELEGRAM_API = 'https://api.telegram.org';

const HOP_BY_HOP = new Set([
  'host', 'connection', 'keep-alive', 'transfer-encoding',
  'te', 'trailer', 'upgrade', 'proxy-authorization',
]);

export const config = {
  api: {
    bodyParser: { sizeLimit: '50mb' }, // для sendPhoto/sendDocument
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── Защита: только запросы с нашего домена ───────────────────────────────
  const origin = req.headers['origin'] || req.headers['referer'] || '';
  const allowedOrigin = process.env.VITE_APP_ORIGIN || '';

  if (allowedOrigin && !origin.startsWith(allowedOrigin)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // ── Допускаем только методы Telegram Bot API ─────────────────────────────
  if (!['GET', 'POST'].includes(req.method || '')) {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // ── Строим целевой URL ───────────────────────────────────────────────────
  const path = (req.url || '').replace(/^\/api\/telegram-proxy/, '') || '/';

  // Путь должен начинаться с /bot — базовая защита от мусорных запросов
  if (!path.startsWith('/bot')) {
    return res.status(400).json({ error: 'Invalid Telegram API path' });
  }

  const targetUrl = `${TELEGRAM_API}${path}`;

  // ── Заголовки ────────────────────────────────────────────────────────────
  const forwardHeaders: Record<string, string> = {
    'host': 'api.telegram.org',
  };

  for (const [key, value] of Object.entries(req.headers)) {
    if (HOP_BY_HOP.has(key.toLowerCase())) continue;
    if (key.toLowerCase() === 'origin') continue; // Telegram не нуждается в нём
    if (typeof value === 'string') forwardHeaders[key] = value;
    else if (Array.isArray(value)) forwardHeaders[key] = value[0];
  }

  // ── Тело ─────────────────────────────────────────────────────────────────
  const hasBody = req.method === 'POST';
  const body = hasBody
    ? typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    : undefined;

  // ── Запрос к Telegram с таймаутом 20 сек ─────────────────────────────────
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body,
      signal: controller.signal,
    });

    clearTimeout(timer);

    const contentType = upstream.headers.get('content-type') || 'application/json';
    res.status(upstream.status).setHeader('content-type', contentType);

    if (contentType.includes('application/json')) {
      const data = await upstream.json();
      return res.json(data);
    } else {
      const buffer = await upstream.arrayBuffer();
      return res.send(Buffer.from(buffer));
    }

  } catch (err: any) {
    clearTimeout(timer);
    const isTimeout = err.name === 'AbortError';
    console.error('[Telegram Proxy]', isTimeout ? 'Timeout' : err.message);
    return res.status(isTimeout ? 504 : 502).json({
      ok: false,
      error: isTimeout ? 'Gateway Timeout' : 'Bad Gateway',
      message: err.message,
    });
  }
}