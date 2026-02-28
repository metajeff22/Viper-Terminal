import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";

if(typeof window!=='undefined'&&!window.__eh){window.__eh=true;window.onerror=function(m,s,l,c,e){const d=document.createElement('div');d.style.cssText='position:fixed;inset:0;background:#000;color:#f33;padding:20px;font:13px monospace;z-index:99999;overflow:auto';d.innerHTML='<b>VIPER ERROR</b><pre>'+m+'\n'+(e?.stack||'')+'</pre><button onclick="location.reload()" style="margin-top:10px;padding:6px 16px;background:#f80;color:#000;border:none;cursor:pointer;font:13px monospace">RELOAD</button>';document.body.appendChild(d)};window.addEventListener('unhandledrejection',e=>console.error(e.reason))}

/* ═══ FORMATTERS ═══ */
const fp=(n)=>{if(n==null||!isFinite(n))return"—";return n.toFixed(2)};
const fpc=n=>n==null||!isFinite(n)?"—":(n>=0?"+":"")+n.toFixed(2)+"%";
const fv=n=>{if(!n||!isFinite(n))return"—";if(n>=1e9)return(n/1e9).toFixed(1)+"B";if(n>=1e6)return(n/1e6).toFixed(1)+"M";if(n>=1e3)return(n/1e3).toFixed(0)+"K";return n+""};
const ftime=tz=>{try{return new Date().toLocaleTimeString('en-US',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:tz})}catch{return""}};
const fdate=tz=>{try{return new Date().toLocaleDateString('en-US',{weekday:'short',month:'2-digit',day:'2-digit',timeZone:tz})}catch{return""}};
const decHTML=s=>{if(!s||typeof document==='undefined')return s||'';const t=document.createElement('textarea');t.innerHTML=s;return t.value;};

/* ═══ COLORS ═══ */
const C={
  bg:'#0e0e1c',panel:'#0a0a16',border:'#282838',
  tbar:'#181828',tbord:'#303045',
  orange:'#ff8c00',amber:'#ffa500',white:'#e8e8e8',gray:'#999',dim:'#606070',vdim:'#404050',
  up:'#00cc00',dn:'#ff2222',unch:'#888',blue:'#4499ff',
  gbg:'#09091a',galt:'#0d0d20',gbord:'#1e1e30',
  greenBg:'#002a00',greenBd:'#005500',
};
const cc=v=>v>0?C.up:v<0?C.dn:C.unch;

/* ═══ SYMBOLS ═══ */
const FUT=[
  {y:'ES=F',d:'ES',n:'S&P 500',tv:'CME_MINI:ES1!'},{y:'NQ=F',d:'NQ',n:'NASDAQ',tv:'CME_MINI:NQ1!'},
  {y:'YM=F',d:'YM',n:'Dow',tv:'CBOT_MINI:YM1!'},{y:'RTY=F',d:'RTY',n:'Russell',tv:'CME_MINI:RTY1!'},
  {y:'^VIX',d:'VIX',n:'VIX',tv:'CBOE:VIX'},{y:'DX-Y.NYB',d:'DXY',n:'Dollar',tv:'TVC:DXY'},
  {y:'CL=F',d:'CL',n:'Crude Oil',tv:'NYMEX:CL1!'},{y:'GC=F',d:'GC',n:'Gold',tv:'COMEX:GC1!'},
  {y:'ZN=F',d:'ZN',n:'10Y Note',tv:'CBOT:ZN1!'},{y:'ZB=F',d:'ZB',n:'30Y Bond',tv:'CBOT:ZB1!'},
  {y:'EURUSD=X',d:'EUR/USD',n:'Euro',tv:'FX:EURUSD'},{y:'JPY=X',d:'USD/JPY',n:'Yen',tv:'FX:USDJPY'},
];
const STK=[
  {s:'AAPL',tv:'NASDAQ:AAPL'},{s:'MSFT',tv:'NASDAQ:MSFT'},{s:'NVDA',tv:'NASDAQ:NVDA'},
  {s:'AMZN',tv:'NASDAQ:AMZN'},{s:'META',tv:'NASDAQ:META'},{s:'GOOG',tv:'NASDAQ:GOOG'},
  {s:'TSLA',tv:'NASDAQ:TSLA'},{s:'SPY',tv:'AMEX:SPY'},{s:'QQQ',tv:'NASDAQ:QQQ'},{s:'IWM',tv:'AMEX:IWM'},
];
const WLD=[
  {y:'^DJI',d:'DOW JONES',r:'Americas',tv:'DJ:DJI'},{y:'^GSPC',d:'S&P 500',r:'Americas',tv:'SP:SPX'},
  {y:'^IXIC',d:'NASDAQ',r:'Americas',tv:'NASDAQ:IXIC'},{y:'^RUT',d:'RUSSELL 2K',r:'Americas',tv:'TVC:RUT'},
  {y:'^STOXX50E',d:'Euro Stoxx 50',r:'EMEA',tv:'TVC:SX5E'},{y:'^FTSE',d:'FTSE 100',r:'EMEA',tv:'TVC:UKX'},
  {y:'^GDAXI',d:'DAX',r:'EMEA',tv:'XETR:DAX'},{y:'^FCHI',d:'CAC 40',r:'EMEA',tv:'TVC:CAC40'},
  {y:'^N225',d:'NIKKEI',r:'Asia/Pacific',tv:'TVC:NI225'},{y:'^HSI',d:'HANG SENG',r:'Asia/Pacific',tv:'TVC:HSI'},
  {y:'000300.SS',d:'CSI 300',r:'Asia/Pacific',tv:'SSE:000300'},
];

