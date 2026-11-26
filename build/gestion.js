/* ================= GESTIÓN DE CARTERAS (PEIF) ================= */
const TD=252;
const RANGES={"1y":"1 año","2y":"2 años","3y":"3 años","5y":"5 años"};
function rangeTxt(){return RANGES[cfg.histRange||"1y"]||"1 año";}
function rfRate(){const x=Number(cfg.rf);return Number.isFinite(x)?x:0.04;}
function erpRate(){const x=Number(cfg.erp);return Number.isFinite(x)?x:0.045;}
function aversion(){const x=Number(cfg.A);return x>0?x:3;}
const mean=a=>a.reduce((s,x)=>s+x,0)/(a.length||1);
function covA(a,b){const ma=mean(a),mb=mean(b);let s=0;for(let i=0;i<a.length;i++)s+=(a[i]-ma)*(b[i]-mb);return s/((a.length-1)||1);}
const varA=a=>covA(a,a), sdA=a=>Math.sqrt(Math.max(varA(a),0));
function alignMaps(maps){
  if(!maps.length||maps.some(m=>!m))return {days:[],cols:[]};
  const days=[...maps[0].keys()].filter(k=>maps.every(m=>m.has(k))).sort((a,b)=>a-b);
  return {days,cols:maps.map(m=>days.map(d=>m.get(d)))};
}
function histAssets(list){return list.filter(h=>HIST[h.id]&&h.assetClass!=="cash"&&h.w>0);}
function pctS(x,d=1){return Number.isFinite(x)?(x>0?"+":"")+fmt(x*100,d)+" %":"—";}
function panel(title,sub){const p=el("div",{class:"panel"});if(title)p.append(el("h2",{},title));if(sub)p.append(el("p",{class:"small muted",style:"margin:-6px 0 12px"},sub));return p;}
function metricGrid(items,cols){const g=el("div",{class:"metric-list",style:cols?"grid-template-columns:repeat("+cols+",minmax(0,1fr))":""});items.forEach(([l,v,s,cls])=>{const m=el("div",{class:"metric"});m.append(el("div",{class:"l"},l));const vv=el("div",{class:"v"+(cls?" "+cls:"")},v);m.append(vv);if(s)m.append(el("div",{class:"s"},s));g.append(m);});return g;}
function needHist(v,txt){const p=panel(null);p.append(el("p",{class:"muted"},txt||"Hace falta la historia de precios de al menos dos activos. Se descarga al abrir la app o con «Actualizar precios»."));v.append(p);}

/* ---------- gráfico XY en SVG ---------- */
function plotXY(o){
  const W=o.w||720,H=o.h||360,L=58,R=18,T=16,B=40,ns="http://www.w3.org/2000/svg";
  const mk=(t,a)=>{const e=document.createElementNS(ns,t);for(const k in a)e.setAttribute(k,a[k]);return e;};
  const svg=mk("svg",{viewBox:`0 0 ${W} ${H}`,width:"100%",role:"img","aria-label":o.label||"Gráfico"});
  let xs=[],ys=[];(o.layers||[]).forEach(l=>(l.pts||[]).forEach(p=>{xs.push(p[0]);ys.push(p[1]);}));
  if(o.xmin!==undefined)xs.push(o.xmin);if(o.ymin!==undefined)ys.push(o.ymin);
  let x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  if(!(x1>x0)){x1=x0+1;} if(!(y1>y0)){y1=y0+1;}
  const px=(x1-x0)*0.06,py=(y1-y0)*0.08;x0-=o.xmin!==undefined?0:px;x1+=px;y0-=py;y1+=py;
  const X=v=>L+(W-L-R)*(v-x0)/(x1-x0),Y=v=>T+(H-T-B)*(1-(v-y0)/(y1-y0));
  const tick=(a,b,n)=>{const st=(b-a)/n;const p=Math.pow(10,Math.floor(Math.log10(st)));const m=[1,2,2.5,5,10].find(m=>m*p>=st)*p;const out=[];for(let v=Math.ceil(a/m)*m;v<=b+1e-12;v+=m)out.push(+v.toFixed(10));return out;};
  tick(y0,y1,5).forEach(v=>{svg.append(mk("line",{x1:L,x2:W-R,y1:Y(v),y2:Y(v),stroke:"var(--line)","stroke-width":1}));const t=mk("text",{x:L-8,y:Y(v)+4,"text-anchor":"end",class:"ax"});t.textContent=(o.yfmt||String)(v);svg.append(t);});
  tick(x0,x1,6).forEach(v=>{const t=mk("text",{x:X(v),y:H-B+18,"text-anchor":"middle",class:"ax"});t.textContent=(o.xfmt||String)(v);svg.append(t);});
  if(o.xlabel){const t=mk("text",{x:(L+W-R)/2,y:H-4,"text-anchor":"middle",class:"ax"});t.textContent=o.xlabel;svg.append(t);}
  if(o.ylabel){const t=mk("text",{x:12,y:T+(H-T-B)/2,"text-anchor":"middle",class:"ax",transform:`rotate(-90 12 ${T+(H-T-B)/2})`});t.textContent=o.ylabel;svg.append(t);}
  if(o.zeroY&&y0<0&&y1>0)svg.append(mk("line",{x1:L,x2:W-R,y1:Y(0),y2:Y(0),stroke:"var(--faint)","stroke-width":1,"stroke-dasharray":"3 3"}));
  (o.layers||[]).forEach(l=>{
    if(l.type==="dots")l.pts.forEach(p=>svg.append(mk("circle",{cx:X(p[0]),cy:Y(p[1]),r:l.r||2,fill:l.color,opacity:l.opacity??0.35})));
    if(l.type==="line"&&l.pts.length>1){const d=l.pts.map((p,i)=>(i?"L":"M")+X(p[0]).toFixed(1)+" "+Y(p[1]).toFixed(1)).join(" ");svg.append(mk("path",{d,fill:"none",stroke:l.color,"stroke-width":l.width||2.2,"stroke-dasharray":l.dash||"",opacity:l.opacity??1}));}
    if(l.type==="marks")l.pts.forEach((p,i)=>{const lab=(l.labels||[])[i];svg.append(mk("circle",{cx:X(p[0]),cy:Y(p[1]),r:l.r||5,fill:l.fill||l.color,stroke:l.color,"stroke-width":2}));if(lab){const t=mk("text",{x:X(p[0])+8,y:Y(p[1])-7,class:"lab"});t.textContent=lab;t.setAttribute("style","fill:"+(l.labelColor||"var(--ink)"));svg.append(t);}});
  });
  const box=el("div",{class:"scroll"});box.append(svg);return box;
}
function legend(items){const lg=el("div",{class:"legend",style:"margin-top:6px"});items.forEach(([c,t,dash])=>{const s=el("span");const i=el("span",{class:"dot"});i.style.background=c;if(dash)i.style.borderRadius="2px";s.append(i,document.createTextNode(t));lg.append(s);});return lg;}

