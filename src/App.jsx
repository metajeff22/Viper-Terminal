import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";

// ── GLOBAL ERROR HANDLER ─────────────────────────────────
if(typeof window!=='undefined'&&!window.__vtErrorHandler){window.__vtErrorHandler=true;window.onerror=function(msg,src,line,col,err){const d=document.createElement('div');d.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:#000;color:#ff3333;padding:40px;font-family:monospace;z-index:99999;overflow:auto';d.innerHTML='<h2 style="color:#ff3333">VIPER TERMINAL ERROR</h2><pre style="color:#ff8800;white-space:pre-wrap">'+msg+'\nLine: '+line+'\n'+(err?.stack||'')+'</pre><button onclick="location.reload()" style="margin-top:20px;padding:8px 20px;background:#ff8800;color:#000;border:none;cursor:pointer;font-family:monospace">RELOAD</button>';document.body.appendChild(d)};window.addEventListener('unhandledrejection',function(e){console.error('Unhandled:',e.reason)})}

// ── FORMATTERS (hardened against NaN/Infinity) ───────────
const fmt = n => n == null || !isFinite(n) ? "—" : (n < 0 ? "-" + Math.abs(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) : n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}));
const fmtPct = n => n == null || !isFinite(n) ? "—" : (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
const fmtVol = n => { if(!n||!isFinite(n)) return "—"; if(n>=1e9) return (n/1e9).toFixed(1)+"B"; if(n>=1e6) return (n/1e6).toFixed(1)+"M"; if(n>=1e3) return (n/1e3).toFixed(1)+"K"; return n.toString(); };
const fmtTime = () => { const d=new Date(); return d.toLocaleTimeString('en-US',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'}); };
const fmtDate = () => { const d=new Date(); return d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'}); };

// ── BLOOMBERG COLOR PALETTE ──────────────────────────────
const C = {
  bg: '#000000', panelBg: '#0a0a0a', panelBorder: '#1a1a1a',
  headerBg: '#1a1a1a', headerBorder: '#333333',
  orange: '#ff8800', amber: '#ffaa00', yellow: '#ffdd00',
  green: '#00cc66', red: '#ff3333', blue: '#3399ff',
  white: '#ffffff', gray: '#888888', dimGray: '#555555',
  darkGray: '#333333', text: '#cccccc', dim: '#666666',
  upGreen: '#00cc66', downRed: '#ff3333', unchanged: '#888888',
};

// ── MOCK DATA ENGINE (replaces live API in prototype) ────
const INDICES = [
  { sym: 'ES', name: 'E-Mini S&P 500', last: 5842.25, chg: -12.50, pctChg: -0.21, high: 5868.00, low: 5830.75, vol: 1247832 },
  { sym: 'NQ', name: 'E-Mini NASDAQ', last: 20645.50, chg: 87.25, pctChg: 0.42, high: 20710.00, low: 20520.25, vol: 892145 },
  { sym: 'YM', name: 'E-Mini Dow', last: 43285.00, chg: -45.00, pctChg: -0.10, high: 43410.00, low: 43200.00, vol: 345621 },
  { sym: 'RTY', name: 'Russell 2000', last: 2089.40, chg: 8.60, pctChg: 0.41, high: 2095.20, low: 2078.30, vol: 234567 },
  { sym: 'VIX', name: 'CBOE Volatility', last: 16.82, chg: -0.43, pctChg: -2.49, high: 17.45, low: 16.60, vol: 0 },
  { sym: 'DXY', name: 'US Dollar Index', last: 106.42, chg: 0.18, pctChg: 0.17, high: 106.65, low: 106.10, vol: 0 },
  { sym: 'CL', name: 'Crude Oil WTI', last: 78.45, chg: 1.22, pctChg: 1.58, high: 78.90, low: 76.85, vol: 567890 },
  { sym: 'GC', name: 'Gold', last: 2935.60, chg: 12.40, pctChg: 0.42, high: 2942.00, low: 2918.80, vol: 234567 },
  { sym: 'ZN', name: '10-Yr Note', last: 110.156, chg: -0.094, pctChg: -0.09, high: 110.312, low: 110.031, vol: 1345678 },
  { sym: 'ZB', name: '30-Yr Bond', last: 118.250, chg: -0.188, pctChg: -0.16, high: 118.500, low: 118.000, vol: 456789 },
  { sym: '6E', name: 'Euro FX', last: 1.0485, chg: -0.0012, pctChg: -0.11, high: 1.0510, low: 1.0465, vol: 345678 },
  { sym: '6J', name: 'Japanese Yen', last: 0.006642, chg: 0.000015, pctChg: 0.23, high: 0.006660, low: 0.006620, vol: 123456 },
];

const STOCKS = [
  { sym: 'AAPL', last: 232.47, chg: 1.83, pctChg: 0.79, vol: 52340000, mktCap: '3.58T', pe: 37.2, div: 0.51 },
  { sym: 'MSFT', last: 411.22, chg: -2.15, pctChg: -0.52, vol: 18920000, mktCap: '3.06T', pe: 35.8, div: 0.72 },
  { sym: 'NVDA', last: 138.85, chg: 4.22, pctChg: 3.13, vol: 89450000, mktCap: '3.40T', pe: 62.1, div: 0.03 },
  { sym: 'AMZN', last: 198.34, chg: 0.67, pctChg: 0.34, vol: 34560000, mktCap: '2.08T', pe: 58.4, div: 0 },
  { sym: 'META', last: 612.50, chg: -8.30, pctChg: -1.34, vol: 12340000, mktCap: '1.56T', pe: 26.3, div: 0.50 },
  { sym: 'GOOG', last: 178.92, chg: 2.45, pctChg: 1.39, vol: 21560000, mktCap: '2.21T', pe: 22.8, div: 0.20 },
  { sym: 'TSLA', last: 302.15, chg: 12.40, pctChg: 4.28, vol: 78900000, mktCap: '967B', pe: 142.5, div: 0 },
  { sym: 'SPY', last: 582.40, chg: -1.20, pctChg: -0.21, vol: 45670000, mktCap: '—', pe: 0, div: 1.22 },
  { sym: 'QQQ', last: 502.85, chg: 2.10, pctChg: 0.42, vol: 32100000, mktCap: '—', pe: 0, div: 0.55 },
  { sym: 'IWM', last: 208.94, chg: 0.86, pctChg: 0.41, vol: 23450000, mktCap: '—', pe: 0, div: 1.38 },
];

const NEWS = [
  { time: '14:32', src: 'RTRS', hl: 'Fed officials signal patience on rate cuts amid sticky inflation data', tags: ['FED','RATES'] },
  { time: '14:18', src: 'BBG', hl: 'NVDA reports record data center revenue, beats estimates by 12%', tags: ['NVDA','EARNINGS'] },
  { time: '14:05', src: 'CNBC', hl: 'Treasury yields climb as jobs data comes in stronger than expected', tags: ['BONDS','ECON'] },
  { time: '13:52', src: 'WSJ', hl: 'OPEC+ considers extending production cuts through Q3 2026', tags: ['OIL','CL'] },
  { time: '13:41', src: 'RTRS', hl: 'China PMI contracts for second straight month, yuan weakens', tags: ['CHINA','FX'] },
  { time: '13:28', src: 'BBG', hl: 'Meta announces $65B AI infrastructure buildout plan', tags: ['META','AI'] },
  { time: '13:15', src: 'RTRS', hl: 'European Central Bank holds rates steady, signals June reassessment', tags: ['ECB','RATES'] },
  { time: '13:02', src: 'CNBC', hl: 'Bitcoin surges past $95K on ETF inflow momentum', tags: ['CRYPTO','BTC'] },
  { time: '12:48', src: 'WSJ', hl: 'Apple Vision Pro 2 production begins at Foxconn facilities', tags: ['AAPL','TECH'] },
  { time: '12:35', src: 'BBG', hl: 'US initial jobless claims fall to 210K vs 225K expected', tags: ['ECON','JOBS'] },
  { time: '12:22', src: 'RTRS', hl: 'Goldman raises S&P 500 year-end target to 6,200', tags: ['RESEARCH','SPX'] },
  { time: '12:10', src: 'CNBC', hl: 'Copper hits 10-month high on infrastructure spending optimism', tags: ['COMMODITIES'] },
];

const ECON_CALENDAR = [
  { time: '08:30', event: 'Initial Jobless Claims', actual: '210K', forecast: '225K', prev: '219K', impact: 'high', surprise: 'positive' },
  { time: '08:30', event: 'GDP Price Index (Q4)', actual: '2.3%', forecast: '2.2%', prev: '1.9%', impact: 'med', surprise: 'neutral' },
  { time: '10:00', event: 'Pending Home Sales MoM', actual: '—', forecast: '1.5%', prev: '-4.6%', impact: 'med', surprise: null },
  { time: '10:30', event: 'EIA Natural Gas Storage', actual: '—', forecast: '-86B', prev: '-196B', impact: 'low', surprise: null },
  { time: '13:00', event: '7-Year Note Auction', actual: '—', forecast: '4.32%', prev: '4.53%', impact: 'med', surprise: null },
  { time: '16:00', event: 'Fed Balance Sheet', actual: '—', forecast: '—', prev: '$6.81T', impact: 'low', surprise: null },
];

const EARNINGS = [
  { sym: 'NVDA', date: 'Feb 26', eps: '$0.89', est: '$0.79', rev: '$39.3B', revEst: '$37.8B', surprise: '+12.7%', react: '+4.2%' },
  { sym: 'CRM', date: 'Feb 26', eps: '$2.78', est: '$2.61', rev: '$10.0B', revEst: '$9.87B', surprise: '+6.5%', react: '+2.1%' },
  { sym: 'SNOW', date: 'Feb 26', eps: '$0.30', est: '$0.27', rev: '$986M', revEst: '$952M', surprise: '+11.1%', react: '-3.4%' },
  { sym: 'DELL', date: 'Feb 27', eps: '—', est: '$2.53', rev: '—', revEst: '$24.5B', surprise: '—', react: '—' },
  { sym: 'MRVL', date: 'Mar 4', eps: '—', est: '$0.59', rev: '—', revEst: '$1.83B', surprise: '—', react: '—' },
  { sym: 'AVGO', date: 'Mar 6', eps: '—', est: '$1.49', rev: '—', revEst: '$14.6B', surprise: '—', react: '—' },
  { sym: 'COST', date: 'Mar 6', eps: '—', est: '$4.11', rev: '—', revEst: '$63.1B', surprise: '—', react: '—' },
  { sym: 'ORCL', date: 'Mar 10', eps: '—', est: '$1.49', rev: '—', revEst: '$14.4B', surprise: '—', react: '—' },
];

const ANALYST_RECS = [
  { sym: 'NVDA', firm: 'Goldman Sachs', action: 'UPGRADE', from: 'Neutral', to: 'Buy', pt: '$175', date: 'Feb 27' },
  { sym: 'TSLA', firm: 'Morgan Stanley', action: 'REITERATE', from: 'Overweight', to: 'Overweight', pt: '$350', date: 'Feb 27' },
  { sym: 'AAPL', firm: 'JP Morgan', action: 'DOWNGRADE', from: 'Overweight', to: 'Neutral', pt: '$225', date: 'Feb 26' },
  { sym: 'META', firm: 'Bank of America', action: 'REITERATE', from: 'Buy', to: 'Buy', pt: '$700', date: 'Feb 26' },
  { sym: 'AMZN', firm: 'UBS', action: 'UPGRADE', from: 'Neutral', to: 'Buy', pt: '$240', date: 'Feb 25' },
  { sym: 'MSFT', firm: 'Citi', action: 'REITERATE', from: 'Buy', to: 'Buy', pt: '$470', date: 'Feb 25' },
  { sym: 'GOOG', firm: 'Barclays', action: 'UPGRADE', from: 'Equal Weight', to: 'Overweight', pt: '$210', date: 'Feb 24' },
  { sym: 'CRM', firm: 'Piper Sandler', action: 'REITERATE', from: 'Overweight', to: 'Overweight', pt: '$375', date: 'Feb 24' },
];

const OPTIONS_CHAIN = [
  { strike: 5800, callBid: 52.25, callAsk: 52.75, callVol: 12340, callOI: 45670, callIV: 14.2, putBid: 10.50, putAsk: 11.00, putVol: 8920, putOI: 34560, putIV: 13.8 },
  { strike: 5810, callBid: 45.00, callAsk: 45.50, callVol: 9870, callOI: 38900, callIV: 14.0, putBid: 13.25, putAsk: 13.75, putVol: 10230, putOI: 41200, putIV: 13.9 },
  { strike: 5820, callBid: 38.25, callAsk: 38.75, callVol: 15600, callOI: 52300, callIV: 13.8, putBid: 16.50, putAsk: 17.00, putVol: 11450, putOI: 43800, putIV: 14.1 },
  { strike: 5830, callBid: 32.00, callAsk: 32.50, callVol: 18900, callOI: 61200, callIV: 13.6, putBid: 20.25, putAsk: 20.75, putVol: 14560, putOI: 48900, putIV: 14.3 },
  { strike: 5840, callBid: 26.25, callAsk: 26.75, callVol: 22100, callOI: 78400, callIV: 13.5, putBid: 24.50, putAsk: 25.00, putVol: 19870, putOI: 56700, putIV: 14.5 },
  { strike: 5850, callBid: 21.00, callAsk: 21.50, callVol: 28900, callOI: 89200, callIV: 13.3, putBid: 29.25, putAsk: 29.75, putVol: 23400, putOI: 67800, putIV: 14.7 },
  { strike: 5860, callBid: 16.50, callAsk: 17.00, callVol: 19800, callOI: 72100, callIV: 13.2, putBid: 34.75, putAsk: 35.25, putVol: 16700, putOI: 51200, putIV: 14.9 },
  { strike: 5870, callBid: 12.50, callAsk: 13.00, callVol: 14300, callOI: 58900, callIV: 13.1, putBid: 40.75, putAsk: 41.25, putVol: 12100, putOI: 42300, putIV: 15.1 },
  { strike: 5880, callBid: 9.25, callAsk: 9.75, callVol: 11200, callOI: 45600, callIV: 13.0, putBid: 47.50, putAsk: 48.00, putVol: 9800, putOI: 36700, putIV: 15.3 },
  { strike: 5890, callBid: 6.75, callAsk: 7.25, callVol: 8900, callOI: 34500, callIV: 12.9, putBid: 55.00, putAsk: 55.50, putVol: 7600, putOI: 28900, putIV: 15.5 },
];

// Simulated tick movement
const useTick = (data, interval = 2000) => {
  const [items, setItems] = useState(data);
  useEffect(() => {
    const t = setInterval(() => {
      setItems(prev => prev.map(item => {
        const delta = (Math.random() - 0.48) * item.last * 0.0003;
        const newLast = +(item.last + delta).toFixed(item.last > 100 ? 2 : item.last > 10 ? 2 : item.last > 1 ? 4 : 6);
        const newChg = +(item.chg + delta).toFixed(item.last > 1 ? 2 : 6);
        const newPct = +((newChg / (newLast - newChg)) * 100).toFixed(2);
        return { ...item, last: newLast, chg: newChg, pctChg: newPct, _flash: delta > 0 ? 'up' : 'dn' };
      }));
    }, interval);
    return () => clearInterval(t);
  }, []);
  return items;
};

// ── BLOOMBERG-STYLE MINI CHART (sparkline) ───────────────
const Sparkline = ({ data, w = 80, h = 20, color }) => {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color || C.green} strokeWidth="1.2" />
    </svg>
  );
};

// Generate random sparkline data
const genSparkData = (base, n = 30) => {
  const d = [base]; for (let i = 1; i < n; i++) d.push(d[i-1] + (Math.random()-0.48)*base*0.003); return d;
};

// ── PANEL COMPONENT ──────────────────────────────────────
const Panel = ({ title, children, flex, style, headerRight, noPad }) => (
  <div style={{
    background: C.panelBg, border: `1px solid ${C.panelBorder}`,
    display: 'flex', flexDirection: 'column', flex: flex || 'none',
    minWidth: 0, overflow: 'hidden', ...style
  }}>
    <div style={{
      background: C.headerBg, borderBottom: `1px solid ${C.panelBorder}`,
      padding: '3px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      flexShrink: 0
    }}>
      <span style={{ color: C.orange, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>{title}</span>
      {headerRight && <span style={{ color: C.dim, fontSize: 10 }}>{headerRight}</span>}
    </div>
    <div style={{ flex: 1, overflow: 'auto', padding: noPad ? 0 : '4px 6px', minHeight: 0 }}>
      {children}
    </div>
  </div>
);

// ── TABLE ROW HELPERS ────────────────────────────────────
const chgColor = v => v > 0 ? C.upGreen : v < 0 ? C.downRed : C.unchanged;
const flashBg = f => f === 'up' ? 'rgba(0,204,102,0.12)' : f === 'dn' ? 'rgba(255,51,51,0.12)' : 'transparent';

// ── MAIN APP ─────────────────────────────────────────────
export default function ViperTerminal() {
  const [page, setPage] = useState('MARKET');
  const [clock, setClock] = useState(fmtTime());
  const [cmdInput, setCmdInput] = useState('');
  const [cmdHistory, setCmdHistory] = useState([]);
  const cmdRef = useRef(null);
  const indices = useTick(INDICES, 1500);
  const stocks = useTick(STOCKS, 2000);
  const mob = typeof window !== 'undefined' && window.innerWidth < 768;

  // Clock tick
  useEffect(() => { const t = setInterval(() => setClock(fmtTime()), 1000); return () => clearInterval(t); }, []);

  // Bloomberg-style command processing
  const processCmd = (cmd) => {
    const c = cmd.toUpperCase().trim();
    if (['MKT','MARKET','1'].includes(c)) setPage('MARKET');
    else if (['NEWS','N','2'].includes(c)) setPage('NEWS');
    else if (['OPT','OPTIONS','3'].includes(c)) setPage('OPTIONS');
    else if (['ECON','ECO','4'].includes(c)) setPage('ECON');
    else if (['EARN','EARNINGS','5'].includes(c)) setPage('EARNINGS');
    else if (['RES','RESEARCH','ANALYST','6'].includes(c)) setPage('RESEARCH');
    else if (['EQ','EQUITY','EQUITIES','7'].includes(c)) setPage('EQUITIES');
    else if (['HELP','?'].includes(c)) setPage('HELP');
    else setCmdHistory(prev => [...prev.slice(-20), { cmd, result: `Unknown command: ${c}` }]);
  };

  const handleCmdKey = (e) => {
    if (e.key === 'Enter' && cmdInput.trim()) {
      processCmd(cmdInput);
      setCmdHistory(prev => [...prev.slice(-20), { cmd: cmdInput }]);
      setCmdInput('');
    }
  };

  // Focus command line on key press
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === '/' || e.key === 'Escape') { e.preventDefault(); cmdRef.current?.focus(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const pages = [
    { key: 'MARKET', label: '1) MARKET', num: '1' },
    { key: 'NEWS', label: '2) NEWS', num: '2' },
    { key: 'OPTIONS', label: '3) OPTIONS', num: '3' },
    { key: 'ECON', label: '4) ECON', num: '4' },
    { key: 'EARNINGS', label: '5) EARNINGS', num: '5' },
    { key: 'RESEARCH', label: '6) RESEARCH', num: '6' },
    { key: 'EQUITIES', label: '7) EQUITIES', num: '7' },
  ];

  return (
    <div style={{
      width: '100vw', height: '100vh', background: C.bg, display: 'flex', flexDirection: 'column',
      fontFamily: "'Consolas','Courier New',monospace", fontSize: 11, color: C.text,
      overflow: 'hidden', userSelect: 'none'
    }}>
      {/* ── TOP BAR ── */}
      <div style={{
        background: '#0d0d0d', borderBottom: `1px solid ${C.darkGray}`,
        padding: '2px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexShrink: 0, height: 24
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: C.orange, fontWeight: 900, fontSize: 13, letterSpacing: 1 }}>VIPER</span>
          <span style={{ color: C.amber, fontSize: 10 }}>TERMINAL</span>
          <span style={{ color: C.darkGray }}>│</span>
          {pages.map(p => (
            <span key={p.key} onClick={() => setPage(p.key)}
              style={{
                color: page === p.key ? C.amber : C.dimGray, cursor: 'pointer', fontSize: 10,
                padding: '1px 6px', background: page === p.key ? '#1a1500' : 'transparent',
                border: page === p.key ? `1px solid ${C.darkGray}` : '1px solid transparent',
                letterSpacing: 0.3
              }}>
              {p.label}
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: C.dim, fontSize: 10 }}>{fmtDate()}</span>
          <span style={{ color: C.amber, fontSize: 11, fontWeight: 700 }}>{clock}</span>
        </div>
      </div>

      {/* ── TICKER STRIP ── */}
      <div style={{
        background: '#050505', borderBottom: `1px solid ${C.panelBorder}`,
        padding: '2px 8px', display: 'flex', gap: 16, overflow: 'hidden', flexShrink: 0, height: 20, alignItems: 'center'
      }}>
        {indices.slice(0, 8).map(q => (
          <span key={q.sym} style={{ display: 'inline-flex', gap: 4, fontSize: 10, whiteSpace: 'nowrap' }}>
            <span style={{ color: C.amber, fontWeight: 700 }}>{q.sym}</span>
            <span style={{ color: C.white }}>{q.last > 100 ? q.last.toFixed(2) : q.last > 1 ? q.last.toFixed(2) : q.last.toFixed(4)}</span>
            <span style={{ color: chgColor(q.chg) }}>{fmtPct(q.pctChg)}</span>
          </span>
        ))}
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {page === 'MARKET' && <MarketPage indices={indices} stocks={stocks} />}
        {page === 'NEWS' && <NewsPage />}
        {page === 'OPTIONS' && <OptionsPage />}
        {page === 'ECON' && <EconPage />}
        {page === 'EARNINGS' && <EarningsPage />}
        {page === 'RESEARCH' && <ResearchPage />}
        {page === 'EQUITIES' && <EquitiesPage stocks={stocks} />}
        {page === 'HELP' && <HelpPage />}
      </div>

      {/* ── COMMAND LINE ── */}
      <div style={{
        background: '#050505', borderTop: `1px solid ${C.darkGray}`,
        padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, height: 24
      }}>
        <span style={{ color: C.orange, fontSize: 11, fontWeight: 700 }}>{'>'}</span>
        <input ref={cmdRef} value={cmdInput} onChange={e => setCmdInput(e.target.value)} onKeyDown={handleCmdKey}
          placeholder="Type command or page number... (/ to focus)"
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: C.amber, fontSize: 11, fontFamily: 'inherit', caretColor: C.amber
          }}
        />
        <span style={{ color: C.dimGray, fontSize: 9 }}>ESC=focus │ ?=help</span>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// ── MARKET PAGE ──────────────────────────────────────────
// ══════════════════════════════════════════════════════════
function MarketPage({ indices, stocks }) {
  const sparkData = useMemo(() => {
    const d = {};
    INDICES.forEach(i => { d[i.sym] = genSparkData(i.last); });
    STOCKS.forEach(s => { d[s.sym] = genSparkData(s.last); });
    return d;
  }, []);

  return (
    <div style={{ flex: 1, display: 'flex', gap: 1, overflow: 'hidden', padding: 1 }}>
      {/* LEFT: Futures & Indices */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <Panel title="Futures & Indices" flex="1" headerRight="CME/CBOE">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: C.dim, fontSize: 9, textTransform: 'uppercase' }}>
                <td style={{ padding: '2px 4px' }}>Sym</td>
                <td style={{ padding: '2px 4px' }}>Name</td>
                <td style={{ padding: '2px 4px', textAlign: 'right' }}>Last</td>
                <td style={{ padding: '2px 4px', textAlign: 'right' }}>Chg</td>
                <td style={{ padding: '2px 4px', textAlign: 'right' }}>%Chg</td>
                <td style={{ padding: '2px 4px', textAlign: 'right' }}>High</td>
                <td style={{ padding: '2px 4px', textAlign: 'right' }}>Low</td>
                <td style={{ padding: '2px 4px', textAlign: 'center' }}>30d</td>
                <td style={{ padding: '2px 4px', textAlign: 'right' }}>Vol</td>
              </tr>
            </thead>
            <tbody>
              {indices.map(q => (
                <tr key={q.sym} style={{ borderBottom: `1px solid ${C.panelBorder}`, background: flashBg(q._flash), transition: 'background 0.3s' }}>
                  <td style={{ padding: '3px 4px', color: C.amber, fontWeight: 700 }}>{q.sym}</td>
                  <td style={{ padding: '3px 4px', color: C.gray, fontSize: 10 }}>{q.name}</td>
                  <td style={{ padding: '3px 4px', textAlign: 'right', color: C.white, fontWeight: 600 }}>{q.last > 1 ? q.last.toFixed(2) : q.last.toFixed(4)}</td>
                  <td style={{ padding: '3px 4px', textAlign: 'right', color: chgColor(q.chg) }}>{q.chg > 0 ? '+' : ''}{q.chg > 1 ? q.chg.toFixed(2) : q.chg.toFixed(4)}</td>
                  <td style={{ padding: '3px 4px', textAlign: 'right', color: chgColor(q.pctChg), fontWeight: 600 }}>{fmtPct(q.pctChg)}</td>
                  <td style={{ padding: '3px 4px', textAlign: 'right', color: C.dim }}>{q.high > 1 ? q.high.toFixed(2) : q.high.toFixed(4)}</td>
                  <td style={{ padding: '3px 4px', textAlign: 'right', color: C.dim }}>{q.low > 1 ? q.low.toFixed(2) : q.low.toFixed(4)}</td>
                  <td style={{ padding: '3px 4px', textAlign: 'center' }}><Sparkline data={sparkData[q.sym]} color={q.chg >= 0 ? C.upGreen : C.downRed} /></td>
                  <td style={{ padding: '3px 4px', textAlign: 'right', color: C.dim }}>{fmtVol(q.vol)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      {/* MIDDLE: News + Econ snapshot */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <Panel title="Headlines" flex="1.5" headerRight="LIVE">
          {NEWS.slice(0, 8).map((n, i) => (
            <div key={i} style={{ padding: '3px 0', borderBottom: `1px solid ${C.panelBorder}`, display: 'flex', gap: 6 }}>
              <span style={{ color: C.dim, fontSize: 10, flexShrink: 0 }}>{n.time}</span>
              <span style={{ color: C.blue, fontSize: 10, flexShrink: 0, fontWeight: 600 }}>{n.src}</span>
              <span style={{ color: C.text, fontSize: 10, lineHeight: 1.3 }}>{n.hl}</span>
            </div>
          ))}
        </Panel>
        <Panel title="Economic Calendar" flex="1" headerRight={fmtDate()}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: C.dim, fontSize: 9 }}>
                <td style={{ padding: '2px 3px' }}>Time</td>
                <td style={{ padding: '2px 3px' }}>Event</td>
                <td style={{ padding: '2px 3px', textAlign: 'right' }}>Act</td>
                <td style={{ padding: '2px 3px', textAlign: 'right' }}>Fcst</td>
                <td style={{ padding: '2px 3px', textAlign: 'right' }}>Prev</td>
              </tr>
            </thead>
            <tbody>
              {ECON_CALENDAR.map((e, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.panelBorder}` }}>
                  <td style={{ padding: '3px', color: C.dim }}>{e.time}</td>
                  <td style={{ padding: '3px', color: e.impact === 'high' ? C.amber : C.text, fontWeight: e.impact === 'high' ? 600 : 400, fontSize: 10 }}>{e.event}</td>
                  <td style={{ padding: '3px', textAlign: 'right', color: e.surprise === 'positive' ? C.upGreen : e.surprise === 'negative' ? C.downRed : e.actual === '—' ? C.dimGray : C.white, fontWeight: 600 }}>{e.actual}</td>
                  <td style={{ padding: '3px', textAlign: 'right', color: C.dim }}>{e.forecast}</td>
                  <td style={{ padding: '3px', textAlign: 'right', color: C.dimGray }}>{e.prev}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      {/* RIGHT: Top movers + Analyst */}
      <div style={{ flex: 0.8, display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <Panel title="Top Movers" flex="1" headerRight="EQUITY">
          {stocks.sort((a, b) => Math.abs(b.pctChg) - Math.abs(a.pctChg)).slice(0, 8).map(s => (
            <div key={s.sym} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 2px', borderBottom: `1px solid ${C.panelBorder}`, background: flashBg(s._flash), transition: 'background 0.3s' }}>
              <span style={{ color: C.amber, fontWeight: 700, width: 42 }}>{s.sym}</span>
              <span style={{ color: C.white, textAlign: 'right', width: 60 }}>{s.last.toFixed(2)}</span>
              <span style={{ color: chgColor(s.pctChg), textAlign: 'right', width: 55, fontWeight: 600 }}>{fmtPct(s.pctChg)}</span>
              <Sparkline data={genSparkData(s.last)} w={50} h={14} color={s.chg >= 0 ? C.upGreen : C.downRed} />
            </div>
          ))}
        </Panel>
        <Panel title="Analyst Actions" flex="1" headerRight="TODAY">
          {ANALYST_RECS.slice(0, 6).map((r, i) => (
            <div key={i} style={{ padding: '3px 0', borderBottom: `1px solid ${C.panelBorder}` }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ color: C.amber, fontWeight: 700, width: 40 }}>{r.sym}</span>
                <span style={{
                  color: r.action === 'UPGRADE' ? C.upGreen : r.action === 'DOWNGRADE' ? C.downRed : C.blue,
                  fontSize: 9, fontWeight: 700
                }}>{r.action}</span>
                <span style={{ color: C.dim, fontSize: 9 }}>PT {r.pt}</span>
              </div>
              <div style={{ color: C.dimGray, fontSize: 9, marginLeft: 46 }}>{r.firm} │ {r.from} → {r.to}</div>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// ── NEWS PAGE ────────────────────────────────────────────
// ══════════════════════════════════════════════════════════
function NewsPage() {
  const [filter, setFilter] = useState('ALL');
  const tags = ['ALL', 'FED', 'EARNINGS', 'ECON', 'TECH', 'OIL', 'CRYPTO', 'FX'];
  const filtered = filter === 'ALL' ? NEWS : NEWS.filter(n => n.tags.includes(filter));

  return (
    <div style={{ flex: 1, display: 'flex', gap: 1, padding: 1, overflow: 'hidden' }}>
      <Panel title="News Wire" flex="1" headerRight="LIVE FEED">
        <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
          {tags.map(t => (
            <span key={t} onClick={() => setFilter(t)} style={{
              padding: '2px 8px', fontSize: 9, cursor: 'pointer', fontWeight: 600,
              color: filter === t ? C.bg : C.dim,
              background: filter === t ? C.amber : C.headerBg,
              border: `1px solid ${filter === t ? C.amber : C.darkGray}`
            }}>{t}</span>
          ))}
        </div>
        {filtered.map((n, i) => (
          <div key={i} style={{ padding: '6px 4px', borderBottom: `1px solid ${C.panelBorder}` }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ color: C.dim, fontSize: 10, flexShrink: 0, fontWeight: 600 }}>{n.time}</span>
              <span style={{ color: C.blue, fontSize: 10, flexShrink: 0, fontWeight: 700, width: 32 }}>{n.src}</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: C.white, fontSize: 11, lineHeight: 1.4 }}>{n.hl}</div>
                <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                  {n.tags.map(t => <span key={t} style={{ color: C.orange, fontSize: 8, padding: '1px 4px', background: '#1a1200', border: `1px solid ${C.darkGray}` }}>{t}</span>)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </Panel>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// ── OPTIONS PAGE ─────────────────────────────────────────
// ══════════════════════════════════════════════════════════
function OptionsPage() {
  const [expiry, setExpiry] = useState('Mar 28');
  const expiries = ['Feb 28', 'Mar 7', 'Mar 14', 'Mar 21', 'Mar 28', 'Apr 4', 'Apr 17'];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, padding: 1, overflow: 'hidden' }}>
      <Panel title="Options Chain — ES (E-Mini S&P 500)" flex="1" noPad
        headerRight={<span>Last: <span style={{ color: C.white }}>5842.25</span> │ IV Rank: <span style={{ color: C.amber }}>42</span></span>}>
        <div style={{ padding: '4px 6px', borderBottom: `1px solid ${C.panelBorder}`, display: 'flex', gap: 4 }}>
          <span style={{ color: C.dim, fontSize: 9, paddingTop: 2 }}>EXP:</span>
          {expiries.map(e => (
            <span key={e} onClick={() => setExpiry(e)} style={{
              padding: '2px 8px', fontSize: 9, cursor: 'pointer',
              color: expiry === e ? C.bg : C.dim,
              background: expiry === e ? C.amber : 'transparent',
              border: `1px solid ${expiry === e ? C.amber : C.darkGray}`
            }}>{e}</span>
          ))}
        </div>
        <div style={{ overflow: 'auto', flex: 1, padding: '0 6px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: C.upGreen, fontSize: 10, fontWeight: 700, padding: '4px', borderBottom: `1px solid ${C.darkGray}` }}>─── CALLS ───</td>
                <td style={{ textAlign: 'center', color: C.amber, fontWeight: 700, padding: '4px', borderBottom: `1px solid ${C.darkGray}`, fontSize: 10 }}>STRIKE</td>
                <td colSpan={5} style={{ textAlign: 'center', color: C.downRed, fontSize: 10, fontWeight: 700, padding: '4px', borderBottom: `1px solid ${C.darkGray}` }}>─── PUTS ───</td>
              </tr>
              <tr style={{ color: C.dim, fontSize: 8, textTransform: 'uppercase' }}>
                <td style={{ padding: '2px 3px', textAlign: 'right' }}>IV</td>
                <td style={{ padding: '2px 3px', textAlign: 'right' }}>Vol</td>
                <td style={{ padding: '2px 3px', textAlign: 'right' }}>OI</td>
                <td style={{ padding: '2px 3px', textAlign: 'right' }}>Bid</td>
                <td style={{ padding: '2px 3px', textAlign: 'right' }}>Ask</td>
                <td style={{ padding: '2px 3px', textAlign: 'center' }}></td>
                <td style={{ padding: '2px 3px', textAlign: 'right' }}>Bid</td>
                <td style={{ padding: '2px 3px', textAlign: 'right' }}>Ask</td>
                <td style={{ padding: '2px 3px', textAlign: 'right' }}>OI</td>
                <td style={{ padding: '2px 3px', textAlign: 'right' }}>Vol</td>
                <td style={{ padding: '2px 3px', textAlign: 'right' }}>IV</td>
              </tr>
            </thead>
            <tbody>
              {OPTIONS_CHAIN.map((o, i) => {
                const atm = Math.abs(o.strike - 5842.25) < 5;
                return (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.panelBorder}`, background: atm ? '#0a1a0a' : 'transparent' }}>
                    <td style={{ padding: '3px', textAlign: 'right', color: C.dim, fontSize: 10 }}>{o.callIV}%</td>
                    <td style={{ padding: '3px', textAlign: 'right', color: C.dim, fontSize: 10 }}>{fmtVol(o.callVol)}</td>
                    <td style={{ padding: '3px', textAlign: 'right', color: C.dimGray, fontSize: 10 }}>{fmtVol(o.callOI)}</td>
                    <td style={{ padding: '3px', textAlign: 'right', color: C.upGreen, fontSize: 10 }}>{o.callBid.toFixed(2)}</td>
                    <td style={{ padding: '3px', textAlign: 'right', color: C.upGreen, fontSize: 10 }}>{o.callAsk.toFixed(2)}</td>
                    <td style={{ padding: '3px', textAlign: 'center', color: atm ? C.amber : C.white, fontWeight: 700, fontSize: 11, background: atm ? '#1a1500' : 'transparent' }}>{o.strike}</td>
                    <td style={{ padding: '3px', textAlign: 'right', color: C.downRed, fontSize: 10 }}>{o.putBid.toFixed(2)}</td>
                    <td style={{ padding: '3px', textAlign: 'right', color: C.downRed, fontSize: 10 }}>{o.putAsk.toFixed(2)}</td>
                    <td style={{ padding: '3px', textAlign: 'right', color: C.dimGray, fontSize: 10 }}>{fmtVol(o.putOI)}</td>
                    <td style={{ padding: '3px', textAlign: 'right', color: C.dim, fontSize: 10 }}>{fmtVol(o.putVol)}</td>
                    <td style={{ padding: '3px', textAlign: 'right', color: C.dim, fontSize: 10 }}>{o.putIV}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// ── ECON PAGE ────────────────────────────────────────────
// ══════════════════════════════════════════════════════════
function EconPage() {
  const yields = [
    { term: '1M', rate: 5.34 }, { term: '3M', rate: 5.31 }, { term: '6M', rate: 5.12 },
    { term: '1Y', rate: 4.75 }, { term: '2Y', rate: 4.28 }, { term: '3Y', rate: 4.12 },
    { term: '5Y', rate: 4.05 }, { term: '7Y', rate: 4.10 }, { term: '10Y', rate: 4.28 },
    { term: '20Y', rate: 4.55 }, { term: '30Y', rate: 4.48 },
  ];

  const macro = [
    { label: 'CPI YoY', value: '3.0%', prev: '2.9%', trend: 'up' },
    { label: 'Core CPI', value: '3.3%', prev: '3.2%', trend: 'up' },
    { label: 'PPI YoY', value: '3.5%', prev: '3.3%', trend: 'up' },
    { label: 'NFP', value: '+143K', prev: '+307K', trend: 'dn' },
    { label: 'Unemp Rate', value: '4.0%', prev: '4.1%', trend: 'dn' },
    { label: 'GDP QoQ', value: '2.3%', prev: '3.1%', trend: 'dn' },
    { label: 'Retail Sales', value: '-0.9%', prev: '+0.7%', trend: 'dn' },
    { label: 'ISM Mfg', value: '50.9', prev: '49.3', trend: 'up' },
    { label: 'ISM Svc', value: '52.8', prev: '54.0', trend: 'dn' },
    { label: 'Consumer Conf', value: '98.3', prev: '105.3', trend: 'dn' },
    { label: 'Fed Funds', value: '4.25-4.50%', prev: '—', trend: 'flat' },
    { label: 'PCE YoY', value: '2.6%', prev: '2.6%', trend: 'flat' },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', gap: 1, padding: 1, overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Panel title="Economic Calendar" flex="1" headerRight={fmtDate()}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: C.dim, fontSize: 9 }}>
                <td style={{ padding: '2px 4px' }}>Time</td>
                <td style={{ padding: '2px 4px' }}>Event</td>
                <td style={{ padding: '2px 4px' }}>Impact</td>
                <td style={{ padding: '2px 4px', textAlign: 'right' }}>Actual</td>
                <td style={{ padding: '2px 4px', textAlign: 'right' }}>Forecast</td>
                <td style={{ padding: '2px 4px', textAlign: 'right' }}>Previous</td>
              </tr>
            </thead>
            <tbody>
              {ECON_CALENDAR.map((e, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.panelBorder}` }}>
                  <td style={{ padding: '4px', color: C.dim }}>{e.time}</td>
                  <td style={{ padding: '4px', color: C.white, fontWeight: e.impact === 'high' ? 600 : 400 }}>{e.event}</td>
                  <td style={{ padding: '4px' }}>
                    <span style={{
                      color: e.impact === 'high' ? C.downRed : e.impact === 'med' ? C.amber : C.dim,
                      fontSize: 9, fontWeight: 700
                    }}>{e.impact.toUpperCase()}</span>
                  </td>
                  <td style={{ padding: '4px', textAlign: 'right', color: e.surprise === 'positive' ? C.upGreen : e.surprise === 'negative' ? C.downRed : e.actual === '—' ? C.dimGray : C.white, fontWeight: 700 }}>{e.actual}</td>
                  <td style={{ padding: '4px', textAlign: 'right', color: C.dim }}>{e.forecast}</td>
                  <td style={{ padding: '4px', textAlign: 'right', color: C.dimGray }}>{e.prev}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Key Macro Indicators" flex="1" headerRight="LATEST">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
            {macro.map((m, i) => (
              <div key={i} style={{ padding: '6px 8px', background: C.headerBg, border: `1px solid ${C.panelBorder}` }}>
                <div style={{ color: C.dim, fontSize: 9, marginBottom: 2 }}>{m.label}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: C.white, fontSize: 13, fontWeight: 700 }}>{m.value}</span>
                  <span style={{ color: m.trend === 'up' ? C.upGreen : m.trend === 'dn' ? C.downRed : C.dim, fontSize: 10 }}>
                    {m.trend === 'up' ? '▲' : m.trend === 'dn' ? '▼' : '─'} {m.prev}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div style={{ flex: 0.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Panel title="US Treasury Yield Curve" flex="1" headerRight="LIVE">
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '8px 0' }}>
            {/* ASCII-style yield curve */}
            <div style={{ flex: 1, position: 'relative', margin: '0 8px' }}>
              <svg viewBox="0 0 200 100" style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
                <polyline
                  points={yields.map((y, i) => `${(i / (yields.length - 1)) * 190 + 5},${100 - ((y.rate - 3.8) / 1.8) * 90}`).join(' ')}
                  fill="none" stroke={C.amber} strokeWidth="2"
                />
                {yields.map((y, i) => (
                  <circle key={i} cx={(i / (yields.length - 1)) * 190 + 5} cy={100 - ((y.rate - 3.8) / 1.8) * 90} r="3" fill={C.orange} />
                ))}
              </svg>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px' }}>
              {yields.map((y, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{ color: C.dim, fontSize: 8 }}>{y.term}</div>
                  <div style={{ color: C.amber, fontSize: 9, fontWeight: 600 }}>{y.rate.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// ── EARNINGS PAGE ────────────────────────────────────────
// ══════════════════════════════════════════════════════════
function EarningsPage() {
  return (
    <div style={{ flex: 1, display: 'flex', gap: 1, padding: 1, overflow: 'hidden' }}>
      <Panel title="Earnings Calendar & Results" flex="1" headerRight="Q4 2025 SEASON">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: C.dim, fontSize: 9, textTransform: 'uppercase' }}>
              <td style={{ padding: '3px 6px' }}>Sym</td>
              <td style={{ padding: '3px 6px' }}>Date</td>
              <td style={{ padding: '3px 6px', textAlign: 'right' }}>EPS</td>
              <td style={{ padding: '3px 6px', textAlign: 'right' }}>Est</td>
              <td style={{ padding: '3px 6px', textAlign: 'right' }}>Rev</td>
              <td style={{ padding: '3px 6px', textAlign: 'right' }}>Rev Est</td>
              <td style={{ padding: '3px 6px', textAlign: 'right' }}>Surprise</td>
              <td style={{ padding: '3px 6px', textAlign: 'right' }}>Reaction</td>
            </tr>
          </thead>
          <tbody>
            {EARNINGS.map((e, i) => {
              const reported = e.eps !== '—';
              return (
                <tr key={i} style={{ borderBottom: `1px solid ${C.panelBorder}`, background: reported ? '#0a0f0a' : 'transparent' }}>
                  <td style={{ padding: '5px 6px', color: C.amber, fontWeight: 700, fontSize: 12 }}>{e.sym}</td>
                  <td style={{ padding: '5px 6px', color: reported ? C.dim : C.white }}>{e.date}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', color: reported ? C.white : C.dimGray, fontWeight: 600 }}>{e.eps}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', color: C.dim }}>{e.est}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', color: reported ? C.white : C.dimGray, fontWeight: 600 }}>{e.rev}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', color: C.dim }}>{e.revEst}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', color: reported ? (parseFloat(e.surprise) > 0 ? C.upGreen : C.downRed) : C.dimGray, fontWeight: 700 }}>{e.surprise}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', color: reported ? (parseFloat(e.react) > 0 ? C.upGreen : C.downRed) : C.dimGray, fontWeight: 600 }}>{e.react}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// ── RESEARCH PAGE ────────────────────────────────────────
// ══════════════════════════════════════════════════════════
function ResearchPage() {
  const consensus = [
    { sym: 'NVDA', buy: 42, hold: 4, sell: 1, avgPT: '$168', upside: '+21%', consensus: 'STRONG BUY' },
    { sym: 'AAPL', buy: 28, hold: 12, sell: 5, avgPT: '$248', upside: '+7%', consensus: 'BUY' },
    { sym: 'MSFT', buy: 38, hold: 6, sell: 1, avgPT: '$480', upside: '+17%', consensus: 'STRONG BUY' },
    { sym: 'AMZN', buy: 44, hold: 2, sell: 0, avgPT: '$245', upside: '+24%', consensus: 'STRONG BUY' },
    { sym: 'TSLA', buy: 15, hold: 18, sell: 12, avgPT: '$275', upside: '-9%', consensus: 'HOLD' },
    { sym: 'META', buy: 36, hold: 6, sell: 2, avgPT: '$680', upside: '+11%', consensus: 'BUY' },
    { sym: 'GOOG', buy: 34, hold: 8, sell: 1, avgPT: '$210', upside: '+17%', consensus: 'STRONG BUY' },
    { sym: 'CRM', buy: 30, hold: 10, sell: 2, avgPT: '$380', upside: '+14%', consensus: 'BUY' },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', gap: 1, padding: 1, overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Panel title="Analyst Consensus" flex="1" headerRight="AGGREGATE">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: C.dim, fontSize: 9, textTransform: 'uppercase' }}>
                <td style={{ padding: '3px 6px' }}>Sym</td>
                <td style={{ padding: '3px 6px', textAlign: 'center' }}>Buy</td>
                <td style={{ padding: '3px 6px', textAlign: 'center' }}>Hold</td>
                <td style={{ padding: '3px 6px', textAlign: 'center' }}>Sell</td>
                <td style={{ padding: '3px 6px', textAlign: 'right' }}>Avg PT</td>
                <td style={{ padding: '3px 6px', textAlign: 'right' }}>Upside</td>
                <td style={{ padding: '3px 6px' }}>Rating</td>
              </tr>
            </thead>
            <tbody>
              {consensus.map((c, i) => {
                const total = c.buy + c.hold + c.sell;
                const buyPct = (c.buy / total) * 100;
                return (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.panelBorder}` }}>
                    <td style={{ padding: '5px 6px', color: C.amber, fontWeight: 700 }}>{c.sym}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'center', color: C.upGreen, fontWeight: 600 }}>{c.buy}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'center', color: C.amber }}>{c.hold}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'center', color: C.downRed }}>{c.sell}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', color: C.white, fontWeight: 600 }}>{c.avgPT}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', color: parseFloat(c.upside) > 0 ? C.upGreen : C.downRed, fontWeight: 600 }}>{c.upside}</td>
                    <td style={{ padding: '5px 6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 60, height: 6, background: C.headerBg, position: 'relative' }}>
                          <div style={{ width: `${buyPct}%`, height: '100%', background: buyPct > 70 ? C.upGreen : buyPct > 50 ? C.amber : C.downRed }} />
                        </div>
                        <span style={{ color: buyPct > 70 ? C.upGreen : buyPct > 50 ? C.amber : C.dim, fontSize: 9, fontWeight: 700 }}>{c.consensus}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      </div>
      <div style={{ flex: 0.7, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Panel title="Recent Actions" flex="1" headerRight="ALL FIRMS">
          {ANALYST_RECS.map((r, i) => (
            <div key={i} style={{ padding: '6px 4px', borderBottom: `1px solid ${C.panelBorder}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ color: C.amber, fontWeight: 700, fontSize: 12 }}>{r.sym}</span>
                  <span style={{
                    color: r.action === 'UPGRADE' ? '#000' : r.action === 'DOWNGRADE' ? '#000' : C.blue,
                    background: r.action === 'UPGRADE' ? C.upGreen : r.action === 'DOWNGRADE' ? C.downRed : 'transparent',
                    padding: '1px 6px', fontSize: 9, fontWeight: 700
                  }}>{r.action}</span>
                </div>
                <span style={{ color: C.dim, fontSize: 9 }}>{r.date}</span>
              </div>
              <div style={{ color: C.gray, fontSize: 10, marginTop: 2 }}>{r.firm}</div>
              <div style={{ color: C.dim, fontSize: 10 }}>{r.from} → <span style={{ color: C.white }}>{r.to}</span> │ PT: <span style={{ color: C.amber, fontWeight: 600 }}>{r.pt}</span></div>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// ── EQUITIES PAGE ────────────────────────────────────────
// ══════════════════════════════════════════════════════════
function EquitiesPage({ stocks }) {
  const sparkData = useMemo(() => {
    const d = {};
    STOCKS.forEach(s => { d[s.sym] = genSparkData(s.last); });
    return d;
  }, []);

  return (
    <div style={{ flex: 1, display: 'flex', gap: 1, padding: 1, overflow: 'hidden' }}>
      <Panel title="Equity Monitor" flex="1" headerRight="US EQUITIES">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: C.dim, fontSize: 9, textTransform: 'uppercase' }}>
              <td style={{ padding: '2px 6px' }}>Sym</td>
              <td style={{ padding: '2px 6px', textAlign: 'right' }}>Last</td>
              <td style={{ padding: '2px 6px', textAlign: 'right' }}>Chg</td>
              <td style={{ padding: '2px 6px', textAlign: 'right' }}>%Chg</td>
              <td style={{ padding: '2px 6px', textAlign: 'center' }}>30d</td>
              <td style={{ padding: '2px 6px', textAlign: 'right' }}>Volume</td>
              <td style={{ padding: '2px 6px', textAlign: 'right' }}>Mkt Cap</td>
              <td style={{ padding: '2px 6px', textAlign: 'right' }}>P/E</td>
              <td style={{ padding: '2px 6px', textAlign: 'right' }}>Div %</td>
            </tr>
          </thead>
          <tbody>
            {stocks.map(s => (
              <tr key={s.sym} style={{ borderBottom: `1px solid ${C.panelBorder}`, background: flashBg(s._flash), transition: 'background 0.3s' }}>
                <td style={{ padding: '4px 6px', color: C.amber, fontWeight: 700, fontSize: 12 }}>{s.sym}</td>
                <td style={{ padding: '4px 6px', textAlign: 'right', color: C.white, fontWeight: 600 }}>{s.last.toFixed(2)}</td>
                <td style={{ padding: '4px 6px', textAlign: 'right', color: chgColor(s.chg) }}>{s.chg > 0 ? '+' : ''}{s.chg.toFixed(2)}</td>
                <td style={{ padding: '4px 6px', textAlign: 'right', color: chgColor(s.pctChg), fontWeight: 600 }}>{fmtPct(s.pctChg)}</td>
                <td style={{ padding: '4px 6px', textAlign: 'center' }}><Sparkline data={sparkData[s.sym]} w={70} h={16} color={s.chg >= 0 ? C.upGreen : C.downRed} /></td>
                <td style={{ padding: '4px 6px', textAlign: 'right', color: C.dim }}>{fmtVol(s.vol)}</td>
                <td style={{ padding: '4px 6px', textAlign: 'right', color: C.gray }}>{s.mktCap}</td>
                <td style={{ padding: '4px 6px', textAlign: 'right', color: s.pe > 50 ? C.amber : C.gray }}>{s.pe || '—'}</td>
                <td style={{ padding: '4px 6px', textAlign: 'right', color: s.div > 0 ? C.upGreen : C.dimGray }}>{s.div ? s.div.toFixed(2) + '%' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// ── HELP PAGE ────────────────────────────────────────────
// ══════════════════════════════════════════════════════════
function HelpPage() {
  const cmds = [
    { cmd: 'MKT / MARKET / 1', desc: 'Market overview — futures, indices, news, movers' },
    { cmd: 'NEWS / N / 2', desc: 'Full news wire with tag filters' },
    { cmd: 'OPT / OPTIONS / 3', desc: 'Options chain viewer (ES futures)' },
    { cmd: 'ECON / ECO / 4', desc: 'Economic calendar, macro indicators, yield curve' },
    { cmd: 'EARN / EARNINGS / 5', desc: 'Earnings calendar and results tracker' },
    { cmd: 'RES / RESEARCH / 6', desc: 'Analyst consensus and recommendation actions' },
    { cmd: 'EQ / EQUITY / 7', desc: 'Equity monitor with fundamentals' },
    { cmd: 'HELP / ?', desc: 'This help screen' },
    { cmd: '/', desc: 'Focus command line (keyboard shortcut)' },
    { cmd: 'ESC', desc: 'Focus command line' },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div style={{ maxWidth: 600, width: '100%' }}>
        <div style={{ color: C.orange, fontSize: 18, fontWeight: 900, marginBottom: 4, letterSpacing: 2 }}>VIPER TERMINAL</div>
        <div style={{ color: C.amber, fontSize: 12, marginBottom: 20 }}>Bloomberg-Style Trading Terminal Prototype v0.1</div>
        <div style={{ color: C.dim, fontSize: 10, marginBottom: 16, lineHeight: 1.6 }}>
          Type commands in the command bar below or click page tabs. Press / or ESC to focus the command line.
        </div>
        <Panel title="Commands" noPad>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {cmds.map((c, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.panelBorder}` }}>
                  <td style={{ padding: '6px 10px', color: C.amber, fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' }}>{c.cmd}</td>
                  <td style={{ padding: '6px 10px', color: C.gray, fontSize: 11 }}>{c.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <div style={{ color: C.dimGray, fontSize: 9, marginTop: 20, lineHeight: 1.6 }}>
          PROTOTYPE: All data is simulated with realistic tick movement. Production version will connect to
          Schwab API (quotes, options, positions), FRED (macro data), ForexFactory (econ calendar),
          TradingView widgets (charts), and Claude API (news summarization & analysis).
        </div>
      </div>
    </div>
  );
}
