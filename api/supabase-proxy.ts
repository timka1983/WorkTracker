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
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  if (!SUPABASE_URL) {
    return res.status(500).json({ error: 'VITE_SUPABASE_URL not configured' });
  }

  // The rewrite in vercel.json sends the full path /api/supabase-proxy/rest/v1/... to this function
  // We need to strip the prefix
  const originalUrl = req.url || '';
  const path = originalUrl.replace(/^\/api\/supabase-proxy/, '') || '/';
  
  // Set req.url to the target path
  req.url = path;

  console.log(`[Supabase Proxy] Forwarding ${req.method} ${originalUrl} -> ${SUPABASE_URL}${path}`);

  return new Promise((resolve, reject) => {
    proxy.web(req, res, { 
      target: SUPABASE_URL,
      headers: {
        'Origin': SUPABASE_URL,
        'Host': new URL(SUPABASE_URL).host
      }
    }, (err) => {
      if (err) {
        console.error('[Supabase Proxy Error]', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Proxy Error', message: err.message });
        }
        return reject(err);
      }
      resolve(true);
    });
  });
}