/* ---------- optimización (Markowitz, largo sin ventas en descubierto) ---------- */
function projSimplex(v){const u=[...v].sort((a,b)=>b-a);let css=0,th=0;for(let i=0;i<u.length;i++){css+=u[i];const t=(css-1)/(i+1);if(u[i]-t>0)th=t;}return v.map(x=>Math.max(x-th,0));}
function pVar(w,S){let s=0;for(let i=0;i<w.length;i++)for(let j=0;j<w.length;j++)s+=w[i]*w[j]*S[i][j];return s;}
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
function qp(S,mu,lam,w0){const n=S.length;let tr=0;for(let i=0;i<n;i++)tr+=S[i][i];const step=1/(2*tr+1e-12);let w=w0?[...w0]:Array(n).fill(1/n);
  for(let it=0;it<2500;it++){const g=S.map((row,i)=>2*dot(row,w)-lam*mu[i]);w=projSimplex(w.map((x,i)=>x-step*g[i]));}return w;}
let mkzCache={key:"",val:null};
function mkzData(list){
  const A=histAssets(list); if(A.length<2||!MKT) return null;
  const al=alignMaps([...A.map(h=>HIST[h.id]),MKT]); if(al.days.length<60) return null;
  const key=A.map(h=>h.id+":"+h.w.toFixed(4)).join("|")+"|"+(lastHist?+lastHist:0)+"|"+rfRate()+"|"+erpRate()+"|"+(cfg.muMode||"capm");
  if(mkzCache.key===key)return mkzCache.val;
  const n=A.length,R=al.cols.slice(0,n),M=al.cols[n];
  const S=R.map(a=>R.map(b=>covA(a,b)*TD));
  const vm=varA(M);const betas=R.map(r=>covA(r,M)/vm);
  const muHist=R.map(r=>mean(r)*TD),muCapm=betas.map(b=>rfRate()+b*erpRate());
  const mu=(cfg.muMode||"capm")==="hist"?muHist:muCapm;
  const sw=A.reduce((s,h)=>s+h.w,0);const wCur=A.map(h=>h.w/sw);
  const sig=w=>Math.sqrt(Math.max(pVar(w,S),0)), ret=w=>dot(w,mu);
  const wMin=qp(S,mu,0);
  const front=[];let prev=wMin;
  for(let k=0;k<44;k++){const lam=0.002*Math.pow(1.3,k);const w=qp(S,mu,lam,prev);prev=w;front.push({w,s:sig(w),r:ret(w)});}
  front.unshift({w:wMin,s:sig(wMin),r:ret(wMin)});
  const fr=front.filter((p,i)=>i===0||p.r>=front[0].r-1e-9).sort((a,b)=>a.s-b.s);
  const rf=rfRate();let tan=fr[0];fr.forEach(p=>{if((p.r-rf)/p.s>(tan.r-rf)/tan.s)tan=p;});
  const cloud=[];for(let k=0;k<1400;k++){let w=A.map(()=>-Math.log(Math.random()+1e-12));if(k%3===0)w=w.map(x=>Math.random()<0.5?0:x);const s0=w.reduce((a,b)=>a+b,0)||1;w=w.map(x=>x/s0);cloud.push([sig(w),ret(w)]);}
  const val={A,n,S,mu,muHist,muCapm,betas,wCur,days:al.days.length,cur:{w:wCur,s:sig(wCur),r:ret(wCur)},min:{w:wMin,s:sig(wMin),r:ret(wMin)},tan,front:fr,cloud,riskyShare:sw};
  mkzCache={key,val};return val;
}
function renderMkz(list,total){
  const v=$("v-mkz");v.innerHTML="";
  const ctr=panel(null);const f=el("div",{class:"row-fields"});
  const selF=(id,label,opts,val,on,hint)=>{const d=el("div",{class:"field"});d.append(el("label",{for:id},label));const s=el("select",{id,class:"inp"});opts.forEach(([k,l])=>{const o=el("option",{value:k},l);if(k===val)o.selected=true;s.append(o);});s.onchange=()=>on(s.value);d.append(s);if(hint)d.append(el("span",{class:"hint"},hint));return d;};
  const numF2=(id,label,val,on,hint,step)=>{const d=el("div",{class:"field"});d.append(el("label",{for:id},label));const i=el("input",{id,class:"inp n",type:"number",step:step||"0.1",value:val});i.onchange=()=>on(parseFloat(i.value));d.append(i);if(hint)d.append(el("span",{class:"hint"},hint));return d;};
  f.append(selF("mk-mu","Retornos esperados",[["capm","CAPM: rf + β × prima de mercado"],["hist","Históricos de la ventana"]],cfg.muMode||"capm",x=>saveCfg({muMode:x}),"Los históricos de 1 año son muy ruidosos"));
  f.append(selF("mk-rng","Ventana de datos",Object.entries(RANGES),cfg.histRange||"1y",x=>{saveCfg({histRange:x});refreshHistory();},"Retornos diarios"));
  f.append(numF2("mk-rf","Tasa libre de riesgo (%)",fmt1(rfRate()*100),x=>saveCfg({rf:x/100,rfManual:true}),cfg.rfManual?"Fijada a mano":"T-Bill 13 semanas"+(cfg.rfDate?", "+cfg.rfDate:"")));
  f.append(numF2("mk-erp","Prima de mercado (%)",fmt1(erpRate()*100),x=>saveCfg({erp:x/100}),"Para el CAPM"));
  f.append(numF2("mk-A","Aversión al riesgo (A)",String(aversion()),x=>saveCfg({A:clamp(x,0.5,15)}),"Suele estar entre 2 y 4","0.5"));
  ctr.append(f);v.append(ctr);
  const D=mkzData(list);
  if(!D){needHist(v,"Para la frontera eficiente hacen falta al menos dos activos con historia de precios (acciones, ETFs o cripto). Se descarga al abrir la app o con «Actualizar precios».");return;}
  const rf=rfRate(),Aav=aversion();
  // capital allocation
  const T=D.tan;const yStar=(T.r-rf)/(Aav*T.s*T.s);
  const cE=rf+yStar*(T.r-rf),cS=yStar*T.s;
  const y0=D.riskyShare;const curE=(1-y0)*rf+y0*D.cur.r,curS=y0*D.cur.s;
  const U=(e,s)=>e-0.5*Aav*s*s;
  const pc=panel("Frontera eficiente de Markowitz y CAL","Cartera riesgosa: los "+D.n+" activos con historia ("+D.days+" días). Sin ventas en descubierto. Puntos grises: combinaciones al azar de esos activos.");
  const maxS=Math.max(...D.front.map(p=>p.s),...D.mu.map((m,i)=>Math.sqrt(D.S[i][i])),D.cur.s)*1.05;
  const sr=(T.r-rf)/T.s;
  const layers=[
    {type:"dots",pts:D.cloud,color:"var(--faint)",opacity:0.28,r:1.8},
    {type:"line",pts:[[0,rf],[maxS,rf+sr*maxS]],color:"var(--c-rf)",dash:"6 5",width:1.8},
    {type:"line",pts:D.front.map(p=>[p.s,p.r]),color:"var(--accent)",width:2.6},
    {type:"marks",pts:D.A.map((h,i)=>[Math.sqrt(D.S[i][i]),D.mu[i]]),labels:D.A.map(h=>lblShort(h)),color:"var(--faint)",fill:"var(--panel)",r:3.5,labelColor:"var(--muted)"},
    {type:"marks",pts:[[0,rf]],labels:["Libre de riesgo"],color:"var(--c-rf)",r:4},
    {type:"marks",pts:[[D.min.s,D.min.r]],labels:["Mínima varianza"],color:"var(--c-cripto)",r:5},
    {type:"marks",pts:[[T.s,T.r]],labels:["Máximo Sharpe"],color:"var(--accent)",r:6},
    {type:"marks",pts:[[D.cur.s,D.cur.r]],labels:["Tu cartera riesgosa"],color:"var(--bad)",r:6},
  ];
  if(yStar>0&&cS<=maxS)layers.push({type:"marks",pts:[[cS,cE]],labels:["Óptima con A = "+fmt(Aav,1)],color:"var(--good)",r:5});
  pc.append(plotXY({layers,xmin:0,xfmt:x=>fmt(x*100,0)+" %",yfmt:x=>fmt(x*100,0)+" %",xlabel:"Riesgo (desvío estándar anual)",ylabel:"Retorno esperado",label:"Frontera eficiente"}));
  pc.append(legend([["var(--accent)","Frontera eficiente"],["var(--c-rf)","CAL (Capital Allocation Line) por la cartera de máximo Sharpe"],["var(--bad)","Tu cartera riesgosa"],["var(--c-cripto)","Mínima varianza"],["var(--good)","Cartera completa óptima para tu A"]]));
  v.append(pc);
  const g=el("div",{class:"grid2",style:"margin-top:16px"});
  // weights table
  const pw=panel("Composición de las carteras","Pesos dentro de la cartera riesgosa (sin efectivo ni activos sin historia).");
  const t=el("table");const hr=el("tr");["Activo","E(r)","σ","Tu cartera","Mín. varianza","Máx. Sharpe"].forEach((x,i)=>hr.append(el("th",i?{class:"n"}:{},x)));t.append(hr);
  D.A.forEach((h,i)=>{const tr=el("tr");tr.append(el("td",{class:"tk"},lblShort(h)),el("td",{class:"n"},pct(D.mu[i],1)),el("td",{class:"n"},pct(Math.sqrt(D.S[i][i]),1)),el("td",{class:"n"},pct(D.cur.w[i],1)),el("td",{class:"n"},pct(D.min.w[i],1)),el("td",{class:"n",style:"font-weight:600"},pct(T.w[i],1)));t.append(tr);});
  [["Retorno esperado",x=>pct(x.r,1)],["Desvío estándar",x=>pct(x.s,1)],["Ratio de Sharpe",x=>fmt((x.r-rf)/x.s,2)]].forEach(([l,f])=>{const tr=el("tr");tr.append(el("td",{style:"font-weight:600"},l),el("td"),el("td"),el("td",{class:"n"},f(D.cur)),el("td",{class:"n"},f(D.min)),el("td",{class:"n",style:"font-weight:600"},f(T)));t.append(tr);});
  const sc=el("div",{class:"scroll"});sc.append(t);pw.append(sc);
  pw.append(el("p",{class:"note"},"La cartera de máximo Sharpe es la tangente entre la CAL y la frontera: la que más retorno extra paga por unidad de riesgo. Con retornos CAPM, las diferencias de retorno salen solo de las betas; con históricos, de lo que pasó en la ventana."));
  g.append(pw);
  // capital allocation
  const pa=panel("Activo libre de riesgo vs. cartera riesgosa","Teorema de separación: todos eligen la misma cartera riesgosa óptima; la aversión al riesgo decide cuánto poner en ella.");
  pa.append(metricGrid([
    ["Proporción óptima en la cartera riesgosa (y*)",pct(yStar,0),"y* = [E(rT) − rf] ÷ (A·σT²)"],
    ["En el activo libre de riesgo",pct(1-yStar,0),yStar>1?"negativo: implicaría endeudarse a rf":"T-Bills o money market"],
    ["Tu proporción actual en riesgo",pct(y0,0),"activos con historia sobre el total"],
    ["Sharpe: tuyo vs. máximo",fmt((D.cur.r-rf)/D.cur.s,2)+" vs "+fmt(sr,2),"pendiente de la CAL"],
    ["Utilidad de tu cartera completa",fmt(U(curE,curS)*100,2),"U = E(r) − ½·A·σ², en %"],
    ["Utilidad de la cartera completa óptima",fmt(U(cE,cS)*100,2),"con el mismo A = "+fmt(Aav,1)]
  ]));
  pa.append(el("p",{class:"note"},"Resultado del modelo con las estimaciones de esta ventana; los retornos esperados son inciertos y cambian mucho con los datos. Es una herramienta de análisis, no una recomendación."));
  g.append(pa);v.append(g);
}

