const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const brl=v=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v)||0);
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const safeExternalUrl=v=>{
  try{
    const u=new URL(String(v||""),location.origin);
    return u.protocol==="https:"||u.protocol==="http:"?u.href:"#";
  }catch{return"#"}
};
const today=()=>new Date().toISOString().slice(0,10);
const monthNames=["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const structure=window.NEXUS_STRUCTURE||{pages:[]};
const pageLabels=Object.fromEntries((structure.pages||[]).map(p=>[
  p.id,
  [p.title||p.label||p.id,p.subtitle||""]
]));

function createConfiguredPage(page){
  if(document.getElementById(page.id))return;
  const section=document.createElement("section");
  section.id=page.id;
  section.className="page structure-page";
  const blocks=Array.isArray(page.blocks)&&page.blocks.length?page.blocks:[{
    eyebrow:(page.label||page.title||"NEXUS").toUpperCase(),
    title:page.title||page.label||"Nova página",
    text:page.subtitle||"Edite esta página em site-structure.js."
  }];
  section.innerHTML='<div class="structure-grid">'+blocks.map(block=>
    '<div class="panel reveal"><span class="ey">'+esc(block.eyebrow||"NEXUS")+'</span><h3>'+esc(block.title||"Bloco")+'</h3><p class="muted">'+esc(block.text||"")+'</p></div>'
  ).join("")+'</div>';
  document.querySelector("main.app").appendChild(section);
}

function buildSiteStructure(){
  const pages=structure.pages||[];
  pages.forEach(createConfiguredPage);

  const desktop=document.querySelector(".nav");
  const mobile=document.querySelector(".mobile-nav");

  if(desktop){
    desktop.innerHTML=pages.filter(p=>p.showDesktop!==false).map((p,i)=>
      '<button class="'+(i===0?"active":"")+'" data-page="'+esc(p.id)+'">'+esc(p.label||p.title||p.id)+'</button>'
    ).join("");
  }

  if(mobile){
    mobile.innerHTML=pages.filter(p=>p.showMobile!==false).map((p,i)=>
      '<button class="'+(i===0?"active":"")+'" data-page="'+esc(p.id)+'"><b>'+esc(p.icon||"•")+'</b><span>'+esc(p.mobileLabel||p.label||p.id)+'</span></button>'
    ).join("");
  }

  const crypto=(pages||[]).find(p=>p.id==="crypto");
  if(crypto?.subTabs?.length){
    crypto.subTabs.forEach(tab=>{
      const btn=document.querySelector('[data-crypto-tab="'+tab.id+'"]');
      if(btn)btn.textContent=tab.label;
    });
  }

  if(structure.brand){
    $$(".logo").forEach(el=>el.textContent=structure.brand.initial||"N");
  }
}

let rows=[];
let currentMode="Movimentação";
let historyFilter="Todos";
let pieChart=null,barChart=null;
let paymentTarget=null;
let editingId=null;
let goals=[];
let marketState={prices:{},fear:null,news:[]};

function toast(text){
  const el=$("#toast"); el.textContent=text; el.classList.add("show");
  clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove("show"),1900);
}
function go(page){
  if(!document.getElementById(page))return;
  $$(".page").forEach(p=>p.classList.toggle("active",p.id===page));
  $$("[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  const meta=pageLabels[page]||[page,""];
  $("#pageTitle").textContent=meta[0]; $("#pageSub").textContent=meta[1];
  setupReveal($("#"+page));
  if(page==="stats")renderStats();
  if(page==="goals")renderGoals();
  if(page==="crypto"&&!marketState.news.length)loadMarket();
  if(page==="crypto"&&cryptoLiveTab==="live")startLiveMonitor();
  if(page!=="crypto")stopLiveMonitor();
  if(page==="binance")loadBinance();
}
function bindNavigation(){
  $$("[data-page]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.page)));
}
buildSiteStructure();
bindNavigation();

let observer=null;
function setupReveal(root=document){
  const els=[...root.querySelectorAll(".reveal")];
  if(!("IntersectionObserver" in window)){
    els.forEach(el=>el.classList.add("visible"));
    return;
  }
  if(!observer){
    observer=new IntersectionObserver(entries=>{
      entries.forEach(e=>{
        if(e.isIntersecting){
          e.target.classList.add("visible");
          observer.unobserve(e.target);
        }
      });
    },{threshold:.05,rootMargin:"80px 0px 80px 0px"});
  }
  els.forEach((el,i)=>{
    if(el.classList.contains("visible"))return;
    el.style.setProperty("--delay",Math.min(i%4,3)*30+"ms");
    observer.observe(el);
  });
  setTimeout(()=>els.forEach(el=>el.classList.add("visible")),700);
}
setupReveal();

/* ---------- dados / Sheets ---------- */
// Legacy browser-side Sheets credentials are disabled. Secrets must stay on the backend.
sessionStorage.removeItem("nexusSheetsToken");
localStorage.removeItem("nexusSheetsToken");
function cfg(){return{endpoint:"",token:""}}
function loadLocal(){try{return JSON.parse(localStorage.getItem("nexusLocalRows")||"[]")}catch{return[]}}
function saveLocal(){localStorage.setItem("nexusLocalRows",JSON.stringify(rows))}
function normalize(x){
  return {
    id:x.id??Date.now()+Math.random(),
    date:String(x.date||""),
    type:x.type||"Saída",
    description:String(x.description||"").slice(0,160),
    category:x.category||"Outros",
    subcategory:x.subcategory||"",
    purpose:x.purpose||"",
    classification:x.classification||"Controlável",
    amount:Number(x.amount)||0,
    month:x.month||"",
    year:Number(x.year)||0,
    status:x.status||"Realizado",
    note:String(x.note||"").slice(0,2000),
    mode:x.mode||x.modalidade||"Movimentação",
    installments:Number(x.installments)||0,
    currentInstallment:Number(x.currentInstallment)||0,
    dueDay:Number(x.dueDay)||0,
    recurrence:x.recurrence||"Único",
    priority:x.priority||"",
    paidAt:String(x.paidAt||"")
  };
}
async function api(action,payload={}){
  const c=cfg(); if(!c.endpoint||!c.token)throw new Error("not_connected");
  if(action==="list"){
    const u=new URL(c.endpoint);u.searchParams.set("action","list");u.searchParams.set("token",c.token);
    const r=await fetch(u,{redirect:"follow"});const j=await r.json();if(j.error)throw new Error(j.error);return j;
  }
  const r=await fetch(c.endpoint,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({...payload,action,token:c.token}),redirect:"follow"});
  const j=await r.json();if(j.error)throw new Error(j.error);return j;
}
async function sync(show=true){
  try{
    const j=await api("list");
    rows=(j.transactions||[]).map(normalize);
    $("#syncLabel").textContent="Sheets sincronizado";
    $("#sheetsStatus").textContent="✓ Conectado. "+rows.length+" registros carregados da aba Movimentações.";
    if(show)toast("Google Sheets sincronizado");
    renderAll();checkPaymentReminder();
    return true;
  }catch(e){
    $("#syncLabel").textContent="Modo local";
    if(show)$("#sheetsStatus").textContent="Não foi possível conectar. O Nexus continua salvando localmente.";
    return false;
  }
}
async function createRecord(record){
  const c=cfg();
  if(c.endpoint&&c.token){
    await api("create",record);
    await sync(false);
  }else{
    rows.push(normalize({...record,id:Date.now()}));saveLocal();renderAll();
  }
}
async function updateRecordLocal(id,record){
  const ix=rows.findIndex(r=>String(r.id)===String(id));
  if(ix<0)return;
  rows[ix]=normalize({...rows[ix],...record,id:rows[ix].id});
  saveLocal();renderAll();
}
function startEdit(id){
  const r=rows.find(x=>String(x.id)===String(id));if(!r)return;
  editingId=r.id;setMode(r.mode||"Movimentação");
  $("#fType").value=r.type;$("#fAmount").value=r.amount;$("#fDescription").value=r.description;
  $("#fCategory").value=r.category;$("#fClass").value=r.classification;$("#fNote").value=r.note||"";
  $("#fDate").value=r.date||today();$("#fStatus").value=["Previsto","Realizado"].includes(r.status)?r.status:"Realizado";
  if(r.mode==="Compromisso"||r.mode==="Assinatura"){
    $("#fDueDate").value=r.date||today();$("#fInstallments").value=r.installments||1;$("#fCurrentInstallment").value=r.currentInstallment||1;
    $("#fDueDay").value=r.dueDay||"";$("#fRecurrence").value=r.recurrence||"Mensal";$("#fPriority").value=r.priority||"Média";
  }
  if(r.mode==="Renda Fixa"){
    $("#fFixedProduct").value=r.subcategory||"CDB";
    $("#fFixedDate").value=r.date||today();
    const rate=String(r.note||"").match(/Taxa estimada:\s*([\d.,]+)%/i);
    const due=String(r.note||"").match(/Vencimento:\s*(\d{4}-\d{2}-\d{2})/i);
    $("#fFixedRate").value=rate?rate[1].replace(",","."):"";
    $("#fFixedDue").value=due?due[1]:"";
  }
  $("#formTitle").textContent="Editar registro";$("#saveMovement").textContent="Salvar alterações";$("#cancelEdit").classList.remove("hidden");
  go("movements");window.scrollTo({top:0,behavior:"smooth"});
}
function cancelEdit(){
  editingId=null;$("#movementForm").reset();$("#fDate").value=today();$("#fFixedDate").value=today();$("#saveMovement").textContent="Salvar";$("#cancelEdit").classList.add("hidden");setMode(currentMode);
}
$("#cancelEdit").addEventListener("click",cancelEdit);

async function markPaid(id){
  const item=rows.find(r=>String(r.id)===String(id)); if(!item)return;
  const c=cfg();
  if(c.endpoint&&c.token){
    await api("markPaid",{id});
    await sync(false);
  }else{
    item.status="Pago";item.paidAt=today();saveLocal();renderAll();
  }
  await createNextIfNeeded(item);
  closePaymentModal();toast("Pagamento marcado como pago");
}
async function createNextIfNeeded(item){
  if(item.mode!=="Compromisso")return;
  let next=null;
  const d=new Date((item.date||today())+"T12:00:00");
  if(item.installments>1 && item.currentInstallment<item.installments){
    d.setMonth(d.getMonth()+1);
    next={...item,id:undefined,date:d.toISOString().slice(0,10),currentInstallment:item.currentInstallment+1,status:"Pendente",paidAt:""};
  }else if(item.recurrence&&item.recurrence!=="Único"){
    if(item.recurrence==="Mensal")d.setMonth(d.getMonth()+1);
    if(item.recurrence==="Semanal")d.setDate(d.getDate()+7);
    if(item.recurrence==="Anual")d.setFullYear(d.getFullYear()+1);
    next={...item,id:undefined,date:d.toISOString().slice(0,10),status:"Pendente",paidAt:"",currentInstallment:item.installments?1:0};
  }
  if(next)await createRecord(next);
}

/* ---------- formulário ---------- */
function setMode(mode){
  currentMode=mode;
  $$("#modeTabs button").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));
  $("#commitmentFields").classList.toggle("hidden",mode!=="Compromisso");
  $("#fixedFields").classList.toggle("hidden",mode!=="Renda Fixa");
  $("#normalFields").classList.toggle("hidden",mode!=="Movimentação");
  if(mode==="Assinatura"){$("#commitmentFields").classList.remove("hidden");$("#fixedFields").classList.add("hidden");$("#normalFields").classList.add("hidden");$("#formTitle").textContent="Adicionar assinatura ou conta recorrente";$("#fType").value="Saída";$("#fRecurrence").value="Mensal";$("#fClass").value="Compromisso";}
  if(mode==="Movimentação"){$("#formTitle").textContent="Adicionar movimentação"}
  if(mode==="Compromisso"){
    $("#formTitle").textContent="Adicionar compromisso ou dívida";
    $("#fType").value="Saída";$("#fClass").value="Compromisso";
  }
  if(mode==="Renda Fixa"){
    $("#formTitle").textContent="Registrar renda fixa";
    $("#fType").value="Saída";$("#fCategory").value="Investimentos";$("#fClass").value="Investimento";
  }
}
$$("#modeTabs button").forEach(b=>b.addEventListener("click",()=>setMode(b.dataset.mode)));
$("#fDate").value=today();$("#fFixedDate").value=today();

