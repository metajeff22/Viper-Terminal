import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";

// ── GLOBAL ERROR HANDLER ─────────────────────────────────
if(typeof window!=='undefined'&&!window.__vtErrorHandler){window.__vtErrorHandler=true;window.onerror=function(msg,src,line,col,err){const d=document.createElement('div');d.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:#1a1a2e;color:#ff3333;padding:40px;font-family:monospace;z-index:99999;overflow:auto';d.innerHTML='<h2 style="color:#ff3333">VIPER TERMINAL ERROR</h2><pre style="color:#ff8800;white-space:pre-wrap">'+msg+'\nLine: '+line+'\n'+(err?.stack||'')+'</pre><button onclick="location.reload()" style="margin-top:20px;padding:8px 20px;background:#ff8800;color:#000;border:none;cursor:pointer;font-family:monospace">RELOAD</button>';document.body.appendChild(d)};window.addEventListener('unhandledrejection',function(e){console.error('Unhandled:',e.reason)})}

// ── FORMATTERS ───────────────────────────────────────────
const fmtP = (n, ref) => { if(n==null||!isFinite(n)) return "—"; const a=Math.abs(ref||n); return a>=10?n.toFixed(2):a>=1?n.toFixed(2):n.toFixed(4); };
const fmtPct = n => n==null||!isFinite(n) ? "—" : (n>=0?"+":"")+n.toFixed(2)+"%";
const fmtVol = n => { if(!n||!isFinite(n)) return ""; if(n>=1e9) return (n/1e9).toFixed(1)+"B"; if(n>=1e6) return (n/1e6).toFixed(1)+"M"; if(n>=1e3) return (n/1e3).toFixed(0)+"K"; return n+""; };
const fmtTime = (tz) => new Date().toLocaleTimeString('en-US',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:tz});
const fmtDateShort = (tz) => new Date().toLocaleDateString('en-US',{weekday:'short',month:'2-digit',day:'2-digit',timeZone:tz});

// ── BLOOMBERG EXACT COLORS ───────────────────────────────
const B = {
  bg:'#1a1a2e', panelBg:'#0d0d1a', border:'#2a2a3e',
  titleBar:'#000033', titleBarActive:'#0000aa', titleText:'#cccccc',
  orange:'#ff8800', amber:'#ffaa00', yellow:'#ffcc00',
  green:'#33cc33', red:'#ff3333', blue:'#4488ff',
  white:'#ffffff', ltGray:'#cccccc', gray:'#888888',
  dimGray:'#555555', darkGray:'#333344', vDark:'#111122',
  gridBg:'#0a0a1a', gridAlt:'#0f0f22', gridBorder:'#222233',
  up:'#33cc33', dn:'#ff3333', unch:'#888888',
  link:'#ff8800', accent:'#ffaa00',
};

// ── SYMBOL CONFIG ────────────────────────────────────────
const FUTURES_SYMS = [
  { yf:'ES=F', d:'ES', n:'E-Mini S&P 500' },
  { yf:'NQ=F', d:'NQ', n:'E-Mini NASDAQ' },
  { yf:'YM=F', d:'YM', n:'E-Mini Dow' },
  { yf:'RTY=F', d:'RTY', n:'Russell 2000' },
  { yf:'^VIX', d:'VIX', n:'CBOE Volatility' },
  { yf:'DX-Y.NYB', d:'DXY', n:'US Dollar Index' },
  { yf:'CL=F', d:'CL', n:'Crude Oil WTI' },
  { yf:'GC=F', d:'GC', n:'Gold' },
  { yf:'ZN=F', d:'ZN', n:'10-Yr Note' },
  { yf:'ZB=F', d:'ZB', n:'30-Yr Bond' },
  { yf:'EURUSD=X', d:'EUR/USD', n:'Euro FX' },
  { yf:'JPY=X', d:'USD/JPY', n:'Japanese Yen' },
];
const STOCK_SYMS = ['AAPL','MSFT','NVDA','AMZN','META','GOOG','TSLA','SPY','QQQ','IWM'];
const WORLD_INDEX_SYMS = [
  { yf:'^DJI', d:'DOW JONES', region:'Americas' },
  { yf:'^GSPC', d:'S&P 500', region:'Americas' },
  { yf:'^IXIC', d:'NASDAQ', region:'Americas' },
  { yf:'^RUT', d:'RUSSELL 2000', region:'Americas' },
  { yf:'^STOXX50E', d:'Euro Stoxx 50', region:'EMEA' },
  { yf:'^FTSE', d:'FTSE 100', region:'EMEA' },
  { yf:'^GDAXI', d:'DAX', region:'EMEA' },
  { yf:'^FCHI', d:'CAC 40', region:'EMEA' },
  { yf:'^N225', d:'NIKKEI', region:'Asia/Pacific' },
  { yf:'^HSI', d:'HANG SENG', region:'Asia/Pacific' },
  { yf:'000300.SS', d:'CSI 300', region:'Asia/Pacific' },
];
const YIELD_SERIES = ['DGS1MO','DGS3MO','DGS6MO','DGS1','DGS2','DGS3','DGS5','DGS7','DGS10','DGS20','DGS30'];
const YIELD_LABELS = ['1M','3M','6M','1Y','2Y','3Y','5Y','7Y','10Y','20Y','30Y'];

// ── DATA HOOKS ───────────────────────────────────────────
const useQuotes = (symbols, interval=10000) => {
  const [data,setData]=useState({}); const [status,setStatus]=useState('loading');
  const prev=useRef({});
  const fetch_ = useCallback(async()=>{
    try {
      const r=await fetch(`/api/quote?symbols=${encodeURIComponent(symbols.join(','))}`);
      if(!r.ok) throw new Error(r.status);
      const j=await r.json(); const wf={};
      for(const[k,q] of Object.entries(j.quotes||{})){
        const p=prev.current[k]; let _f=null;
        if(p&&p.last!==q.last) _f=q.last>p.last?'up':'dn';
        wf[k]={...q,_flash:_f};
      }
      prev.current=j.quotes||{}; setData(wf); setStatus('live');
    } catch(e){ console.error(e); setStatus(s=>s==='loading'?'error':'stale'); }
  },[symbols.join(',')]);
  useEffect(()=>{ fetch_(); const t=setInterval(fetch_,interval); return()=>clearInterval(t); },[fetch_,interval]);
  useEffect(()=>{
    if(Object.values(data).some(d=>d._flash)){
      const t=setTimeout(()=>setData(p=>{const c={};for(const[k,v] of Object.entries(p))c[k]={...v,_flash:null};return c;}),500);
      return()=>clearTimeout(t);
    }
  },[data]);
  return {data,status};
};
const useFred=(series,key,interval=300000)=>{
  const [data,setData]=useState({}); const [status,setStatus]=useState('loading');
  const fetch_=useCallback(async()=>{
    if(!key){setStatus('nokey');return;}
    try{const r=await fetch(`/api/fred?series=${series.join(',')}&key=${key}`);if(!r.ok)throw new Error(r.status);const j=await r.json();setData(j.data||{});setStatus('live');}catch(e){console.error(e);setStatus('error');}
  },[series.join(','),key]);
  useEffect(()=>{fetch_();const t=setInterval(fetch_,interval);return()=>clearInterval(t);},[fetch_,interval]);
  return {data,status};
};

// ── SPARKLINE ────────────────────────────────────────────
const Spark=({data,w=60,h=16,color})=>{
  if(!data||data.length<2) return null;
  const v=data.filter(x=>x!=null&&isFinite(x)); if(v.length<2) return null;
  const mn=Math.min(...v),mx=Math.max(...v),rg=mx-mn||1;
  const pts=v.map((val,i)=>`${(i/(v.length-1))*w},${h-((val-mn)/rg)*h}`).join(' ');
  return <svg width={w} height={h} style={{display:'block'}}><polyline points={pts} fill="none" stroke={color||B.green} strokeWidth="1"/></svg>;
};

// ── BLOOMBERG WINDOW PANEL ───────────────────────────────
// Exact Bloomberg: dark blue title bar, orange dots, minimize/maximize/options buttons
const BPanel=({title,children,active,ticker,style,noPad,headerRight})=>(
  <div style={{background:B.panelBg,border:`1px solid ${B.border}`,display:'flex',flexDirection:'column',overflow:'hidden',...style}}>
    {/* Title bar — Bloomberg style */}
    <div style={{background:active?B.titleBarActive:B.titleBar,borderBottom:`1px solid ${B.border}`,padding:'1px 4px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,height:18,cursor:'default'}}>
      <div style={{display:'flex',alignItems:'center',gap:4}}>
        <span style={{color:'#ffaa00',fontSize:8}}>◆</span>
        <span style={{color:B.titleText,fontSize:10,fontWeight:600}}>{title}</span>
        {ticker&&<><span style={{color:B.dimGray,fontSize:10}}>│</span><span style={{color:B.orange,fontSize:10,fontWeight:700}}>{ticker}</span></>}
      </div>
      <div style={{display:'flex',alignItems:'center',gap:2}}>
        {headerRight&&<span style={{color:B.gray,fontSize:8,marginRight:4}}>{headerRight}</span>}
        <span style={{color:B.gray,fontSize:9,cursor:'pointer',padding:'0 2px'}}>◻</span>
        <span style={{color:B.gray,fontSize:10,cursor:'pointer',padding:'0 2px'}}>▫</span>
        <span style={{color:B.gray,fontSize:8,cursor:'pointer',padding:'0 2px'}}>≡</span>
      </div>
    </div>
    <div style={{flex:1,overflow:'auto',padding:noPad?0:'2px 3px',minHeight:0,background:B.gridBg}}>
      {children}
    </div>
  </div>
);

// ── SETTINGS PERSISTENCE ─────────────────────────────────
const loadS=(k,d)=>{try{const v=localStorage.getItem('vt_'+k);return v?JSON.parse(v):d;}catch{return d;}};
const saveS=(k,v)=>{try{localStorage.setItem('vt_'+k,JSON.stringify(v));}catch{}};

// ── NEWS DATA (mock - Phase 3) ───────────────────────────
const NEWS=[
  {time:'14:32',src:'RTRS',hl:'Fed officials signal patience on rate cuts amid sticky inflation data',cat:'FED'},
  {time:'14:18',src:'BBG',hl:'NVDA reports record data center revenue, beats estimates by 12%',cat:'EARNINGS'},
  {time:'14:05',src:'CNBC',hl:'Treasury yields climb as jobs data stronger than expected',cat:'BONDS'},
  {time:'13:52',src:'WSJ',hl:'OPEC+ considers extending production cuts through Q3 2026',cat:'OIL'},
  {time:'13:41',src:'RTRS',hl:'China PMI contracts for second straight month, yuan weakens',cat:'CHINA'},
  {time:'13:28',src:'BBG',hl:'Meta announces $65B AI infrastructure buildout plan',cat:'TECH'},
  {time:'13:15',src:'RTRS',hl:'European Central Bank holds rates steady, signals June cut',cat:'ECB'},
  {time:'13:02',src:'CNBC',hl:'Bitcoin surges past $95K on ETF inflow momentum',cat:'CRYPTO'},
  {time:'12:48',src:'WSJ',hl:'Apple Vision Pro 2 production begins at Foxconn facilities',cat:'TECH'},
  {time:'12:35',src:'BBG',hl:'US initial jobless claims fall to 210K vs 225K expected',cat:'ECON'},
  {time:'12:22',src:'RTRS',hl:'Goldman raises S&P 500 year-end target to 6,200',cat:'RESEARCH'},
  {time:'12:10',src:'CNBC',hl:'Copper hits 10-month high on infrastructure spending optimism',cat:'CMDTY'},
  {time:'11:55',src:'BBG',hl:'[Delayed] North America Metals & Mining: Adjusting Estimates',cat:'RESEARCH'},
  {time:'11:40',src:'WSJ',hl:'Midyear Outlook: Global Aluminum market supply rebalancing',cat:'CMDTY'},
];

const ANALYST_RECS=[
  {sym:'NVDA',firm:'Goldman Sachs',action:'UPGRADE',from:'Neutral',to:'Buy',pt:'$175',date:'Feb 27'},
  {sym:'TSLA',firm:'Morgan Stanley',action:'REITERATE',from:'OW',to:'OW',pt:'$350',date:'Feb 27'},
  {sym:'AAPL',firm:'JP Morgan',action:'DOWNGRADE',from:'OW',to:'Neutral',pt:'$225',date:'Feb 26'},
  {sym:'META',firm:'BofA',action:'REITERATE',from:'Buy',to:'Buy',pt:'$700',date:'Feb 26'},
  {sym:'AMZN',firm:'UBS',action:'UPGRADE',from:'Neutral',to:'Buy',pt:'$240',date:'Feb 25'},
  {sym:'MSFT',firm:'Citi',action:'REITERATE',from:'Buy',to:'Buy',pt:'$470',date:'Feb 25'},
];

// ── MAIN APP ─────────────────────────────────────────────
export default function ViperTerminal(){
  const [clock,setClock]=useState({});
  const [fredKey,setFredKey]=useState(()=>loadS('fredKey',''));
  const [showSettings,setShowSettings]=useState(false);
  const [focusSym,setFocusSym]=useState('AAPL');

  // All symbols
  const allSyms=useMemo(()=>[
    ...FUTURES_SYMS.map(f=>f.yf),...STOCK_SYMS,
    ...WORLD_INDEX_SYMS.map(w=>w.yf),
  ],[]);

  const {data:quotes,status:qStatus}=useQuotes(allSyms,10000);
  const {data:fredData,status:fStatus}=useFred(YIELD_SERIES,fredKey,300000);

  // Clock update
  useEffect(()=>{
    const tick=()=>setClock({
      chi:fmtTime('America/Chicago'), chid:fmtDateShort('America/Chicago'),
      ny:fmtTime('America/New_York'), nyd:fmtDateShort('America/New_York'),
      lon:fmtTime('Europe/London'), lond:fmtDateShort('Europe/London'),
      hk:fmtTime('Asia/Hong_Kong'), hkd:fmtDateShort('Asia/Hong_Kong'),
      syd:fmtTime('Australia/Sydney'), sydd:fmtDateShort('Australia/Sydney'),
    });
    tick(); const t=setInterval(tick,1000); return()=>clearInterval(t);
  },[]);

  // Mapped data
  const futures=useMemo(()=>FUTURES_SYMS.map(f=>{const q=quotes[f.yf];return q?{...q,sym:f.d,name:f.n}:{sym:f.d,name:f.n,last:0,chg:0,pctChg:0,high:0,low:0,vol:0,spark:[]};}),[quotes]);
  const stocks=useMemo(()=>STOCK_SYMS.map(s=>{const q=quotes[s];return q||{sym:s,last:0,chg:0,pctChg:0,vol:0,spark:[]};}),[quotes]);
  const worldIdx=useMemo(()=>WORLD_INDEX_SYMS.map(w=>{const q=quotes[w.yf];return q?{...q,display:w.d,region:w.region}:{display:w.d,region:w.region,last:0,chg:0,pctChg:0,vol:0};}),[quotes]);
  const yields=useMemo(()=>YIELD_SERIES.map((s,i)=>({term:YIELD_LABELS[i],rate:fredData[s]?.latest?.value||0})),[fredData]);
  const focusQ=quotes[focusSym]||null;

  const chgC=v=>v>0?B.up:v<0?B.dn:B.unch;
  const flashBg=f=>f==='up'?'rgba(51,204,51,0.12)':f==='dn'?'rgba(255,51,51,0.12)':'transparent';

  return(
    <div style={{width:'100vw',height:'100vh',background:B.bg,display:'flex',flexDirection:'column',fontFamily:"'Consolas','Lucida Console','Courier New',monospace",fontSize:10,color:B.ltGray,overflow:'hidden',userSelect:'none'}}>
      
      {/* ═══ SETTINGS MODAL ═══ */}
      {showSettings&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={e=>{if(e.target===e.currentTarget)setShowSettings(false)}}>
        <div style={{background:B.titleBar,border:`1px solid ${B.border}`,padding:20,minWidth:380}}>
          <div style={{color:B.orange,fontSize:13,fontWeight:700,marginBottom:12}}>TERMINAL SETTINGS</div>
          <div style={{marginBottom:10}}>
            <div style={{color:B.gray,fontSize:9,marginBottom:3}}>FRED API KEY (free from fred.stlouisfed.org)</div>
            <input value={fredKey} onChange={e=>{setFredKey(e.target.value);saveS('fredKey',e.target.value);}} placeholder="Enter FRED API key..." style={{width:'100%',background:'#000',border:`1px solid ${B.border}`,color:B.amber,padding:'4px 6px',fontFamily:'inherit',fontSize:10,outline:'none',boxSizing:'border-box'}}/>
          </div>
          <button onClick={()=>setShowSettings(false)} style={{padding:'4px 14px',background:B.orange,color:'#000',border:'none',cursor:'pointer',fontFamily:'inherit',fontWeight:700,fontSize:10}}>CLOSE</button>
        </div>
      </div>}

      {/* ═══ TOP TOOLBAR — Bloomberg Launchpad Bar ═══ */}
      <div style={{background:'#0a0a18',borderBottom:`1px solid ${B.border}`,padding:'1px 6px',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0,height:20}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{color:B.orange,fontWeight:900,fontSize:12,letterSpacing:1}}>VIPER</span>
          <span style={{color:B.dimGray}}>│</span>
          <span style={{color:B.amber,fontSize:9}}>Launchpad</span>
          <span style={{color:B.dimGray}}>│</span>
          <span style={{color:B.gray,fontSize:9,cursor:'pointer'}} onClick={()=>setShowSettings(true)}>⚙ Settings</span>
          <span style={{color:B.dimGray}}>│</span>
          <span style={{display:'inline-flex',alignItems:'center',gap:3}}>
            <span style={{width:5,height:5,borderRadius:'50%',background:qStatus==='live'?B.up:qStatus==='loading'?B.amber:B.dn,boxShadow:qStatus==='live'?`0 0 3px ${B.up}`:'none'}}/>
            <span style={{color:qStatus==='live'?B.up:B.amber,fontSize:8}}>{qStatus==='live'?'LIVE':'LOADING'}</span>
          </span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <span style={{color:B.gray,fontSize:9}}>{new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'})}</span>
          <span style={{color:B.amber,fontWeight:700,fontSize:11}}>{clock.ny||''}</span>
        </div>
      </div>

      {/* ═══ MAIN GRID — Bloomberg Launchpad Layout ═══ */}
      {/* 3 columns, multiple rows, matching the screenshot layout */}
      <div style={{flex:1,display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gridTemplateRows:'1fr 1fr 0.45fr 0.3fr',gap:1,padding:1,overflow:'hidden',minHeight:0}}>
        
        {/* ── ROW 1 COL 1: News Feed ── */}
        <BPanel title="News Feed - S&P 500 Stock Mar..." ticker="SPX Index" active>
          <div style={{padding:'1px 2px'}}>
            <div style={{display:'flex',gap:4,marginBottom:3,borderBottom:`1px solid ${B.gridBorder}`,paddingBottom:2}}>
              <span style={{color:B.orange,fontSize:8,fontWeight:700,cursor:'pointer'}}>Create Feed</span>
              <span style={{color:B.gray,fontSize:8}}>Actions ▾</span>
              <span style={{color:B.gray,fontSize:8}}>Open Search</span>
              <span style={{color:B.gray,fontSize:8}}>More ▾</span>
            </div>
            <div style={{display:'flex',gap:4,marginBottom:4}}>
              <span style={{background:'#002244',color:B.white,fontSize:8,padding:'1px 6px',border:`1px solid ${B.blue}`}}>S&P 500 Stock Market ...</span>
              <span style={{color:B.gray,fontSize:8}}>▶ Sources</span>
              <span style={{color:B.gray,fontSize:8}}>▶ All Dates</span>
              <span style={{color:B.gray,fontSize:8}}>▶ Time</span>
            </div>
            {NEWS.map((n,i)=>(
              <div key={i} style={{padding:'1px 0',borderBottom:`1px solid ${B.gridBorder}`,display:'flex',gap:4,lineHeight:1.3}}>
                <span style={{color:B.dimGray,fontSize:9,flexShrink:0,width:32}}>{n.time}</span>
                <span style={{color:n.src==='RTRS'?B.green:n.src==='BBG'?B.blue:n.src==='CNBC'?B.amber:B.gray,fontSize:9,flexShrink:0,fontWeight:700,width:28}}>{n.src}</span>
                <span style={{color:B.ltGray,fontSize:9}}>{n.hl}</span>
              </div>
            ))}
          </div>
        </BPanel>

        {/* ── ROW 1 COL 2: Chart ── */}
        <BPanel title="GP Standard Chart" ticker={`${focusSym} US Equity`}>
          <div style={{height:'100%',display:'flex',flexDirection:'column'}}>
            {/* Chart toolbar */}
            <div style={{display:'flex',gap:4,padding:'2px 4px',borderBottom:`1px solid ${B.gridBorder}`,flexShrink:0}}>
              {['1D','3D','1M','6M','YTD','1Y','5Y','Max'].map(p=>(
                <span key={p} style={{color:p==='1D'?B.white:B.gray,fontSize:8,padding:'0 3px',background:p==='1D'?'#004400':'transparent',cursor:'pointer'}}>{p}</span>
              ))}
              <span style={{color:B.dimGray,fontSize:8,marginLeft:4}}>│</span>
              <span style={{color:B.amber,fontSize:8}}>10 Min ▾</span>
            </div>
            {/* Chart area with price info */}
            <div style={{flex:1,position:'relative',padding:4}}>
              {focusQ ? (
                <>
                  <div style={{position:'absolute',top:4,left:4,zIndex:1}}>
                    <span style={{color:B.white,fontSize:11,fontWeight:700}}>{focusQ.last?.toFixed(2)}</span>
                    <span style={{color:chgC(focusQ.chg),fontSize:10,marginLeft:6}}>{focusQ.chg>0?'+':''}{focusQ.chg?.toFixed(2)}</span>
                    <span style={{color:chgC(focusQ.pctChg),fontSize:10,marginLeft:4}}>({fmtPct(focusQ.pctChg)})</span>
                  </div>
                  <div style={{position:'absolute',top:20,left:4,color:B.dimGray,fontSize:8}}>
                    H: {focusQ.high?.toFixed(2)} │ L: {focusQ.low?.toFixed(2)} │ V: {fmtVol(focusQ.vol)}
                  </div>
                  {/* SVG Chart */}
                  <svg viewBox="0 0 300 120" style={{width:'100%',height:'100%',marginTop:30}} preserveAspectRatio="none">
                    {/* Grid */}
                    {[0.25,0.5,0.75].map(p=><line key={p} x1="0" y1={120*p} x2="300" y2={120*p} stroke={B.gridBorder} strokeWidth="0.5" strokeDasharray="2,2"/>)}
                    {focusQ.spark?.length>1 && (()=>{
                      const d=focusQ.spark.filter(x=>x!=null&&isFinite(x));if(d.length<2) return null;
                      const mn=Math.min(...d),mx=Math.max(...d),rg=mx-mn||1;
                      const pts=d.map((v,i)=>`${(i/(d.length-1))*300},${110-((v-mn)/rg)*100}`).join(' ');
                      const fill=d.map((v,i)=>`${(i/(d.length-1))*300},${110-((v-mn)/rg)*100}`);
                      fill.push(`300,110`);fill.unshift(`0,110`);
                      const c=focusQ.chg>=0?B.up:B.dn;
                      return(<>
                        <polygon points={fill.join(' ')} fill={focusQ.chg>=0?'rgba(51,204,51,0.08)':'rgba(255,51,51,0.08)'}/>
                        <polyline points={pts} fill="none" stroke={c} strokeWidth="1.5"/>
                        {/* Volume bars */}
                        <g opacity="0.3">{d.slice(0,-1).map((_,i)=>{
                          const x=(i/(d.length-1))*300; const bh=Math.random()*15+2;
                          return <rect key={i} x={x} y={120-bh} width={300/d.length*0.6} height={bh} fill={d[i+1]>=d[i]?B.up:B.dn}/>;
                        })}</g>
                      </>);
                    })()}
                  </svg>
                </>
              ) : (
                <div style={{color:B.dimGray,textAlign:'center',marginTop:40}}>Select a symbol to view chart</div>
              )}
            </div>
          </div>
        </BPanel>

        {/* ── ROW 1 COL 3: GD Graphic Dashboard / Analyst ── */}
        <BPanel title="GD Graphic Dashboard" ticker={`${focusSym} US Equity`}>
          <div style={{padding:4}}>
            {focusQ ? (
              <>
                <div style={{marginBottom:6}}>
                  <div style={{color:B.white,fontSize:10,fontWeight:700}}>{focusQ.name||focusSym}</div>
                  <div style={{display:'flex',gap:12,marginTop:4}}>
                    <div>
                      <div style={{color:B.gray,fontSize:8}}>Price</div>
                      <div style={{color:B.white,fontSize:16,fontWeight:700}}>{focusQ.last?.toFixed(2)}</div>
                    </div>
                    <div>
                      <div style={{color:B.gray,fontSize:8}}>1d %Chg</div>
                      <div style={{color:chgC(focusQ.pctChg),fontSize:16,fontWeight:700}}>{fmtPct(focusQ.pctChg)}</div>
                    </div>
                    <div>
                      <div style={{color:B.gray,fontSize:8}}>Volume</div>
                      <div style={{color:B.white,fontSize:16,fontWeight:700}}>{fmtVol(focusQ.vol)}</div>
                    </div>
                  </div>
                </div>
                <div style={{borderTop:`1px solid ${B.gridBorder}`,paddingTop:4,marginTop:4}}>
                  <div style={{color:B.orange,fontSize:9,fontWeight:700,marginBottom:4}}>Analyst Recs</div>
                  {ANALYST_RECS.filter(r=>r.sym===focusSym).length>0 ?
                    ANALYST_RECS.filter(r=>r.sym===focusSym).map((r,i)=>(
                      <div key={i} style={{fontSize:9,marginBottom:2}}>
                        <span style={{color:r.action==='UPGRADE'?B.up:r.action==='DOWNGRADE'?B.dn:B.blue,fontWeight:700}}>{r.action}</span>
                        <span style={{color:B.gray}}> {r.firm} PT {r.pt}</span>
                      </div>
                    )) :
                    <div style={{color:B.dimGray,fontSize:9}}>No recent actions</div>
                  }
                </div>
              </>
            ) : <div style={{color:B.dimGray}}>Loading...</div>}
          </div>
        </BPanel>

        {/* ── ROW 2 COL 1: Bloomberg Quote / Security Detail ── */}
        <BPanel title="Bloomberg Quote" ticker={`${focusSym} US Equity`}>
          <div style={{padding:2}}>
            {/* Top price bar */}
            <div style={{background:'#001133',padding:'3px 6px',marginBottom:3,display:'flex',alignItems:'center',gap:8}}>
              <span style={{color:B.amber,fontWeight:700,fontSize:12}}>{focusSym} US</span>
              <span style={{color:B.gray}}>$</span>
              <span style={{color:B.white,fontWeight:700,fontSize:13}}>{focusQ?.last?.toFixed(2)||'···'}</span>
              <span style={{color:chgC(focusQ?.chg),fontWeight:600}}>{focusQ?.chg>0?'+':''}{focusQ?.chg?.toFixed(2)||''}</span>
            </div>
            {/* Quote grid — Bloomberg style two-column key-value */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:0}}>
              {[
                ['Last',focusQ?.last?.toFixed(2)],['Change',focusQ?.chg?.toFixed(2)],
                ['High',focusQ?.high?.toFixed(2)],['Low',focusQ?.low?.toFixed(2)],
                ['Open',focusQ?.prevClose?.toFixed(2)],['Prev Close',focusQ?.prevClose?.toFixed(2)],
                ['Volume',fmtVol(focusQ?.vol)],['%Change',fmtPct(focusQ?.pctChg)],
                ['Exchange',focusQ?.exchange||''],['Mkt State',focusQ?.mktState||''],
              ].map(([k,v],i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'1px 4px',borderBottom:`1px solid ${B.gridBorder}`,background:i%4<2?B.gridBg:B.gridAlt}}>
                  <span style={{color:B.gray,fontSize:9}}>{k}</span>
                  <span style={{color:k==='Change'||k==='%Change'?chgC(focusQ?.chg):B.white,fontSize:9,fontWeight:600}}>{v||'—'}</span>
                </div>
              ))}
            </div>
            {/* Intraday chart mini */}
            <div style={{marginTop:4,padding:2,borderTop:`1px solid ${B.gridBorder}`}}>
              <div style={{color:B.gray,fontSize:8,marginBottom:2}}>Intraday Chart │ GP ▾</div>
              {focusQ?.spark?.length>2 && (
                <svg viewBox="0 0 200 40" style={{width:'100%',height:40}}>
                  {(()=>{
                    const d=focusQ.spark.filter(x=>x!=null&&isFinite(x));if(d.length<2)return null;
                    const mn=Math.min(...d),mx=Math.max(...d),rg=mx-mn||1;
                    const pts=d.map((v,i)=>`${(i/(d.length-1))*200},${38-((v-mn)/rg)*34}`).join(' ');
                    return <polyline points={pts} fill="none" stroke={focusQ.chg>=0?B.up:B.dn} strokeWidth="1"/>;
                  })()}
                </svg>
              )}
            </div>
            {/* Relative Valuation table */}
            <div style={{marginTop:4,borderTop:`1px solid ${B.gridBorder}`,paddingTop:2}}>
              <div style={{color:B.gray,fontSize:8,marginBottom:2}}>Trade/Quote Recap │ QR ▾</div>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr style={{color:B.dimGray,fontSize:8}}>
                  <td style={{padding:'1px 2px'}}>Time</td><td style={{padding:'1px 2px'}}>Size</td><td style={{padding:'1px 2px',textAlign:'right'}}>Price</td>
                </tr></thead>
                <tbody>
                  {[0,1,2,3,4].map(i=>{
                    const p=focusQ?.last||(100+i); const sz=Math.floor(Math.random()*500+50);
                    const t=new Date(Date.now()-i*60000);
                    return(<tr key={i} style={{borderBottom:`1px solid ${B.gridBorder}`}}>
                      <td style={{padding:'1px 2px',color:B.dimGray,fontSize:8}}>{t.toLocaleTimeString('en-US',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'})}</td>
                      <td style={{padding:'1px 2px',color:B.gray,fontSize:8}}>{sz}</td>
                      <td style={{padding:'1px 2px',color:B.white,fontSize:8,textAlign:'right'}}>{(p+(Math.random()-0.5)*0.5).toFixed(2)}</td>
                    </tr>);
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </BPanel>

        {/* ── ROW 2 COL 2+3: WEI World Equity Indices ── */}
        <div style={{gridColumn:'2/4',display:'flex',flexDirection:'column',overflow:'hidden',border:`1px solid ${B.border}`,background:B.panelBg}}>
          <div style={{background:B.titleBar,borderBottom:`1px solid ${B.border}`,padding:'1px 4px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,height:18}}>
            <div style={{display:'flex',alignItems:'center',gap:4}}>
              <span style={{color:'#ffaa00',fontSize:8}}>◆</span>
              <span style={{color:B.titleText,fontSize:10,fontWeight:600}}>WEI World Equity Indices</span>
            </div>
            <div style={{display:'flex',gap:6}}>
              {['Standard','Movers','Volatility','Ratios','Futures'].map((t,i)=>(
                <span key={t} style={{color:i===0?B.white:B.gray,fontSize:8,cursor:'pointer',textDecoration:i===0?'underline':'none'}}>{t}</span>
              ))}
            </div>
          </div>
          <div style={{flex:1,overflow:'auto',padding:0}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{color:B.dimGray,fontSize:8,background:B.gridAlt,position:'sticky',top:0,zIndex:1}}>
                  <td style={{padding:'2px 4px'}}>Index</td>
                  <td style={{padding:'2px 4px',textAlign:'right'}}>Last</td>
                  <td style={{padding:'2px 4px',textAlign:'right'}}>Net Chg</td>
                  <td style={{padding:'2px 4px',textAlign:'right'}}>%Chg</td>
                  <td style={{padding:'2px 4px',textAlign:'center'}}>Intra</td>
                  <td style={{padding:'2px 4px',textAlign:'right'}}>Volume</td>
                  <td style={{padding:'2px 4px',textAlign:'right'}}>High</td>
                  <td style={{padding:'2px 4px',textAlign:'right'}}>Low</td>
                </tr>
              </thead>
              <tbody>
                {['Americas','EMEA','Asia/Pacific'].map(region=>(
                  <React.Fragment key={region}>
                    <tr><td colSpan={8} style={{padding:'3px 4px',color:B.amber,fontSize:9,fontWeight:700,background:'#0a0a1a',borderBottom:`1px solid ${B.gridBorder}`}}>{region}</td></tr>
                    {worldIdx.filter(w=>w.region===region).map((w,i)=>(
                      <tr key={w.display} style={{borderBottom:`1px solid ${B.gridBorder}`,background:i%2?B.gridAlt:B.gridBg,cursor:'pointer'}}
                        onClick={()=>{ const s=WORLD_INDEX_SYMS.find(x=>x.d===w.display); if(s) setFocusSym(s.yf); }}>
                        <td style={{padding:'2px 4px',color:B.white,fontSize:9,fontWeight:600}}>{w.display}</td>
                        <td style={{padding:'2px 4px',textAlign:'right',color:B.white,fontSize:9}}>{w.last?fmtP(w.last,w.last):'···'}</td>
                        <td style={{padding:'2px 4px',textAlign:'right',color:chgC(w.chg),fontSize:9}}>{w.last?(w.chg>0?'+':'')+fmtP(w.chg,w.last):''}</td>
                        <td style={{padding:'2px 4px',textAlign:'right',color:chgC(w.pctChg),fontSize:9,fontWeight:600}}>{w.last?fmtPct(w.pctChg):''}</td>
                        <td style={{padding:'2px 4px',textAlign:'center'}}><Spark data={w.spark} w={50} h={12} color={w.chg>=0?B.up:B.dn}/></td>
                        <td style={{padding:'2px 4px',textAlign:'right',color:B.dimGray,fontSize:9}}>{fmtVol(w.vol)}</td>
                        <td style={{padding:'2px 4px',textAlign:'right',color:B.dimGray,fontSize:9}}>{w.high?fmtP(w.high,w.last):''}</td>
                        <td style={{padding:'2px 4px',textAlign:'right',color:B.dimGray,fontSize:9}}>{w.low?fmtP(w.low,w.last):''}</td>
                      </tr>
                    ))}
                    {/* Futures rows */}
                    {region==='Americas'&&futures.slice(0,4).map((f,i)=>(
                      <tr key={f.sym} style={{borderBottom:`1px solid ${B.gridBorder}`,background:i%2?B.gridAlt:B.gridBg,cursor:'pointer'}}
                        onClick={()=>setFocusSym(FUTURES_SYMS.find(x=>x.d===f.sym)?.yf||f.sym)}>
                        <td style={{padding:'2px 4px',color:B.amber,fontSize:9,fontWeight:600}}>{f.sym} (Fut)</td>
                        <td style={{padding:'2px 4px',textAlign:'right',color:B.white,fontSize:9}}>{f.last?fmtP(f.last,f.last):'···'}</td>
                        <td style={{padding:'2px 4px',textAlign:'right',color:chgC(f.chg),fontSize:9}}>{f.last?(f.chg>0?'+':'')+fmtP(f.chg,f.last):''}</td>
                        <td style={{padding:'2px 4px',textAlign:'right',color:chgC(f.pctChg),fontSize:9,fontWeight:600}}>{f.last?fmtPct(f.pctChg):''}</td>
                        <td style={{padding:'2px 4px',textAlign:'center'}}><Spark data={f.spark} w={50} h={12} color={f.chg>=0?B.up:B.dn}/></td>
                        <td style={{padding:'2px 4px',textAlign:'right',color:B.dimGray,fontSize:9}}>{fmtVol(f.vol)}</td>
                        <td style={{padding:'2px 4px',textAlign:'right',color:B.dimGray,fontSize:9}}>{f.high?fmtP(f.high,f.last):''}</td>
                        <td style={{padding:'2px 4px',textAlign:'right',color:B.dimGray,fontSize:9}}>{f.low?fmtP(f.low,f.last):''}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── ROW 3: Ticker Quote Strips (5 tickers) ── */}
        {stocks.slice(0,5).map((s,i)=>(
          <div key={s.sym||i} style={{background:B.panelBg,border:`1px solid ${B.border}`,display:'flex',flexDirection:'column',overflow:'hidden',gridColumn:i>=3?(i===3?'1/2':'2/3'):'auto',cursor:'pointer'}}
            onClick={()=>setFocusSym(s.sym)}>
            <div style={{background:B.titleBar,borderBottom:`1px solid ${B.border}`,padding:'0 4px',display:'flex',alignItems:'center',justifyContent:'space-between',height:14,flexShrink:0}}>
              <span style={{color:B.titleText,fontSize:8}}>Vert │ {s.sym} ▾</span>
              <div style={{display:'flex',gap:2}}><span style={{color:B.gray,fontSize:7}}>◻ ▫</span></div>
            </div>
            <div style={{padding:'2px 4px',display:'flex',alignItems:'center',justifyContent:'space-between',flex:1}}>
              <div>
                <div style={{color:B.orange,fontSize:10,fontWeight:700}}>{s.name||s.sym}</div>
                <div style={{display:'flex',gap:8,marginTop:1}}>
                  <div><span style={{color:B.gray,fontSize:8}}>Last Price</span><div style={{color:B.white,fontSize:11,fontWeight:700}}>{s.last?s.last.toFixed(2):'···'}</div></div>
                  <div><span style={{color:B.gray,fontSize:8}}>Bid</span><div style={{color:B.white,fontSize:11}}>{s.last?(s.last-0.01).toFixed(2):''}</div></div>
                  <div><span style={{color:B.gray,fontSize:8}}>Ask</span><div style={{color:B.white,fontSize:11}}>{s.last?(s.last+0.01).toFixed(2):''}</div></div>
                </div>
              </div>
              <div style={{textAlign:'right'}}>
                <span style={{color:chgC(s.pctChg),fontSize:12,fontWeight:700}}>{s.last?fmtPct(s.pctChg):''}</span>
                <div style={{color:B.gray,fontSize:8}}>Country US</div>
              </div>
            </div>
          </div>
        ))}
        {/* Fill remaining col in row 3 */}
        <BPanel title="TOP Top News" noPad style={{gridColumn:'3/4'}}>
          <div style={{padding:2}}>
            <div style={{display:'flex',gap:4,marginBottom:2}}>
              <span style={{color:B.white,fontSize:8,background:'#333',padding:'0 4px'}}>All Stories</span>
              <span style={{color:B.gray,fontSize:8}}>Pages</span>
              <span style={{color:B.gray,fontSize:8}}>Open Search</span>
            </div>
            <div style={{color:B.amber,fontSize:9,fontWeight:700,marginBottom:2}}>Top Stories Selected By Bloomberg │ More ▸</div>
            {NEWS.slice(0,6).map((n,i)=>(
              <div key={i} style={{padding:'1px 0',fontSize:8,color:B.ltGray,borderBottom:`1px solid ${B.gridBorder}`,lineHeight:1.2}}>
                <span style={{color:B.dimGray,marginRight:4}}>{n.time}</span>{n.hl}
              </div>
            ))}
          </div>
        </BPanel>

        {/* ── ROW 4: International Clock + Commodities ── */}
        <div style={{gridColumn:'1/3',background:B.panelBg,border:`1px solid ${B.border}`,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{background:B.titleBar,borderBottom:`1px solid ${B.border}`,padding:'0 4px',display:'flex',alignItems:'center',height:14,flexShrink:0}}>
            <span style={{color:'#ffaa00',fontSize:7}}>◆</span>
            <span style={{color:B.titleText,fontSize:9,marginLeft:3}}>International Clock</span>
          </div>
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'space-around',padding:'2px 8px'}}>
            {[
              {city:'Chicago',tz:clock.chi,dt:clock.chid,gmt:'GMT -6:00',cc:'IL, US'},
              {city:'New York',tz:clock.ny,dt:clock.nyd,gmt:'GMT -5:00',cc:'NY, US'},
              {city:'London',tz:clock.lon,dt:clock.lond,gmt:'GMT +0:00',cc:'GB'},
              {city:'Hong Kong',tz:clock.hk,dt:clock.hkd,gmt:'GMT +8:00',cc:'CN'},
              {city:'Sydney',tz:clock.syd,dt:clock.sydd,gmt:'GMT +10:00',cc:'AU'},
            ].map(c=>(
              <div key={c.city} style={{textAlign:'center'}}>
                <div style={{color:B.amber,fontSize:18,fontWeight:700,fontFamily:"'Consolas',monospace",letterSpacing:1}}>{c.tz||'--:--:--'}</div>
                <div style={{color:B.dimGray,fontSize:8}}>{c.dt||''}</div>
                <div style={{color:B.gray,fontSize:9,fontWeight:600}}>{c.city}</div>
                <div style={{color:B.dimGray,fontSize:7}}>{c.cc} │ {c.gmt}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Row 4 Col 3: Commodities & FX */}
        <BPanel title="Commodities & FX">
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <tbody>
              {futures.slice(6).map((f,i)=>(
                <tr key={f.sym} style={{borderBottom:`1px solid ${B.gridBorder}`,background:i%2?B.gridAlt:B.gridBg}}>
                  <td style={{padding:'1px 3px',color:B.amber,fontSize:9,fontWeight:600}}>{f.sym}</td>
                  <td style={{padding:'1px 3px',textAlign:'right',color:B.white,fontSize:9}}>{f.last?fmtP(f.last,f.last):'···'}</td>
                  <td style={{padding:'1px 3px',textAlign:'right',color:chgC(f.pctChg),fontSize:9}}>{f.last?fmtPct(f.pctChg):''}</td>
                  <td style={{padding:'1px 3px',textAlign:'center'}}><Spark data={f.spark} w={40} h={10} color={f.chg>=0?B.up:B.dn}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </BPanel>
      </div>
    </div>
  );
}
