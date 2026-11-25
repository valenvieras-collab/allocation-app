import re,sys
src=open('/mnt/user-data/outputs/allocation.html').read()
s=src
def rep(a,b,count=1):
    global s
    n=s.count(a)
    assert n==count,(a[:80],n); s=s.replace(a,b)

# --- header buttons + price status
rep('''      <button class="btn" id="btnAsk" hidden>Pedir lectura a Claude</button>
      <button class="btn primary" id="btnAdd" hidden>Agregar activo</button>''',
'''      <button class="btn" id="btnAsk" hidden>Pedir lectura a Claude</button>
      <button class="btn" id="btnImport" title="Importar una copia de la cartera">Importar</button>
      <button class="btn" id="btnExport" title="Guardar una copia de la cartera">Exportar</button>
      <button class="btn" id="btnRefresh">Actualizar precios</button>
      <button class="btn primary" id="btnAdd" hidden>Agregar activo</button>''')
rep('''<p class="sub" id="subtitle">Cartera en US$ · diagnóstico, riesgo y rebalanceo</p>''',
'''<p class="sub" id="subtitle">Cartera en US$ · diagnóstico, riesgo y rebalanceo</p>
      <p class="sub small" id="dataStatus" style="margin-top:2px"></p>''')
rep('''<div class="status" id="status">Conectando con la cartera guardada…</div>''','''<div class="status" id="status">Abriendo la cartera…</div>''')
rep('''Volatilidades, betas y correlaciones son estimaciones con un modelo de un factor (mercado accionario de EE.UU.) más correlación por sector o clase; no salen de precios históricos. Los precios se actualizan a mano o con /allocation. Herramienta de análisis, no una recomendación de inversión.''',
'''Precios, volatilidad, beta y correlaciones salen de Yahoo Finance: cotización actual y precios diarios de un año (beta contra SPY). Bonos y efectivo, que no tienen historia en Yahoo, usan un modelo de un factor. Herramienta de análisis, no una recomendación de inversión.''')

# --- cartera notes
rep('''  if(pend.length) notes.push("Sin precio del día todavía: "+pend.join(", ")+". Corré /allocation en el chat para traer el precio de la sesión y calcular la cantidad; mientras tanto cuentan por el monto cargado.");
  notes.push("Los precios se actualizan al cierre de cada sesión con /allocation. Valores en otras monedas se convierten con el tipo de cambio de la pestaña Riesgo.");''',
'''  if(pend.length) notes.push("Sin precio todavía: "+pend.join(", ")+". Los bonos no cotizan en Yahoo Finance: cargá su precio (en % del nominal) con Editar → Ajustar datos a mano. Mientras tanto cuentan por el monto cargado.");
  notes.push("Los precios se actualizan al abrir la app y con «Actualizar precios». Valores en otras monedas se convierten con el tipo de cambio de la pestaña Riesgo, que también se actualiza solo.");''')
rep('''"Modelo: cada activo se mueve con el mercado según su beta, y los activos del mismo sector o clase comparten además una parte de su riesgo propio (correlación residual editable abajo). Muestra hasta 16 posiciones, sin efectivo."''',
'''(R.nHist>=2?"Correlación histórica de retornos diarios de un año entre los activos con datos de Yahoo Finance; para bonos y activos sin historia, modelo de un factor con correlación residual (editable abajo). ":"Modelo: cada activo se mueve con el mercado según su beta y los del mismo sector o clase comparten parte de su riesgo propio. ")+"Muestra hasta 16 posiciones, sin efectivo."''')

# --- risk: empirical correlation
rep('''    let c=b[i]*b[j]*sm*sm;
    if(i===j) c+=e[i]*e[i]; else if(g[i]===g[j]) c+=rg[i]*e[i]*e[j];''',
'''    let c;
    if(hh[i]&&hh[j]){ c = i===j ? s[i]*s[i] : empCorr(list[i].id,list[j].id)*s[i]*s[j]; }
    else { c=b[i]*b[j]*sm*sm; if(i===j) c+=e[i]*e[i]; else if(g[i]===g[j]) c+=rg[i]*e[i]*e[j]; }''')
rep('''  const C=[];''','''  const hh=list.map(h=>!!HIST[h.id]&&Number(h.vol)>0);
  const C=[];''')
rep('''return {sigP,betaP,rc,corr,sdModel,''','''return {nHist:hh.filter(Boolean).length,sigP,betaP,rc,corr,sdModel,''')

