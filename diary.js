/* Nexus Diário — quadro livre por página, sem chamadas à API financeira.
 * Coordenadas são armazenadas no mundo virtual; pan/zoom não alteram os objetos.
 * Persistência local por conta e dispositivo. Não depende do backend.
 */
(()=>{
"use strict";
const root=document.getElementById("diary");if(!root)return;
root.innerHTML="<div class=\"panel diary-library\"><div class=\"diary-library-head\"><h2>Diário infinito</h2><button id=\"diaryNew\" type=\"button\" class=\"primary small\">＋ Nova página</button></div><div id=\"diaryPages\" class=\"diary-pages\"></div><p id=\"diaryEmpty\" class=\"muted\">Crie uma página para começar.</p><small>Salvo apenas neste dispositivo.</small></div><div id=\"diaryEditor\" class=\"diary-editor\" hidden><div class=\"diary-toolbar\"><input id=\"diaryTitle\" maxlength=\"80\" placeholder=\"Título da página\"><div class=\"diary-tools\"><button type=\"button\" data-diary-tool=\"hand\">✋</button><button type=\"button\" data-diary-tool=\"pen\">✎</button><button type=\"button\" data-diary-tool=\"text\">T</button><button type=\"button\" data-diary-tool=\"rect\">▢</button><button type=\"button\" data-diary-tool=\"ellipse\">◯</button><button type=\"button\" data-diary-tool=\"arrow\">↗</button><button type=\"button\" data-diary-tool=\"line\">╱</button><input id=\"diaryColor\" type=\"color\" value=\"#f4e59d\"><input id=\"diarySize\" type=\"range\" min=\"1\" max=\"14\" value=\"3\"><button type=\"button\" id=\"diaryUndo\">↶</button></div><div class=\"diary-tools\"><button type=\"button\" id=\"diaryZoomOut\">−</button><span id=\"diaryZoomLabel\">100%</span><button type=\"button\" id=\"diaryZoomIn\">＋</button><button type=\"button\" id=\"diaryCenter\">⌖</button><button type=\"button\" id=\"diaryExport\">↓ PNG</button></div></div><div class=\"diary-paper\"><canvas id=\"diaryCanvas\"></canvas></div><small id=\"diarySaveStatus\">Salvo neste dispositivo · pinça para zoom · ✋ para mover</small></div>";
const q=s=>root.querySelector(s);
const canvas=q("#diaryCanvas"),ctx=canvas.getContext("2d");
const state={pages:[],id:null,tool:"pen",color:"#f4e59d",size:3,zoom:1,x:0,y:0,gesture:null,dirty:false};
let activeKey="",autosave=0;
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const scope=()=>{const id=typeof currentUser!=="undefined"&&currentUser?(currentUser.id||currentUser.email||currentUser.user_id):"guest";return "nexus-diary-v1:"+String(id)};
const current=()=>state.pages.find(p=>p.id===state.id);
function load(){
  const key=scope();if(key===activeKey)return;
  activeKey=key;state.pages=[];state.id=null;
  try{const value=JSON.parse(localStorage.getItem(key)||"[]");if(Array.isArray(value))state.pages=value.filter(p=>p&&typeof p.id==="string"&&Array.isArray(p.objects)).slice(0,120)}catch{}
  state.pages.forEach(p=>{p.objects=p.objects.slice(0,2500)});
  state.id=state.pages[0]?.id||null;
  list();
}
function save(){try{localStorage.setItem(activeKey,JSON.stringify(state.pages));q("#diarySaveStatus").textContent="Salvo neste dispositivo"}catch{q("#diarySaveStatus").textContent="Armazenamento cheio — exporte sua página"}}
function schedule(){q("#diarySaveStatus").textContent="Salvando…";clearTimeout(autosave);autosave=setTimeout(save,450)}
function list(){
  const host=q("#diaryPages");host.replaceChildren();
  state.pages.forEach(p=>{
    const button=document.createElement("button");button.type="button";button.className="diary-page-link"+(p.id===state.id?" active":"");
    button.textContent=p.title||"Sem título";button.addEventListener("click",()=>select(p.id));host.append(button);
  });
  q("#diaryEmpty").hidden=state.pages.length!==0;
}
function select(id){
  state.id=id;state.zoom=1;state.x=0;state.y=0;
  const p=current();q("#diaryEditor").hidden=!p;q("#diaryTitle").value=p?.title||"";
  list();resize();render();
}
function create(){
  load();const p={id:uid(),title:"Nova página",objects:[],created:Date.now()};
  state.pages.unshift(p);schedule();select(p.id);q("#diaryTitle").focus();q("#diaryTitle").select();
}
function resize(){
  const r=canvas.getBoundingClientRect();if(r.width<1||r.height<1)return;
  const dpr=Math.min(window.devicePixelRatio||1,2);
  canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);render();
}
function pt(e){const b=canvas.getBoundingClientRect();return{x:e.clientX-b.left,y:e.clientY-b.top}}
function world(p){return{x:(p.x-state.x)/state.zoom,y:(p.y-state.y)/state.zoom}}
function render(){
  const w=canvas.clientWidth,h=canvas.clientHeight;
  ctx.setTransform(canvas.width/Math.max(w,1),0,0,canvas.height/Math.max(h,1),0,0);
  ctx.fillStyle="#08090c";ctx.fillRect(0,0,w,h);
  ctx.save();ctx.translate(state.x,state.y);ctx.scale(state.zoom,state.zoom);
  const p=current();
  for(const o of p?.objects||[]){
    ctx.strokeStyle=o.color||"#f4e59d";ctx.fillStyle=o.color||"#f4e59d";ctx.lineWidth=o.size||3;ctx.lineCap="round";ctx.lineJoin="round";
    if(o.type==="pen"){if(!o.points?.length)continue;ctx.beginPath();ctx.moveTo(o.points[0].x,o.points[0].y);o.points.slice(1).forEach(t=>ctx.lineTo(t.x,t.y));if(o.points.length===1)ctx.lineTo(o.points[0].x+.1,o.points[0].y+.1);ctx.stroke()}
    else if(o.type==="text"){ctx.font="20px system-ui,sans-serif";String(o.text||"").split("\n").forEach((line,i)=>ctx.fillText(line,o.x,o.y+i*27))}
    else if(o.type==="rect"){ctx.strokeRect(o.x,o.y,o.w,o.h)}
    else if(o.type==="ellipse"){ctx.beginPath();ctx.ellipse(o.x+o.w/2,o.y+o.h/2,Math.max(1,Math.abs(o.w/2)),Math.max(1,Math.abs(o.h/2)),0,0,Math.PI*2);ctx.stroke()}
    else if(o.type==="arrow"||o.type==="line"){
      const x=o.x+o.w,y=o.y+o.h;ctx.beginPath();ctx.moveTo(o.x,o.y);ctx.lineTo(x,y);ctx.stroke();
      if(o.type==="arrow"){const a=Math.atan2(o.h,o.w),len=13;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-len*Math.cos(a-.48),y-len*Math.sin(a-.48));ctx.moveTo(x,y);ctx.lineTo(x-len*Math.cos(a+.48),y-len*Math.sin(a+.48));ctx.stroke()}
    }
  }
  ctx.restore();q("#diaryZoomLabel").textContent=Math.round(state.zoom*100)+"%";
}
function setZoom(v,origin){const old=state.zoom;const next=Math.max(.2,Math.min(5,v));const c=origin||{x:canvas.clientWidth/2,y:canvas.clientHeight/2};state.x=c.x-(c.x-state.x)*next/old;state.y=c.y-(c.y-state.y)*next/old;state.zoom=next;render()}
function tool(t){state.tool=t;root.querySelectorAll("[data-diary-tool]").forEach(b=>b.classList.toggle("active",b.dataset.diaryTool===t));canvas.style.cursor=t==="hand"?"grab":t==="text"?"text":"crosshair"}
root.addEventListener("click",e=>{const b=e.target.closest("[data-diary-tool]");if(b)tool(b.dataset.diaryTool)});
q("#diaryNew").addEventListener("click",create);
q("#diaryTitle").addEventListener("input",e=>{const p=current();if(!p)return;p.title=e.target.value.slice(0,80);list();schedule()});
q("#diaryColor").addEventListener("input",e=>state.color=e.target.value);
q("#diarySize").addEventListener("input",e=>state.size=Number(e.target.value));
q("#diaryZoomIn").addEventListener("click",()=>setZoom(state.zoom*1.25));
q("#diaryZoomOut").addEventListener("click",()=>setZoom(state.zoom/1.25));
q("#diaryCenter").addEventListener("click",()=>{state.zoom=1;state.x=0;state.y=0;render()});
q("#diaryUndo").addEventListener("click",()=>{const p=current();if(p?.objects.length){p.objects.pop();schedule();render()}});
q("#diaryExport").addEventListener("click",()=>{const p=current();if(!p)return;const a=document.createElement("a");a.download=(p.title||"diario").replace(/[^\wÀ-ÿ-]+/g,"_")+".png";a.href=canvas.toDataURL("image/png");a.click()});
canvas.addEventListener("wheel",e=>{e.preventDefault();const p=pt(e);setZoom(state.zoom*Math.exp(-e.deltaY*.0015),p)},{passive:false});
const pointers=new Map();
canvas.addEventListener("pointerdown",e=>{
  if(!current())return;
  canvas.setPointerCapture(e.pointerId);const local=pt(e);pointers.set(e.pointerId,local);
  if(pointers.size===2){state.gesture={mode:"pinch",distance:distance(),zoom:state.zoom,mid:midpoint()};return}
  if(state.tool==="text"){
    const value=prompt("Escreva sua anotação:");if(value?.trim()){const p=world(local);current().objects.push({type:"text",x:p.x,y:p.y,text:value.slice(0,1000),color:state.color});schedule();render()}return;
  }
  const p=world(local),obj=state.tool==="pen"?{type:"pen",points:[p],color:state.color,size:state.size}:{type:state.tool,x:p.x,y:p.y,w:0,h:0,color:state.color,size:state.size};
  if(state.tool!=="hand")current().objects.push(obj);
  state.gesture={mode:state.tool==="hand"?"pan":"draw",pointer:e.pointerId,start:local,origin:{x:state.x,y:state.y},obj};
  render();
});
function distance(){const a=[...pointers.values()];return Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)}
function midpoint(){const a=[...pointers.values()];return{x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2}}
canvas.addEventListener("pointermove",e=>{
  if(!pointers.has(e.pointerId))return;
  const p=pt(e);pointers.set(e.pointerId,p);const g=state.gesture;if(!g)return;
  if(pointers.size===2&&g.mode==="pinch"){setZoom(g.zoom*distance()/Math.max(g.distance,1),midpoint());return}
  if(g.pointer!==e.pointerId)return;
  if(g.mode==="pan"){state.x=g.origin.x+p.x-g.start.x;state.y=g.origin.y+p.y-g.start.y}
  if(g.mode==="draw"&&g.obj){const a=world(p);if(g.obj.type==="pen"){g.obj.points.push(a)}else{g.obj.w=a.x-g.obj.x;g.obj.h=a.y-g.obj.y}}
  render();
});
function end(e){if(!pointers.has(e.pointerId))return;pointers.delete(e.pointerId);if(state.gesture?.mode==="draw")schedule();state.gesture=null}
canvas.addEventListener("pointerup",end);canvas.addEventListener("pointercancel",end);
window.addEventListener("resize",()=>{if(root.classList.contains("active"))resize()});
window.NEXUS_DIARY={open(){load();list();requestAnimationFrame(resize)},create};
tool("pen");load();
})();
