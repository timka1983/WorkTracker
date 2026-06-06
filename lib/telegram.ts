// lib/telegram.ts
// Клиентская утилита для работы с Telegram через прокси

// ── URL с переключателем прокси ───────────────────────────────────────────────
// getTelegramUrl читает localStorage при каждом вызове —
// не нужна перезагрузка страницы при смене настройки
export const getTelegramUrl = (botToken: string, method: string): string => {
  const useProxy = localStorage.getItem('use_telegram_proxy') === 'true';
  if (useProxy) {
    return `/api/telegram-proxy/bot${botToken}/${method}`;
  }
  return `https://api.telegram.org/bot${botToken}/${method}`;
};

// ── Отправка сообщения ────────────────────────────────────────────────────────
export const sendTelegramNotification = async (
  botToken: string,
  chatId: string,
  message: string,
  enabled = true
): Promise<boolean> => {
  if (!enabled || !botToken?.trim() || !chatId?.trim() || !message?.trim()) return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const url = getTelegramUrl(botToken, 'sendMessage');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);
    const data = await res.json();

    if (!data.ok) {
      console.error('[Telegram] Send failed:', data.description);
      return false;
    }
    return true;

  } catch (err: any) {
    clearTimeout(timer);
    if (err.name !== 'AbortError') {
      console.error('[Telegram] Send error:', err.message);
    }
    return false;
  }
};

// ── Получение chatId из последнего сообщения боту ────────────────────────────
// Используется в настройках: пользователь пишет боту /start,
// потом нажимает «Определить chat_id» и система его находит автоматически
export const getTelegramChatId = async (botToken: string): Promise<string | null> => {
  if (!botToken?.trim()) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const useProxy = localStorage.getItem('use_telegram_proxy') === 'true';
    const url = useProxy
      ? `/api/telegram-proxy/bot${botToken}/getUpdates`
      : `https://api.telegram.org/bot${botToken}/getUpdates`;

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    const data = await res.json();
    if (!data.ok || !data.result?.length) return null;

    const last = data.result[data.result.length - 1];
    const chatId =
      last.message?.chat?.id ||
      last.channel_post?.chat?.id ||
      last.my_chat_member?.chat?.id;

    return chatId ? String(chatId) : null;

  } catch (err: any) {
    clearTimeout(timer);
    if (err.name !== 'AbortError') {
      console.error('[Telegram] getUpdates error:', err.message);
    }
    return null;
  }
};