# --- sheet info + manual price field
rep('''  info.textContent=isNew?(sample?"Al agregar, Claude completa nombre, clase, sector, región, moneda, volatilidad y beta. El precio del día y la cantidad equivalente llegan cuando corrés /allocation en el chat.":"Al agregar se guarda el monto. Los datos del activo y el precio del día se completan cuando corrés /allocation en el chat."):(d.pricePending?"Precio pendiente: se completa la próxima vez que corras /allocation.":d.priceDate?"Último precio: "+fmt(Number(d.price),2)+" "+(d.currency||"USD")+" ("+d.priceDate+").":"");''',
'''  info.textContent=isNew?"Al agregar, la app busca el activo en Yahoo Finance: nombre, clase, sector, moneda y precio actual, y calcula volatilidad y beta con su historia de un año. Bonos: el precio se carga a mano en «Ajustar datos a mano».":(d.pricePending?"Precio pendiente: se completa al actualizar precios (bonos: cargalo abajo, en % del nominal).":d.priceDate?"Último precio: "+fmt(Number(d.price),d.pricePer?3:2)+(d.pricePer?" %":" "+(d.currency||"USD"))+" ("+d.priceDate+(d.priceSource?", "+d.priceSource:"")+").":"");''')
rep('''  const fNote=el("textarea",{id:"f-note",class:"inp",rows:"2"});fNote.value=d.note||"";''',
'''  const fPx=inp("f-px","",{type:"number",step:"any",n:1,ph:d.price?String(d.price):""});
  g1.append(fld("f-px",d.pricePer||parseBond(d.ticker)?"Precio (% del nominal)":"Precio manual",fPx,"Solo si querés fijarlo a mano"));
  const fNote=el("textarea",{id:"f-note",class:"inp",rows:"2"});fNote.value=d.note||"";''')
rep('''    const manual=[...touched].filter(k=>!["f-ticker","f-amt","f-tgt","f-note"].includes(k));''',
'''    const manual=[...touched].filter(k=>!["f-ticker","f-amt","f-tgt","f-note","f-px"].includes(k));''')
rep('''o.classifyPending=!!sample&&!manual.length;o.manualFields=manual;}''',
'''o.classifyPending=!manual.length;o.manualFields=manual;}
    const pxIn=numF(fPx.value);
    if(pxIn!==null&&pxIn>0){o.price=pxIn;o.priceDate=new Date().toLocaleDateString("es-UY");o.priceSource="manual";o.priceManual=true;
      if(o.mode==="amount"&&o.assetClass!=="cash"){const usdAmt=Number(o.amount)/fxOf(o.amountCurrency||"USD");o.qty=usdAmt*fxOf(o.currency)/(pxIn/(Number(o.pricePer)||1));o.mode="qty";o.pricePending=false;}}''')
rep('''    if(isNew&&sample){toast("Agregado. Completando datos de "+tk+"…");classify(o,manual);}else toast(isNew?tk+" agregado":tk+" guardado");''',
'''    if(isNew&&o.classifyPending){toast("Agregado. Buscando "+tk+" en Yahoo Finance…");classify(o,manual);}else{toast(isNew?tk+" agregado":tk+" guardado");if(isNew)refreshAll();}''')

# --- replace classify section
a=s.index("/* ---------- auto-fill with Claude ---------- */"); b=s.index("/* ---------- writes ---------- */")
s=s[:a]+open('/home/claude/allocation-app/build/classify.js').read()+"\n"+s[b:]

# --- replace boot
a=s.index("(async()=>{\n  if(!window.claude||!window.claude.use)"); b=s.rindex("})();\n})();")
s=s[:a]+open('/home/claude/allocation-app/build/boot.js').read()+"\n"+s[b+len("})();\n"):]

rep('''["Volatilidad est.", list.length?pct(R.sigP,1):"—", "anual, modelo"]''','''["Volatilidad", list.length?pct(R.sigP,1):"—", R.nHist>=2?"anual, histórico 1 año":"anual, modelo"]''')
rep('''["Volatilidad anual estimada",pct(R.sigP,1),"desvío estándar del modelo"]''','''["Volatilidad anual",pct(R.sigP,1),R.nHist>=2?"con correlaciones históricas de 1 año":"desvío estándar del modelo"]''')
rep('''"Correlación estimada entre posiciones"''','''R.nHist>=2?"Correlación entre posiciones (1 año, diaria)":"Correlación estimada entre posiciones"''')
doc='''<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; img-src 'self' data:">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>[hidden]{display:none!important}</style>
</head><body>
'''+s+'''
</body></html>'''
open('/home/claude/allocation-app/renderer/index.html','w').write(doc)
print("ok", len(doc))