/* ---------- modelo de un índice (Sharpe) ---------- */
function regress(y,x){const b=covA(y,x)/varA(x);const a=mean(y)-b*mean(x);const vy=varA(y),vx=varA(x);const r2=vy>0?b*b*vx/vy:0;const ve=Math.max(vy-b*b*vx,0);return {a,b,r2,vy,vx,ve};}
let sclSel=null;
function renderIdx(list,total){
  const v=$("v-idx");v.innerHTML="";
  const A=histAssets(list);
  if(!A.length||!MKT){needHist(v,"El modelo de un índice necesita la historia de precios de tus activos y del S&P 500 (SPY). Se descarga al abrir la app o con «Actualizar precios».");return;}
  const rfd=rfRate()/TD;
  const res=A.map(h=>{const al=alignMaps([HIST[h.id],MKT]);if(al.days.length<40)return null;const y=al.cols[0].map(r=>r-rfd),x=al.cols[1].map(r=>r-rfd);const g=regress(y,x);return {h,y,x,...g,days:al.days.length};}).filter(Boolean);
  const alP=alignMaps([...A.map(h=>HIST[h.id]),MKT]);const sw=A.reduce((s,h)=>s+h.w,0);
  let port=null;if(alP.days.length>=40){const n=A.length;const rp=alP.days.map((_,t)=>A.reduce((s,h,i)=>s+(h.w/sw)*alP.cols[i][t],0));const y=rp.map(r=>r-rfd),x=alP.cols[n].map(r=>r-rfd);port={...regress(y,x),y,x};}
  const sm=Math.sqrt(varA(res[0]?res[0].x:[0,0])*TD);
  const p=panel("Modelo de un índice de Sharpe: Rᵢ = αᵢ + βᵢ·R_M + eᵢ","Excesos de retorno diarios sobre la tasa libre de riesgo, contra el S&P 500 (SPY), ventana de "+rangeTxt()+". Riesgo total² = β²·σ_M² (sistemático) + σ²(e) (específico).");
  const t=el("table");const hr=el("tr");["Activo","Peso","α anual","β","R²","σ total","Sistemático","Específico","% sistemático"].forEach((x,i)=>hr.append(el("th",i?{class:"n"}:{},x)));t.append(hr);
  const row=(name,w,g,bold)=>{const tr=el("tr");if(bold)tr.style.fontWeight="600";const sT=Math.sqrt(g.vy*TD),sS=Math.abs(g.b)*Math.sqrt(g.vx*TD),sE=Math.sqrt(g.ve*TD);
    const bar=el("div",{class:"track",style:"width:90px;display:inline-block;vertical-align:middle;margin-right:6px"});const sp=el("span");sp.style.width=(g.r2*100)+"%";sp.style.background="var(--accent)";bar.append(sp);
    const pc_=el("td",{class:"n"});pc_.append(bar,document.createTextNode(pct(g.r2,0)));
    tr.append(el("td",{class:"tk"},name),el("td",{class:"n"},w),el("td",{class:"n "+(g.a>=0?"pos":"neg")},pctS(g.a*TD,1)),el("td",{class:"n"},fmt(g.b,2)),el("td",{class:"n"},fmt(g.r2,2)),el("td",{class:"n"},pct(sT,1)),el("td",{class:"n"},pct(sS,1)),el("td",{class:"n"},pct(sE,1)),pc_);t.append(tr);};
  res.forEach(r=>row(lblShort(r.h),pct(r.h.w,1),r));
  if(port)row("Tu cartera",pct(sw,0),port,true);
  const sc=el("div",{class:"scroll"});sc.append(t);p.append(sc);
  p.append(el("p",{class:"note"},"α positivo: en la ventana, el activo rindió más de lo que su β justificaba según el modelo (y negativo, menos). β mide la sensibilidad al mercado: más β, más agresivo. Un R² bajo indica mucho riesgo específico, que se puede diversificar; el sistemático no. En la cartera, el riesgo específico se diluye al combinar activos con correlación menor a 1."));
  v.append(p);
  // SCL
  const ps=panel("Línea característica del activo (SCL)","Cada punto es un día: exceso de retorno del mercado (eje horizontal) contra el del activo. La pendiente es β y el corte con el eje, α.");
  const ids=res.map(r=>r.h.id);if(!ids.includes(sclSel))sclSel=ids[0];
  const s=el("select",{id:"scl-sel",class:"inp",style:"max-width:260px;margin-bottom:8px"});res.forEach(r=>{const o=el("option",{value:r.h.id},lbl(r.h));if(r.h.id===sclSel)o.selected=true;s.append(o);});s.onchange=()=>{sclSel=s.value;renderIdx(rows().list,0);};
  ps.append(s);
  const r=res.find(x=>x.h.id===sclSel);
  if(r){const xs=r.x;const xmin=Math.min(...xs),xmax=Math.max(...xs);
    ps.append(plotXY({layers:[{type:"dots",pts:xs.map((x,i)=>[x,r.y[i]]),color:"var(--c-rv)",opacity:0.45,r:2.2},{type:"line",pts:[[xmin,r.a+r.b*xmin],[xmax,r.a+r.b*xmax]],color:"var(--accent)",width:2.4}],xfmt:x=>fmt(x*100,1)+" %",yfmt:x=>fmt(x*100,1)+" %",xlabel:"Exceso de retorno del S&P 500 (diario)",ylabel:lblShort(r.h),zeroY:true,h:320}));
    ps.append(el("p",{class:"small muted"},lbl(r.h)+": β = "+fmt(r.b,2)+" · α diario = "+fmt(r.a*100,3)+" % (≈ "+pctS(r.a*TD,1)+" anual) · R² = "+fmt(r.r2,2)+" · "+r.days+" días."));}
  v.append(ps);
}

