import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";

if(typeof window!=='undefined'&&!window.__vtEH){window.__vtEH=true;window.onerror=function(m,s,l,c,e){const d=document.createElement('div');d.style.cssText='position:fixed;inset:0;background:#000;color:#f33;padding:20px;font:12px monospace;z-index:99999;overflow:auto';d.innerHTML='<b>ERROR</b><pre>'+m+'\n'+(e?.stack||'')+'</pre><button onclick="location.reload()" style="margin-top:10px;padding:6px 16px;background:#f80;color:#000;border:none;cursor:pointer;font-size:12px">RELOAD</button>';document.body.appendChild(d)};window.addEventListener('unhandledrejection',e=>console.error(e.reason))}

// ── FORMATTERS ───────────────────────────────────────────
const fp=(n,r)=>{if(n==null||!isFinite(n))return"—";const a=Math.abs(r||n);return a>=10?n.toFixed(2):a>=1?n.toFixed(2):n.toFixed(4)};
const fpc=n=>n==null||!isFinite(n)?"—":(n>=0?"+":"")+n.toFixed(2)+"%";
const fv=n=>{if(!n||!isFinite(n))return"";if(n>=1e9)return(n/1e9).toFixed(1)+"B";if(n>=1e6)return(n/1e6).toFixed(1)+"M";if(n>=1e3)return(n/1e3).toFixed(0)+"K";return n+""};
const ftime=tz=>{try{return new Date().toLocaleTimeString('en-US',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:tz})}catch{return""}};
const fdate=tz=>{try{return new Date().toLocaleDateString('en-US',{weekday:'short',month:'2-digit',day:'2-digit',timeZone:tz})}catch{return""}};

// ── COLORS ───────────────────────────────────────────────
const B={
  bg:'#101020',panel:'#0c0c18',border:'#2a2a3a',
  tbar:'#1a1a2a',tbord:'#333345',
  orange:'#ff8c00',amber:'#ffa500',white:'#e8e8e8',gray:'#999',dim:'#606070',vdim:'#404050',
  up:'#00cc00',dn:'#ff2222',unch:'#888',blue:'#4499ff',
  gbg:'#0a0a16',galt:'#0e0e1e',gbord:'#222235',
  banner:'#002200',bannerB:'#005500',
};
const cc=v=>v>0?B.up:v<0?B.dn:B.unch;

// ── SYMBOLS ──────────────────────────────────────────────
const FUT=[
  {y:'ES=F',d:'ES',n:'S&P 500',tv:'CME_MINI:ES1!'},{y:'NQ=F',d:'NQ',n:'NASDAQ',tv:'CME_MINI:NQ1!'},
  {y:'YM=F',d:'YM',n:'Dow',tv:'CBOT_MINI:YM1!'},{y:'RTY=F',d:'RTY',n:'Russell',tv:'CME_MINI:RTY1!'},
  {y:'^VIX',d:'VIX',n:'VIX',tv:'CBOE:VIX'},{y:'DX-Y.NYB',d:'DXY',n:'Dollar',tv:'TVC:DXY'},
  {y:'CL=F',d:'CL',n:'Crude',tv:'NYMEX:CL1!'},{y:'GC=F',d:'GC',n:'Gold',tv:'COMEX:GC1!'},
  {y:'ZN=F',d:'ZN',n:'10Y',tv:'CBOT:ZN1!'},{y:'ZB=F',d:'ZB',n:'30Y',tv:'CBOT:ZB1!'},
  {y:'EURUSD=X',d:'EUR/USD',n:'Euro',tv:'FX:EURUSD'},{y:'JPY=X',d:'USD/JPY',n:'Yen',tv:'FX:USDJPY'},
];
const STK=['AAPL','MSFT','NVDA','AMZN','META','GOOG','TSLA','SPY','QQQ','IWM'];
const WLD=[
  {y:'^DJI',d:'DOW JONES',r:'Americas',tv:'DJ:DJI'},{y:'^GSPC',d:'S&P 500',r:'Americas',tv:'SP:SPX'},
  {y:'^IXIC',d:'NASDAQ',r:'Americas',tv:'NASDAQ:IXIC'},{y:'^RUT',d:'RUSSELL 2000',r:'Americas',tv:'TVC:RUT'},
  {y:'^STOXX50E',d:'Euro Stoxx 50',r:'EMEA',tv:'TVC:SX5E'},{y:'^FTSE',d:'FTSE 100',r:'EMEA',tv:'TVC:UKX'},
  {y:'^GDAXI',d:'DAX',r:'EMEA',tv:'XETR:DAX'},{y:'^FCHI',d:'CAC 40',r:'EMEA',tv:'TVC:CAC40'},
  {y:'^N225',d:'NIKKEI',r:'Asia/Pacific',tv:'TVC:NI225'},{y:'^HSI',d:'HANG SENG',r:'Asia/Pacific',tv:'TVC:HSI'},
  {y:'000300.SS',d:'CSI 300',r:'Asia/Pacific',tv:'SSE:000300'},
];

