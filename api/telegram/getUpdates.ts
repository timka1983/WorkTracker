import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { botToken } = req.query as { botToken: string };
    if (!botToken) return res.status(400).json({ error: "botToken is required" });
    
    console.log(`[Telegram] Fetching updates...`);
    
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates`);
    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    console.error("[Telegram] getUpdates proxy error:", error.message);
    res.status(500).json({ ok: false, error: "Failed to reach Telegram", message: error.message });
  }
}