/* ---------- performance ---------- */
function drawdown(rs){let v=1,pk=1,mdd=0;rs.forEach(r=>{v*=1+r;pk=Math.max(pk,v);mdd=Math.min(mdd,v/pk-1);});return mdd;}
function annRet(rs){const tot=rs.reduce((v,r)=>v*(1+r),1);return Math.pow(tot,TD/rs.length)-1;}
function renderPerf(list,total){
  const v=$("v-perf");v.innerHTML="";
  const top=panel(null);const f=el("div",{class:"row-fields"});
  const d=el("div",{class:"field"});d.append(el("label",{for:"pf-b"},"Benchmark"));const s=el("select",{id:"pf-b",class:"inp"});
  [["SPY","S&P 500 (SPY)"],["QQQ","Nasdaq 100 (QQQ)"],["ACWI","Acciones globales (ACWI)"],["AOR","Global 60/40 (AOR)"],["AOM","Global 40/60 (AOM)"],["AGG","Bonos EE.UU. (AGG)"]].forEach(([k,l])=>{const o=el("option",{value:k},l);if(k===(cfg.bench||"SPY"))o.selected=true;s.append(o);});
  s.onchange=()=>{saveCfg({bench:s.value});refreshHistory();};d.append(s);f.append(d);
  const d2=el("div",{class:"field"});d2.append(el("label",{},"Ventana"));d2.append(el("div",{class:"num",style:"padding:7px 0"},rangeTxt()+" · se cambia en Markowitz"));f.append(d2);
  top.append(f);v.append(top);
  // P&L by cost
  const withCost=list.filter(h=>pnl(h));
  if(withCost.length){
    const pp=panel("Resultado según tu precio de compra");const t=el("table");const hr=el("tr");["Activo","Invertido US$","Valor US$","Resultado US$","Rentabilidad"].forEach((x,i)=>hr.append(el("th",i?{class:"n"}:{},x)));t.append(hr);
    let inv=0,val=0;withCost.forEach(h=>{const pl=pnl(h);inv+=pl.costUsd;val+=h.value;const tr=el("tr");tr.append(el("td",{class:"tk"},lblShort(h)),el("td",{class:"n"},fmt(pl.costUsd,0)),el("td",{class:"n"},fmt(h.value,0)),el("td",{class:"n "+(pl.usd>=0?"pos":"neg")},(pl.usd>=0?"+":"−")+fmt(Math.abs(pl.usd),0)),el("td",{class:"n "+(pl.pct>=0?"pos":"neg")},pctS(pl.pct,1)));t.append(tr);});
    const tr=el("tr");tr.style.fontWeight="600";tr.append(el("td",{},"Total"),el("td",{class:"n"},fmt(inv,0)),el("td",{class:"n"},fmt(val,0)),el("td",{class:"n "+(val-inv>=0?"pos":"neg")},(val-inv>=0?"+":"−")+fmt(Math.abs(val-inv),0)),el("td",{class:"n "+(val>=inv?"pos":"neg")},pctS(val/inv-1,1)));t.append(tr);
    const sc=el("div",{class:"scroll"});sc.append(t);pp.append(sc);pp.append(el("p",{class:"note"},"Solo las posiciones con precio de compra cargado (Editar → Precio de compra)."));v.append(pp);
  }
  const A=histAssets(list);const cash=list.filter(h=>h.assetClass==="cash");
  if(!A.length||!BENCH){needHist(v,"La evaluación de performance necesita la historia de precios de tus activos y del benchmark. Se descarga al abrir la app o con «Actualizar precios».");return;}
  const al=alignMaps([...A.map(h=>HIST[h.id]),BENCH]);if(al.days.length<40){needHist(v);return;}
  const n=A.length;const wc=cash.reduce((s,h)=>s+h.w,0);const sw=A.reduce((s,h)=>s+h.w,0)+wc;
  const rp=al.days.map((_,t)=>A.reduce((s,h,i)=>s+(h.w/sw)*al.cols[i][t],0));const rb=al.cols[n];
  const rf=rfRate();const aP=annRet(rp),aB=annRet(rb),sP=sdA(rp)*Math.sqrt(TD),sB=sdA(rb)*Math.sqrt(TD);
  const beta=covA(rp,rb)/varA(rb);const te=sdA(rp.map((r,i)=>r-rb[i]))*Math.sqrt(TD);
  const jensen=aP-(rf+beta*(aB-rf));
  const bn=(cfg.bench||"SPY");
  const pm=panel("Evaluación de la performance","Tu cartera actual (pesos de hoy) mantenida durante "+rangeTxt()+" ("+al.days.length+" días), contra "+bn+". No es tu rendimiento real, que depende de cuándo compraste cada activo.");
  const t=el("table");const hr=el("tr");["Medida","Tu cartera",bn,"Qué mide"].forEach((x,i)=>hr.append(el("th",i&&i<3?{class:"n"}:{},x)));t.append(hr);
  const R_=(l,a,b,q,cls)=>{const tr=el("tr");tr.append(el("td",{style:"font-weight:600"},l),el("td",{class:"n "+(cls||"")},a),el("td",{class:"n"},b),el("td",{class:"small muted",style:"white-space:normal"},q));t.append(tr);};
  R_("Retorno anualizado",pctS(aP,1),pctS(aB,1),"Rendimiento compuesto de la ventana",aP>=aB?"pos":"neg");
  R_("Desvío estándar",pct(sP,1),pct(sB,1),"Riesgo total (volatilidad anual)");
  R_("Ratio de Sharpe",fmt((aP-rf)/sP,2),fmt((aB-rf)/sB,2),"Retorno sobre rf por unidad de riesgo total");
  R_("Ratio de Treynor",pct((aP-rf)/beta,1),pct(aB-rf,1),"Retorno sobre rf por unidad de β (riesgo sistemático)");
  R_("Beta",fmt(beta,2),"1,00","Sensibilidad al benchmark");
  R_("Alfa de Jensen",pctS(jensen,1),"—","Retorno por encima de lo que pide el CAPM: rf + β·(R_B − rf)",jensen>=0?"pos":"neg");
  R_("Tracking error",pct(te,1),"—","Desvío estándar de la diferencia con el benchmark");
  R_("Information ratio",fmt((aP-aB)/te,2),"—","Retorno activo por unidad de tracking error");
  R_("Máxima caída",pct(drawdown(rp),1),pct(drawdown(rb),1),"Peor caída desde un máximo");
  const sc=el("div",{class:"scroll"});sc.append(t);pm.append(sc);
  let vp=100,vb=100;const gp=[[0,100]],gb=[[0,100]];al.days.forEach((d,i)=>{vp*=1+rp[i];vb*=1+rb[i];gp.push([i+1,vp]);gb.push([i+1,vb]);});
  pm.append(el("h3",{style:"margin-top:16px"},"Evolución de US$ 100"));
  pm.append(plotXY({layers:[{type:"line",pts:gb,color:"var(--faint)",width:2},{type:"line",pts:gp,color:"var(--accent)",width:2.6}],xfmt:x=>{const d=al.days[Math.max(0,Math.min(al.days.length-1,Math.round(x)-1))];if(d===undefined)return "";const dt=new Date(d*86400000);return MES[dt.getUTCMonth()]+"-"+String(dt.getUTCFullYear()).slice(2);},yfmt:x=>fmt(x,0),h:300,label:"Evolución"}));
  pm.append(legend([["var(--accent)","Tu cartera"],["var(--faint)",bn]]));
  pm.append(el("p",{class:"note"},"Incluye el efectivo como retorno cero y excluye los activos sin historia en Yahoo (bonos). Tasa libre de riesgo: "+pct(rf,2)+"."));
  v.append(pm);
}

