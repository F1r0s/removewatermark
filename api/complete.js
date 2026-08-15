// OGAds Postback receiver
// OGAds will call: /api/complete?sid={aff_sub}&offer_id={offer_id}&payout={payout}
// You must set this URL in your OGAds dashboard → Tools → Postback URL

if (!globalThis._unlockedSessions) {
  globalThis._unlockedSessions = new Map();
}

export default async function handler(req, res) {
  const { sid, offer_id, payout } = req.query;

  if (!sid) {
    return res.status(400).send('Missing sid parameter');
  }

  // Store the completed session
  globalThis._unlockedSessions.set(sid, {
    ts: Date.now(),
    offerId: offer_id || 'unknown',
    payout: payout || '0',
  });

  // Cleanup sessions older than 30 minutes
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [key, val] of globalThis._unlockedSessions) {
    if (val.ts < cutoff) globalThis._unlockedSessions.delete(key);
  }

  console.log(`[Postback] Unlocked session: ${sid} | offer: ${offer_id} | payout: $${payout}`);

  return res.status(200).send('1'); // OGAds expects a "1" response on success
}