$("#movementForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const base={
    type:$("#fType").value,
    description:$("#fDescription").value.trim().slice(0,160),
    category:$("#fCategory").value,
    classification:$("#fClass").value,
    amount:Number($("#fAmount").value||0),
    mode:currentMode,
    recurrence:"Único",priority:"",installments:0,currentInstallment:0,dueDay:0,paidAt:"",
    note:$("#fNote").value.trim().slice(0,2000)
  };
  if(!base.description||base.amount<=0){toast("Preencha a descrição e o valor");return}
  if(currentMode==="Movimentação"){
    Object.assign(base,{date:$("#fDate").value||today(),status:$("#fStatus").value,purpose:"Movimentação"});
  }
  if(currentMode==="Compromisso"||currentMode==="Assinatura"){
    const due=$("#fDueDate").value;
    if(!due){toast("Informe o vencimento");return}
    Object.assign(base,{
      date:due,status:"Pendente",purpose:currentMode==="Assinatura"?"Assinatura ou conta recorrente":"Compromisso financeiro",
      installments:Math.max(1,Number($("#fInstallments").value||1)),
      currentInstallment:Math.max(1,Number($("#fCurrentInstallment").value||1)),
      dueDay:Number($("#fDueDay").value||new Date(due+"T12:00:00").getDate()),
      recurrence:$("#fRecurrence").value,priority:$("#fPriority").value
    });
  }
  if(currentMode==="Renda Fixa"){
    const fd=$("#fFixedDate").value||today(),product=$("#fFixedProduct").value,rate=$("#fFixedRate").value,due=$("#fFixedDue").value;
    Object.assign(base,{
      date:fd,status:"Realizado",subcategory:product,purpose:"Renda fixa",
      note:[rate?("Taxa estimada: "+rate+"% a.a."):"",due?("Vencimento: "+due):"",base.note].filter(Boolean).join(" | ")
    });
  }
  try{
    toast("Salvando...");
    if(editingId){
      if(cfg().endpoint&&cfg().token){toast("Edição ficará local até o backend receber suporte a update");}
      await updateRecordLocal(editingId,base);editingId=null;$("#saveMovement").textContent="Salvar";$("#cancelEdit").classList.add("hidden");toast("Registro atualizado");
    }else await createRecord(base);
    e.currentTarget.reset();$("#fDate").value=today();$("#fFixedDate").value=today();setMode(currentMode);
    toast("Registro salvo");go("movements");
  }catch(err){toast("Não foi possível salvar")}
});