/* ---------- perfil del inversor, AA estratégico y rebalanceo ---------- */
const QUIZ=[
  {q:"¿Cuál es el horizonte de la inversión?",o:[["Corto, 1 a 3 años",1],["Mediano, 3 a 7 años",2.5],["Largo, más de 7 años",4]]},
  {q:"¿Cómo definirías tu experiencia como inversor?",o:[["Sin experiencia",1],["Algo de experiencia en bonos",2],["Experiencia en bonos y fondos",3],["Amplia experiencia; conozco cómo funcionan los mercados",4]]},
  {q:"¿Qué objetivo querés privilegiar?",o:[["Preservar el capital",1],["Obtener rentas",2],["Renta y crecimiento del capital",3],["Crecimiento del capital",4]]},
  {q:"¿Con cuál de estas inversiones (rango de un año) te sentirías más cómodo?",o:[["A: mejor +5 %, peor −2 %",1],["B: mejor +10 %, peor −5 %",1.75],["C: mejor +15 %, peor −10 %",2.5],["D: mejor +20 %, peor −15 %",3.25],["E: mejor +25 %, peor −20 %",4]]},
  {q:"Sobre las subas y bajas de corto plazo:",o:[["Es esencial minimizar el riesgo de que el valor baje",1],["Acepto alguna baja, pero prefiero mayoría conservadora",2],["Acepto caídas significativas por retornos considerables",3],["Maximizar el retorno de largo plazo aunque haya caídas drásticas",4]]},
  {q:"Tu cartera cae 20 %. ¿Cómo reaccionás?",o:[["Vendo y evito inversiones que puedan caer así",1],["Mantengo, pero evito ese tipo de inversiones a futuro",2],["No hago ajustes",3],["Compro más",4]]}
];
const PROFILES={
  Conservador:{A:4,aae:{rv:[15,25,35],rf:[50,60,75],cash:[5,10,20],cripto:[0,0,2],otros:[0,5,10]}},
  Moderado:{A:3,aae:{rv:[40,50,60],rf:[30,40,50],cash:[5,10,15],cripto:[0,0,5],otros:[0,0,5]}},
  Agresivo:{A:2,aae:{rv:[65,75,90],rf:[5,15,25],cash:[0,5,10],cripto:[0,5,10],otros:[0,0,10]}}
};
function profileOf(ans){const v=QUIZ.map((q,i)=>ans&&ans[i]!=null?q.o[ans[i]][1]:null);if(v.some(x=>x==null))return null;const sc=mean(v);return {score:sc,label:sc<2?"Conservador":sc<3?"Moderado":"Agresivo"};}
function renderPerfil(list,total){
  const v=$("v-perfil");v.innerHTML="";
  const g=el("div",{class:"grid2"});
  // cuestionario
  const pq=panel("Perfil de riesgo","Cuestionario del curso: tolerancia al riesgo y horizonte son los dos parámetros básicos para fijar la proporción entre renta fija, renta variable y activos monetarios.");
  const ans=(cfg.profile&&cfg.profile.answers)||[];
  QUIZ.forEach((q,i)=>{const f=el("div",{class:"field",style:"margin-bottom:10px"});f.append(el("label",{for:"qz-"+i},(i+1)+". "+q.q));const s=el("select",{id:"qz-"+i,class:"inp"});s.append(el("option",{value:""},"Elegí una opción"));q.o.forEach(([t],k)=>{const o=el("option",{value:String(k)},t);if(ans[i]===k)o.selected=true;s.append(o);});
    s.onchange=()=>{const a=[...ans];a[i]=s.value===""?null:Number(s.value);const pr=profileOf(a);saveCfg({profile:{answers:a,label:pr?pr.label:null,score:pr?pr.score:null}});};f.append(s);pq.append(f);});
  const pr=profileOf(ans);
  if(pr){const P=PROFILES[pr.label];const box=el("div",{class:"status",style:"margin-top:6px"});box.append(el("b",{},"Perfil "+pr.label),document.createTextNode(" (puntaje "+fmt(pr.score,2)+" de 4). Aversión al riesgo de referencia: A = "+P.A+"."));
    if(canWrite){const a1=el("div",{class:"actions"});const b1=el("button",{class:"btn small"},"Usar A = "+P.A+" en Markowitz");b1.onclick=()=>{saveCfg({A:P.A});};const b2=el("button",{class:"btn small"},"Cargar rangos del perfil "+pr.label);b2.onclick=()=>{saveCfg({aae:JSON.parse(JSON.stringify(P.aae)),aaeFrom:pr.label});};a1.append(b1,b2);box.append(a1);}pq.append(box);}
  else pq.append(el("p",{class:"small muted"},"Respondé todas las preguntas para ver el perfil."));
  pq.append(el("p",{class:"note"},"Los perfiles son intuitivos y orientativos; el horizonte también importa: a más plazo, menor volatilidad de los retornos anualizados."));
  g.append(pq);
  // AAE
  const pa=panel("Asset Allocation Estratégico","Se maneja con rangos, no con porcentajes estrictos: dentro del rango hay libertad para el asset allocation táctico.");
  const aae=cfg.aae||PROFILES.Moderado.aae;
  const cls=group(list,h=>h.assetClass);const cur=k=>(cls.find(c=>c[0]===k)||[0,0])[1];
  const t=el("table");const hr=el("tr");["Clase","Mín.","Objetivo","Máx.","Actual","Estado"].forEach((x,i)=>hr.append(el("th",i?{class:"n"}:{},x)));t.append(hr);
  let sumT=0;const outC=[];
  Object.keys(CLASSES).forEach(k=>{const r=aae[k]||[0,0,0];sumT+=r[1];const a=cur(k);const tr=el("tr");const c=el("td");c.append(classChip(k));tr.append(c);
    [0,1,2].forEach(j=>{const td=el("td",{class:"n"});if(canWrite){const i=el("input",{id:"aae-"+k+"-"+j,class:"inp n",style:"width:4.6em",type:"number",step:"1",min:"0",max:"100",value:String(r[j])});i.onchange=()=>{const nv=JSON.parse(JSON.stringify(aae));nv[k]=nv[k]||[0,0,0];nv[k][j]=clamp(parseFloat(i.value)||0,0,100);saveCfg({aae:nv});};td.append(i);}else td.textContent=r[j]+" %";tr.append(td);});
    tr.append(el("td",{class:"n",style:"font-weight:600"},pct(a,1)));
    const inR=a*100>=r[0]-1e-9&&a*100<=r[2]+1e-9;if(!inR)outC.push(CLASSES[k].label);
    const st=el("td",{class:"n"});st.append(el("span",{class:"dev-pill"+(inR?"":" out")},inR?"en rango":(a*100<r[0]?"bajo":"sobre")));tr.append(st);t.append(tr);});
  const sc=el("div",{class:"scroll"});sc.append(t);pa.append(sc);
  if(Math.abs(sumT-100)>0.5)pa.append(el("div",{class:"status warn",style:"margin-top:10px"},"Los objetivos suman "+fmt(sumT,0)+" %. Ajustalos para que sumen 100 %."));
  pa.append(el("p",{class:"small muted",style:"margin-top:10px"},outC.length?"Fuera de rango: "+outC.join(", ")+".":"Todas las clases están dentro de su rango."));
  if(canWrite&&list.length){const box=el("div",{class:"actions",style:"margin-top:8px"});const b=el("button",{class:"btn small"},"Llevar estos objetivos a Rebalanceo");
    b.onclick=()=>{box.innerHTML="";box.append(el("span",{class:"small",style:"align-self:center"},"Reemplaza los pesos objetivo de cada activo: el objetivo de la clase se reparte entre sus activos según su peso actual."));const y=el("button",{class:"btn small primary"},"Confirmar");const n=el("button",{class:"btn small"},"Cancelar");n.onclick=()=>renderPerfil(rows().list,0);
      y.onclick=async()=>{y.disabled=true;let miss=[];for(const k of Object.keys(CLASSES)){const hs=list.filter(h=>h.assetClass===k);const T=(aae[k]||[0,0,0])[1]/100;if(!hs.length){if(T>0)miss.push(CLASSES[k].label);continue;}const sw=hs.reduce((s,h)=>s+h.w,0);for(const h of hs){const tg=sw>0?T*h.w/sw:T/hs.length;await saveHolding({...stripCalc(h),target:+tg.toFixed(4)},true);}}
        toast(miss.length?"Objetivos cargados. Sin activos en: "+miss.join(", "):"Objetivos cargados en Rebalanceo");};box.append(y,n);};box.append(b);pa.append(box);}
  g.append(pa);v.append(g);
  // estrategia de rebalanceo
  const pr2=panel("Estrategia de rebalanceo","Monitoreo y feedback: rebalancear tiene costos (comisiones, impacto en precios, impuestos) y beneficios (control de riesgo, volver a la cartera óptima, disciplina).");
  const rb=cfg.rebal||{mode:"porcentaje",freq:12,last:""};
  const f=el("div",{class:"row-fields"});
  const mkSel=(id,label,opts,val,on)=>{const d=el("div",{class:"field"});d.append(el("label",{for:id},label));const s=el("select",{id,class:"inp"});opts.forEach(([k,l])=>{const o=el("option",{value:String(k)},l);if(String(k)===String(val))o.selected=true;s.append(o);});s.onchange=()=>on(s.value);s.disabled=!canWrite;d.append(s);return d;};
  f.append(mkSel("rb-mode","Estrategia",[["porcentaje","Por porcentaje (bandas)"],["calendario","Por calendario"],["mixto","Mixta"]],rb.mode,x=>saveCfg({rebal:{...rb,mode:x}})));
  f.append(mkSel("rb-freq","Frecuencia (calendario)",[[3,"Trimestral"],[6,"Semestral"],[12,"Anual"]],rb.freq,x=>saveCfg({rebal:{...rb,freq:Number(x)}})));
  const dd=el("div",{class:"field"});dd.append(el("label",{for:"rb-last"},"Último rebalanceo"));const di=el("input",{id:"rb-last",class:"inp",type:"date",value:rb.last||""});di.disabled=!canWrite;di.onchange=()=>saveCfg({rebal:{...rb,last:di.value}});dd.append(di);f.append(dd);
  const bd=el("div",{class:"field"});bd.append(el("label",{},"Banda por activo"));bd.append(el("div",{class:"num",style:"padding:7px 0"},fmt((Number(cfg.band)||0.05)*100,1)+" pp · se cambia en Rebalanceo"));f.append(bd);
  pr2.append(f);
  const band=Number(cfg.band)||0.05;const outPos=list.filter(h=>Number.isFinite(h.target)&&Math.abs(h.w-h.target)>band).map(h=>lblShort(h));
  let due=null;if(rb.last){const dt=new Date(rb.last+"T12:00:00");dt.setMonth(dt.getMonth()+Number(rb.freq||12));due=dt;}
  const calDue=due?new Date()>=due:true; const pctDue=outPos.length>0||outC.length>0;
  const verdict=rb.mode==="porcentaje"?pctDue:rb.mode==="calendario"?calDue:(calDue&&pctDue);
  const msg=el("div",{class:"status "+(verdict?"warn":""),style:"margin-top:12px"});
  msg.append(el("b",{},verdict?"Según tu estrategia, corresponde revisar el rebalanceo. ":"Según tu estrategia, no hace falta rebalancear todavía. "));
  const det=[];if(rb.mode!=="calendario")det.push(pctDue?("fuera de banda o de rango: "+[...outPos,...outC].join(", ")):"todo dentro de bandas y rangos");if(rb.mode!=="porcentaje")det.push(due?("fecha de calendario: "+due.toLocaleDateString("es-UY")):"sin fecha del último rebalanceo");
  msg.append(document.createTextNode(det.join(" · ")+"."));pr2.append(msg);
  if(canWrite){const b=el("button",{class:"btn small",style:"margin-top:8px"},"Marcar rebalanceo hecho hoy");b.onclick=()=>saveCfg({rebal:{...rb,last:new Date().toISOString().slice(0,10)}});pr2.append(b);}
  v.append(el("div",{style:"height:16px"}),pr2);
}

