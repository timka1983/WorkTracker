import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, data } = req.body;
  
  if (type === "payment.succeeded") {
    const { orgId, planType } = data;
    console.log(`Payment succeeded for org ${orgId}, plan ${planType}`);
  }
  
  res.json({ received: true });
}
