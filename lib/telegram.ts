
export const getTelegramUrl = (botToken: string, method: string) => {
  const useProxy = localStorage.getItem('use_telegram_proxy') === 'true';
  if (useProxy) {
    // We have two types of proxies in server.ts
    // 1. Specific routes like /api/telegram/send (internal fetch)
    // 2. Transparent proxy /api/telegram-proxy (http-proxy-middleware)
    
    // Transparent proxy is more flexible for any method
    return `/api/telegram-proxy/bot${botToken}/${method}`;
  }
  return `https://api.telegram.org/bot${botToken}/${method}`;
};

export const wrapTelegramFetch = async (botToken: string, method: string, options: RequestInit = {}) => {
  const url = getTelegramUrl(botToken, method);
  const response = await fetch(url, options);
  return response;
};
