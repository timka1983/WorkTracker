// api/supabase-proxy.ts
// Vercel Serverless Function — прокси для Supabase
// Решает проблему блокировки *.supabase.co корпоративными сетями и провайдерами РФ

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Заголовки которые нельзя прокидывать upstream — могут сломать запрос
const HOP_BY_HOP = new Set([
  'host', 'connection', 'keep-alive', 'transfer-encoding',
  'te', 'trailer', 'upgrade', 'proxy-authorization', 'proxy-authenticate',
]);

export const config = {
  api: {
    // Vercel буферизует тело сам — bodyParser нужен чтобы req.body был заполнен
    bodyParser: { sizeLimit: '10mb' },
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── Защита: только запросы с нашего домена ───────────────────────────────
  const origin = req.headers['origin'] || req.headers['referer'] || '';
  const allowedOrigin = process.env.VITE_APP_ORIGIN || '';

  if (allowedOrigin && !origin.startsWith(allowedOrigin)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // ── Целевой URL ──────────────────────────────────────────────────────────
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  if (!SUPABASE_URL) {
    return res.status(500).json({ error: 'VITE_SUPABASE_URL not configured' });
  }

  const path = (req.url || '').replace(/^\/api\/supabase-proxy/, '') || '/';
  const targetUrl = `${SUPABASE_URL}${path}`;

  // ── Прокидываем заголовки, убираем hop-by-hop ────────────────────────────
  const forwardHeaders: Record<string, string> = {
    'host': new URL(SUPABASE_URL).host,
    'origin': SUPABASE_URL,
  };

  for (const [key, value] of Object.entries(req.headers)) {
    if (HOP_BY_HOP.has(key.toLowerCase())) continue;
    if (typeof value === 'string') forwardHeaders[key] = value;
    else if (Array.isArray(value)) forwardHeaders[key] = value[0];
  }

  // ── Тело запроса ─────────────────────────────────────────────────────────
  const hasBody = !['GET', 'HEAD'].includes(req.method || 'GET');
  const body = hasBody
    ? typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    : undefined;

  // ── Запрос к Supabase с таймаутом 25 сек ─────────────────────────────────
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body,
      signal: controller.signal,
    });

    clearTimeout(timer);

    // ── Прокидываем ответ обратно ─────────────────────────────────────────
    const contentType = upstream.headers.get('content-type') || 'application/json';
    res.status(upstream.status).setHeader('content-type', contentType);

    // Прокидываем важные заголовки ответа
    const passHeaders = ['x-request-id', 'sb-edge-routing-hints', 'content-range'];
    for (const h of passHeaders) {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    }

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
    console.error('[Supabase Proxy]', isTimeout ? 'Timeout' : err.message);
    return res.status(isTimeout ? 504 : 502).json({
      error: isTimeout ? 'Gateway Timeout' : 'Bad Gateway',
      message: err.message,
    });
  }
}