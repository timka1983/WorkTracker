import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orgId, planType, amount, termMonths, invoiceId, extraMachines, extraUsers } = req.body;
    
    // Mock session creation
    const sessionId = Math.random().toString(36).substring(7);
    
    let confirmationUrl = `/payment-success?session_id=${sessionId}&orgId=${orgId}&plan=${planType}&term=${termMonths || 1}`;
    if (invoiceId) confirmationUrl += `&invoiceId=${invoiceId}`;
    if (extraMachines) confirmationUrl += `&extraMachines=${extraMachines}`;
    if (extraUsers) confirmationUrl += `&extraUsers=${extraUsers}`;

    res.json({ url: confirmationUrl });
  } catch (error) {
    console.error("Payment session error:", error);
    res.status(500).json({ error: "Failed to create payment session" });
  }
}
