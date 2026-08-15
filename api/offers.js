// Global session store (in-memory, works within same Vercel instance)
if (!globalThis._unlockedSessions) {
  globalThis._unlockedSessions = new Map();
}

const USA_PRIORITY_IDS = [68793, 57464];

export default async function handler(req, res) {
  // Allow CORS for the frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.connection?.remoteAddress
    || '1.1.1.1';
  const userAgent = req.headers['user-agent'] || 'Mozilla/5.0';

  const apiKey = process.env.OGADS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OGADS_API_KEY not configured' });
  }

  const url = `https://appsave.store/api/v2?ip=${encodeURIComponent(ip)}&user_agent=${encodeURIComponent(userAgent)}`;

  try {
    const ogRes = await fetch(url, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (!ogRes.ok) {
      return res.status(500).json({ error: 'OGAds API error', status: ogRes.status });
    }

    const data = await ogRes.json();
    if (!data.success) {
      return res.status(500).json({ error: 'OGAds returned error', details: data });
    }

    let offers = data.offers || [];

    // Detect USA traffic: check if any returned offers are USA priority IDs
    const hasPriorityOffers = offers.some(o => USA_PRIORITY_IDS.includes(Number(o.offerid)));
    // Also check country on offers — USA offers will be tagged US
    const usaOfferCount = offers.filter(o => {
      const c = (o.country || '').toUpperCase();
      return c === 'US' || c.includes('US');
    }).length;
    const isUSA = hasPriorityOffers || (offers.length > 0 && usaOfferCount >= offers.length * 0.5);

    if (isUSA) {
      // Move priority IDs to the front
      const priority = offers.filter(o => USA_PRIORITY_IDS.includes(Number(o.offerid)));
      const rest = offers.filter(o => !USA_PRIORITY_IDS.includes(Number(o.offerid)));
      offers = [...priority, ...rest];
    } else {
      // Non-USA: filter for min $1.00 payout, sort by payout descending
      offers = offers
        .filter(o => parseFloat(o.payout) >= 1.00)
        .sort((a, b) => parseFloat(b.payout) - parseFloat(a.payout));

      // If nothing passes the filter (very low-payout region), show top 6 sorted by payout
      if (offers.length < 2) {
        offers = (data.offers || []).sort((a, b) => parseFloat(b.payout) - parseFloat(a.payout));
      }
    }

    return res.status(200).json({
      offers: offers.slice(0, 6),
      isUSA,
      ip
    });
  } catch (err) {
    console.error('Offers fetch error:', err);
    return res.status(500).json({ error: 'Internal error fetching offers' });
  }
}
