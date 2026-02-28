// /api/quote.js — Vercel serverless function
// Proxies Yahoo Finance v8 chart API to bypass CORS
// Usage: /api/quote?symbols=ES=F,NQ=F,AAPL,MSFT

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=10');

  const { symbols } = req.query;
  if (!symbols) return res.status(400).json({ error: 'Missing symbols parameter' });

  const symList = symbols.split(',').map(s => s.trim()).filter(Boolean);
  
  try {
    const results = await Promise.allSettled(
      symList.map(async (sym) => {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=5m&includePrePost=true`;
        const resp = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        if (!resp.ok) throw new Error(`Yahoo returned ${resp.status} for ${sym}`);
        const data = await resp.json();
        const result = data?.chart?.result?.[0];
        if (!result) throw new Error(`No data for ${sym}`);

        const meta = result.meta;
        const quotes = result.indicators?.quote?.[0] || {};
        const timestamps = result.timestamp || [];
        const closes = quotes.close || [];
        
        // Get previous close and current price
        const prevClose = meta.chartPreviousClose || meta.previousClose || 0;
        const price = meta.regularMarketPrice || closes[closes.length - 1] || 0;
        const chg = price - prevClose;
        const pctChg = prevClose ? (chg / prevClose) * 100 : 0;

        // Build sparkline from intraday closes (sample every 6th point for ~30 points)
        const spark = [];
        const step = Math.max(1, Math.floor(closes.length / 30));
        for (let i = 0; i < closes.length; i += step) {
          if (closes[i] != null) spark.push(+closes[i].toFixed(4));
        }

        return {
          sym: meta.symbol || sym,
          name: meta.shortName || meta.longName || sym,
          last: +price.toFixed(meta.regularMarketPrice > 100 ? 2 : 4),
          chg: +chg.toFixed(meta.regularMarketPrice > 100 ? 2 : 4),
          pctChg: +pctChg.toFixed(2),
          high: +(meta.regularMarketDayHigh || 0).toFixed(meta.regularMarketPrice > 100 ? 2 : 4),
          low: +(meta.regularMarketDayLow || 0).toFixed(meta.regularMarketPrice > 100 ? 2 : 4),
          vol: meta.regularMarketVolume || 0,
          prevClose: +prevClose.toFixed(4),
          mktState: meta.marketState || 'UNKNOWN',
          exchange: meta.exchangeName || '',
          spark,
        };
      })
    );

    const quotes = {};
    for (const r of results) {
      if (r.status === 'fulfilled') quotes[r.value.sym] = r.value;
      // silently skip failures
    }

    return res.status(200).json({ quotes, ts: Date.now() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
