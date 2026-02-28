// /api/news.js — Live financial news from RSS feeds
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  const feeds = [
    { url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', src: 'MW' },
    { url: 'https://feeds.content.dowjones.io/public/rss/mw_marketpulse', src: 'MW' },
    { url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', src: 'CNBC' },
    { url: 'https://www.cnbc.com/id/10001147/device/rss/rss.html', src: 'CNBC' },
    { url: 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=^GSPC&region=US&lang=en-US', src: 'YF' },
  ];

  // Decode HTML entities server-side
  function decode(s) {
    if (!s) return '';
    return s
      .replace(/<!\[CDATA\[|\]\]>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
      .replace(/&#x20[12][0-9a-fA-F];/g, "'")  // smart quotes
      .replace(/&#x201[cCdD];/g, '"')           // smart double quotes
      .replace(/&#x20(14|13);/g, '—')           // em/en dash
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/<[^>]+>/g, '')  // strip any remaining HTML tags
      .trim();
  }

  try {
    const results = await Promise.allSettled(
      feeds.map(async (feed) => {
        const resp = await fetch(feed.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ViperTerminal/1.0)' },
          signal: AbortSignal.timeout(5000),
        });
        if (!resp.ok) throw new Error(`${resp.status}`);
        const xml = await resp.text();
        const items = [];
        const re = /<item>([\s\S]*?)<\/item>/g;
        let m;
        while ((m = re.exec(xml)) !== null && items.length < 10) {
          const c = m[1];
          const title = decode(c.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '');
          const pubDate = c.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
          if (title && title.length > 15) {
            const date = new Date(pubDate);
            items.push({
              title,
              time: !isNaN(date) ? date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York' }) : '',
              ts: !isNaN(date) ? date.getTime() : 0,
              src: feed.src,
            });
          }
        }
        return items;
      })
    );

    const all = results.filter(r => r.status === 'fulfilled').flatMap(r => r.value).filter(i => i.ts > 0);
    const seen = new Set();
    const deduped = all.filter(i => { const k = i.title.toLowerCase().slice(0, 40); if (seen.has(k)) return false; seen.add(k); return true; });
    deduped.sort((a, b) => b.ts - a.ts);

    return res.status(200).json({ news: deduped.slice(0, 40), ts: Date.now() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