/* ---------- renta fija: TIR, duración y convexidad ---------- */
function bondCalc(h){
  const c=Number(h.coupon),P=Number(h.price);if(!(P>0)||!h.maturity||!Number.isFinite(c))return null;
  const mat=new Date(h.maturity+"T12:00:00"),now=new Date();if(!(mat>now))return null;
  const cfs=[];let d=new Date(mat);while(d>now){cfs.push((d-now)/31557600000);d=new Date(d);d.setMonth(d.getMonth()-6);}cfs.reverse();
  const cpn=c/2;const flows=cfs.map((t,i)=>[t,cpn+(i===cfs.length-1?100:0)]);
  const price=y=>flows.reduce((s,[t,f])=>s+f/Math.pow(1+y/2,2*t),0);
  const tLast=cfs.length?cfs[0]:0;const accrued=c>0?cpn*(1-tLast*2):0; // fracción del período corrido
  const target=P+Math.max(0,accrued);
  let lo=-0.5,hi=1.5;for(let i=0;i<200;i++){const m=(lo+hi)/2;if(price(m)>target)lo=m;else hi=m;}const y=(lo+hi)/2;
  const pv=flows.map(([t,f])=>[t,f/Math.pow(1+y/2,2*t)]);const Pm=pv.reduce((s,x)=>s+x[1],0);
  const mac=pv.reduce((s,[t,v])=>s+t*v,0)/Pm;const mod=mac/(1+y/2);
  const conv=pv.reduce((s,[t,v])=>s+v*t*(t+0.5),0)/(Pm*Math.pow(1+y/2,2));
  return {ytm:y,mac,mod,conv,years:cfs[cfs.length-1]||0};
}
function renderRF(list,total){
  const v=$("v-rfx");v.innerHTML="";
  const rfL=list.filter(h=>h.assetClass==="rf");
  if(!rfL.length){const p=panel("Renta fija");p.append(el("p",{class:"muted"},"No hay renta fija en la cartera. Agregá un bono con su símbolo de IBKR (por ejemplo T 4 1/2 11/15/33) y su precio en % del nominal, o un ETF de bonos, y acá vas a ver TIR, duración, convexidad y sensibilidad a las tasas."));v.append(p);return;}
  const items=rfL.map(h=>{const b=h.vehicle==="Bono"?bondCalc(h):null;const dm=b?b.mod:(Number(h.duration)>0?Number(h.duration):null);return {h,b,dm,mac:b?b.mac:dm,conv:b?b.conv:0};});
  const p=panel("Renta fija: TIR, duración y convexidad","Duración de Macaulay: vida media ponderada de los flujos. Modificada: variación porcentual del precio ante un cambio de 1 punto en la TIR. Cupones semestrales; precio limpio en % del nominal.");
  const t=el("table");const hr=el("tr");["Activo","Valor US$","Precio","TIR","Vencimiento","Macaulay","Modificada","Convexidad","DV01 US$"].forEach((x,i)=>hr.append(el("th",i?{class:"n"}:{},x)));t.append(hr);
  items.forEach(({h,b,dm,conv})=>{const tr=el("tr");tr.append(el("td",{class:"tk",title:h.ticker},lblShort(h)),el("td",{class:"n"},fmt(h.value,0)),el("td",{class:"n"},Number(h.price)>0?fmt(Number(h.price),h.pricePer?2:2)+(h.pricePer?" %":""):"—"),el("td",{class:"n"},b?pct(b.ytm,2):"—"),el("td",{class:"n"},h.maturity?isoToEs(h.maturity):"—"),el("td",{class:"n"},b?fmt(b.mac,2):"—"));
    const tdm=el("td",{class:"n"});if(b)tdm.textContent=fmt(b.mod,2);else if(canWrite){const i=el("input",{id:"dur-"+h.id,class:"inp n",style:"width:5em",type:"number",step:"0.1",placeholder:"cargar",value:Number(h.duration)>0?String(h.duration):""});i.onchange=()=>saveHolding({...stripCalc(h),duration:parseFloat(i.value)||null},true);tdm.append(i);}else tdm.textContent=dm?fmt(dm,2):"—";tr.append(tdm);
    tr.append(el("td",{class:"n"},b?fmt(b.conv,1):"—"),el("td",{class:"n"},dm?fmt(h.value*dm*0.0001,0):"—"));t.append(tr);});
  const sc=el("div",{class:"scroll"});sc.append(t);p.append(sc);
  const okI=items.filter(x=>x.dm&&x.h.value>0);const V=okI.reduce((s,x)=>s+x.h.value,0);
  const Dp=V>0?okI.reduce((s,x)=>s+x.h.value*x.dm,0)/V:null;const Mp=V>0?okI.reduce((s,x)=>s+x.h.value*(x.mac||x.dm),0)/V:null;const Cp=V>0?okI.reduce((s,x)=>s+x.h.value*x.conv,0)/V:0;
  p.append(el("p",{class:"note"},"Para ETFs de bonos cargá la duración modificada que publica el emisor (columna Modificada). Los bonos usan el precio que cargaste; no hay cotización automática."));
  v.append(p);
  if(Dp){
    const g=el("div",{class:"grid2",style:"margin-top:16px"});
    const ps=panel("Sensibilidad a la tasa de interés","ΔP/P ≈ −D_mod·Δy + ½·C·Δy². La convexidad hace que el precio suba más de lo que baja ante movimientos iguales de tasa.");
    ps.append(metricGrid([["Duración modificada de la renta fija",fmt(Dp,2),"ponderada por valor"],["DV01 total",usd(V*Dp*0.0001,0),"por cada punto básico"]]));
    const t2=el("table",{style:"margin-top:14px"});const h2=el("tr");["Cambio de tasa","Precio","US$"].forEach((x,i)=>h2.append(el("th",i?{class:"n"}:{},x)));t2.append(h2);
    [-200,-100,-50,50,100,200].forEach(bp=>{const dy=bp/10000;const ch=-Dp*dy+0.5*Cp*dy*dy;const tr=el("tr");tr.append(el("td",{},(bp>0?"+":"")+bp+" pb"),el("td",{class:"n "+(ch>=0?"pos":"neg")},pctS(ch,2)),el("td",{class:"n "+(ch>=0?"pos":"neg")},(ch>=0?"+":"−")+fmt(Math.abs(ch*V),0)));t2.append(tr);});
    const s2=el("div",{class:"scroll"});s2.append(t2);ps.append(s2);
    ps.append(el("p",{class:"note"},"Con expectativa de suba de tasas conviene menor duración; con expectativa de baja, mayor duración."));
    g.append(ps);
    const pi=panel("Inmunización","Con horizonte corto domina el riesgo de precio; con horizonte largo, el de reinversión. Cuando la duración coincide con el horizonte, los dos efectos se compensan.");
    const hz=Number(cfg.horizon)||null;const d=el("div",{class:"field",style:"max-width:220px"});d.append(el("label",{for:"rf-hz"},"Tu horizonte de inversión (años)"));const hi=el("input",{id:"rf-hz",class:"inp n",type:"number",step:"0.5",value:hz?String(hz):""});hi.onchange=()=>saveCfg({horizon:parseFloat(hi.value)||null});d.append(hi);pi.append(d);
    pi.append(metricGrid([["Duración de Macaulay de la renta fija",fmt(Mp,2)+" años",""],["Diferencia con tu horizonte",hz?fmt(Mp-hz,2)+" años":"—",hz?(Math.abs(Mp-hz)<0.5?"prácticamente inmunizada":Mp>hz?"más larga que el horizonte: expuesta a subas de tasa":"más corta que el horizonte: expuesta a reinversión a tasas menores"):"cargá tu horizonte"]]));
    g.append(pi);v.append(g);
  }
}
