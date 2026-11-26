function pnl(h){
  const c=Number(h.cost), p=Number(h.price), q=Number(h.qty);
  if(!(c>0)||!(p>0)||!(q>0)||h.mode==="amount") return null;
  const per=Number(h.pricePer)||1, fx=fxOf(h.currency||"USD");
  const usd=q*(p-c)/per/fx; return {usd,pct:p/c-1,costUsd:q*c/per/fx};
}
function openSheet(h){
  const root=$("sheetRoot");root.innerHTML="";
  const isNew=!h; const d=h?stripCalc(h):{ticker:"",name:"",vehicle:"Acción",assetClass:"rv",sector:"",region:"EE.UU.",currency:"USD",mode:"qty",qty:"",price:"",cost:"",target:null,vol:"",beta:"",note:""};
  const touched=new Set();
  const shade=el("div",{class:"shade"});shade.onclick=close;
  const s=el("div",{class:"sheet",role:"dialog","aria-modal":"true","aria-labelledby":"sh-title"});
  const hd=el("header");hd.append(el("h2",{id:"sh-title",style:"margin:0"},isNew?"Agregar activo":"Editar "+lbl(d)));const x=el("button",{class:"btn small","aria-label":"Cerrar"},"Cerrar");x.onclick=close;hd.append(x);
  const body=el("div",{class:"body"});
  const fld=(id,label,input,hint)=>{const f=el("div",{class:"field"});const lb=el("label",{for:id},label);f.append(lb,input);if(hint)f.append(el("span",{class:"hint"},hint));f._label=lb;return f;};
  const inp=(id,val,attrs={})=>{const i=el("input",{id,class:"inp"+(attrs.n?" n":""),value:val==null?"":String(val),...(attrs.type?{type:attrs.type}:{}),...(attrs.step?{step:attrs.step}:{}),...(attrs.list?{list:attrs.list}:{}),...(attrs.ph?{placeholder:attrs.ph}:{}),...(attrs.mode?{inputmode:attrs.mode}:{}),autocomplete:"off"});i.addEventListener("input",()=>touched.add(id));return i;};
  const sel=(id,opts,val)=>{const s=el("select",{id,class:"inp"});opts.forEach(([k,l])=>{const o=el("option",{value:k},l);if(k===val)o.selected=true;s.append(o);});s.addEventListener("change",()=>touched.add(id));return s;};
  const isCashT=t=>CURRENCIES.includes(String(t||"").trim().toUpperCase());
  /* principal: ticker + cantidad */
  const main=el("div",{class:"grid-f"});
  const fT=inp("f-ticker",d.ticker,{ph:"NVDA, SPY, BTC, USD, T 4 1/2 11/15/33…"});fT.style.textTransform="uppercase";
  if(!isNew)fT.disabled=true;
  const qtyVal=d.mode==="amount"?d.amount:d.qty;
  const fQty=inp("f-qty",qtyVal==null?"":qtyVal,{n:1,mode:"decimal",ph:"10"});
  const tHint=el("span",{class:"hint"},"Bonos: como los muestra IBKR (emisor cupón vencimiento) o ISIN");
  const tf=fld("f-ticker","Ticker",fT);tf.append(tHint);
  const qf=fld("f-qty","Cantidad de acciones",fQty,"");
  main.append(tf,qf);
  const second=el("div",{class:"grid-f"});
  const fCost=inp("f-cost",d.cost||"",{n:1,mode:"decimal",ph:"opcional"});
  const fBpx=inp("f-bpx",d.pricePer&&d.price?d.price:"",{n:1,mode:"decimal",ph:"98,50"});
  const cf=fld("f-cost","Precio de compra (opcional)",fCost,"Para ver la ganancia o pérdida");
  const bf=fld("f-bpx","Precio actual (% del nominal)",fBpx,"Yahoo no publica precios de bonos");
  second.append(cf,bf);
  body.append(main,second);
  function kind(){const t=fT.value.trim().toUpperCase();const b=parseBond(t);return isCashT(t)||d.assetClass==="cash"?"cash":(b||d.vehicle==="Bono")?"bond":"stock";}
  function sync(){
    const k=kind(); const b=parseBond(fT.value);
    qf._label.textContent=k==="cash"?"Monto":k==="bond"?"Valor nominal":"Cantidad de acciones / unidades";
    qf.querySelector(".hint").textContent=k==="cash"?"En la moneda del ticker (USD, UYU…)":k==="bond"?"Ej.: 10000 = US$ 10.000 nominales":"Las que compraste; el valor se calcula con el último precio";
    cf.hidden=k==="cash"; cf._label.textContent=k==="bond"?"Precio de compra (% del nominal, opcional)":"Precio de compra por acción (opcional)";
    bf.hidden=k!=="bond";
    tHint.textContent=b&&b.kind==="ibkr"?"Bono: "+bondName(BOND_ISSUERS[b.issuer]||b.issuer,b.coupon,b.maturity)+" · "+b.sector:b?"Código "+b.kind.toUpperCase()+": se buscará el bono":k==="cash"?"Efectivo":"Bonos: como los muestra IBKR (emisor cupón vencimiento) o ISIN";
  }
  qf.append(el("span",{class:"hint"},""));
  fT.addEventListener("input",sync);
  const info=el("p",{class:"small muted"});
  info.textContent=isNew?"Al agregar, la app busca el activo en Yahoo Finance (nombre, clase, sector, moneda), toma el último precio y calcula el valor de tu posición. Volatilidad y beta salen de su historia de precios.":(d.priceDate?"Último precio: "+fmt(Number(d.price),d.pricePer?3:2)+(d.pricePer?" %":" "+(d.currency||"USD"))+" ("+d.priceDate+(d.priceSource?", "+d.priceSource:"")+").":"Precio pendiente.");
  body.append(info);
  const fTgt=inp("f-tgt",Number.isFinite(d.target)?fmt1(d.target*100):"",{type:"number",step:"0.5",n:1,ph:"sin objetivo"});
  body.append(fld("f-tgt","Peso objetivo (%)",fTgt,"Opcional, para rebalancear"));
  /* detalles */
  const det=el("details");det.append(el("summary",{class:"small",style:"cursor:pointer;color:var(--muted)"},"Ajustar datos a mano"));
  const g1=el("div",{class:"grid-f",style:"margin-top:12px"});
  const fName=inp("f-name",d.name);
  const fVeh=sel("f-veh",VEHICLES.map(v=>[v,v]),d.vehicle);
  const fCls=sel("f-cls",Object.entries(CLASSES).map(([k,v])=>[k,v.label]),d.assetClass);
  const dl=el("datalist",{id:"sectors"});SECTORS.forEach(s=>dl.append(el("option",{value:s})));
  const fSec=inp("f-sec",d.sector,{list:"sectors"});
  const fReg=sel("f-reg",REGIONS.map(r=>[r,r]),d.region||"EE.UU.");
  const fCur=inp("f-cur",d.currency||"USD",{ph:"USD"});
  const fVol=inp("f-vol",d.vol!==""&&d.vol!=null?fmt1(Number(d.vol)*100):"",{type:"number",step:"0.5",n:1});
  const fBeta=inp("f-beta",d.beta??"",{type:"number",step:"0.05",n:1});
  const fPx=inp("f-px","",{type:"number",step:"any",n:1,ph:d.price&&!d.pricePer?String(d.price):""});
  g1.append(fld("f-name","Nombre",fName),fld("f-veh","Vehículo",fVeh),fld("f-cls","Clase de activo",fCls),fld("f-sec","Sector",fSec),fld("f-reg","Región",fReg),fld("f-cur","Moneda de cotización",fCur),fld("f-vol","Volatilidad anual (%)",fVol),fld("f-beta","Beta vs S&P 500",fBeta),fld("f-px","Precio fijo (en vez de Yahoo)",fPx,"Dejalo vacío para usar el último precio"));
  const fNote=el("textarea",{id:"f-note",class:"inp",rows:"2"});fNote.value=d.note||"";
  det.append(g1,dl,el("div",{style:"margin-top:12px"}));det.lastChild.append(fld("f-note","Nota",fNote));
  body.append(det);
  const err=el("p",{class:"small neg",role:"alert"});body.append(err);
  const ft=el("footer");const left=el("div",{class:"confirm"});const right=el("div",{class:"actions"});
  if(!isNew){const del=el("button",{class:"btn danger",type:"button"},"Borrar");del.onclick=()=>{left.innerHTML="";left.append(el("span",{},"¿Borrar "+lbl(d)+"?"));const y=el("button",{class:"btn danger small",type:"button"},"Sí, borrar");y.onclick=async()=>{y.disabled=true;try{await db.collection("holdings").doc(d.id).delete();toast(lbl(d)+" borrado");close();}catch(e){err.textContent=dbMsg(e);y.disabled=false;}};const n=el("button",{class:"btn small",type:"button"},"No");n.onclick=()=>{left.innerHTML="";left.append(del);};left.append(y,n);};left.append(del);}
  const cancel=el("button",{class:"btn",type:"button"},"Cancelar");cancel.onclick=close;
  const save=el("button",{class:"btn primary",type:"button"},isNew?"Agregar":"Guardar");
  right.append(cancel,save);ft.append(left,right);
  s.append(hd,body,ft);root.append(shade,s);sync();(isNew?fT:fQty).focus();
  [fT,fQty,fCost,fBpx].forEach(i=>i.addEventListener("keydown",e=>{if(e.key==="Enter")save.click();}));
  save.onclick=async()=>{
    err.textContent="";const tk=fT.value.trim().toUpperCase();
    if(!tk){err.textContent="Escribí el ticker.";fT.focus();return;}
    const k=kind();
    const q=numIn(fQty.value);
    if(q===null||q<=0){err.textContent=k==="cash"?"Escribí el monto.":k==="bond"?"Escribí el valor nominal.":"Escribí la cantidad de acciones.";fQty.focus();return;}
    const tg=numF(fTgt.value), cost=numIn(fCost.value), bpx=numIn(fBpx.value);
    const o={...d,ticker:tk,name:fName.value.trim(),vehicle:fVeh.value,assetClass:fCls.value,sector:fSec.value.trim(),region:fReg.value,currency:(fCur.value.trim().toUpperCase()||"USD").slice(0,4),
      vol:numF(fVol.value)!==null?numF(fVol.value)/100:null,beta:numF(fBeta.value),target:tg!==null?clamp(tg,0,100)/100:null,note:fNote.value.trim(),cost:cost!==null&&cost>0?cost:null};
    if(k==="cash"){ o.mode="amount"; o.amount=q; o.qty=null; o.amountCurrency=isCashT(tk)?tk:(o.amountCurrency||o.currency||"USD"); o.pricePending=false; }
    else { o.mode="qty"; o.qty=q; if(!(Number(o.price)>0)) o.pricePending=true; }
    const manual=[...touched].filter(x=>!["f-ticker","f-qty","f-tgt","f-note","f-px","f-cost","f-bpx"].includes(x));
    const bd=isNew?parseBond(tk):null;
    if(bd&&bd.kind==="ibkr"){Object.assign(o,{vehicle:"Bono",assetClass:"rf",sector:bd.sector,region:bd.region,currency:"USD",issuer:bd.issuer,coupon:bd.coupon,maturity:bd.maturity,pricePer:100,vol:o.vol??bd.vol,beta:o.beta??bd.beta,name:o.name||bondName(BOND_ISSUERS[bd.issuer]||bd.issuer,bd.coupon,bd.maturity)});}
    else if(bd){Object.assign(o,{vehicle:"Bono",assetClass:"rf",pricePer:100});}
    if(k==="bond"&&bpx!==null&&bpx>0){o.price=bpx;o.pricePer=100;o.priceDate=new Date().toLocaleDateString("es-UY");o.priceSource="manual";o.priceManual=true;o.pricePending=false;}
    const pxIn=numF(fPx.value);
    if(k==="stock"&&pxIn!==null&&pxIn>0){o.price=pxIn;o.priceDate=new Date().toLocaleDateString("es-UY");o.priceSource="manual";o.priceManual=true;o.pricePending=false;}
    else if(k==="stock"&&!isNew&&fPx.value.trim()===""&&d.priceManual&&touched.has("f-px")){o.priceManual=false;}
    if(isNew){o.id=slug(tk);if(holdings.some(x=>x.id===o.id)){err.textContent=tk+" ya está en la cartera: editalo desde la tabla.";return;}o.riskSource=manual.length?"manual":"pendiente";o.classifyPending=!manual.length;o.manualFields=manual;}
    delete o.example;
    save.disabled=true;
    const ok=await saveHolding(o);save.disabled=false;
    if(!ok){err.textContent="No se pudo guardar. Intentá de nuevo.";return;}
    close();
    if(isNew&&o.classifyPending){toast("Agregado. Buscando "+tk+" en Yahoo Finance…");classify(o,manual);}else{toast(isNew?lbl(o)+" agregado":lbl(o)+" guardado");refreshAll(true);}
  };
  function close(){sheetCtl?.abort();root.innerHTML="";document.removeEventListener("keydown",esc);}
  function esc(e){if(e.key==="Escape")close();}
  document.addEventListener("keydown",esc);
}
