// /api/news.js — Vercel serverless function
// Fetches live financial news from public RSS feeds
// Usage: /api/news

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  const feeds = [
    { url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', src: 'MW' },
    { url: 'https://feeds.content.dowjones.io/public/rss/mw_marketpulse', src: 'MW' },
    { url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', src: 'CNBC' },
    { url: 'https://www.cnbc.com/id/10001147/device/rss/rss.html', src: 'CNBC' },
    { url: 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=^GSPC&region=US&lang=en-US', src: 'YF' },
    { url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258', src: 'CNBC' },
  ];

  try {
    const results = await Promise.allSettled(
      feeds.map(async (feed) => {
        const resp = await fetch(feed.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ViperTerminal/1.0)' },
          signal: AbortSignal.timeout(5000),
        });
        if (!resp.ok) throw new Error(`${resp.status}`);
        const xml = await resp.text();
        
        // Simple XML parsing for RSS items
        const items = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        let match;
        while ((match = itemRegex.exec(xml)) !== null && items.length < 8) {
          const content = match[1];
          const title = content.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1] || '';
          const pubDate = content.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
          const link = content.match(/<link>(.*?)<\/link>/)?.[1] || '';
          
          if (title && title.length > 10) {
            const date = new Date(pubDate);
            const time = !isNaN(date) ? date.toLocaleTimeString('en-US', { 
              hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York' 
            }) : '';
            
            items.push({
              title: title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"'),
              time,
              ts: !isNaN(date) ? date.getTime() : 0,
              src: feed.src,
              link,
            });
          }
        }
        return items;
      })
    );

    // Flatten, dedupe by title, sort by timestamp
    const allItems = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value)
      .filter(item => item.ts > 0);
    
    // Dedupe by similar titles
    const seen = new Set();
    const deduped = allItems.filter(item => {
      const key = item.title.toLowerCase().slice(0, 50);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort newest first
    deduped.sort((a, b) => b.ts - a.ts);

    return res.status(200).json({ 
      news: deduped.slice(0, 30), 
      ts: Date.now(),
      count: deduped.length 
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
