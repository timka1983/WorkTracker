import type { VercelRequest, VercelResponse } from '@vercel/node';
import httpProxy from 'http-proxy';

const proxy = httpProxy.createProxyServer({
  secure: true,
  changeOrigin: true,
});

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(req: VercelRequest, res: VercelResponse) {
  const TELEGRAM_URL = 'https://api.telegram.org';

  const originalUrl = req.url || '';
  const path = originalUrl.replace(/^\/api\/telegram-proxy/, '') || '/';
  req.url = path;

  console.log(`[Telegram Proxy] Forwarding ${req.method} ${originalUrl} -> ${TELEGRAM_URL}${path}`);

  return new Promise((resolve, reject) => {
    proxy.web(req, res, { 
      target: TELEGRAM_URL,
      headers: {
        'Host': 'api.telegram.org'
      }
    }, (err) => {
      if (err) {
        console.error('[Telegram Proxy Error]', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Proxy Error', message: err.message });
        }
        return reject(err);
      }
      resolve(true);
    });
  });
}
