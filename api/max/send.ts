import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { botToken, chatId, message } = req.body;
    
    const response = await fetch(`https://api.max.ru/v1/bot/${botToken}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      })
    });
    
    const data = await response.json();
    if (!data.ok) {
      throw new Error(data.description || 'Failed to send');
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error("Max notification error:", error);
    res.status(500).json({ error: "Failed to send Max notification", message: error.message });
  }
}