/* ---------- histórico ---------- */
function dayDiff(date){return Math.floor((new Date(date+"T12:00:00")-new Date(today()+"T12:00:00"))/86400000)}
function effectiveStatus(r){
  if(r.status==="Pago"||r.status==="Realizado")return r.status;
  if(r.mode==="Compromisso"&&r.date&&dayDiff(r.date)<0)return "Atrasado";
  return r.status;
}
function renderHistory(){
  const q=$("#historySearch").value.toLowerCase().trim();
  let data=[...rows].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  if(historyFilter!=="Todos")data=data.filter(r=>r.mode===historyFilter);
  if(q)data=data.filter(r=>(r.description+" "+r.category+" "+r.classification+" "+r.note).toLowerCase().includes(q));
  const box=$("#historyList");
  if(!data.length){box.innerHTML='<div class="insight">Nenhum registro encontrado.</div>';return}
  box.innerHTML=data.slice(0,80).map(r=>{
    const st=effectiveStatus(r),isIn=r.type==="Entrada";
    const extra=(r.mode==="Compromisso"||r.mode==="Assinatura")?(r.installments?(" • parcela "+r.currentInstallment+"/"+r.installments):""):"";
    return '<div class="list-item"><div class="list-icon">'+(r.mode==="Renda Fixa"?"◆":r.mode==="Compromisso"?"!":isIn?"↙":"↘")+'</div><div class="list-info"><b>'+esc(r.description)+'</b><span>'+esc(r.mode)+" • "+esc(r.category)+" • "+esc(r.classification)+extra+" • "+esc(st)+'</span></div><div class="list-value '+(isIn?"good":"")+'">'+(r.mode==="Renda Fixa"?"":isIn?"+":"-")+" "+brl(r.amount)+'<div class="list-actions"><button class="mini" data-edit="'+esc(r.id)+'">Editar</button>'+( (r.mode==="Compromisso"||r.mode==="Assinatura")&&st!=="Pago"?'<button class="mini pay" data-pay="'+esc(r.id)+'">Já paguei</button>':"")+'</div></div></div>';
  }).join("");
  $$("[data-pay]").forEach(b=>b.addEventListener("click",()=>markPaid(b.dataset.pay)));
  $$("[data-edit]").forEach(b=>b.addEventListener("click",()=>startEdit(b.dataset.edit)));
  setupReveal(box);
}
$("#historySearch").addEventListener("input",renderHistory);
$("#historyFilters")?.addEventListener("click",e=>{
  const b=e.target.closest("button[data-filter]");
  if(!b)return;
  e.preventDefault();
  historyFilter=b.dataset.filter;
  $("#historyFilters button").forEach(x=>x.classList.toggle("active",x===b));
  renderHistory();
});

