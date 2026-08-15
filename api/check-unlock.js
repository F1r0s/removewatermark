// Check if a session has been unlocked via postback
if (!globalThis._unlockedSessions) {
  globalThis._unlockedSessions = new Map();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { sid } = req.query;
  if (!sid) {
    return res.status(400).json({ unlocked: false, error: 'Missing sid' });
  }

  const session = globalThis._unlockedSessions.get(sid);
  if (session) {
    return res.status(200).json({
      unlocked: true,
      offerId: session.offerId,
      payout: session.payout,
    });
  }

  return res.status(200).json({ unlocked: false });
}