// ── DATA HOOKS ───────────────────────────────────────────
const useQ=(syms,iv=10000)=>{
  const[d,sD]=useState({});const[st,sSt]=useState('loading');const pv=useRef({});
  const f=useCallback(async()=>{try{
    const r=await fetch(`/api/quote?symbols=${encodeURIComponent(syms.join(','))}`);
    if(!r.ok)throw 0;const j=await r.json();const w={};
    for(const[k,q]of Object.entries(j.quotes||{})){const p=pv.current[k];w[k]={...q,_f:p&&p.last!==q.last?(q.last>p.last?'u':'d'):null};}
    pv.current=j.quotes||{};sD(w);sSt('live');
  }catch{sSt(s=>s==='loading'?'error':'stale')}},[syms.join(',')]);
  useEffect(()=>{f();const t=setInterval(f,iv);return()=>clearInterval(t)},[f,iv]);
  useEffect(()=>{if(Object.values(d).some(x=>x._f)){const t=setTimeout(()=>sD(p=>{const c={};for(const[k,v]of Object.entries(p))c[k]={...v,_f:null};return c}),500);return()=>clearTimeout(t)}},[d]);
  return{d,st};
};

// ── LIVE NEWS HOOK ───────────────────────────────────────
const useNews=(iv=60000)=>{
  const[news,setNews]=useState([]);const[st,setSt]=useState('loading');
  const f=useCallback(async()=>{try{
    const r=await fetch('/api/news');if(!r.ok)throw 0;
    const j=await r.json();setNews(j.news||[]);setSt('live');
  }catch{setSt('error')}},[]);
  useEffect(()=>{f();const t=setInterval(f,iv);return()=>clearInterval(t)},[f,iv]);
  return{news,st};
};

// ── SPARKLINE ────────────────────────────────────────────
const Sp=({d,w=60,h=16,c})=>{
  if(!d||d.length<2)return null;const v=d.filter(x=>x!=null&&isFinite(x));if(v.length<2)return null;
  const mn=Math.min(...v),mx=Math.max(...v),rg=mx-mn||1;
  return<svg width={w} height={h} style={{display:'block',verticalAlign:'middle'}}><polyline points={v.map((val,i)=>`${(i/(v.length-1))*w},${h-1-((val-mn)/rg)*(h-2)}`).join(' ')} fill="none" stroke={c||B.up} strokeWidth="1.2"/></svg>;
};

