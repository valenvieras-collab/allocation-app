/* ---------- datos de mercado (Yahoo Finance, vía la app) ---------- */
const classifying=new Set();
const CRYPTO=["BTC","ETH","SOL","ADA","XRP","DOGE","BNB","AVAX","DOT","LTC","LINK","MATIC"];
const CURRENCIES=["USD","UYU","EUR","BRL","ARS","GBP","CHF","JPY","MXN","CLP","CAD"];
const SECTOR_MAP={"Technology":"Tecnología","Communication Services":"Comunicaciones","Consumer Cyclical":"Consumo discrecional","Consumer Defensive":"Consumo básico","Healthcare":"Salud","Financial Services":"Financiero","Industrials":"Industrial","Energy":"Energía","Basic Materials":"Materiales","Utilities":"Utilities","Real Estate":"Inmobiliario"};
const SUFFIX_REGION={L:"Europa",PA:"Europa",DE:"Europa",AS:"Europa",MI:"Europa",MC:"Europa",SW:"Europa",T:"Asia desarrollada",HK:"Emergentes",SS:"Emergentes",SZ:"Emergentes",KS:"Emergentes",TW:"Emergentes",NS:"Emergentes",BO:"Emergentes",SA:"Latinoamérica",MX:"Latinoamérica",BA:"Latinoamérica",SN:"Latinoamérica",TO:"EE.UU.",V:"EE.UU.",AX:"Asia desarrollada"};
function ySym(h){
  if(h.yahooSymbol) return h.yahooSymbol;
  const t=String(h.ticker||"").toUpperCase().trim();
  if(h.assetClass==="cripto"||CRYPTO.includes(t)) return t.includes("-")?t:t+"-USD";
  return t.replace(/\.(?=[A-Z]$)/,"-");
}
function priceable(h){ return h.assetClass!=="cash" && h.vehicle!=="Bono" && !parseBond(h.ticker) && !h.priceManual; }
function guessFromName(name){
  const n=String(name||"").toLowerCase(); const r={assetClass:"rv",sector:"Diversificado",region:"EE.UU."};
  if(/treasury|bond|t-bill|aggregate|fixed income|tips|corporate|municipal|duration/.test(n)){r.assetClass="rf";r.sector=/0-3 month|t-bill|1-3 month|ultra.?short|money market/.test(n)?"Letras / monetario":/treasury|govt|government/.test(n)?"Bonos del Tesoro":/emerging/.test(n)?"Bonos emergentes":"Bonos corporativos";}
  else if(/gold|silver|commodit|crude|oil fund|metals/.test(n)){r.assetClass="otros";r.sector="Commodities";r.region="Global";}
  else if(/bitcoin|ether|crypto/.test(n)){r.assetClass="cripto";r.sector="Cripto";r.region="Global";}
  else if(/semiconductor|technology|tech |software|magnificent|cloud|cyber|robotic|artificial/.test(n)) r.sector="Tecnología";
  else if(/financial|bank/.test(n)) r.sector="Financiero";
  else if(/health|biotech|pharma/.test(n)) r.sector="Salud";
  else if(/energy/.test(n)) r.sector="Energía";
  else if(/real estate|reit/.test(n)) r.sector="Inmobiliario";
  else if(/utilit/.test(n)) r.sector="Utilities";
  if(/emerging/.test(n)) r.region="Emergentes";
  else if(/world|global|all.country|international|eafe|developed/.test(n)) r.region="Global";
  else if(/europe|stoxx|euro/.test(n)) r.region="Europa";
  else if(/japan|australia/.test(n)) r.region="Asia desarrollada";
  else if(/china|india|taiwan|korea/.test(n)) r.region="Emergentes";
  else if(/latin|brazil|mexico|argentin|chile/.test(n)) r.region="Latinoamérica";
  r.leveraged=/ultrapro|ultra |2x|3x|leveraged|daily .*bull/.test(n);
  return r;
}
async function classify(o,manual=[]){
  if(classifying.has(o.id))return; classifying.add(o.id); retried.add(o.id); render();
  const t=String(o.ticker||"").toUpperCase().trim(); const bd=parseBond(t);
  const cur0=holdings.find(h=>h.id===o.id)||o; const u=stripCalc(cur0);
  const set=(k,f,v)=>{ if(!manual.includes(f)&&v!==undefined&&v!==null&&String(v)!=="") u[k]=v; };
  try{
    if(CURRENCIES.includes(t)){
      set("name","f-name","Efectivo en "+t); set("vehicle","f-veh","Efectivo"); set("assetClass","f-cls","cash"); set("sector","f-sec","Efectivo");
      set("currency","f-cur",t); set("region","f-reg",t==="UYU"?"Uruguay":t==="USD"?"EE.UU.":t==="EUR"?"Europa":"Global");
      u.amountCurrency=t; u.mode="amount"; u.pricePending=false; if(u.vol==null)u.vol=t==="USD"?0:0.08; if(u.beta==null)u.beta=0; u.riskSource="estimado";
    } else if(bd){
      u.vehicle="Bono"; u.assetClass="rf"; u.pricePer=100;
      if(bd.kind==="ibkr"){ set("name","f-name",(bd.treasury?"US Treasury":bd.issuer)+" "+fmt(bd.coupon,3).replace(/,?0+$/,"")+" % "+bd.maturity.slice(0,4)); u.issuer=bd.issuer;u.coupon=bd.coupon;u.maturity=bd.maturity; set("sector","f-sec",bd.sector); set("region","f-reg",bd.region); if(u.vol==null)u.vol=bd.vol; if(u.beta==null)u.beta=bd.beta; }
      else { set("sector","f-sec","Bonos corporativos"); if(u.vol==null)u.vol=0.06; if(u.beta==null)u.beta=0.1; }
      u.riskSource="estimado (modelo)";
    } else {
      const sym=ySym({...u,assetClass:CRYPTO.includes(t)?"cripto":u.assetClass});
      const [sr,qr]=await Promise.all([window.api.search(sym),window.api.quote([sym])]);
      const qq=qr&&qr[sym]; const hits=(sr&&sr.ok?sr.quotes:[])||[];
      const hit=hits.find(x=>String(x.symbol).toUpperCase()===sym.toUpperCase())||null;
      if(!(qq&&qq.ok)&&!hit){ u.classifyPending=false; await saveHolding(u); toast("No encontré "+t+" en Yahoo Finance. Revisá el ticker o completá los datos con Editar."); return; }
      const type=String((hit&&hit.type)||(qq&&qq.type)||"").toUpperCase();
      const name=(hit&&hit.name)||(qq&&qq.name)||t;
      u.yahooSymbol=sym; set("name","f-name",name);
      if(type==="CRYPTOCURRENCY"){ set("vehicle","f-veh","Cripto"); set("assetClass","f-cls","cripto"); set("sector","f-sec","Cripto"); set("region","f-reg","Global"); }
      else if(type==="ETF"||type==="MUTUALFUND"){ const g=guessFromName(name); set("vehicle","f-veh",type==="ETF"?"ETF":"Fondo"); set("assetClass","f-cls",g.assetClass); set("sector","f-sec",g.sector); set("region","f-reg",g.region); if(g.leveraged&&!u.note)u.note="ETF apalancado: se rebalancea a diario."; }
      else { set("vehicle","f-veh","Acción"); set("assetClass","f-cls","rv"); set("sector","f-sec",SECTOR_MAP[hit&&hit.sector]||""); const suf=(sym.split(".")[1]||""); set("region","f-reg",SUFFIX_REGION[suf]||"EE.UU."); }
      if(qq&&qq.ok&&qq.currency) set("currency","f-cur",String(qq.currency).toUpperCase());
      const dv={rv:[0.30,1.0],rf:[0.06,0.1],cripto:[0.60,1.3],otros:[0.18,0.2],cash:[0,0]}[u.assetClass]||[0.3,1];
      if(u.vol==null||u.vol==="")u.vol=dv[0]; if(u.beta==null||u.beta==="")u.beta=dv[1]; u.riskSource="estimado (se reemplaza con históricos)";
    }
    u.classifyPending=false;
    await saveHolding(u); toast(t+": datos completados");
  }catch(e){ toast("No se pudieron completar los datos de "+t+". Revisá la conexión."); }
  finally{ classifying.delete(o.id); render(); }
  refreshAll();
}

