// /api/fred.js — Vercel serverless function
// Proxies FRED API for economic data
// Usage: /api/fred?series=DGS10,DGS2,DGS30&key=YOUR_FRED_KEY
// Or for multiple observations: /api/fred?series=DGS10&key=xxx

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  const { series, key } = req.query;
  const apiKey = key || process.env.FRED_API_KEY;
  
  if (!series) return res.status(400).json({ error: 'Missing series parameter' });
  if (!apiKey) return res.status(400).json({ error: 'Missing FRED API key. Get one free at https://fred.stlouisfed.org/docs/api/api_key.html' });

  const seriesList = series.split(',').map(s => s.trim()).filter(Boolean);

  try {
    const results = await Promise.allSettled(
      seriesList.map(async (id) => {
        const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=5`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`FRED returned ${resp.status} for ${id}`);
        const data = await resp.json();
        const obs = (data.observations || []).filter(o => o.value !== '.');
        return {
          id,
          latest: obs[0] ? { date: obs[0].date, value: parseFloat(obs[0].value) } : null,
          prev: obs[1] ? { date: obs[1].date, value: parseFloat(obs[1].value) } : null,
        };
      })
    );

    const data = {};
    for (const r of results) {
      if (r.status === 'fulfilled') data[r.value.id] = r.value;
    }

    return res.status(200).json({ data, ts: Date.now() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