/* ═══ HOOKS ═══ */
const useQ=(syms,iv=12000)=>{
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
const useNews=(iv=60000)=>{
  const[news,setNews]=useState([]);const[st,setSt]=useState('loading');
  const f=useCallback(async()=>{try{
    const r=await fetch('/api/news');if(!r.ok)throw 0;
    const j=await r.json();setNews((j.news||[]).map(n=>({...n,title:decHTML(n.title)})));setSt('live');
  }catch{setSt(s=>s==='loading'?'error':'stale')}},[]);
  useEffect(()=>{f();const t=setInterval(f,iv);return()=>clearInterval(t)},[f,iv]);
  return{news,st};
};

/* ═══ SPARKLINE ═══ */
const Sp=({d,w=55,h=14,c})=>{
  if(!d||d.length<2)return null;const v=d.filter(x=>x!=null&&isFinite(x));if(v.length<2)return null;
  const mn=Math.min(...v),mx=Math.max(...v),rg=mx-mn||1;
  return<svg width={w} height={h} style={{display:'block'}}><polyline points={v.map((val,i)=>`${(i/(v.length-1))*w},${h-1-((val-mn)/rg)*(h-2)}`).join(' ')} fill="none" stroke={c||C.up} strokeWidth="1.2"/></svg>;
};

/* ═══ TRADINGVIEW CHART — direct iframe embed ═══ */
// This uses TradingView's public embed URL which works without any script injection
const TVChart=React.memo(({symbol})=>{
  const src=`https://s.tradingview.com/widgetembed/?frameElementId=tv_chart&symbol=${encodeURIComponent(symbol)}&interval=15&hidesidetoolbar=0&symboledit=1&saveimage=0&toolbarbg=0a0a16&studies=MASimple%7B14%7D&theme=dark&style=1&timezone=America%2FChicago&studies_overrides=%7B%7D&overrides=%7B%22paneProperties.background%22%3A%22%230a0a16%22%2C%22paneProperties.backgroundType%22%3A%22solid%22%2C%22scalesProperties.backgroundColor%22%3A%22%230a0a16%22%7D&enabled_features=[]&disabled_features=[]&locale=en&utm_source=www.tradingview.com&utm_medium=widget_new&utm_campaign=chart`;
  return(
    <iframe
      key={symbol}
      src={src}
      style={{width:'100%',height:'100%',border:'none',display:'block'}}
      allowTransparency="true"
      allow="encrypted-media"
    />
  );
});

/* ═══ PANEL ═══ */
const Panel=({title,children,ticker,style:st,nopad,right})=>(
  <div style={{background:C.panel,border:`1px solid ${C.border}`,display:'flex',flexDirection:'column',overflow:'hidden',minWidth:0,...st}}>
    <div style={{background:C.tbar,borderBottom:`1px solid ${C.tbord}`,padding:'0 6px',display:'flex',alignItems:'center',justifyContent:'space-between',height:20,flexShrink:0}}>
      <div style={{display:'flex',alignItems:'center',gap:5,overflow:'hidden'}}>
        <span style={{color:C.amber,fontSize:9}}>◆</span>
        <span style={{color:'#aaa',fontSize:12,whiteSpace:'nowrap'}}>{title}</span>
        {ticker&&<><span style={{color:'#444'}}>│</span><span style={{color:C.orange,fontSize:12,fontWeight:700}}>{ticker}</span></>}
      </div>
      <div style={{display:'flex',alignItems:'center',gap:2,flexShrink:0}}>
        {right}
        <span style={{color:'#555',fontSize:11,marginLeft:4,cursor:'pointer'}}>□</span>
        <span style={{color:'#555',fontSize:11,cursor:'pointer'}}>≡</span>
      </div>
    </div>
    <div style={{flex:1,overflow:'auto',padding:nopad?0:'3px 5px',minHeight:0,background:C.gbg}}>{children}</div>
  </div>
);

/* ═══ MAIN ═══ */
export default function VT(){
  const[clk,setClk]=useState({});
  const[focus,setFocus]=useState('AAPL');
  const[focusTV,setFocusTV]=useState('NASDAQ:AAPL');

  const allSyms=useMemo(()=>[...FUT.map(f=>f.y),...STK.map(s=>s.s),...WLD.map(w=>w.y)],[]);
  const{d:Q,st:qst}=useQ(allSyms,12000);
  const{news,st:nst}=useNews(60000);

  useEffect(()=>{const fn=()=>setClk({
    c:ftime('America/Chicago'),cd:fdate('America/Chicago'),
    n:ftime('America/New_York'),nd:fdate('America/New_York'),
    l:ftime('Europe/London'),ld:fdate('Europe/London'),
    h:ftime('Asia/Hong_Kong'),hd:fdate('Asia/Hong_Kong'),
    s:ftime('Australia/Sydney'),sd:fdate('Australia/Sydney'),
  });fn();const t=setInterval(fn,1000);return()=>clearInterval(t)},[]);

  const fut=useMemo(()=>FUT.map(f=>{const q=Q[f.y];return q?{...q,sym:f.d,name:f.n,tv:f.tv}:{sym:f.d,name:f.n,tv:f.tv,last:0,chg:0,pctChg:0,high:0,low:0,vol:0,spark:[]}}),[Q]);
  const stk=useMemo(()=>STK.map(s=>{const q=Q[s.s];return q?{...q,tv:s.tv}:{sym:s.s,tv:s.tv,last:0,chg:0,pctChg:0,vol:0,spark:[]}}),[Q]);
  const wld=useMemo(()=>WLD.map(w=>{const q=Q[w.y];return q?{...q,display:w.d,r:w.r,tv:w.tv}:{display:w.d,r:w.r,tv:w.tv,last:0,chg:0,pctChg:0,vol:0,spark:[]}}),[Q]);
  const fq=Q[focus]||null;

  const sel=(ySym,tvSym)=>{setFocus(ySym);setFocusTV(tvSym);};

  // Table cell/row styles
  const td={padding:'2px 6px',fontSize:13,whiteSpace:'nowrap'};
  const tdr={...td,textAlign:'right'};

  return(
    <div style={{width:'100vw',height:'100vh',background:C.bg,display:'flex',flexDirection:'column',
      fontFamily:"Consolas,'Lucida Console','Courier New',monospace",fontSize:13,color:C.white,overflow:'hidden'}}>

      {/* ═══ TOOLBAR ═══ */}
      <div style={{background:'#08081a',borderBottom:`1px solid ${C.tbord}`,padding:'0 10px',display:'flex',alignItems:'center',justifyContent:'space-between',height:24,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{color:C.orange,fontWeight:900,fontSize:15,letterSpacing:1}}>VIPER</span>
          <span style={{color:C.vdim}}>│</span>
          <span style={{width:7,height:7,borderRadius:'50%',background:qst==='live'?C.up:C.amber,display:'inline-block'}}/>
          <span style={{color:qst==='live'?C.up:C.amber,fontSize:11}}>{qst==='live'?'LIVE DATA':qst.toUpperCase()}</span>
          {nst==='live'&&<><span style={{color:C.vdim}}>│</span><span style={{color:C.up,fontSize:11}}>● NEWS</span></>}
        </div>
        <span style={{color:C.amber,fontWeight:700,fontSize:15}}>{clk.n||''} <span style={{color:C.gray,fontWeight:400,fontSize:12}}>{new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</span></span>
      </div>

      {/* ═══ MAIN: flexbox rows ═══ */}
      <div style={{flex:1,display:'flex',flexDirection:'column',gap:1,padding:1,overflow:'hidden'}}>

        {/* ═══ ROW 1: News | CHART | Quote ═══ */}
        <div style={{flex:5,display:'flex',gap:1,minHeight:0}}>

          {/* NEWS */}
          <Panel title="News Feed" style={{width:'26%',flexShrink:0}}
            right={<span style={{color:nst==='live'?C.up:C.amber,fontSize:9}}>● LIVE</span>}>
            {news.length===0&&<div style={{color:C.dim,padding:10}}>Loading...</div>}
            {news.slice(0,20).map((n,i)=>(
              <div key={i} style={{display:'flex',gap:5,padding:'1px 0',borderBottom:`1px solid ${C.gbord}`}}>
                <span style={{color:C.dim,fontSize:11,flexShrink:0,width:34}}>{n.time}</span>
                <span style={{color:n.src==='CNBC'?C.amber:n.src==='MW'?C.up:'#a070ff',fontWeight:700,fontSize:11,flexShrink:0,width:34}}>{n.src}</span>
                <span style={{color:'#ccc',fontSize:12,lineHeight:'17px'}}>{n.title}</span>
              </div>
            ))}
          </Panel>

          {/* TRADINGVIEW CHART — proper iframe */}
          <Panel title="Chart" ticker={focusTV} nopad style={{flex:1}}>
            <TVChart symbol={focusTV}/>
          </Panel>

          {/* QUOTE */}
          <Panel title="Quote" ticker={focus} style={{width:'22%',flexShrink:0}}>
            {fq?(<div>
              <div style={{background:C.greenBg,border:`1px solid ${C.greenBd}`,padding:'5px 8px',marginBottom:6}}>
                <div style={{display:'flex',alignItems:'baseline',gap:6,flexWrap:'wrap'}}>
                  <span style={{color:C.amber,fontWeight:700,fontSize:16}}>{focus}</span>
                  <span style={{color:C.white,fontWeight:700,fontSize:18}}>${fp(fq.last)}</span>
                </div>
                <div style={{color:cc(fq.chg),fontWeight:700,fontSize:14,marginTop:2}}>
                  {fq.chg>0?'+':''}{fp(fq.chg)} ({fpc(fq.pctChg)})
                </div>
              </div>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <tbody>
                  {[['High',fp(fq.high),'Low',fp(fq.low)],
                    ['Open',fp(fq.prevClose),'Prev Cls',fp(fq.prevClose)],
                    ['Volume',fv(fq.vol),'State',fq.mktState||'—'],
                  ].map((r,i)=>(
                    <tr key={i} style={{borderBottom:`1px solid ${C.gbord}`,background:i%2?C.galt:C.gbg}}>
                      <td style={{...td,color:C.gray,fontSize:11}}>{r[0]}</td>
                      <td style={{...td,color:C.white,fontWeight:600}}>{r[1]}</td>
                      <td style={{...td,color:C.gray,fontSize:11}}>{r[2]}</td>
                      <td style={{...td,color:C.white,fontWeight:600}}>{r[3]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Sparkline */}
              {fq.spark?.length>2&&(
                <div style={{marginTop:6,padding:'4px 0',borderTop:`1px solid ${C.gbord}`}}>
                  <div style={{color:C.dim,fontSize:10,marginBottom:3}}>Intraday</div>
                  <svg viewBox="0 0 280 55" style={{width:'100%',height:55}}>
                    {(()=>{const d=fq.spark.filter(x=>x!=null&&isFinite(x));if(d.length<2)return null;
                      const mn=Math.min(...d),mx=Math.max(...d),rg=mx-mn||1;
                      const pts=d.map((v,i)=>`${(i/(d.length-1))*280},${52-((v-mn)/rg)*48}`).join(' ');
                      return<><polygon points={`0,52 ${pts} 280,52`} fill={fq.chg>=0?'rgba(0,200,0,0.06)':'rgba(255,30,30,0.06)'}/><polyline points={pts} fill="none" stroke={fq.chg>=0?C.up:C.dn} strokeWidth="1.5"/></>;
                    })()}
                  </svg>
                </div>
              )}
              <div style={{color:C.dim,fontSize:11,marginTop:4}}>{fq.name||''}</div>
            </div>):(<div style={{color:C.dim,padding:10}}>Loading...</div>)}
          </Panel>
        </div>

        {/* ═══ ROW 2: Indices + Futures | Equities + Commodities ═══ */}
        <div style={{flex:4,display:'flex',gap:1,minHeight:0}}>

          {/* WORLD INDICES */}
          <Panel title="World Equity Indices & Futures" nopad style={{flex:7}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr style={{borderBottom:`1px solid ${C.gbord}`,background:C.galt,position:'sticky',top:0,zIndex:1}}>
                <th style={{...td,color:C.dim,fontSize:11,textAlign:'left',fontWeight:400}}>Index</th>
                <th style={{...tdr,color:C.dim,fontSize:11,fontWeight:400}}>Last</th>
                <th style={{...tdr,color:C.dim,fontSize:11,fontWeight:400}}>Chg</th>
                <th style={{...tdr,color:C.dim,fontSize:11,fontWeight:400}}>%Chg</th>
                <th style={{...td,color:C.dim,fontSize:11,fontWeight:400,textAlign:'center',width:55}}></th>
                <th style={{...tdr,color:C.dim,fontSize:11,fontWeight:400}}>Volume</th>
                <th style={{...tdr,color:C.dim,fontSize:11,fontWeight:400}}>High</th>
                <th style={{...tdr,color:C.dim,fontSize:11,fontWeight:400}}>Low</th>
              </tr></thead>
              <tbody>
                {['Americas','EMEA','Asia/Pacific'].map(region=>(
                  <React.Fragment key={region}>
                    <tr><td colSpan={8} style={{...td,color:C.amber,fontWeight:700,background:'#0b0b1e',borderBottom:`1px solid ${C.gbord}`,fontSize:12}}>{region}</td></tr>
                    {wld.filter(w=>w.r===region).map((w,i)=>(
                      <tr key={w.display} style={{borderBottom:`1px solid ${C.gbord}`,background:i%2?C.galt:C.gbg,cursor:'pointer',height:23}}
                        onClick={()=>sel(WLD.find(x=>x.d===w.display)?.y||'',w.tv)}>
                        <td style={{...td,color:C.white,fontWeight:600}}>{w.display}</td>
                        <td style={{...tdr,color:C.white}}>{w.last?fp(w.last):'···'}</td>
                        <td style={{...tdr,color:cc(w.chg)}}>{w.last?(w.chg>0?'+':'')+fp(w.chg):''}</td>
                        <td style={{...tdr,color:cc(w.pctChg),fontWeight:600}}>{w.last?fpc(w.pctChg):''}</td>
                        <td style={{padding:'2px',textAlign:'center'}}><Sp d={w.spark} w={50} h={14} c={w.chg>=0?C.up:C.dn}/></td>
                        <td style={{...tdr,color:C.dim,fontSize:12}}>{fv(w.vol)}</td>
                        <td style={{...tdr,color:C.dim,fontSize:12}}>{w.high?fp(w.high):''}</td>
                        <td style={{...tdr,color:C.dim,fontSize:12}}>{w.low?fp(w.low):''}</td>
                      </tr>
                    ))}
                    {region==='Americas'&&fut.slice(0,6).map((f,i)=>(
                      <tr key={f.sym} style={{borderBottom:`1px solid ${C.gbord}`,background:i%2?C.galt:C.gbg,cursor:'pointer',height:23}}
                        onClick={()=>sel(FUT.find(x=>x.d===f.sym)?.y||'',f.tv)}>
                        <td style={{...td,color:C.amber,fontWeight:600}}>{f.sym} <span style={{color:C.dim,fontSize:11}}>(Fut)</span></td>
                        <td style={{...tdr,color:C.white}}>{f.last?fp(f.last):'···'}</td>
                        <td style={{...tdr,color:cc(f.chg)}}>{f.last?(f.chg>0?'+':'')+fp(f.chg):''}</td>
                        <td style={{...tdr,color:cc(f.pctChg),fontWeight:600}}>{f.last?fpc(f.pctChg):''}</td>
                        <td style={{padding:'2px',textAlign:'center'}}><Sp d={f.spark} w={50} h={14} c={f.chg>=0?C.up:C.dn}/></td>
                        <td style={{...tdr,color:C.dim,fontSize:12}}>{fv(f.vol)}</td>
                        <td style={{...tdr,color:C.dim,fontSize:12}}>{f.high?fp(f.high):''}</td>
                        <td style={{...tdr,color:C.dim,fontSize:12}}>{f.low?fp(f.low):''}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </Panel>

          {/* RIGHT: Equities + Commodities */}
          <div style={{flex:3,display:'flex',flexDirection:'column',gap:1}}>
            <Panel title="Equities" style={{flex:1}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <tbody>{stk.map((s,i)=>(
                  <tr key={s.sym} style={{borderBottom:`1px solid ${C.gbord}`,background:i%2?C.galt:C.gbg,cursor:'pointer',height:23}}
                    onClick={()=>sel(s.sym,s.tv)}>
                    <td style={{...td,color:C.orange,fontWeight:700,width:55}}>{s.sym}</td>
                    <td style={{...tdr,color:C.white,fontWeight:600}}>{s.last?fp(s.last):'···'}</td>
                    <td style={{...tdr,color:cc(s.chg),fontSize:12}}>{s.last?(s.chg>0?'+':'')+fp(s.chg):''}</td>
                    <td style={{padding:'2px',textAlign:'center'}}><Sp d={s.spark} w={45} h={12} c={s.chg>=0?C.up:C.dn}/></td>
                    <td style={{...tdr,color:cc(s.pctChg),fontWeight:700,width:60}}>{s.last?fpc(s.pctChg):''}</td>
                  </tr>
                ))}</tbody>
              </table>
            </Panel>
            <Panel title="Commodities & FX">
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <tbody>{fut.slice(6).map((f,i)=>(
                  <tr key={f.sym} style={{borderBottom:`1px solid ${C.gbord}`,background:i%2?C.galt:C.gbg,cursor:'pointer',height:23}}
                    onClick={()=>sel(FUT.find(x=>x.d===f.sym)?.y||'',f.tv)}>
                    <td style={{...td,color:C.amber,fontWeight:600}}>{f.sym}</td>
                    <td style={{...tdr,color:C.white}}>{f.last?fp(f.last):'···'}</td>
                    <td style={{...tdr,color:cc(f.pctChg),fontWeight:600}}>{f.last?fpc(f.pctChg):''}</td>
                    <td style={{padding:'2px',textAlign:'center'}}><Sp d={f.spark} w={40} h={12} c={f.chg>=0?C.up:C.dn}/></td>
                  </tr>
                ))}</tbody>
              </table>
            </Panel>
          </div>
        </div>

        {/* ═══ ROW 3: Clock ═══ */}
        <div style={{height:56,flexShrink:0,background:C.panel,border:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-around',padding:'0 16px'}}>
          {[{c:'Chicago',t:clk.c,d:clk.cd,g:'-6'},{c:'New York',t:clk.n,d:clk.nd,g:'-5'},{c:'London',t:clk.l,d:clk.ld,g:'+0'},{c:'Hong Kong',t:clk.h,d:clk.hd,g:'+8'},{c:'Sydney',t:clk.s,d:clk.sd,g:'+10'}].map(z=>(
            <div key={z.c} style={{textAlign:'center'}}>
              <div style={{color:C.amber,fontSize:22,fontWeight:700,letterSpacing:2}}>{z.t||'--:--:--'}</div>
              <div style={{color:C.gray,fontSize:10}}>{z.d} <b>{z.c}</b> <span style={{color:C.dim}}>GMT{z.g}</span></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
