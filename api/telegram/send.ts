// api/telegram/send.ts
// Типизированный эндпоинт для отправки сообщений
// botToken НЕ принимается от клиента — только из переменных окружения сервера

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── botToken берётся с сервера, не из запроса ─────────────────────────────
  // Если у тебя один бот на всё приложение — храни в env.
  // Если боты у каждого клиента свои (multi-tenant) — храни в БД и
  // аутентифицируй запрос перед тем как читать токен из БД.
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

  if (!BOT_TOKEN) {
    // Если токены клиентские (multi-tenant), принять из тела — но только
    // после проверки аутентификации запроса (проверяй здесь свой JWT/apiKey)
    return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not configured' });
  }

  // ── Валидация входящих данных ─────────────────────────────────────────────
  const { chatId, message } = req.body || {};

  if (!chatId || typeof chatId !== 'string') {
    return res.status(400).json({ error: 'chatId is required and must be a string' });
  }
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'message is required and must not be empty' });
  }
  if (message.length > 4096) {
    return res.status(400).json({ error: 'message exceeds Telegram 4096 character limit' });
  }

  // ── Отправка с таймаутом ──────────────────────────────────────────────────
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message.trim(),
          parse_mode: 'HTML',
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timer);
    const data = await response.json();

    if (!data.ok) {
      console.error('[Telegram Send] API error:', data.description);
      return res.status(400).json({ error: data.description });
    }

    return res.json({ success: true, messageId: data.result?.message_id });

  } catch (err: any) {
    clearTimeout(timer);
    const isTimeout = err.name === 'AbortError';
    console.error('[Telegram Send]', isTimeout ? 'Timeout' : err.message);
    return res.status(isTimeout ? 504 : 502).json({
      error: isTimeout ? 'Telegram timeout' : 'Failed to send',
      message: err.message,
    });
  }
}