/* ---------- dashboard + estatísticas ---------- */
function selectedMonth(){return $("#monthPicker").value||today().slice(0,7)}
function recordMonthKey(r){
  const raw=String(r.date||"").trim();
  if(/^\d{4}-\d{2}/.test(raw))return raw.slice(0,7);
  if(/^\d{2}\/\d{2}\/\d{4}$/.test(raw)){const [d,m,y]=raw.split("/");return y+"-"+m}
  if(r.year&&r.month){
    const mi=monthNames.findIndex(x=>x.toLowerCase()===String(r.month).toLowerCase());
    if(mi>=0)return String(r.year)+"-"+String(mi+1).padStart(2,"0");
  }
  return "";
}
function monthRows(key=selectedMonth()){return rows.filter(r=>recordMonthKey(r)===key)}
function realized(r){
  const s=String(r.status||"").trim().toLowerCase();
  return ["realizado","pago","recebido","concluído","concluido"].includes(s);
}
function calcMonth(key=selectedMonth()){
  const m=monthRows(key),done=m.filter(realized);
  const income=done.filter(r=>r.type==="Entrada").reduce((s,r)=>s+r.amount,0);
  const expense=done.filter(r=>r.type==="Saída"&&r.mode!=="Renda Fixa").reduce((s,r)=>s+r.amount,0);
  const invest=done.filter(r=>r.type==="Saída"&&(r.classification==="Investimento"||r.category==="Investimentos"||r.category==="Reserva")).reduce((s,r)=>s+r.amount,0);
  const pending=m.filter(r=>r.mode==="Compromisso"&&r.status!=="Pago").reduce((s,r)=>s+r.amount,0);
  const savings=income?Math.max(-100,(income-expense)/income*100):0;
  const unnecessary=done.filter(r=>r.type==="Saída"&&r.classification==="Não necessário").reduce((s,r)=>s+r.amount,0);
  const essential=done.filter(r=>r.type==="Saída"&&r.classification==="Essencial").reduce((s,r)=>s+r.amount,0);
  const commitments=done.filter(r=>r.type==="Saída"&&r.classification==="Compromisso").reduce((s,r)=>s+r.amount,0);
  let score=income?Math.round(Math.max(0,Math.min(100,50+savings*.35+(invest/income*100)*.18-(unnecessary/income*100)*.65))):0;
  return{m,done,income,expense,balance:income-expense,invest,pending,savings,unnecessary,essential,commitments,score};
}
function renderDashboard(){
  const x=calcMonth();
  $("#kpiBalance").textContent=brl(x.balance);$("#kpiIncome").textContent=brl(x.income);$("#kpiExpense").textContent=brl(x.expense);
  $("#kpiSavings").textContent=x.savings.toFixed(1).replace(".",",")+"%";$("#kpiInvest").textContent=brl(x.invest);$("#kpiPending").textContent=brl(x.pending);
  $("#heroScore").textContent=x.income?x.score+"%":"—";$("#ringScore").textContent=x.income?x.score+"%":"—";
  $("#heroText").textContent=x.income?(x.score>=75?"Boa organização neste mês.":x.score>=50?"Mês equilibrado, mas há espaço para melhorar.":"Atenção ao nível de gastos e compromissos."):"Adicione movimentações para o Nexus calcular sua situação.";
  const due=rows.filter(r=>r.mode==="Compromisso"&&r.status!=="Pago").sort((a,b)=>String(a.date).localeCompare(String(b.date))).slice(0,5);
  $("#upcomingList").innerHTML=due.length?due.map(r=>{
    const d=dayDiff(r.date),when=d<0?"Atrasado":d===0?"Vence hoje":d===1?"Vence amanhã":"Vence em "+d+" dias";
    return '<div class="list-item"><div class="list-icon">!</div><div class="list-info"><b>'+esc(r.description)+'</b><span>'+when+(r.installments?" • "+r.currentInstallment+"/"+r.installments:"")+'</span></div><div class="list-value">'+brl(r.amount)+'</div></div>';
  }).join(""):'<div class="insight">Nenhum compromisso pendente.</div>';
  const ins=[];
  if(x.income)ins.push("Você economizou "+x.savings.toFixed(1).replace(".",",")+"% do que entrou.");
  if(x.unnecessary>0)ins.push(brl(x.unnecessary)+" foram classificados como gasto não necessário.");
  if(x.invest>0)ins.push(brl(x.invest)+" foram destinados a investimentos/reserva.");
  if(x.pending>0)ins.push("Há "+brl(x.pending)+" em compromissos pendentes neste mês.");
  $("#monthInsights").innerHTML=(ins.length?ins:["Ainda não há dados suficientes para analisar o mês."]).map(t=>'<div class="insight">'+esc(t)+'</div>').join("");
  $("#monthReading").textContent=x.income?(x.balance>=0?"Saldo mensal positivo":"Saídas acima das entradas"):"Sem dados suficientes";
}
function classificationData(){
  const data=calcMonth().done.filter(r=>r.type==="Saída"&&r.mode!=="Renda Fixa");
  const map={};
  data.forEach(r=>map[r.classification]=(map[r.classification]||0)+r.amount);
  return map;
}
function lastMonths(n=6){
  const key=selectedMonth(),[y0,m0]=key.split("-").map(Number),arr=[];
  for(let i=n-1;i>=0;i--){const d=new Date(y0,m0-1-i,1);arr.push(d.toISOString().slice(0,7))}
  return arr;
}
function renderStats(){
  const x=calcMonth();
  $("#statEssential").textContent=brl(x.essential);$("#statUnnecessary").textContent=brl(x.unnecessary);$("#statCommitments").textContent=brl(x.commitments);$("#statInvestment").textContent=brl(x.invest);
  const ind=[
    ["Taxa de economia",x.income?x.savings.toFixed(1).replace(".",",")+"%":"—"],
    ["Compromissos / entradas",x.income?(x.pending/x.income*100).toFixed(1).replace(".",",")+"%":"—"],
    ["Gasto não necessário",x.income?(x.unnecessary/x.income*100).toFixed(1).replace(".",",")+"% da renda":"—"],
    ["Saldo do mês",brl(x.balance)]
  ];
  $("#indicatorList").innerHTML=ind.map(i=>'<div class="indicator"><span>'+i[0]+'</span><b>'+i[1]+'</b></div>').join("");
  renderCharts();
}
function renderCharts(){
  const cls=classificationData(),labels=Object.keys(cls),values=Object.values(cls);
  $("#pieEmpty").style.display=values.length?"none":"grid";
  if(pieChart)pieChart.destroy();
  if(window.Chart&&values.length)pieChart=new Chart($("#classPie"),{type:"doughnut",data:{labels,datasets:[{data:values,backgroundColor:["#d6b400","#c8c8c2","#766923","#777","#a38d35","#555"],borderColor:"#111",borderWidth:3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"bottom",labels:{color:"#aaa",boxWidth:10,font:{size:10}}}}}});
  const keys=lastMonths(6),incomes=[],expenses=[];
  keys.forEach(k=>{const x=calcMonth(k);incomes.push(x.income);expenses.push(x.expense)});
  const has=incomes.some(Boolean)||expenses.some(Boolean);$("#barEmpty").style.display=has?"none":"grid";
  if(barChart)barChart.destroy();
  if(window.Chart&&has)barChart=new Chart($("#flowBar"),{type:"bar",data:{labels:keys.map(k=>{const [y,m]=k.split("-");return monthNames[Number(m)-1].slice(0,3)}),datasets:[{label:"Entradas",data:incomes,backgroundColor:"#b59b18"},{label:"Saídas",data:expenses,backgroundColor:"#bdbdb7"}]},options:{responsive:true,maintainAspectRatio:false,scales:{x:{ticks:{color:"#777"},grid:{display:false}},y:{ticks:{color:"#777"},grid:{color:"#1e1e1e"}}},plugins:{legend:{labels:{color:"#aaa",boxWidth:10,font:{size:10}}}}}});
}