// ── TRADINGVIEW CHART EMBED ──────────────────────────────
const TVChart=({symbol,height})=>{
  const ref=useRef(null);const prev=useRef('');
  useEffect(()=>{
    if(!ref.current||symbol===prev.current)return;
    prev.current=symbol;
    ref.current.innerHTML='';
    const container=document.createElement('div');
    container.className='tradingview-widget-container__widget';
    container.style.height='100%';container.style.width='100%';
    ref.current.appendChild(container);
    const script=document.createElement('script');
    script.src='https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async=true;
    script.innerHTML=JSON.stringify({
      autosize:true,symbol:symbol,interval:"15",timezone:"America/Chicago",
      theme:"dark",style:"1",locale:"en",
      backgroundColor:"rgba(10,10,22,1)",gridColor:"rgba(30,30,50,0.5)",
      hide_top_toolbar:false,hide_legend:false,
      save_image:false,hide_volume:false,
      support_host:"https://www.tradingview.com",
    });
    ref.current.appendChild(script);
  },[symbol]);
  return<div ref={ref} style={{height:height||'100%',width:'100%'}}/>;
};

// ── BLOOMBERG PANEL ──────────────────────────────────────
const P=({t,children,tk,style,nopad,right})=>(
  <div style={{background:B.panel,border:`1px solid ${B.border}`,display:'flex',flexDirection:'column',overflow:'hidden',minWidth:0,...style}}>
    <div style={{background:B.tbar,borderBottom:`1px solid ${B.tbord}`,padding:'0 6px',display:'flex',alignItems:'center',justifyContent:'space-between',height:20,flexShrink:0}}>
      <div style={{display:'flex',alignItems:'center',gap:5,minWidth:0,overflow:'hidden'}}>
        <span style={{color:B.amber,fontSize:10}}>◆</span>
        <span style={{color:'#aaa',fontSize:12,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{t}</span>
        {tk&&<><span style={{color:'#444'}}>│</span><span style={{color:B.orange,fontSize:12,fontWeight:700}}>{tk}</span></>}
      </div>
      <div style={{display:'flex',alignItems:'center',gap:3,flexShrink:0}}>
        {right&&<span style={{color:B.dim,fontSize:10,marginRight:4}}>{right}</span>}
        <span style={{color:'#666',fontSize:11,cursor:'pointer'}}>—</span>
        <span style={{color:'#666',fontSize:10,cursor:'pointer'}}>□</span>
        <span style={{color:'#666',fontSize:11,cursor:'pointer'}}>≡</span>
      </div>
    </div>
    <div style={{flex:1,overflow:'auto',padding:nopad?0:'3px 4px',minHeight:0,background:B.gbg}}>{children}</div>
  </div>
);

const ld=(k,d)=>{try{return JSON.parse(localStorage.getItem('vt_'+k))||d}catch{return d}};
const sv=(k,v)=>{try{localStorage.setItem('vt_'+k,JSON.stringify(v))}catch{}};

// ══════════════════════════════════════════════════════════
export default function VT(){
  const[clk,setClk]=useState({});
  const[showSet,setShowSet]=useState(false);
  const[focus,setFocus]=useState('AAPL');
  const[focusTV,setFocusTV]=useState('NASDAQ:AAPL');

  const allS=useMemo(()=>[...FUT.map(f=>f.y),...STK,...WLD.map(w=>w.y)],[]);
  const{d:Q,st:qst}=useQ(allS,10000);
  const{news,st:nst}=useNews(60000);

  useEffect(()=>{const tick=()=>setClk({
    c:ftime('America/Chicago'),cd:fdate('America/Chicago'),
    n:ftime('America/New_York'),nd:fdate('America/New_York'),
    l:ftime('Europe/London'),ld_:fdate('Europe/London'),
    h:ftime('Asia/Hong_Kong'),hd:fdate('Asia/Hong_Kong'),
    s:ftime('Australia/Sydney'),sd:fdate('Australia/Sydney'),
  });tick();const t=setInterval(tick,1000);return()=>clearInterval(t)},[]);

  const fut=useMemo(()=>FUT.map(f=>{const q=Q[f.y];return q?{...q,sym:f.d,name:f.n,tv:f.tv}:{sym:f.d,name:f.n,tv:f.tv,last:0,chg:0,pctChg:0,high:0,low:0,vol:0,spark:[]}}),[Q]);
  const stk=useMemo(()=>STK.map(s=>{const q=Q[s];return q||{sym:s,last:0,chg:0,pctChg:0,vol:0,spark:[]}}),[Q]);
  const wld=useMemo(()=>WLD.map(w=>{const q=Q[w.y];return q?{...q,display:w.d,r:w.r,tv:w.tv}:{display:w.d,r:w.r,tv:w.tv,last:0,chg:0,pctChg:0,vol:0,spark:[]}}),[Q]);
  const fq=Q[focus]||null;

  // Select symbol and update TradingView
  const selectSym=(yahooSym,tvSym)=>{
    setFocus(yahooSym);
    if(tvSym)setFocusTV(tvSym);
    else{
      // Build TV symbol from yahoo sym
      const s=STK.includes(yahooSym)?`NASDAQ:${yahooSym}`:yahooSym;
      setFocusTV(s);
    }
  };

  const rs={borderBottom:`1px solid ${B.gbord}`};
  const cs={padding:'2px 5px',fontSize:13,whiteSpace:'nowrap'};

  return(
    <div style={{width:'100vw',height:'100vh',background:B.bg,display:'flex',flexDirection:'column',
      fontFamily:"'Consolas','Lucida Console','Courier New',monospace",fontSize:14,color:B.white,overflow:'hidden',userSelect:'none'}}>

      {/* Settings Modal */}
      {showSet&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.85)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={e=>{if(e.target===e.currentTarget)setShowSet(false)}}>
        <div style={{background:B.tbar,border:`1px solid ${B.border}`,padding:20,width:380}}>
          <div style={{color:B.orange,fontSize:16,fontWeight:700,marginBottom:12}}>TERMINAL SETTINGS</div>
          <div style={{color:B.dim,fontSize:11,marginBottom:16}}>
            Quotes: Yahoo Finance (live, 10s refresh)<br/>
            Charts: TradingView (live, real-time)<br/>
            News: RSS feeds (live, 60s refresh)<br/>
          </div>
          <button onClick={()=>setShowSet(false)} style={{padding:'5px 18px',background:B.orange,color:'#000',border:'none',cursor:'pointer',fontFamily:'inherit',fontWeight:700,fontSize:12}}>OK</button>
        </div>
      </div>}

      {/* ═══ TOOLBAR ═══ */}
      <div style={{background:'#0a0a14',borderBottom:`1px solid ${B.tbord}`,padding:'0 8px',display:'flex',alignItems:'center',justifyContent:'space-between',height:22,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{color:B.orange,fontWeight:900,fontSize:14,letterSpacing:1}}>VIPER</span>
          <span style={{color:B.dim,fontSize:11}}>Terminal</span>
          <span style={{color:B.vdim}}>│</span>
          <span style={{color:'#777',fontSize:11,cursor:'pointer'}} onClick={()=>setShowSet(true)}>⚙</span>
          <span style={{color:B.vdim}}>│</span>
          <span style={{width:6,height:6,borderRadius:'50%',background:qst==='live'?B.up:B.amber,display:'inline-block',boxShadow:qst==='live'?`0 0 4px ${B.up}`:'none'}}/>
          <span style={{color:qst==='live'?B.up:B.amber,fontSize:10}}>{qst==='live'?'LIVE':qst}</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{color:B.dim,fontSize:11}}>{new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'})}</span>
          <span style={{color:B.amber,fontWeight:700,fontSize:14}}>{clk.n||''}</span>
        </div>
      </div>

      {/* ═══ MAIN GRID ═══ */}
      <div style={{flex:1,display:'grid',gridTemplateColumns:'1fr 1.4fr 1fr',gridTemplateRows:'1.3fr 1.2fr 60px',gap:1,padding:1,overflow:'hidden',minHeight:0}}>

        {/* R1C1: LIVE NEWS */}
        <P t="News Feed" right={<span style={{color:nst==='live'?B.up:B.amber,fontSize:9}}>●{nst==='live'?' LIVE':''}</span>}>
          <div>
            {news.length===0&&<div style={{color:B.dim,padding:8}}>Loading news...</div>}
            {news.slice(0,15).map((n,i)=>(
              <div key={i} style={{display:'flex',gap:5,padding:'2px 0',borderBottom:`1px solid ${B.gbord}`,lineHeight:'16px'}}>
                <span style={{color:B.dim,fontSize:11,flexShrink:0,width:36}}>{n.time}</span>
                <span style={{color:n.src==='CNBC'?B.amber:n.src==='MW'?B.up:n.src==='YF'?'#aa66ff':B.gray,fontWeight:700,fontSize:11,flexShrink:0,width:32}}>{n.src}</span>
                <span style={{color:'#ccc',fontSize:12}}>{n.title}</span>
              </div>
            ))}
          </div>
        </P>

        {/* R1C2: TRADINGVIEW CHART */}
        <P t="Chart" tk={focusTV} nopad>
          <TVChart symbol={focusTV}/>
        </P>

        {/* R1C3: Bloomberg Quote + Dashboard */}
        <P t="Quote" tk={`${focus}`}>
          {fq?(<div>
            {/* Green banner */}
            <div style={{background:B.banner,border:`1px solid ${B.bannerB}`,padding:'4px 8px',marginBottom:4,display:'flex',alignItems:'center',gap:8}}>
              <span style={{color:B.amber,fontWeight:700,fontSize:14}}>{focus}</span>
              <span style={{color:B.white,fontWeight:700,fontSize:16}}>${fq.last?.toFixed(2)}</span>
              <span style={{color:cc(fq.chg),fontWeight:700,fontSize:14}}>{fq.chg>0?'+':''}{fq.chg?.toFixed(2)}</span>
              <span style={{color:cc(fq.pctChg),fontSize:13}}>({fpc(fq.pctChg)})</span>
            </div>
            {/* Key stats grid */}
            <table style={{width:'100%',borderCollapse:'collapse',marginBottom:4}}>
              <tbody>
                {[['High',fq.high?.toFixed(2),'Low',fq.low?.toFixed(2)],
                  ['Open',fq.prevClose?.toFixed(2),'Prev Close',fq.prevClose?.toFixed(2)],
                  ['Volume',fv(fq.vol),'Mkt State',fq.mktState||''],
                  ['Exchange',fq.exchange||'','',null],
                ].map((r,i)=>(
                  <tr key={i} style={{...rs,background:i%2?B.galt:B.gbg}}>
                    <td style={{...cs,color:B.gray,fontSize:12,width:'25%'}}>{r[0]}</td>
                    <td style={{...cs,color:B.white,fontWeight:600,width:'25%'}}>{r[1]||'—'}</td>
                    <td style={{...cs,color:B.gray,fontSize:12,width:'25%'}}>{r[2]}</td>
                    <td style={{...cs,color:B.white,fontWeight:600}}>{r[3]===null?'':(r[3]||'—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Intraday mini */}
            <div style={{borderTop:`1px solid ${B.gbord}`,paddingTop:2}}>
              <div style={{color:B.gray,fontSize:10,marginBottom:2}}>Intraday</div>
              {fq.spark?.length>2&&<svg viewBox="0 0 250 40" style={{width:'100%',height:40}}>
                {(()=>{const d=fq.spark.filter(x=>x!=null&&isFinite(x));if(d.length<2)return null;const mn=Math.min(...d),mx=Math.max(...d),rg=mx-mn||1;
                  const pts=d.map((v,i)=>`${(i/(d.length-1))*250},${38-((v-mn)/rg)*34}`).join(' ');
                  const fill=`0,38 ${pts} 250,38`;
                  return<><polygon points={fill} fill={fq.chg>=0?'rgba(0,180,0,0.08)':'rgba(220,0,0,0.08)'}/><polyline points={pts} fill="none" stroke={fq.chg>=0?B.up:B.dn} strokeWidth="1.5"/></>;
                })()}
              </svg>}
            </div>
            {/* Name */}
            <div style={{color:B.dim,fontSize:11,marginTop:4}}>{fq.name||focus}</div>
          </div>):(<div style={{color:B.dim,padding:8}}>Loading...</div>)}
        </P>

        {/* R2C1+C2: World Indices + Futures */}
        <div style={{gridColumn:'1/3',background:B.panel,border:`1px solid ${B.border}`,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{background:B.tbar,borderBottom:`1px solid ${B.tbord}`,padding:'0 6px',display:'flex',alignItems:'center',justifyContent:'space-between',height:20,flexShrink:0}}>
            <div style={{display:'flex',alignItems:'center',gap:5}}>
              <span style={{color:B.amber,fontSize:10}}>◆</span>
              <span style={{color:'#aaa',fontSize:12}}>World Equity Indices & Futures</span>
            </div>
            <div style={{display:'flex',gap:6}}>
              {['Standard','Movers','Volatility','Futures'].map((t,i)=>(
                <span key={t} style={{color:i===0?B.white:'#666',fontSize:10,cursor:'pointer',textDecoration:i===0?'underline':'none'}}>{t}</span>
              ))}
            </div>
          </div>
          <div style={{flex:1,overflow:'auto',background:B.gbg}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr style={{...rs,background:B.galt,position:'sticky',top:0,zIndex:1}}>
                {['Index','Last','Chg','%Chg','','Volume','High','Low'].map((h,i)=>(
                  <td key={i} style={{...cs,color:B.dim,textAlign:i>0?'right':'left',fontSize:11}}>{h}</td>
                ))}
              </tr></thead>
              <tbody>
                {['Americas','EMEA','Asia/Pacific'].map(region=>(
                  <React.Fragment key={region}>
                    <tr><td colSpan={8} style={{...cs,color:B.amber,fontWeight:700,background:'#0c0c1a',borderBottom:`1px solid ${B.gbord}`,fontSize:12}}>{region}</td></tr>
                    {wld.filter(w=>w.r===region).map((w,i)=>(
                      <tr key={w.display} style={{...rs,background:i%2?B.galt:B.gbg,cursor:'pointer'}} onClick={()=>selectSym(WLD.find(x=>x.d===w.display)?.y||'',w.tv)}>
                        <td style={{...cs,color:B.white,fontWeight:600}}>{w.display}</td>
                        <td style={{...cs,textAlign:'right',color:B.white}}>{w.last?fp(w.last,w.last):'···'}</td>
                        <td style={{...cs,textAlign:'right',color:cc(w.chg)}}>{w.last?(w.chg>0?'+':'')+fp(w.chg,w.last):''}</td>
                        <td style={{...cs,textAlign:'right',color:cc(w.pctChg),fontWeight:600}}>{w.last?fpc(w.pctChg):''}</td>
                        <td style={{...cs,textAlign:'center',padding:'2px'}}><Sp d={w.spark} w={50} h={14} c={w.chg>=0?B.up:B.dn}/></td>
                        <td style={{...cs,textAlign:'right',color:B.dim}}>{fv(w.vol)}</td>
                        <td style={{...cs,textAlign:'right',color:B.dim}}>{w.high?fp(w.high,w.last):''}</td>
                        <td style={{...cs,textAlign:'right',color:B.dim}}>{w.low?fp(w.low,w.last):''}</td>
                      </tr>
                    ))}
                    {region==='Americas'&&fut.slice(0,6).map((f,i)=>(
                      <tr key={f.sym} style={{...rs,background:i%2?B.galt:B.gbg,cursor:'pointer'}} onClick={()=>selectSym(FUT.find(x=>x.d===f.sym)?.y||'',f.tv)}>
                        <td style={{...cs,color:B.amber,fontWeight:600}}>{f.sym} <span style={{color:B.dim,fontSize:11}}>(Fut)</span></td>
                        <td style={{...cs,textAlign:'right',color:B.white}}>{f.last?fp(f.last,f.last):'···'}</td>
                        <td style={{...cs,textAlign:'right',color:cc(f.chg)}}>{f.last?(f.chg>0?'+':'')+fp(f.chg,f.last):''}</td>
                        <td style={{...cs,textAlign:'right',color:cc(f.pctChg),fontWeight:600}}>{f.last?fpc(f.pctChg):''}</td>
                        <td style={{...cs,textAlign:'center',padding:'2px'}}><Sp d={f.spark} w={50} h={14} c={f.chg>=0?B.up:B.dn}/></td>
                        <td style={{...cs,textAlign:'right',color:B.dim}}>{fv(f.vol)}</td>
                        <td style={{...cs,textAlign:'right',color:B.dim}}>{f.high?fp(f.high,f.last):''}</td>
                        <td style={{...cs,textAlign:'right',color:B.dim}}>{f.low?fp(f.low,f.last):''}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* R2C3: Ticker cards */}
        <div style={{display:'flex',flexDirection:'column',gap:1,overflow:'auto'}}>
          {stk.slice(0,7).map((s,i)=>(
            <div key={s.sym||i} style={{background:B.panel,border:`1px solid ${B.border}`,padding:'3px 6px',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}} onClick={()=>selectSym(s.sym,`NASDAQ:${s.sym}`)}>
              <div>
                <span style={{color:B.orange,fontWeight:700,fontSize:13}}>{s.sym}</span>
                <span style={{color:B.white,fontWeight:600,fontSize:13,marginLeft:8}}>{s.last?s.last.toFixed(2):'···'}</span>
                <span style={{color:cc(s.chg),fontSize:12,marginLeft:6}}>{s.last?(s.chg>0?'+':'')+s.chg.toFixed(2):''}</span>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <Sp d={s.spark} w={50} h={14} c={s.chg>=0?B.up:B.dn}/>
                <span style={{color:cc(s.pctChg),fontWeight:700,fontSize:13,width:55,textAlign:'right'}}>{s.last?fpc(s.pctChg):''}</span>
              </div>
            </div>
          ))}
          {/* Commodities */}
          <div style={{borderTop:`1px solid ${B.gbord}`,marginTop:2,paddingTop:2}}>
            {fut.slice(6).map((f,i)=>(
              <div key={f.sym} style={{display:'flex',justifyContent:'space-between',padding:'2px 6px',borderBottom:`1px solid ${B.gbord}`,cursor:'pointer',background:i%2?B.galt:B.gbg}} onClick={()=>selectSym(FUT.find(x=>x.d===f.sym)?.y||'',f.tv)}>
                <span style={{color:B.amber,fontWeight:600,fontSize:12}}>{f.sym}</span>
                <span style={{color:B.white,fontSize:12}}>{f.last?fp(f.last,f.last):'···'}</span>
                <span style={{color:cc(f.pctChg),fontSize:12,fontWeight:600}}>{f.last?fpc(f.pctChg):''}</span>
              </div>
            ))}
          </div>
        </div>

        {/* R3: Clock bar */}
        <div style={{gridColumn:'1/4',background:B.panel,border:`1px solid ${B.border}`,display:'flex',alignItems:'center',justifyContent:'space-around',padding:'0 12px'}}>
          {[
            {c:'Chicago',t:clk.c,d:clk.cd,g:'-6'},{c:'New York',t:clk.n,d:clk.nd,g:'-5'},
            {c:'London',t:clk.l,d:clk.ld_,g:'+0'},{c:'Hong Kong',t:clk.h,d:clk.hd,g:'+8'},
            {c:'Sydney',t:clk.s,d:clk.sd,g:'+10'},
          ].map(z=>(
            <div key={z.c} style={{textAlign:'center'}}>
              <span style={{color:B.amber,fontSize:20,fontWeight:700,letterSpacing:1}}>{z.t||'--:--:--'}</span>
              <div style={{display:'flex',gap:6,justifyContent:'center',alignItems:'center'}}>
                <span style={{color:B.gray,fontSize:11}}>{z.d||''}</span>
                <span style={{color:B.gray,fontSize:12,fontWeight:600}}>{z.c}</span>
                <span style={{color:B.dim,fontSize:10}}>GMT{z.g}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
