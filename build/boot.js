/* ---------- almacenamiento local (app de escritorio) ---------- */
let STORE={holdings:{},config:null};
const LIS={h:[],c:[]};
const snapH=()=>({docs:Object.values(STORE.holdings).map(d=>({id:d.id,exists:true,data:()=>d})),metadata:{fromCache:false,hasPendingWrites:false}});
const snapC=()=>({exists:!!STORE.config,data:()=>STORE.config||undefined,metadata:{fromCache:false,hasPendingWrites:false}});
let saveT=null;
function persist(){ clearTimeout(saveT); saveT=setTimeout(()=>{ window.api.save(STORE).catch(()=>toast("No se pudo guardar en el disco")); },120); }
const emitH=()=>{const s=snapH();LIS.h.forEach(f=>f(s));}, emitC=()=>{const s=snapC();LIS.c.forEach(f=>f(s));};
const localDb={
  collection:()=>({ onSnapshot:(n)=>{LIS.h.push(n);setTimeout(()=>n(snapH()),0);return()=>{};},
    doc:(id)=>({ set:async(d)=>{STORE.holdings[id]=JSON.parse(JSON.stringify({...d,id}));persist();emitH();},
                 delete:async()=>{delete STORE.holdings[id];persist();emitH();} }) }),
  doc:()=>({ onSnapshot:(n)=>{LIS.c.push(n);setTimeout(()=>n(snapC()),0);return()=>{};},
    set:async(d)=>{STORE.config=JSON.parse(JSON.stringify(d));persist();emitC();} })
};
$("btnRefresh").onclick=()=>refreshAll(false);
$("btnExport").onclick=async()=>{ try{ if(await window.api.exportData(STORE)) toast("Copia guardada"); }catch(e){ toast("No se pudo exportar"); } };
$("btnImport").onclick=async()=>{
  try{ const d=await window.api.importData(); if(!d)return;
    if(!d.holdings||typeof d.holdings!=="object"){ toast("El archivo no es una copia de Allocation"); return; }
    STORE={holdings:d.holdings,config:d.config||STORE.config}; persist(); emitH(); emitC(); toast("Cartera importada"); refreshAll(true);
  }catch(e){ toast("No se pudo importar el archivo"); }
};
(async()=>{
  if(!window.api){ setStatus("Esta versión funciona dentro de la app de escritorio.","warn"); loaded=true; render(); return; }
  try{ STORE=await window.api.load(); }catch(e){ STORE={holdings:{},config:null}; }
  STORE.holdings=STORE.holdings||{};
  db=localDb; canWrite=true;
  db.collection("holdings").onSnapshot(snap=>{
    holdings=snap.docs.map(x=>{const v=x.data()||{};return {...v,id:x.id,target:(v.target===null||v.target===undefined||v.target==="")?NaN:Number(v.target)};});
    loaded=true; setStatus(null); render();
  });
  db.doc("config/main").onSnapshot(snap=>{const v=snap.exists?snap.data():null;if(v)cfg={...structuredClone(DEFAULTS),...v,fx:{...DEFAULTS.fx,...(v.fx||{})},rho:{...DEFAULTS.rho,...(v.rho||{})},limits:{...DEFAULTS.limits,...(v.limits||{})}};render();});
  try{ const inf=await window.api.appInfo(); const f=document.createElement("p"); f.className="note"; f.textContent="Allocation para Mac · interfaz v"+inf.version+" ("+inf.source+")"+(inf.needsReinstall?" · Hay una versión nueva de la app que requiere reinstalar: pedísela a Claude.":""); document.querySelector(".wrap").append(f); if(inf.source==="actualizada desde GitHub") toast("Allocation se actualizó: "+(inf.notes||"versión "+inf.version)); }catch(e){}
  setTimeout(()=>{ holdings.filter(h=>h.classifyPending).forEach(h=>classify(h,h.manualFields||[])); refreshAll(true); },60);
})();