/* ---------- relatório ---------- */
function csvEscape(v){const s=String(v??"");return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}
$("#downloadCsv").addEventListener("click",()=>{
  const headers=["ID","Data","Tipo","Descrição","Categoria","Subcategoria","Finalidade","Classificação","Valor","Status","Observação","Modalidade","Parcelas","Parcela atual","Dia vencimento","Recorrência","Prioridade","Pago em"];
  const lines=[headers.join(";"),...rows.map(r=>[r.id,r.date,r.type,r.description,r.category,r.subcategory,r.purpose,r.classification,r.amount,r.status,r.note,r.mode,r.installments,r.currentInstallment,r.dueDay,r.recurrence,r.priority,r.paidAt].map(csvEscape).join(";"))];
  const blob=new Blob(["\ufeff"+lines.join("\n")],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="nexus-finance-"+today()+".csv";a.click();URL.revokeObjectURL(a.href);
});
$("#printReport").addEventListener("click",()=>{
  const x=calcMonth(),cls=classificationData(),m=selectedMonth(),[y,mo]=m.split("-");
  const w=window.open("","_blank");
  w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Relatório Nexus</title><style>body{font-family:Arial;padding:32px;color:#111}h1{margin:0}small{color:#666}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:24px 0}.k{border:1px solid #ddd;padding:14px;border-radius:8px}.k b{display:block;font-size:20px;margin-top:5px}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left;font-size:12px}@media print{button{display:none}}</style></head><body><h1>Nexus Finance</h1><small>Relatório de '+monthNames[Number(mo)-1]+' de '+y+'</small><div class="grid"><div class="k">Entradas<b>'+brl(x.income)+'</b></div><div class="k">Saídas<b>'+brl(x.expense)+'</b></div><div class="k">Saldo<b>'+brl(x.balance)+'</b></div><div class="k">Economia<b>'+x.savings.toFixed(1)+'%</b></div><div class="k">Investimentos<b>'+brl(x.invest)+'</b></div><div class="k">Pendentes<b>'+brl(x.pending)+'</b></div></div><h2>Gastos por classificação</h2><table><tr><th>Classificação</th><th>Valor</th></tr>'+Object.entries(cls).map(([k,v])=>'<tr><td>'+esc(k)+'</td><td>'+brl(v)+'</td></tr>').join("")+'</table><h2>Movimentações do mês</h2><table><tr><th>Data</th><th>Descrição</th><th>Tipo</th><th>Classificação</th><th>Valor</th></tr>'+x.m.map(r=>'<tr><td>'+esc(r.date)+'</td><td>'+esc(r.description)+'</td><td>'+esc(r.type)+'</td><td>'+esc(r.classification)+'</td><td>'+brl(r.amount)+'</td></tr>').join("")+'</table><script>window.onload=()=>window.print()<\/script></body></html>');
  w.document.close();
});

/* ---------- lembrete pagamento ---------- */
function checkPaymentReminder(){
  if(sessionStorage.getItem("nexusPaidAskSnooze")===today())return;
  const due=rows.filter(r=>r.mode==="Compromisso"&&r.status!=="Pago"&&r.date&&dayDiff(r.date)<=0).sort((a,b)=>String(a.date).localeCompare(String(b.date)))[0];
  if(!due)return;
  paymentTarget=due;
  $("#paymentTitle").textContent="Você já pagou "+due.description+"?";
  $("#paymentText").textContent=(dayDiff(due.date)<0?"Está atrasado.":"Vence hoje.")+" Valor: "+brl(due.amount)+(due.installments?" • parcela "+due.currentInstallment+"/"+due.installments:"");
  $("#paymentModal").classList.add("open");
}
function closePaymentModal(){$("#paymentModal").classList.remove("open");paymentTarget=null}
$("#paymentDone").addEventListener("click",()=>paymentTarget&&markPaid(paymentTarget.id));
$("#paymentLater").addEventListener("click",()=>{sessionStorage.setItem("nexusPaidAskSnooze",today());closePaymentModal();toast("Vou lembrar de novo depois")});

/* ---------- metas + educação financeira ---------- */
function loadGoals(){try{return JSON.parse(localStorage.getItem("nexusGoals")||"[]")}catch{return[]}}
function saveGoals(){localStorage.setItem("nexusGoals",JSON.stringify(goals))}
goals=loadGoals();
function salaryIncome(key=selectedMonth()){return monthRows(key).filter(r=>realized(r)&&r.type==="Entrada"&&r.category==="Salário").reduce((s,r)=>s+r.amount,0)}
function renderGoals(){
  const box=$("#goalList");if(!box)return;
  box.innerHTML=goals.length?goals.map(g=>{
    const pct=Math.min(100,g.target?g.current/g.target*100:0),remain=Math.max(0,g.target-g.current);
    let monthly="";
    if(g.date){const months=Math.max(1,Math.ceil((new Date(g.date+"T12:00:00")-new Date())/(86400000*30.44)));monthly=" • "+brl(remain/months)+"/mês para o prazo";}
    return '<div class="goal-card"><div><b>'+esc(g.name)+'</b><span>'+brl(g.current)+' de '+brl(g.target)+monthly+'</span></div><strong>'+pct.toFixed(0)+'%</strong><div class="goal-track"><i style="width:'+pct+'%"></i></div></div>';
  }).join(""):'<div class="insight">Nenhuma meta criada ainda.</div>';
  const x=calcMonth(),salary=salaryIncome(),saved=Math.max(0,x.income-x.expense),salarySave=salary?Math.max(0,saved/salary*100):0;
  const expensePct=x.income?x.expense/x.income*100:0;
  const reserveGoal=goals.find(g=>/reserva|emerg/i.test(g.name));
  $("#salaryRules").innerHTML=[
    {ok:salarySave>=50,title:"Meta pessoal: preservar 50% do salário",text:salary?"Neste mês você preservou "+salarySave.toFixed(0)+"% do valor recebido como salário.":"Cadastre uma entrada na categoria Salário para acompanhar esta regra."},
    {ok:x.savings>=20,title:"Referência de poupança: 10–20%",text:x.income?"Sua taxa atual é "+x.savings.toFixed(0)+"%. O Nexus usa 20% como faixa forte, não como obrigação.":"Ainda não há renda realizada no mês."},
    {ok:expensePct<=80,title:"Não comprometer toda a renda",text:x.income?"Despesas realizadas consumiram "+expensePct.toFixed(0)+"% da renda.":"Registre renda e despesas para calcular."},
    {ok:!!reserveGoal&&reserveGoal.current>0,title:"Construir reserva de emergência",text:reserveGoal?"Reserva cadastrada: "+brl(reserveGoal.current)+" de "+brl(reserveGoal.target)+".":"Crie uma meta chamada Reserva de emergência; uma referência comum é vários meses dos gastos essenciais."}
  ].map(r=>'<div class="rule '+(r.ok?"rule-good":"rule-warn")+'"><i></i><div><b>'+r.title+'</b><span>'+r.text+'</span></div></div>').join("");
}
$("#goalForm")?.addEventListener("submit",e=>{
  e.preventDefault();const g={id:Date.now(),name:$("#gName").value.trim(),target:Number($("#gTarget").value),current:Number($("#gCurrent").value||0),date:$("#gDate").value};
  if(!g.name||g.target<=0)return toast("Informe a meta e o valor");
  goals.push(g);saveGoals();e.currentTarget.reset();$("#gCurrent").value=0;renderGoals();toast("Meta criada");
});

/* ---------- mercado ---------- */
async function fetchJson(url){const r=await fetch(url,{cache:"no-store"});if(!r.ok)throw new Error(String(r.status));return r.json()}
async function getPublicPrices(){
  const url="https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=brl&include_24hr_change=true";
  const j=await fetchJson(url);
  const map={BTC:j.bitcoin,ETH:j.ethereum,SOL:j.solana};
  const raw={};
  Object.entries(map).forEach(([sym,x])=>{
    if(!x||!Number(x.brl))throw new Error("invalid_price_"+sym);
    raw[sym]={BRL:{PRICE:Number(x.brl),CHANGEPCT24HOUR:Number(x.brl_24h_change||0)}};
  });
  return raw;
}
async function getCryptoComparePrices(){
  const j=await fetchJson("https://min-api.cryptocompare.com/data/pricemultifull?fsyms=BTC,ETH,SOL&tsyms=BRL");
  if(!j.RAW)throw new Error("cryptocompare_no_data");
  return j.RAW;
}
async function getMarketPrices(){
  try{return await getPublicPrices()}
  catch(e){return await getCryptoComparePrices()}
}
async function loadPrices(){
  const raw=await getMarketPrices();
  [["BTC","btc"],["ETH","eth"],["SOL","sol"]].forEach(([sym,id])=>{
    const x=raw[sym]?.BRL||{};marketState.prices[sym]=x;
    $("#"+id+"Price").textContent=x.PRICE?brl(x.PRICE):"—";
    const ch=$("#"+id+"Change"),p=Number(x.CHANGEPCT24HOUR||0);ch.textContent=(p>=0?"+":"")+p.toFixed(2).replace(".",",")+"% em 24h";ch.className=p>=0?"good":"bad";
  });
}
async function loadFear(){
  try{
    const j=await fetchJson("https://api.alternative.me/fng/?limit=1&format=json");
    marketState.fear=j.data?.[0]||null;
  }catch{marketState.fear=null}
  $("#fearValue").textContent=marketState.fear?.value||"—";$("#fearLabel").textContent=marketState.fear?.value_classification||"sem leitura";
}
async function loadNews(){
  $("#newsStatus").textContent="Atualizando...";
  let list=[];
  try{
    const j=await fetchJson("https://min-api.cryptocompare.com/data/v2/news/?lang=EN");
    list=(j.Data||[]).slice(0,12).map(x=>({title:x.title,url:x.url,source:x.source_info?.name||x.source||"CryptoCompare",time:x.published_on?new Date(x.published_on*1000):new Date(),body:x.body||""}));
  }catch{}
  if(!list.length){
    try{
      const j=await fetchJson("https://cryptocurrency.cv/api/news?limit=12");
      list=(j.articles||j.data||[]).slice(0,12).map(x=>({title:x.title,url:x.link||x.url,source:x.source||"Crypto",time:new Date(x.pubDate||Date.now()),body:x.description||""}));
    }catch{}
  }
  marketState.news=list;$("#newsStatus").textContent=list.length?list.length+" notícias":"Fonte indisponível";
  $("#newsList").innerHTML=list.length?list.map(n=>'<a class="news-item" target="_blank" rel="noopener" href="'+esc(safeExternalUrl(n.url))+'"><b>'+esc(n.title)+'</b><span>'+esc(n.source)+" • "+n.time.toLocaleString("pt-BR")+'</span></a>').join(""):'<div class="insight">A API de notícias não respondeu agora. Tente novamente em alguns minutos.</div>';
}
function sentiment(){
  const text=marketState.news.map(n=>(n.title+" "+n.body).toLowerCase()).join(" ");
  const pos=["approval","adoption","rally","surge","record","inflow","bull","institutional","rate cut","partnership","growth"];
  const neg=["hack","ban","lawsuit","outflow","crash","selloff","war","tariff","inflation","liquidation","fraud","rate hike"];
  return pos.reduce((s,w)=>s+(text.includes(w)?1:0),0)-neg.reduce((s,w)=>s+(text.includes(w)?1:0),0);
}
function renderScenario(){
  const changes=["BTC","ETH","SOL"].map(s=>Number(marketState.prices[s]?.CHANGEPCT24HOUR)).filter(Number.isFinite);
  const momentum=changes.length?changes.reduce((a,b)=>a+b,0)/changes.length:0,newsScore=sentiment(),fear=Number(marketState.fear?.value||50);
  const score=Math.max(-6,Math.min(6,momentum/2+newsScore*.5+(fear-50)/18));
  let bull=Math.max(15,Math.min(70,Math.round(35+score*4))),bear=Math.max(15,Math.min(70,Math.round(35-score*4))),side=100-bull-bear;
  if(side<15){const d=15-side;side=15;(bull>bear?bull-=d:bear-=d)}
  $("#bullProb").textContent=bull+"%";$("#sideProb").textContent=side+"%";$("#bearProb").textContent=bear+"%";
  let title,text;
  if(bull>bear+12){title="Viés de alta, com risco de volatilidade";text="Momentum e sentimento estão mais favoráveis no curto prazo. Uma notícia macro ou regulatória pode inverter o cenário rapidamente."}
  else if(bear>bull+12){title="Pressão de baixa no curto prazo";text="Os sinais atuais indicam maior risco de correção. Vale esperar confirmação antes de aumentar exposição."}
  else{title="Mercado sem direção clara";text="Os sinais estão mistos. O cenário-base é lateralidade até aparecer um catalisador mais forte."}
  $("#scenarioTitle").textContent=title;$("#scenarioText").textContent=text;
  $("#marketActions").innerHTML=[
    ["Esperar confirmação","Aguardar preço e notícias apontarem na mesma direção."],
    ["Entrada gradual","Se decidir entrar, dividir o valor em aportes menores reduz o risco de acertar um topo local."],
    ["Preservar caixa","Se esse dinheiro tiver uso próximo, manter liquidez pode fazer mais sentido do que assumir volatilidade."]
  ].map(x=>'<div class="action-item"><b>'+x[0]+'</b><span>'+x[1]+'</span></div>').join("");
}
async function loadMarket(){
  $("#newsStatus").textContent="Atualizando...";
  const rs=await Promise.allSettled([loadPrices(),loadFear(),loadNews()]);
  renderScenario();if(rs.every(x=>x.status==="rejected"))toast("As APIs de mercado não responderam");
}
$("#refreshMarket").addEventListener("click",()=>{loadMarket();toast("Atualizando mercado")});

/* ---------- settings ---------- */
const c0=cfg();
const legacyEndpoint=$("#sheetsEndpoint");
const legacyToken=$("#sheetsToken");
const legacyButton=$("#connectSheets");
if(legacyEndpoint)legacyEndpoint.value="";
if(legacyToken)legacyToken.value="";
if(legacyButton)legacyButton.addEventListener("click",()=>{
  sessionStorage.removeItem("nexusSheetsToken");
  localStorage.removeItem("nexusSheetsToken");
  localStorage.removeItem("nexusSheetsEndpoint");
  const status=$("#sheetsStatus");
  if(status)status.textContent="Integração direta desativada por segurança. Use somente integrações via backend.";
  toast("Integração direta desativada por segurança");
});

/* ---------- init ---------- */
function renderAll(){renderHistory();renderDashboard();renderStats();renderGoals()}
$("#monthPicker").addEventListener("change",renderAll);
rows=loadLocal().map(normalize);renderAll();setMode("Movimentação");setTimeout(checkPaymentReminder,700);
if(c0.endpoint&&c0.token)sync(false);


/* ---------- Nexus Live: acompanhamento enquanto o site está aberto ---------- */
let cryptoLiveTab="radar";
let liveTimer=null;
let liveRunning=false;
let liveLast={};
let liveLogEntries=[];

function setCryptoTab(tab){
  cryptoLiveTab=tab;
  $("#cryptoTabs [data-crypto-tab]").forEach(b=>b.classList.toggle("active",b.dataset.cryptoTab===tab));
  $("#cryptoRadar").classList.toggle("active",tab==="radar");
  $("#cryptoLive").classList.toggle("active",tab==="live");
  setupReveal(tab==="live"?$("#cryptoLive"):$("#cryptoRadar"));
  if(tab==="live"){
    startLiveMonitor();
    liveTick(true);
  }
}
$("#cryptoTabs [data-crypto-tab]").forEach(b=>b.addEventListener("click",()=>setCryptoTab(b.dataset.cryptoTab)));
$("#binanceShortcut")?.addEventListener("click",()=>go("binance"));

function updateOnlineState(){
  const online=navigator.onLine;
  const state=$("#liveStatus")?.parentElement;
  if(state){
    state.classList.toggle("online",online);
    state.classList.toggle("offline",!online);
  }
  if($("#liveStatus"))$("#liveStatus").textContent=online?"Online • acompanhando mercado":"Offline • acompanhamento pausado";
  if(!online)addLiveLog("Conexão perdida","O Nexus pausou as atualizações até a internet voltar.","neutral",true);
}
window.addEventListener("online",()=>{updateOnlineState();addLiveLog("Conexão restaurada","Voltamos a acompanhar BTC, ETH e SOL.","neutral",true);liveTick(true)});
window.addEventListener("offline",updateOnlineState);
updateOnlineState();

function startLiveMonitor(){
  if(liveRunning)return;
  liveRunning=true;
  updateOnlineState();
  liveTick(true);
  liveTimer=setInterval(()=>{
    if(navigator.onLine && !document.hidden)liveTick(false);
  },30000);
}

function stopLiveMonitor(){
  if(liveTimer)clearInterval(liveTimer);
  liveTimer=null;liveRunning=false;
}

async function getLivePrices(){
  return getMarketPrices();
}

function pctMove(now,old){
  if(!old||!Number(old))return 0;
  return (Number(now)-Number(old))/Number(old)*100;
}

function setLiveCoin(sym,prefix,raw){
  const x=raw[sym]?.BRL||{};
  const price=Number(x.PRICE||0),prev=Number(liveLast[sym]||0);
  const sessionMove=pctMove(price,prev);
  $("#live"+prefix).textContent=price?brl(price):"—";
  const moveEl=$("#live"+prefix+"Move");
  const day=Number(x.CHANGEPCT24HOUR||0);
  if(prev){
    moveEl.textContent=(sessionMove>=0?"+":"")+sessionMove.toFixed(3).replace(".",",")+"% desde a última leitura • "+(day>=0?"+":"")+day.toFixed(2).replace(".",",")+"% 24h";
    moveEl.className=sessionMove>0.03?"good":sessionMove<-0.03?"bad":"";
  }else{
    moveEl.textContent=(day>=0?"+":"")+day.toFixed(2).replace(".",",")+"% em 24h";
    moveEl.className=day>=0?"good":"bad";
  }
  return{price,prev,sessionMove,day};
}

function addLiveLog(title,text,type="neutral",dedupe=false){
  if(dedupe && liveLogEntries[0]?.title===title)return;
  const entry={time:new Date(),title,text,type};
  liveLogEntries.unshift(entry);
  liveLogEntries=liveLogEntries.slice(0,30);
  renderLiveLog();
}
function renderLiveLog(){
  const box=$("#liveLog");if(!box)return;
  if(!liveLogEntries.length){box.innerHTML='<div class="insight">A sessão ainda não registrou mudanças.</div>';return}
  box.innerHTML=liveLogEntries.map(e=>'<div class="live-entry '+e.type+'"><b>'+esc(e.title)+'</b><span>'+e.time.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",second:"2-digit"})+" • "+esc(e.text)+'</span></div>').join("");
}
$("#clearLiveLog")?.addEventListener("click",()=>{liveLogEntries=[];renderLiveLog();toast("Diário da sessão limpo")});

function liveOpinion(snapshot){
  const coins=Object.values(snapshot);
  const avg24=coins.reduce((s,x)=>s+x.day,0)/coins.length;
  const avgShort=coins.reduce((s,x)=>s+x.sessionMove,0)/coins.length;
  const positives=coins.filter(x=>x.day>0).length;
  let bias,title,text,type;
  if(avg24>2 && positives>=2){
    bias="VIÉS DE ALTA";title="Mercado com força compradora";
    text="BTC, ETH e SOL estão majoritariamente positivos em 24h. No curtíssimo prazo, eu evitaria correr atrás de uma alta já esticada: uma alternativa é esperar recuo ou confirmação antes de entrar.";
    type="up";
  }else if(avg24<-2 && positives<=1){
    bias="PRESSÃO DE BAIXA";title="Mercado sob pressão";
    text="As principais moedas acompanhadas estão pressionadas. Entradas grandes agora aumentam o risco de pegar uma continuação da queda; caixa e aportes pequenos por etapas são alternativas mais defensivas.";
    type="down";
  }else{
    bias="MISTO / LATERAL";title="Sem direção forte";
    text="Os sinais das três moedas estão mistos. Eu trataria este momento como indefinido: observar rompimentos e notícias antes de aumentar exposição tende a ser mais prudente.";
    type="neutral";
  }
  if(Math.abs(avgShort)>.12){
    text+=" Nos últimos segundos houve movimento perceptível de "+(avgShort>0?"alta":"queda")+" na média das três moedas.";
  }
  $("#liveBias").textContent=bias;
  $("#liveOpinionTitle").textContent=title;
  $("#liveOpinionText").textContent=text;
  $("#liveSuggestions").innerHTML=[
    ["Observar","Espere duas ou mais atualizações apontando na mesma direção para reduzir ruído."],
    ["Entrada gradual","Se optar por comprar, dividir o valor em partes reduz dependência de um único preço."],
    ["Definir limite","Antes de entrar, decida quanto do seu dinheiro pode ficar exposto à volatilidade."]
  ].map(x=>'<div class="action-item"><b>'+x[0]+'</b><span>'+x[1]+'</span></div>').join("");
  return{bias,title,type,avg24,avgShort};
}

async function liveTick(force=false){
  if(!navigator.onLine){updateOnlineState();return}
  try{
    if($("#liveStatus"))$("#liveStatus").textContent="Online • atualizando...";
    const raw=await getLivePrices();
    const snap={
      BTC:setLiveCoin("BTC","Btc",raw),
      ETH:setLiveCoin("ETH","Eth",raw),
      SOL:setLiveCoin("SOL","Sol",raw)
    };
    const now=new Date();
    $("#liveUpdated").textContent=now.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
    const opinion=liveOpinion(snap);

    if(!Object.keys(liveLast).length){
      addLiveLog("Acompanhamento iniciado","Primeira leitura capturada. Agora o Nexus vai comparar as próximas atualizações.","neutral");
    }else{
      Object.entries(snap).forEach(([sym,x])=>{
        if(Math.abs(x.sessionMove)>=0.08){
          addLiveLog(sym+" "+(x.sessionMove>0?"subiu":"caiu"),(x.sessionMove>0?"+":"")+x.sessionMove.toFixed(3).replace(".",",")+"% desde a última atualização. Preço: "+brl(x.price),x.sessionMove>0?"up":"down");
        }
      });
      if(force||Math.abs(opinion.avgShort)>=.12)addLiveLog("Leitura Nexus",opinion.title+" • "+opinion.bias,opinion.type,true);
    }
    ["BTC","ETH","SOL"].forEach(sym=>liveLast[sym]=Number(raw[sym]?.BRL?.PRICE||0));
    updateOnlineState();
  }catch(e){
    if($("#liveStatus"))$("#liveStatus").textContent="Online • API indisponível";
    addLiveLog("Falha na atualização","Não consegui consultar os preços neste ciclo. Vou tentar novamente automaticamente.","neutral",true);
  }
}

document.addEventListener("visibilitychange",()=>{
  if(!document.hidden && navigator.onLine && liveRunning)liveTick(true);
});

/* O monitor de cripto só inicia quando a subaba Ao Vivo é aberta.
   Isso evita requisições de rede desnecessárias na inicialização do iPhone. */


/* ---------- Binance: leitura Spot, nunca enviar credenciais ao navegador ---------- */
let binanceBusy=false;
async function loadBinance(){
  if(binanceBusy)return;
  const status=$("#binanceStatus"),box=$("#binanceBalances"),button=$("#binanceRefresh");
  if(!status||!box)return;
  binanceBusy=true;
  if(button)button.disabled=true;
  status.textContent="Consultando conexão...";
  try{
    const res=await fetch("/api/binance/status",{credentials:"same-origin",cache:"no-store"});
    if(res.status===401){status.textContent="Entre na sua conta Nexus para conectar a Binance.";return}
    if(res.status===403){status.textContent="Acesso restrito ao proprietário configurado.";return}
    if(!res.ok)throw Error("status");
    const info=await res.json();
    if(!info.configured){
      status.textContent="Aguardando configuração segura no Render.";
      box.innerHTML='<p class="muted">Nenhuma chave configurada. Siga as instruções abaixo para habilitar a leitura.</p>';
      return;
    }
    status.textContent="Conectado · buscando carteira Spot...";
    const response=await fetch("/api/binance/balances",{credentials:"same-origin",cache:"no-store"});
    if(!response.ok)throw Error("balances");
    const data=await response.json();
    const items=Array.isArray(data.balances)?data.balances:[];
    box.innerHTML=items.length?items.map(item=>
      '<div class="binance-asset"><b>'+esc(item.asset)+'</b><span>Livre: '+esc(item.free)+'</span><span>Bloqueado: '+esc(item.locked)+'</span></div>'
    ).join(""):'<p class="muted">Nenhum ativo com saldo positivo na carteira Spot.</p>';
    status.textContent="Carteira Spot atualizada.";
  }catch{
    status.textContent="Não foi possível consultar a Binance agora. Verifique a configuração e tente novamente.";
  }finally{
    binanceBusy=false;
    if(button)button.disabled=false;
  }
}
$("#binanceRefresh")?.addEventListener("click",loadBinance);

/* ---------- aparência ---------- */
function setAppearance(mode,notify=false){
  const value=mode==="glass"?"glass":"solid";
  document.body.classList.toggle("appearance-glass",value==="glass");
  $$(".appearance-option").forEach(btn=>btn.classList.toggle("active",btn.dataset.appearance===value));
  localStorage.setItem("nexusAppearance",value);
  if(notify)toast(value==="glass"?"Modo Vidro ativado":"Modo Sólido ativado");
}
setAppearance(localStorage.getItem("nexusAppearance")||"solid");
$$(".appearance-option").forEach(btn=>btn.addEventListener("click",()=>setAppearance(btn.dataset.appearance,true)));


/* ---------- movimento leve: entrada por peça sem recalcular durante o scroll ---------- */
(()=>{
  const reduce=window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const selector=[
    ".hero",".card",".panel",".goal-card",".rule",".list-item",".indicator",
    ".action-item",".news-item",".live-entry",".appearance-option",
    ".scenario-grid > div"
  ].join(",");
  let observer=null;

  function prepare(root=document){
    const pieces=[...root.querySelectorAll(selector)];
    pieces.forEach((el,index)=>{
      if(el.dataset.motionReady)return;
      el.dataset.motionReady="1";
      el.classList.add("motion-piece");
      el.style.setProperty("--motion-x",((index%2)?1:-1)*(14+(index%3)*5)+"px");
      el.style.setProperty("--motion-y",(8+(index%4)*3)+"px");
      if(reduce?.matches){
        el.classList.add("motion-visible");
        return;
      }
      observer?.observe(el);
    });
  }

  if(!reduce?.matches && "IntersectionObserver" in window){
    observer=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){
          entry.target.classList.add("motion-visible");
          observer.unobserve(entry.target);
        }
      });
    },{rootMargin:"0px 0px -3% 0px",threshold:.03});
  }

  document.addEventListener("click",e=>{
    if(e.target.closest("[data-page], .side-nav a, .mobile-nav button")){
      setTimeout(()=>prepare(document),0);
    }
  },true);

  document.addEventListener("focusin",e=>{
    const field=e.target.closest?.("input,select,textarea");
    if(field)field.classList.add("typing-active");
  });
  document.addEventListener("focusout",e=>{
    const field=e.target.closest?.("input,select,textarea");
    if(field)field.classList.remove("typing-active");
  });

  prepare(document);
})();