/* precios y tipo de cambio */
let refreshing=false, lastPrices=null, lastHist=null;
const HIST={}; const corrCache=new Map();
function fmtTime(sec){ if(!sec)return new Date().toLocaleDateString("es-UY"); const d=new Date(sec*1000); return d.toLocaleDateString("es-UY",{day:"2-digit",month:"2-digit",year:"numeric"})+" "+d.toLocaleTimeString("es-UY",{hour:"2-digit",minute:"2-digit",hour12:false}); }
function setDataStatus(){ const p=[]; if(lastPrices)p.push("Precios: Yahoo Finance, "+lastPrices.toLocaleTimeString("es-UY",{hour:"2-digit",minute:"2-digit",hour12:false})); if(lastHist)p.push("riesgo con históricos de 1 año"); const el_=$("dataStatus"); if(el_)el_.textContent=p.join(" · "); }
function setRefreshUI(on){ const b=$("btnRefresh"); if(b){b.disabled=on;b.textContent=on?"Actualizando…":"Actualizar precios";} }
async function refreshPrices(quiet){
  if(refreshing||!window.api)return; refreshing=true; setRefreshUI(true);
  try{
    const list=holdings.filter(priceable); const syms=[...new Set(list.map(ySym))];
    const curs=[...new Set(["UYU",...Object.keys(cfg.fx||{}),...holdings.map(h=>h.currency||"USD"),...holdings.map(h=>h.amountCurrency||"USD")])].filter(c=>c&&c!=="USD"&&/^[A-Z]{3}$/.test(c));
    const q=await window.api.quote([...syms,...curs.map(c=>c+"=X")]);
    const fx={...cfg.fx}; let fxCh=false;
    curs.forEach(c=>{const r=q[c+"=X"]; if(r&&r.ok&&r.price>0){fx[c]=+Number(r.price).toFixed(4);fxCh=true;}});
    if(fxCh){ cfg={...cfg,fx,fxDate:new Date().toLocaleDateString("es-UY"),fxSource:"Yahoo Finance"}; await db.doc("config/main").set(JSON.parse(JSON.stringify(cfg))); }
    let ok=0; const fail=[];
    for(const h of list){
      const r=q[ySym(h)]; if(!r||!r.ok||!(r.price>0)){fail.push(h.ticker);continue;}
      const u=stripCalc(h); u.price=r.price; u.priceTime=r.time; u.priceDate=fmtTime(r.time); u.priceSource="Yahoo Finance";
      if(r.currency&&!(h.manualFields||[]).includes("f-cur")&&/^[A-Z]{3}$/.test(r.currency)) u.currency=r.currency;
      if(u.mode!=="qty"||u.pricePending){ const usdAmt=Number(u.amount)/fxOf(u.amountCurrency||"USD"); u.qty=+(usdAmt*fxOf(u.currency||"USD")/(u.price/(Number(u.pricePer)||1))).toFixed(6); u.mode="qty"; u.pricePending=false; }
      await db.collection("holdings").doc(h.id).set(u); ok++;
    }
    lastPrices=new Date(); setDataStatus();
    if(!quiet||fail.length) toast(fail.length?("Precios actualizados ("+ok+"). Sin datos: "+fail.join(", ")):("Precios actualizados ("+ok+")"));
  }catch(e){ toast("No se pudieron traer los precios. Revisá la conexión a internet."); }
  finally{ refreshing=false; setRefreshUI(false); }
}
/* históricos: volatilidad, beta y correlación */
function toRet(pts){ const m=new Map(); for(let i=1;i<pts.length;i++){ m.set(Math.floor(pts[i][0]/86400), Math.log(pts[i][1]/pts[i-1][1])); } return m; }
function pairs(a,b){ const out=[]; for(const [k,v] of a){ const w=b.get(k); if(w!==undefined) out.push([v,w]); } return out; }
function statsPairs(pr){ const n=pr.length; let mx=0,my=0; pr.forEach(([x,y])=>{mx+=x;my+=y;}); mx/=n; my/=n; let sxy=0,sxx=0,syy=0; pr.forEach(([x,y])=>{sxy+=(x-mx)*(y-my);sxx+=(x-mx)**2;syy+=(y-my)**2;}); return {cov:sxy/(n-1),vx:sxx/(n-1),vy:syy/(n-1)}; }
function empCorr(a,b){ const k=a<b?a+"|"+b:b+"|"+a; if(corrCache.has(k))return corrCache.get(k); const pr=(HIST[a]&&HIST[b])?pairs(HIST[a],HIST[b]):[]; let c=0; if(pr.length>40){const s=statsPairs(pr); c=(s.vx>0&&s.vy>0)?s.cov/Math.sqrt(s.vx*s.vy):0;} corrCache.set(k,c); return c; }
async function refreshHistory(){
  if(!window.api)return; const list=holdings.filter(priceable); if(!list.length)return;
  try{
    const syms=[...new Set([...list.map(ySym),"SPY"])];
    const r=await window.api.history(syms,"1y");
    const spy=r.SPY&&r.SPY.ok&&r.SPY.points.length>60?toRet(r.SPY.points):null;
    for(const h of list){
      const x=r[ySym(h)]; if(!x||!x.ok||x.points.length<60){ delete HIST[h.id]; continue; }
      const m=toRet(x.points); HIST[h.id]=m;
      const vals=[...m.values()]; const mean=vals.reduce((a,b)=>a+b,0)/vals.length;
      const sd=Math.sqrt(vals.reduce((a,b)=>a+(b-mean)**2,0)/(vals.length-1))*Math.sqrt(252);
      let beta=Number(h.beta); if(spy){ const pr=pairs(m,spy); if(pr.length>60){ const s=statsPairs(pr); beta=s.vy>0?s.cov/s.vy:beta; } }
      const man=h.manualFields||[]; const u=stripCalc(h);
      if(!man.includes("f-vol")) u.vol=+sd.toFixed(4); if(!man.includes("f-beta")&&Number.isFinite(beta)) u.beta=+beta.toFixed(3);
      u.riskSource="histórico 1 año (Yahoo Finance)"; u.riskDate=new Date().toLocaleDateString("es-UY");
      if(u.vol!==h.vol||u.beta!==h.beta||u.riskSource!==h.riskSource) await db.collection("holdings").doc(h.id).set(u);
    }
    corrCache.clear(); lastHist=new Date(); setDataStatus(); render();
  }catch(e){ toast("No se pudieron traer los históricos; el riesgo usa el modelo."); }
}
async function refreshAll(quiet){ await refreshPrices(quiet); await refreshHistory(); }
