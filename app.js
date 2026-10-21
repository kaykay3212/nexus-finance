const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const OFFLINE_MESSAGE="Sem internet: login, movimentações e dados financeiros não podem ser sincronizados.";
const brl=v=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v)||0);
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const today=()=>{
  const date=new Date();
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
};
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
    const mobilePages=pages.filter(p=>p.showMobile!==false);
    mobile.innerHTML='<button type="button" class="mobile-nav-toggle" aria-label="Abrir navegação" aria-expanded="false" aria-controls="mobileNavItems"><b></b></button><div class="mobile-nav-items" id="mobileNavItems" hidden>'+mobilePages.map(p=>
      '<button type="button" data-page="'+esc(p.id)+'" aria-label="'+esc(p.mobileLabel||p.label||p.title||p.id)+'"><b>'+(p.id==="stats"?'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 19V5M4 19h17M8 16v-5m4 5V8m4 8v-9m4 9v-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>':esc(p.icon||"•"))+'</b></button>'
    ).join("")+'</div>';
    syncMobileNav();
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
let historyVisible=80;
let pieChart=null,barChart=null;
let paymentTarget=null;
let editingId=null;
let goals=[];
let marketState={prices:{},fear:null,news:[],updatedAt:0,loading:null};
let activeApiRequests=0;
let appLoadingTimer=null;

function beginAppLoading(){
  activeApiRequests+=1;
  if(activeApiRequests!==1)return;
  appLoadingTimer=setTimeout(()=>{
    if(activeApiRequests===0||document.body.classList.contains("auth-locked"))return;
    $("#appLoading").hidden=false;
    $(".app").setAttribute("aria-busy","true");
  },280);
}
function endAppLoading(){
  activeApiRequests=Math.max(0,activeApiRequests-1);
  if(activeApiRequests)return;
  clearTimeout(appLoadingTimer);
  appLoadingTimer=null;
  $("#appLoading").hidden=true;
  $(".app").removeAttribute("aria-busy");
}

function toast(text){
  const el=$("#toast"); el.textContent=text; el.classList.add("show");
  clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove("show"),1900);
}
function closeMobileTabs(switcher){
  if(!switcher)return;
  switcher.classList.remove("mode-tabs-open");
  switcher.querySelector(".mobile-tabs-toggle")?.setAttribute("aria-expanded","false");
}
function syncMobileNav(page=$(".page.active")?.id){
  const nav=$(".mobile-nav");if(!nav)return;
  const toggle=nav.querySelector(".mobile-nav-toggle"),items=nav.querySelector(".mobile-nav-items");
  if(!toggle||!items)return;
  const selected=(structure.pages||[]).find(p=>p.id===page)||{};
  const currentIcon=toggle.querySelector("b");
  if(page==="stats")currentIcon.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 19V5M4 19h17M8 16v-5m4 5V8m4 8v-9m4 9v-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  else currentIcon.textContent=selected.icon||"•";
  toggle.setAttribute("aria-label","Página atual: "+(selected.mobileLabel||selected.label||selected.title||page||"Início")+". Abrir navegação");
  items.hidden=false;items.setAttribute("aria-hidden",String(!nav.classList.contains("mobile-nav-open")));
  items.querySelectorAll("[data-mobile-temporary]").forEach(button=>{
    if(button.dataset.page!==page)button.remove();
  });
  if(selected.id&&!items.querySelector('[data-page="'+selected.id+'"]')){
    const button=document.createElement("button"),icon=document.createElement("b");
    button.type="button";button.dataset.page=selected.id;button.dataset.mobileTemporary="true";
    button.setAttribute("aria-label",selected.mobileLabel||selected.label||selected.title||selected.id);
    icon.textContent=selected.icon||"•";button.appendChild(icon);items.prepend(button);
  }
  const buttons=[...items.querySelectorAll("[data-page]")];
  const active=buttons.find(button=>button.dataset.page===page);
  if(active)items.prepend(active);
  buttons.forEach(button=>{
    const current=button.dataset.page===page;
    button.classList.toggle("active",current);
    if(current)button.setAttribute("aria-current","page");else button.removeAttribute("aria-current");
  });
}
function closeMobileNav(){
  const nav=$(".mobile-nav"),toggle=nav?.querySelector(".mobile-nav-toggle"),items=nav?.querySelector(".mobile-nav-items");
  if(!nav||!toggle||!items)return;
  nav.classList.remove("mobile-nav-open");toggle.setAttribute("aria-expanded","false");items.setAttribute("aria-hidden","true");
  syncMobileNav();
}
function toggleMobileNav(toggle){
  const nav=toggle?.closest(".mobile-nav"),items=nav?.querySelector(".mobile-nav-items");
  if(!nav||!items)return;
  const open=!nav.classList.contains("mobile-nav-open");
  items.hidden=false;nav.classList.toggle("mobile-nav-open",open);toggle.setAttribute("aria-expanded",String(open));items.setAttribute("aria-hidden",String(!open));
  if(open)toggle.setAttribute("aria-label","Fechar navegação");else syncMobileNav();
}
function resetPageScroll(){
  const scroller=document.scrollingElement||document.documentElement;
  if(scroller)scroller.scrollTop=0;
  document.body.scrollTop=0;
  window.scrollTo(0,0);
}
function go(page){
  if(!document.getElementById(page))return;
  const previousPage=document.querySelector(".page.active")?.id;
  const pageChanged=previousPage!==page;
  if(pageChanged)nexusUI.cancelTouch();
  $$(".page").forEach(p=>p.classList.toggle("active",p.id===page));
  $$("[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  syncMobileNav(page);
  closeMobileNav();
  const meta=pageLabels[page]||[page,""];
  $("#pageTitle").textContent=meta[0]; $("#pageSub").textContent=meta[1];
  setupReveal($("#"+page));
  if(page==="stats")renderStats();
  if(page==="investments")renderInvestments();
  if(page==="goals")renderGoals();
  if(page==="crypto"&&(!marketState.news.length||Date.now()-marketState.updatedAt>120000))loadMarket();
  if(page==="crypto"&&cryptoLiveTab==="live")startLiveMonitor();
  if(page!=="crypto")stopLiveMonitor();
  if(page==="binance")loadBinance();
  if(page==="simulation")window.NEXUS_SIMULATION?.render();
  // Switching tabs must not issue programmatic scrolling during an iOS gesture.
}
function setDashboardView(view,focus=false){
  const selected=$("#home [data-dashboard-view=\""+view+"\"]");
  if(!selected)return;
  const changed=!selected.classList.contains("active");
  $$("#home [data-dashboard-view]").forEach(tab=>{
    const active=tab===selected;
    tab.classList.toggle("active",active);
    tab.setAttribute("aria-selected",String(active));
    tab.tabIndex=active?0:-1;
  });
  $$("#home [data-dashboard-panel]").forEach(panel=>{
    panel.hidden=panel.dataset.dashboardPanel!==view;
  });
  if(focus)selected.focus();
  setupReveal($("#home [data-dashboard-panel=\""+view+"\"]"));
  if(changed)resetPageScroll();
}
function setDashboardChart(chart){
  $$("#dashboardAnalytics [data-analytics-chart]").forEach(card=>{
    card.hidden=card.dataset.analyticsChart!==chart;
  });
}
$("#home [role=tablist]").addEventListener("click",event=>{
  const tab=event.target.closest("[data-dashboard-view]");
  if(tab)setDashboardView(tab.dataset.dashboardView);
});
$("#home [role=tablist]").addEventListener("keydown",event=>{
  if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
  const tabs=$$("#home [data-dashboard-view]"),current=tabs.indexOf(document.activeElement);
  if(current<0)return;
  event.preventDefault();
  const next=event.key==="Home"?0:event.key==="End"?tabs.length-1:(current+(event.key==="ArrowRight"?1:-1)+tabs.length)%tabs.length;
  setDashboardView(tabs[next].dataset.dashboardView,true);
});
$("#dashboardChartPicker").addEventListener("change",event=>setDashboardChart(event.target.value));
function bindNavigation(){
  $$("[data-page]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.page)));
}
buildSiteStructure();
const mobileNavElement=document.querySelector(".mobile-nav");
let mobilePressTimer=0;
function clearMobilePress(){
  clearTimeout(mobilePressTimer);
  mobileNavElement?.querySelectorAll(".is-pressing,.is-holding").forEach(button=>button.classList.remove("is-pressing","is-holding"));
}
mobileNavElement?.addEventListener("pointerdown",event=>{
  const button=event.target.closest("button");if(!button)return;
  clearMobilePress();
  button.classList.add("is-pressing");
  if(document.body.classList.contains("appearance-glass"))mobilePressTimer=setTimeout(()=>button.classList.add("is-holding"),180);
});
for(const type of ["pointerup","pointercancel","pointerleave"]){mobileNavElement?.addEventListener(type,clearMobilePress)}
// Legacy per-element navigation binding is intentionally not used.
// All persistent UI actions are routed by NexusUIController below.
class NexusUIController{
  constructor(root=document){
    this.root=root;this.bound=false;this.touchStart=null;this.touchPage=null;this.touchPageWidth=0;
    this.swipeNeighbor=null;this.swipeDirection=0;this.pendingTouch=null;this.touchFrame=0;
    this.minSwipe=46;this.maxVertical=96;this.swiping=false;this.gestureAbandoned=false;
  }
  bind(){
    if(this.bound)return;
    this.bound=true;
    this.root.addEventListener("click",e=>this.onClick(e));
    this.root.addEventListener("keydown",e=>this.onKeyDown(e));
    // Preserve native vertical scrolling on touch devices. Page switching uses the mobile navigation.
    // Horizontal swipe transforms caused scroll capture, stuck page heights and blank areas on iOS.
  }
  swipePages(){
    return (structure.pages||[]).filter(p=>p.showMobile!==false&&document.getElementById(p.id)).map(p=>p.id);
  }
  onTouchStart(e){
    this.cancelTouch();
    if(e.touches.length!==1||e.target.closest("input,textarea,select,button,a,.segmented,.filters,.news-list,.live-log"))return;
    const t=e.touches[0],page=document.querySelector(".page.active");
    if(!page)return;
    this.touchStart={x:t.clientX,y:t.clientY,time:Date.now()};
    this.touchPage=page;this.touchPageWidth=Math.max(280,page.getBoundingClientRect().width);
  }
  prepareNeighbor(dx){
    const active=this.touchPage,pages=this.swipePages(),i=pages.indexOf(active?.id);
    const direction=dx<0?-1:1;
    this.swipeDirection=direction;
    if(!active||i<0)return null;
    const next=direction<0?i+1:i-1;
    if(next<0||next>=pages.length)return null;
    const neighbor=document.getElementById(pages[next]);
    if(!neighbor)return null;
    if(this.swipeNeighbor&&this.swipeNeighbor!==neighbor)this.clearNeighbor();
    this.swipeNeighbor=neighbor;
    this.swipeDirection=dx<0?-1:1;
    const app=document.querySelector("main.app"),header=document.querySelector(".topbar");
    const visibleTop=Math.max(0,(header?.getBoundingClientRect().bottom||0)-(app?.getBoundingClientRect().top||0));
    neighbor.style.setProperty("--preview-top",visibleTop+"px");
    neighbor.style.setProperty("--preview-header-height",Math.max(0,header?.getBoundingClientRect().bottom||0)+"px");
    neighbor.classList.add("swipe-preview",dx<0?"swipe-from-right":"swipe-from-left");
    return neighbor;
  }
  clearNeighbor(){
    this.swipeDirection=0;
    if(!this.swipeNeighbor)return;
    this.swipeNeighbor.classList.remove("swipe-preview","swipe-from-right","swipe-from-left");
    this.swipeNeighbor.style.removeProperty("--preview-x");
    this.swipeNeighbor.style.removeProperty("--preview-opacity");
    this.swipeNeighbor.style.removeProperty("--preview-top");
    this.swipeNeighbor.style.removeProperty("--preview-header-height");
    this.swipeNeighbor=null;
  }
  onTouchMove(e){
    if(!this.touchStart||!e.touches.length||this.gestureAbandoned)return;
    const t=e.touches[0];
    this.pendingTouch={x:t.clientX,y:t.clientY};
    if(!this.touchFrame)this.touchFrame=requestAnimationFrame(()=>this.applyTouchMove());
  }
  applyTouchMove(){
    this.touchFrame=0;
    const point=this.pendingTouch;this.pendingTouch=null;
    if(!point||!this.touchStart||!this.touchPage||this.gestureAbandoned)return;
    const dx=point.x-this.touchStart.x,dy=point.y-this.touchStart.y;
    if(Math.abs(dx)<5)return;
    if(Math.abs(dx)<=Math.abs(dy)*1.06){
      this.gestureAbandoned=true;
      if(this.swiping)this.clearSwipe(true);
      return;
    }
    const page=this.touchPage,width=this.touchPageWidth,progress=Math.min(1,Math.abs(dx)/width);
    const move=Math.max(-width*.92,Math.min(width*.92,dx*.96));
    page.classList.add("swiping");page.style.setProperty("--swipe-x",move+"px");
    page.style.setProperty("--swipe-opacity",String(1-progress*.10));
    const direction=dx<0?-1:1;
    const neighbor=this.swipeDirection===direction?this.swipeNeighbor:this.prepareNeighbor(dx);
    if(neighbor){
      const start=dx<0?width*.22:-width*.22;
      neighbor.style.setProperty("--preview-x",(start*(1-progress))+"px");
      neighbor.style.setProperty("--preview-opacity",String(.32+progress*.68));
    }
    this.swiping=true;
  }
  clearSwipe(animate=false){
    const page=this.touchPage||document.querySelector(".page.active");
    if(page){
      if(animate)page.classList.add("swipe-settling");
      else page.classList.remove("swipe-settling");
      page.classList.remove("swiping","swipe-complete");page.style.removeProperty("--swipe-x");page.style.removeProperty("--swipe-opacity");
      if(animate)setTimeout(()=>page.classList.remove("swipe-settling"),280);
    }
    this.clearNeighbor();this.swiping=false;this.pendingTouch=null;
  }
  cancelTouch(){
    const hadSwipe=this.swiping||this.swipeNeighbor||this.touchPage?.classList.contains("swiping");
    if(this.touchFrame)cancelAnimationFrame(this.touchFrame);
    this.touchFrame=0;this.pendingTouch=null;this.touchStart=null;
    this.touchPageWidth=0;this.gestureAbandoned=false;
    if(hadSwipe)this.clearSwipe(true);
    this.touchPage=null;
  }
  onTouchEnd(e){
    if(!this.touchStart||!e.changedTouches.length)return;
    if(this.touchFrame)cancelAnimationFrame(this.touchFrame);
    this.touchFrame=0;this.pendingTouch=null;
    const start=this.touchStart,page=this.touchPage,width=this.touchPageWidth;
    const t=e.changedTouches[0],dx=t.clientX-start.x,dy=t.clientY-start.y,elapsed=Date.now()-start.time;
    this.touchStart=null;
    this.touchPage=null;this.touchPageWidth=0;
    const valid=!this.gestureAbandoned&&elapsed<=850&&Math.abs(dx)>=this.minSwipe&&Math.abs(dy)<=this.maxVertical&&Math.abs(dx)>=Math.abs(dy)*1.10;
    this.gestureAbandoned=false;
    const active=page?.id;
    if(!valid){this.clearSwipe(true);return}
    if(active==="crypto"&&((dx<0&&cryptoLiveTab==="radar")||(dx>0&&cryptoLiveTab==="live"))){
      const destination=dx<0?"live":"radar";
      this.clearSwipe(true);setTimeout(()=>{
        if(cryptoLiveTab===destination)return;
        setCryptoTab(destination);
      },110);return;
    }
    const pages=this.swipePages(),i=pages.indexOf(active),next=dx<0?i+1:i-1;
    if(next<0||next>=pages.length){this.clearSwipe(true);return}
    if(page){page.classList.remove("swiping");page.classList.add("swipe-complete");page.style.setProperty("--swipe-x",(dx<0?-width:width)+"px");}
    setTimeout(()=>{this.clearSwipe();if(next>=0&&next<pages.length)go(pages[next]);},190);
  }
  onClick(e){
    const mobileToggle=e.target.closest(".mobile-nav-toggle");
    if(mobileToggle){toggleMobileNav(mobileToggle);return}
    if(!e.target.closest(".mobile-nav")&&$(".mobile-nav.mobile-nav-open"))closeMobileNav();
    if(e.target.closest("[data-history-more]")){historyVisible+=80;renderHistory();return}
    const page=e.target.closest("[data-page]");
    if(page){e.preventDefault();go(page.dataset.page);return}
    const mode=e.target.closest("#modeTabs button[data-mode]");
    if(mode){e.preventDefault();setMode(mode.dataset.mode);return}
    const tabsToggle=e.target.closest(".mobile-tabs-toggle");
    if(tabsToggle){
      const switcher=tabsToggle.closest(".mobile-tabs-switcher");
      const open=switcher.classList.toggle("mode-tabs-open");
      tabsToggle.setAttribute("aria-expanded",String(open));
      return;
    }
    const crypto=e.target.closest("#cryptoTabs [data-crypto-tab]");
    if(crypto){e.preventDefault();setCryptoTab(crypto.dataset.cryptoTab);return}
    if(e.target.closest("#binanceShortcut")){e.preventDefault();closeMobileTabs($(".crypto-tabs-switcher"));go("binance");return}
    const filter=e.target.closest("#historyFilters button[data-filter]");
    if(filter){
      e.preventDefault();
      historyFilter=filter.dataset.filter;
      historyVisible=80;
      document.querySelectorAll("#historyFilters button").forEach(x=>x.classList.toggle("active",x===filter));
      const toggle=$(".history-filter-switcher .mobile-tabs-toggle");
      if(toggle)toggle.setAttribute("aria-label","Filtro selecionado: "+filter.textContent.trim()+". Abrir filtros do histórico");
      closeMobileTabs($(".history-filter-switcher"));
      renderHistory();
    }
  }
  onKeyDown(e){
    if(e.key!=="Escape")return;
    const nav=$(".mobile-nav.mobile-nav-open");if(!nav)return;
    closeMobileNav();nav.querySelector(".mobile-nav-toggle")?.focus();
  }
}
const nexusUI=new NexusUIController();
nexusUI.bind();

function setupReveal(root=document){
  window.dispatchEvent(new CustomEvent("nexus:motion-scan",{detail:{root}}));
}
/* ---------- backend e sessão ---------- */
let currentUser=null;
let accountRevision=0;
let authMode="login";
let goalsAvailable=true;
function backendBase(){
  if(["http:","https:"].includes(window.location.protocol))return window.location.origin;
  return "http://localhost:8000";
}
function apiErrorMessage(error){
  if(error.code==="invalid_credentials")return "E-mail ou senha incorretos.";
  if(error.code==="registration_disabled")return "O cadastro de novas contas está temporariamente desativado.";
  if(error.code==="invalid_password")return "A senha precisa ter pelo menos 6 caracteres.";
  if(error.code==="account_exists")return "Já existe uma conta com este e-mail.";
  if(error.status===429)return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  if(error.name==="AbortError")return "O servidor não respondeu a tempo. No plano gratuito ele pode demorar para iniciar; aguarde um momento e tente novamente.";
  if(error instanceof TypeError&&!navigator.onLine)return OFFLINE_MESSAGE;
  if(error instanceof TypeError)return "Não foi possível conectar ao serviço. Verifique sua conexão e tente novamente.";
  if(error.status===401)return "Sua sessão expirou. Entre novamente para continuar.";
  if(error.status===404)return "Este recurso não está disponível neste backend.";
  return error.message||"O backend não conseguiu concluir a solicitação.";
}
function showAppError(error){
  if(error?.status===401){
    lockApp(apiErrorMessage(error));
    return;
  }
  const el=$("#appNotice");if(!el)return;
  el.textContent=apiErrorMessage(error);el.hidden=false;
}
function clearAppError(){const el=$("#appNotice");if(el){el.textContent="";el.hidden=true}}
window.addEventListener("offline",()=>{
  const notice=$("#appNotice");
  if(notice){notice.textContent=OFFLINE_MESSAGE;notice.hidden=false}
});
window.addEventListener("online",()=>{
  const notice=$("#appNotice");
  if(notice?.textContent===OFFLINE_MESSAGE)clearAppError();
});
function setAuthError(message){$("#authError").textContent=message||""}
function setAuthMode(mode){
  authMode=mode;
  const register=mode==="register";
  $("#authTitle").textContent=register?"Criar sua conta":"Entre na sua conta";
  $("#authSubmitLabel").textContent=register?"Criar conta":"Entrar";
  $("#authPassword").autocomplete=register?"new-password":"current-password";
  $("#authModeToggle").textContent=register?"Já tem uma conta? Entrar":"Ainda não tem conta? Criar conta";
  setAuthError("");
}
async function apiRequest(path,{method="GET",body,timeoutMs=65000}={}){
  const revision=accountRevision;
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  const options={method,credentials:"include",headers:{},signal:controller.signal};
  if(body!==undefined){options.headers["Content-Type"]="application/json";options.body=JSON.stringify(body)}
  beginAppLoading();
  try{
    const response=await fetch(backendBase()+path,options);
    let data=null;
    if(response.status!==204){
      try{data=await response.json()}
      catch(error){
        if(error.name==="AbortError")throw error;
        if(response.ok)throw new Error("O backend retornou uma resposta inválida.");
      }
    }
    if(!response.ok){
      const message=data?.message||data?.detail||data?.error||("Backend respondeu HTTP "+response.status);
      const error=new Error(typeof message==="string"?message:JSON.stringify(message));
      error.status=response.status;error.code=data?.error;throw error;
    }
    if(!path.startsWith("/api/auth/")&&revision!==accountRevision)throw new Error("A conta mudou durante a solicitação. Entre novamente para atualizar os dados.");
    return data;
  }finally{
    clearTimeout(timeout);
    endAppLoading();
  }
}
function lockApp(message="",{preserveEmail=false}={}){
  accountRevision+=1;
  currentUser=null;rows=[];goals=[];document.body.classList.add("auth-locked");
  window.NEXUS_SIMULATION?.reset();
  stopLiveMonitor();
  $("#binanceBalances")?.replaceChildren();
  if($("#binanceStatus"))$("#binanceStatus").textContent="Entre para consultar sua carteira.";
  window.NexusDashboardCharts?.close();
  editingId=null;
  $("#saveMovement").textContent="Salvar";
  $("#cancelEdit").classList.add("hidden");
  $("#authPassword").value="";
  if(!preserveEmail)$("#authEmail").value="";
  $("#movementForm")?.reset();
  closePaymentModal();
  renderAll();
  $("#accountStatus").textContent="";$("#syncLabel").textContent="Entre para conectar";
  if(message)setAuthError(message);
}
function unlockApp(user){
  currentUser=user||{};document.body.classList.remove("auth-locked");
  const email=currentUser.email||"Conta conectada";
  $("#accountStatus").textContent="Conectado como "+email;
  $("#syncLabel").textContent="Conta autenticada";
  $(".avatar").textContent=String(email).charAt(0).toUpperCase();
  updateLocalImportPanel();
  setupReveal(document.querySelector(".page.active")||document);
}
async function loadAccountData(){
  rows=await fetchAllTransactions();
  goalsAvailable=true;
  try{
    const goalData=await apiRequest("/api/goals");
    if(!Array.isArray(goalData?.goals))throw new Error("Resposta inválida ao carregar metas.");
    goals=goalData.goals;
  }catch(error){
    if([404,405,501].includes(error.status)){goals=[];goalsAvailable=false}
    else throw error;
  }
  renderAll();checkPaymentReminder();
  if(!goalsAvailable)showAppError(new Error("O backend não oferece suporte a metas; elas não serão salvas neste aparelho."));
  else clearAppError();
}
async function fetchAllTransactions(){
  const transactions=[];
  const pageSize=5000;
  for(let offset=0;;offset+=pageSize){
    const txData=await apiRequest(`/api/transactions?limit=${pageSize}&offset=${offset}`);
    if(!Array.isArray(txData?.transactions))throw new Error("Resposta inválida ao carregar movimentações.");
    transactions.push(...txData.transactions);
    if(txData.transactions.length<pageSize)break;
  }
  return transactions.map(normalize);
}
function normalize(x){
  return {
    id:x.id??Date.now()+Math.random(),
    date:String(x.date||""),
    type:x.type||"Saída",
    description:x.description||"",
    category:x.category||"Outros",
    subcategory:x.subcategory||"",
    purpose:x.purpose||"",
    classification:x.classification||"Controlável",
    amount:Number(x.amount)||0,
    month:x.month||"",
    year:Number(x.year)||0,
    status:x.status||"Realizado",
    note:x.note||"",
    mode:x.mode||x.modalidade||"Movimentação",
    installments:Number(x.installments)||0,
    currentInstallment:Number(x.currentInstallment)||0,
    dueDay:Number(x.dueDay)||0,
    recurrence:x.recurrence||"Único",
    priority:x.priority||"",
    paidAt:String(x.paidAt||"")
  };
}
function getLocalImportData(){
  const transactionsRaw=localStorage.getItem("nexusLocalRows");
  const goalsRaw=localStorage.getItem("nexusGoals");
  const transactions=transactionsRaw?JSON.parse(transactionsRaw):[];
  const localGoals=goalsRaw?JSON.parse(goalsRaw):[];
  if(!Array.isArray(transactions)||!Array.isArray(localGoals)){
    throw new Error("Os dados locais não estão no formato esperado. Eles foram mantidos neste aparelho.");
  }
  return{transactionsRaw,goalsRaw,transactions,goals:localGoals};
}
function updateLocalImportPanel(){
  const panel=$("#localImportPanel");
  if(!panel)return;
  if(!currentUser){panel.hidden=true;return}
  try{
    const data=getLocalImportData();
    const count=data.transactions.length+data.goals.length;
    panel.hidden=count===0;
    $("#localImportSummary").textContent=count
      ?`${data.transactions.length} movimentação(ões) e ${data.goals.length} meta(s) salvas neste navegador.`
      :"Não há registros locais para importar.";
  }catch(error){
    panel.hidden=false;
    $("#localImportSummary").textContent=error.message;
    $("#localImportButton").disabled=true;
  }
}
async function importLocalData(){
  const button=$("#localImportButton");
  let data;
  try{data=getLocalImportData()}
  catch(error){showAppError(error);return}
  const transactionCount=data.transactions.length,goalCount=data.goals.length;
  if(!transactionCount&&!goalCount){updateLocalImportPanel();return}
  const confirmed=window.confirm(
    `Importar ${transactionCount} movimentação(ões) e ${goalCount} meta(s) para sua conta? `+
    "O Nexus manterá os dados deste navegador até o PostgreSQL confirmar a importação completa."
  );
  if(!confirmed)return;

  let importId=localStorage.getItem("nexusLegacyImportId");
  if(!importId){
    if(!crypto.randomUUID){showAppError(new Error("Este navegador não oferece identificadores seguros para a importação."));return}
    importId=crypto.randomUUID();
    localStorage.setItem("nexusLegacyImportId",importId);
  }
  button.disabled=true;
  try{
    const result=await apiRequest("/api/transactions/import",{
      method:"POST",
      timeoutMs:60000,
      body:{importId,transactions:data.transactions,goals:data.goals}
    });
    if(result?.imported?.transactions!==transactionCount||result?.imported?.goals!==goalCount){
      throw new Error("O backend não confirmou todos os registros. Os dados locais foram mantidos.");
    }
    const latest=getLocalImportData();
    if(latest.transactionsRaw!==data.transactionsRaw||latest.goalsRaw!==data.goalsRaw){
      throw new Error("Os dados locais mudaram durante a importação. A cópia original foi mantida; atualize a página antes de tentar novamente.");
    }
    localStorage.removeItem("nexusLocalRows");
    localStorage.removeItem("nexusGoals");
    localStorage.removeItem("nexusLegacyImportId");
    await loadAccountData();
    updateLocalImportPanel();
    toast("Dados importados e confirmados no PostgreSQL");
  }catch(error){
    showAppError(error);
  }finally{
    button.disabled=false;
  }
}
async function createRecord(record){
  if(!currentUser)throw new Error("Entre na sua conta antes de salvar movimentações.");
  const result=await apiRequest("/api/transactions",{method:"POST",body:record});
  if(result?.transaction)rows.push(normalize(result.transaction));
  else await reloadTransactions();
  renderAll();
}
async function reloadTransactions(){
  rows=await fetchAllTransactions();
}
async function updateRecord(id,record){
  const existing=rows.find(r=>String(r.id)===String(id));
  const payload={...(existing||{}),...record};delete payload.id;
  const result=await apiRequest("/api/transactions/"+encodeURIComponent(id),{method:"PUT",body:payload});
  if(result?.transaction){
    const ix=rows.findIndex(r=>String(r.id)===String(id));
    if(ix>=0)rows[ix]=normalize(result.transaction);
  }else await reloadTransactions();
  renderAll();
}
async function deleteRecord(id){
  await apiRequest("/api/transactions/"+encodeURIComponent(id),{method:"DELETE"});
  rows=rows.filter(r=>String(r.id)!==String(id));renderAll();clearAppError();toast("Movimentação excluída");
}
function startEdit(id){
  const r=rows.find(x=>String(x.id)===String(id));if(!r)return;
  editingId=r.id;setMode(r.mode||"Movimentação");
  $("#fType").value=r.type;syncMovementType(r.category);$("#fAmount").value=r.amount;$("#fDescription").value=r.description;
  $("#fClass").value=r.classification;$("#fNote").value=r.note||"";
  $("#fDate").value=r.date||today();$("#fStatus").value=["Previsto","Realizado"].includes(r.status)?r.status:"Realizado";
  if(r.mode==="Compromisso"||r.mode==="Assinatura"){
    $("#fDueDate").value=r.date||today();$("#fInstallments").value=r.mode==="Assinatura"?0:(r.installments||1);$("#fCurrentInstallment").value=r.mode==="Assinatura"?0:(r.currentInstallment||1);
    $("#fDueDay").value=r.dueDay||"";$("#fRecurrence").value=r.recurrence||"Mensal";$("#fPriority").value=r.priority||"Média";
  }
  if(r.mode==="Renda Fixa"){
    $("#fFixedProduct").value=r.subcategory||"CDB";
    $("#fFixedDate").value=r.date||today();
    const rate=String(r.note||"").match(/Taxa estimada:\s*([\d.,]+)%/i);
    const due=String(r.note||"").match(/Vencimento:\s*(\d{4}-\d{2}-\d{2})/i);
    $("#fFixedRate").value=rate?rate[1].replace(",","."):"";
    $("#fFixedDue").value=due?due[1]:"";
    $("#fNote").value=String(r.note||"").split(" | ").filter(part=>!/^Taxa estimada:|^Vencimento:/.test(part)).join(" | ");
  }
  $("#formTitle").textContent="Editar registro";$("#saveMovement").textContent="Salvar alterações";$("#cancelEdit").classList.remove("hidden");
  go("movements");window.scrollTo({top:0,behavior:"smooth"});
}
function cancelEdit(){
  editingId=null;$("#movementForm").reset();$("#fDate").value=today();$("#fFixedDate").value=today();$("#saveMovement").textContent="Salvar";$("#cancelEdit").classList.add("hidden");setMode(currentMode);
}
$("#cancelEdit").addEventListener("click",cancelEdit);

const paymentsInFlight=new Set();
async function markPaid(id){
  const key=String(id),item=rows.find(r=>String(r.id)===key);
  if(!item||realized(item)||paymentsInFlight.has(key))return;
  paymentsInFlight.add(key);
  try{
    const result=await apiRequest("/api/transactions/"+encodeURIComponent(id)+"/pay",{method:"PATCH",body:{atomicPayment:true}});
    if(result?.transaction){
      const ix=rows.findIndex(r=>String(r.id)===key);
      if(ix>=0)rows[ix]=normalize(result.transaction);
      if(result.nextTransaction&&!rows.some(r=>String(r.id)===String(result.nextTransaction.id)))rows.push(normalize(result.nextTransaction));
    }else await reloadTransactions();
    renderAll();closePaymentModal();clearAppError();toast("Pagamento marcado como pago");
  }finally{paymentsInFlight.delete(key)}
}

/* ---------- formulário ---------- */
const expenseCategories=["Casa","Alimentação","Transporte","Assinaturas","Lazer","Compras","Reserva","Investimentos","Educação","Outros"];
const incomeCategories=["Salário","Renda extra","Reembolso","Venda","Rendimentos","Outros"];
function syncMovementType(preferredCategory){
  const income=currentMode==="Movimentação"&&$("#fType").value==="Entrada";
  $("#fClassField").hidden=income;
  $("#fNoteField").hidden=income;
  $("#fCategoryLabel").textContent=income?"Origem":"Categoria";
  $("#fDescription").placeholder=income?"Ex.: salário, reembolso":"Ex.: mercado, aluguel";
  const select=$("#fCategory"),selected=preferredCategory||select.value;
  const choices=income?incomeCategories:expenseCategories;
  const keepCustom=Boolean(preferredCategory&&editingId);
  select.replaceChildren(...[...new Set([...choices,...(keepCustom?[preferredCategory]:[])])].map(value=>{
    const option=document.createElement("option");option.value=value;option.textContent=value;return option;
  }));
  select.value=choices.includes(selected)||keepCustom?selected:income?"Salário":"Casa";
  if(income)$("#fClass").value="Controlável";
}
$("#fType").addEventListener("change",()=>syncMovementType());
function setMode(mode){
  const changed=currentMode!==mode;
  currentMode=mode;
  document.querySelectorAll("#modeTabs button").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));
  const modeToggle=$("#modeTabsToggle"),modeSwitcher=$(".mode-switcher");
  if(modeToggle&&modeSwitcher){
    const selected=$$("#modeTabs button").find(button=>button.dataset.mode===mode);
    modeToggle.setAttribute("aria-label","Tipo selecionado: "+(selected?.textContent.trim()||mode)+". Abrir tipos de movimentação");
    closeMobileTabs(modeSwitcher);
  }
  $("#commitmentFields").classList.toggle("hidden",mode!=="Compromisso");
  $("#installmentsField").classList.toggle("hidden",mode==="Assinatura");
  $("#currentInstallmentField").classList.toggle("hidden",mode==="Assinatura");
  $("#fixedFields").classList.toggle("hidden",mode!=="Renda Fixa");
  $("#normalFields").classList.toggle("hidden",mode!=="Movimentação");
  if(mode==="Assinatura"){$("#fInstallments").value=0;$("#fCurrentInstallment").value=0;$("#commitmentFields").classList.remove("hidden");$("#fixedFields").classList.add("hidden");$("#normalFields").classList.add("hidden");$("#formTitle").textContent="Adicionar assinatura ou conta recorrente";$("#fType").value="Saída";$("#fRecurrence").value="Mensal";$("#fClass").value="Compromisso";}
  if(mode==="Movimentação"){$("#formTitle").textContent="Adicionar movimentação"}
  if(mode==="Compromisso"){
    $("#formTitle").textContent="Adicionar compromisso ou dívida";
    $("#fType").value="Saída";$("#fClass").value="Compromisso";
  }
  if(mode==="Renda Fixa"){
    $("#formTitle").textContent="Registrar renda fixa";
    $("#fType").value="Saída";$("#fCategory").value="Investimentos";$("#fClass").value="Investimento";
  }
  syncMovementType();
  if(changed&&document.getElementById("movements")?.classList.contains("active"))resetPageScroll();
}

$("#fDate").value=today();$("#fFixedDate").value=today();

$("#movementForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const form=e.currentTarget,button=$("#saveMovement");
  if(button.disabled)return;
  const original=rows.find(r=>String(r.id)===String(editingId));
  const base={
    type:$("#fType").value,
    description:$("#fDescription").value.trim(),
    category:$("#fCategory").value,
    classification:$("#fClass").value,
    amount:Number($("#fAmount").value||0),
    mode:currentMode,
    recurrence:"Único",priority:"",installments:0,currentInstallment:0,dueDay:0,paidAt:"",
    note:$("#fNote").value.trim()
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
      installments:currentMode==="Assinatura"?0:Math.max(1,Number($("#fInstallments").value||1)),
      currentInstallment:currentMode==="Assinatura"?0:Math.max(1,Number($("#fCurrentInstallment").value||1)),
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
  if(original&&original.mode===currentMode&&realized(original)&&currentMode!=="Movimentação"){
    base.status=original.status;base.paidAt=original.paidAt;
  }
  button.disabled=true;
  try{
    toast("Salvando...");
    if(editingId){
      await updateRecord(editingId,base);editingId=null;$("#saveMovement").textContent="Salvar";$("#cancelEdit").classList.add("hidden");toast("Registro atualizado");
    }else await createRecord(base);
    form.reset();$("#fDate").value=today();$("#fFixedDate").value=today();setMode(currentMode);
    clearAppError();toast("Registro salvo");go("movements");
  }catch(err){showAppError(err);toast("Não foi possível salvar")}
  finally{button.disabled=false}
});

/* ---------- histórico ---------- */
function dayDiff(date){return Math.floor((new Date(date+"T12:00:00")-new Date(today()+"T12:00:00"))/86400000)}
function isPendingPayment(r){return ["Compromisso","Assinatura"].includes(r.mode)&&!realized(r)}
function effectiveStatus(r){
  if(r.status==="Pago"||r.status==="Realizado")return r.status;
  if(isPendingPayment(r)&&r.date&&dayDiff(r.date)<0)return "Atrasado";
  return r.status;
}
function renderHistory(){
  const q=$("#historySearch").value.toLowerCase().trim();
  let data=[...rows].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  if(historyFilter==="Investimentos")data=data.filter(isInvestmentRecord);
  else if(historyFilter!=="Todos")data=data.filter(r=>r.mode===historyFilter);
  if(q)data=data.filter(r=>(r.description+" "+r.category+" "+r.classification+" "+r.note).toLowerCase().includes(q));
  const box=$("#historyList");
  if(!data.length){box.innerHTML='<div class="insight">Nenhum registro encontrado.</div>';return}
  box.innerHTML=data.slice(0,historyVisible).map(r=>{
    const st=effectiveStatus(r),isIn=r.type==="Entrada";
    const iconClass=r.mode==="Renda Fixa"?"investment":r.mode==="Compromisso"?"commitment":r.mode==="Assinatura"?"subscription":isIn?"income":"expense";
    const extra=(r.mode==="Compromisso"||r.mode==="Assinatura")?(r.installments?(" • parcela "+r.currentInstallment+"/"+r.installments):""):"";
    return '<div class="list-item"><div class="list-icon '+iconClass+'">'+(r.mode==="Renda Fixa"?"◆":r.mode==="Compromisso"?"!":isIn?"↙":"↘")+'</div><div class="list-info"><b>'+esc(r.description)+'</b><span>'+esc(r.mode)+" • "+esc(r.category)+" • "+esc(r.classification)+extra+" • "+esc(st)+'</span></div><div class="list-value '+(isIn?"nexus-tone-good":"nexus-tone-bad")+'">'+(r.mode==="Renda Fixa"?"":isIn?"+":"-")+" "+brl(r.amount)+'<div class="list-actions"><button class="mini" data-edit="'+esc(r.id)+'">Editar</button><button class="mini" data-delete="'+esc(r.id)+'">Excluir</button>'+( isPendingPayment(r)?'<button class="mini pay" data-pay="'+esc(r.id)+'">Já paguei</button>':"")+'</div></div></div>';
  }).join("");
  if(data.length>historyVisible)box.insertAdjacentHTML("beforeend",'<button type="button" class="secondary" data-history-more>Carregar mais ('+(data.length-historyVisible)+' restantes)</button>');
  $$("[data-pay]").forEach(b=>b.addEventListener("click",()=>markPaid(b.dataset.pay).catch(showAppError)));
  $$("[data-edit]").forEach(b=>b.addEventListener("click",()=>startEdit(b.dataset.edit)));
  $$("[data-delete]").forEach(b=>b.addEventListener("click",async()=>{
    if(!confirm("Excluir esta movimentação? Esta ação não pode ser desfeita."))return;
    try{await deleteRecord(b.dataset.delete)}catch(error){showAppError(error)}
  }));
  setupReveal(box);
}
$("#historySearch").addEventListener("input",()=>{historyVisible=80;renderHistory()});


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
  const expense=done.filter(r=>r.type==="Saída").reduce((s,r)=>s+r.amount,0);
  const invest=done.filter(isInvestmentRecord).reduce((s,r)=>s+r.amount,0);
  const pending=m.filter(r=>isPendingPayment(r)).reduce((s,r)=>s+r.amount,0);
  const savings=income?(income-expense)/income*100:0;
  const unnecessary=done.filter(r=>r.type==="Saída"&&r.classification==="Não necessário").reduce((s,r)=>s+r.amount,0);
  const essential=done.filter(r=>r.type==="Saída"&&r.classification==="Essencial").reduce((s,r)=>s+r.amount,0);
  const commitments=done.filter(r=>r.type==="Saída"&&r.classification==="Compromisso").reduce((s,r)=>s+r.amount,0);
  let score=income?Math.round(Math.max(0,Math.min(100,50+savings*.35+(invest/income*100)*.18-(unnecessary/income*100)*.65))):0;
  return{m,done,income,expense,balance:income-expense,invest,pending,savings,unnecessary,essential,commitments,score};
}
function renderDashboardGoalMonitor(){
  const box=$("#dashboardGoalMonitor");
  if(!box)return;
  if(!goals.length){
    box.innerHTML='<div class="insight">Nenhuma meta cadastrada. Crie uma meta para acompanhar o valor acumulado e o prazo.</div>';
    return;
  }
  box.innerHTML=goals.map(goal=>{
    const target=Number(goal.target)||0,current=Number(goal.current)||0;
    const pct=target>0?Math.min(100,Math.max(0,current/target*100)):0;
    const remaining=Math.max(0,target-current);
    let status="Sem prazo",risk="no-date",deadline="";
    if(current>=target&&target>0){status="Concluída";risk="complete"}
    else if(goal.date){
      const days=dayDiff(goal.date);
      if(Number.isNaN(days)){status="Prazo inválido";risk="no-date"}
      else if(days<0){status="Prazo vencido";risk="overdue"}
      else if(days<=30){status=days===0?"Vence hoje":"Vence em "+days+" dias";risk="soon"}
      else{status="No prazo";risk="on-track"}
      if(!Number.isNaN(days))deadline=" • "+new Date(goal.date+"T12:00:00").toLocaleDateString("pt-BR");
    }
    return '<article class="goal-monitor-item"><div class="goal-monitor-heading"><div><b>'+esc(goal.name)+'</b><span>'+brl(current)+' de '+brl(target)+'</span></div><strong>'+pct.toFixed(0)+'%</strong></div><div class="goal-monitor-track" role="progressbar" aria-label="Progresso de '+esc(goal.name)+'" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+pct.toFixed(0)+'"><i style="width:'+pct+'%"></i></div><div class="goal-monitor-meta"><span class="goal-monitor-status '+risk+'">'+status+'</span><span>'+brl(remaining)+' restantes'+deadline+'</span></div></article>';
  }).join("");
}
function isInvestmentRecord(record){
  return record.type==="Saída"&&(
    record.classification==="Investimento"||
    record.category==="Investimentos"||
    record.category==="Reserva"||
    record.mode==="Renda Fixa"
  );
}
function renderDashboard(){
  const x=calcMonth();
  $("#kpiBalance").textContent=brl(x.balance);$("#kpiIncome").textContent=brl(x.income);$("#kpiExpense").textContent=brl(x.expense);
  [["kpiBalance",x.balance<0?"bad":x.balance>0?"good":"neutral"],["kpiIncome",x.income>0?"good":"neutral"],["kpiExpense",x.expense>0?"bad":"neutral"],["kpiInvest",x.invest>0?"good":"neutral"],["kpiPending",x.pending>0?"bad":"neutral"]].forEach(([id,tone])=>{const el=$("#"+id);if(el){el.classList.remove("nexus-tone-good","nexus-tone-bad","nexus-tone-neutral");el.classList.add("nexus-tone-"+tone)}});
  $("#kpiSavings").textContent=x.savings.toFixed(1).replace(".",",")+"%";$("#kpiInvest").textContent=brl(x.invest);$("#kpiPending").textContent=brl(x.pending);
  $("#heroScore").textContent=x.income?x.score+"%":"—";$("#ringScore").textContent=x.income?x.score+"%":"—";
  $("#scoreRing").style.setProperty("--score-pct",x.income?x.score+"%":"0%");
  $("#scoreRing").setAttribute("aria-label",x.income?"Saúde financeira: "+x.score+"%":"Sem dados de saúde financeira neste mês");
  $("#heroText").textContent=x.income?(x.score>=75?"Bom resultado":x.score>=50?"Acompanhe os gastos":"Atenção aos gastos"):"Sem dados no mês";
  const due=rows.filter(r=>isPendingPayment(r)).sort((a,b)=>String(a.date).localeCompare(String(b.date))).slice(0,5);
  $("#upcomingList").innerHTML=due.length?due.map(r=>{
    const d=dayDiff(r.date),when=d<0?"Atrasado":d===0?"Vence hoje":d===1?"Vence amanhã":"Vence em "+d+" dias";
    return '<div class="list-item"><div class="list-icon">!</div><div class="list-info"><b>'+esc(r.description)+'</b><span>'+when+(r.installments?" • "+r.currentInstallment+"/"+r.installments:"")+'</span></div><div class="list-value nexus-tone-bad">'+brl(r.amount)+'</div></div>';
  }).join(""):'<div class="insight">Nenhum compromisso pendente.</div>';
  const ins=[];
  if(x.income)ins.push("Economia: "+x.savings.toFixed(1).replace(".",",")+"%");
  if(x.unnecessary>0)ins.push("Não essencial: "+brl(x.unnecessary));
  if(x.invest>0)ins.push("Aportes: "+brl(x.invest));
  if(x.pending>0)ins.push("Pendentes: "+brl(x.pending));
  $("#monthInsights").innerHTML=(ins.length?ins:["Sem dados no mês"]).map(t=>'<div class="insight">'+esc(t)+'</div>').join("");
  $("#monthReading").textContent=x.income?(x.balance>=0?"Resultado positivo":"Resultado negativo"):"Sem dados";
  renderDashboardGoalMonitor();
  window.NexusDashboardCharts?.refresh();
}
function renderInvestments(){
  const records=rows.filter(isInvestmentRecord);
  const completed=records.filter(realized);
  const planned=records.filter(record=>!realized(record)&&effectiveStatus(record)!=="Pago");
  const selected=completed.filter(record=>recordMonthKey(record)===selectedMonth());
  const fixed=records.filter(record=>record.mode==="Renda Fixa");
  const invested=completed.reduce((sum,record)=>sum+Number(record.amount||0),0);
  const expected=planned.reduce((sum,record)=>sum+Number(record.amount||0),0);
  $("#investmentMonthTotal").textContent=brl(selected.reduce((sum,record)=>sum+Number(record.amount||0),0));
  $("#investmentMonthLabel").textContent="mês selecionado • "+selectedMonth();
  $("#investmentAllTime").textContent=brl(invested);
  $("#investmentFixedCount").textContent=String(fixed.length);
  $("#investmentPlanned").textContent=brl(expected);

  const months=lastMonths(6);
  const totals=months.map(key=>completed
    .filter(record=>recordMonthKey(record)===key)
    .reduce((sum,record)=>sum+Number(record.amount||0),0));
  const maxTotal=Math.max(...totals,1);
  $("#investmentTrend").innerHTML=months.map((key,index)=>{
    const monthLabel=monthNames[Number(key.slice(5,7))-1].slice(0,3);
    const value=totals[index],height=value?Math.max(5,Math.round(value/maxTotal*100)):2;
    return '<div class="trend-column" title="'+esc(monthLabel+" "+key.slice(0,4)+": "+brl(value))+'"><small>'+brl(value)+'</small><div class="trend-bar-wrap"><i class="trend-bar" style="height:'+height+'%" aria-hidden="true"></i></div><span>'+monthLabel+'</span></div>';
  }).join("");

  const byCategory=new Map();
  completed.forEach(record=>{
    const category=record.category||"Outros";
    byCategory.set(category,(byCategory.get(category)||0)+Number(record.amount||0));
  });
  const categories=[...byCategory.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6);
  const maxCategory=Math.max(...categories.map(([,value])=>value),1);
  $("#investmentCategories").innerHTML=categories.length?categories.map(([name,value])=>
    '<div class="investment-category"><span>'+esc(name)+'</span><b>'+brl(value)+'</b><div class="investment-category-track"><i style="width:'+Math.max(4,Math.round(value/maxCategory*100))+'%"></i></div></div>'
  ).join(""):'<div class="insight">As categorias dos aportes aparecerão quando houver registros realizados.</div>';

  const recent=[...records].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,12);
  $("#investmentList").innerHTML=recent.length?recent.map(record=>{
    const status=effectiveStatus(record);
    return '<div class="list-item"><div class="list-icon">◈</div><div class="list-info"><b>'+esc(record.description)+'</b><span>'+esc(record.date)+" • "+esc(record.category)+" • "+esc(status)+'</span></div><div class="list-value nexus-tone-good">'+brl(record.amount)+'</div></div>';
  }).join(""):'<div class="investment-list-empty">Nenhum aporte registrado ainda. Use “Registrar aporte” para começar.</div>';
  setupReveal($("#investments"));
}
function startInvestmentEntry(){
  setMode("Movimentação");
  $("#fType").value="Saída";
  $("#fCategory").value="Investimentos";
  $("#fClass").value="Investimento";
  go("movements");
  requestAnimationFrame(()=>$("#fDescription").focus({preventScroll:false}));
}
window.NexusDashboardCharts?.bind({
  getRecords:()=>rows,
  getMonth:selectedMonth,
  getMonthData:calcMonth,
  getRecordMonthKey:recordMonthKey,
  isRealized:realized,
  formatMoney:brl,
  openPage:go
});
document.querySelectorAll("[data-open-page]").forEach(el=>{
  el.addEventListener("click",()=>go(el.dataset.openPage));
  el.addEventListener("keydown",event=>{
    if(event.key==="Enter"||event.key===" "){event.preventDefault();go(el.dataset.openPage)}
  });
});
$("#dashboardAddMovement").addEventListener("click",()=>{
  setMode("Movimentação");go("movements");requestAnimationFrame(()=>$("#fDescription").focus({preventScroll:false}));
});
$("#addInvestment").addEventListener("click",startInvestmentEntry);
$("#investmentMarket").addEventListener("click",()=>go("crypto"));
$("#investmentViewAll").addEventListener("click",()=>{
  historyFilter="Investimentos";
  $$("#historyFilters button").forEach(button=>button.classList.toggle("active",button.dataset.filter===historyFilter));
  renderHistory();go("movements");
});
function classificationData(){
  const data=calcMonth().done.filter(r=>r.type==="Saída");
  const map={};
  data.forEach(r=>map[r.classification]=(map[r.classification]||0)+r.amount);
  return map;
}
function lastMonths(n=6){
  const key=selectedMonth(),[y0,m0]=key.split("-").map(Number),arr=[];
  for(let i=n-1;i>=0;i--){
    const d=new Date(y0,m0-1-i,1);
    arr.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
  }
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
  $("#indicatorList").innerHTML=ind.map((i,index)=>{const severity=index===0?(x.income?(x.savings>=20?"good":"bad"):"neutral"):index===1?(x.income?(x.pending/x.income<=.5?"good":"bad"):"neutral"):index===2?(x.income?(x.unnecessary/x.income<=.3?"good":"bad"):"neutral"):(x.balance>0?"good":x.balance<0?"bad":"neutral");return '<div class="indicator"><span>'+i[0]+'</span><b class="nexus-tone-'+severity+'">'+i[1]+'</b></div>'}).join("");
  renderEducationComparison(x);
  renderFinanceAnalytics();
}
function renderEducationComparison(x){
  const comparison=$("#educationComparison"),feedback=$("#educationFeedback");
  if(!comparison||!feedback)return;
  if(!x.income){
    comparison.innerHTML='<div class="insight">Registre entradas realizadas no mês para comparar percentuais com sua renda.</div>';
    feedback.innerHTML='<div class="insight">Sem entradas realizadas, não é possível concluir o que está dentro ou fora das referências. Os valores absolutos continuam disponíveis nos indicadores acima.</div>';
    return;
  }
  const controllable=x.done.filter(r=>r.type==="Saída"&&r.classification==="Controlável").reduce((sum,r)=>sum+Number(r.amount||0),0);
  const needs=x.essential+x.commitments;
  const wants=x.unnecessary+controllable;
  const reserve=Math.max(0,x.balance)+x.invest;
  const categorized=needs+wants+x.invest;
  const unclassified=Math.max(0,x.expense-categorized);
  const rows=[
    {label:"Necessidades",amount:needs,target:50,description:"Essenciais e compromissos • referência de até 50%"},
    {label:"Desejos e gastos controláveis",amount:wants,target:30,description:"Controláveis e não necessários • referência de até 30%"},
    {label:"Reserva e investimentos",amount:reserve,target:20,description:"Saldo positivo e investimentos • referência de pelo menos 20%",minimum:true}
  ];
  comparison.innerHTML=rows.map(item=>{
    const pct=item.amount/x.income*100,width=Math.min(100,Math.max(0,pct));
    const within=item.minimum?pct>=item.target:pct<=item.target;
    const label=pct.toFixed(1).replace(".",",")+"%";
    const reading=item.minimum
      ?(within?"Atingiu a referência flexível de poupança.":"Abaixo da referência flexível; se couber no orçamento, avalie aumentar aos poucos.")
      :(within?"Dentro da referência indicativa.":"Acima da referência indicativa; avalie se a distribuição é sustentável.");
    return '<div class="education-row"><div class="education-row-head"><div><b>'+item.label+'</b><small>'+item.description+'</small></div><strong>'+brl(item.amount)+' <span>'+label+'</span></strong></div><div class="education-track" role="img" aria-label="'+item.label+': '+label+' da renda; referência '+item.target+'%"><i class="'+(within?"within":"above")+'" style="width:'+width+'%"></i><span class="education-target" style="left:'+item.target+'%" aria-hidden="true"></span></div><small class="education-reading">'+reading+'</small></div>';
  }).join("");
  const savingRate=reserve/x.income*100;
  const feedbackItems=[
    {tone:reserve>0?"good":"neutral",title:"Bom: há reserva ou investimento",text:reserve>0?brl(reserve)+" ( "+savingRate.toFixed(1).replace(".",",")+"% da renda ) ficou em saldo positivo ou foi investido.": "Ainda não há saldo positivo ou investimento contabilizado neste mês."},
    {tone:needs/x.income>0.5?"warn":"good",title:"Controlar: necessidades e compromissos",text:brl(needs)+" ("+(needs/x.income*100).toFixed(1).replace(".",",")+"% da renda). Se estiver pressionando o orçamento, reveja custos recorrentes e vencimentos."},
    {tone:x.unnecessary>0?"warn":"good",title:"Reduzir ou evitar: gastos não necessários",text:x.unnecessary>0?brl(x.unnecessary)+" foram classificados assim. Um limite mensal pode ajudar sem exigir cortar tudo.":"Nenhum gasto foi marcado como não necessário neste mês."},
    {tone:wants/x.income>0.3||savingRate<20?"warn":"good",title:"Melhorar: planejar a próxima decisão",text:wants/x.income>0.3?"Desejos e gastos controláveis passam da referência de 30%; experimente definir um teto antes do próximo mês.":savingRate<20?"Reserva e investimentos estão abaixo da referência flexível de 20%; se couber no orçamento, programe um valor possível.":"A distribuição observada está próxima das referências. Continue acompanhando sem tratar os percentuais como obrigação."}
  ];
  feedback.innerHTML=feedbackItems.map(item=>'<article class="education-feedback-card '+item.tone+'"><b>'+item.title+'</b><span>'+item.text+'</span></article>').join("");
  const note=unclassified>0?brl(unclassified)+" em saídas ("+(unclassified/x.income*100).toFixed(1).replace(".",",")+"% da renda) não entrou nos grupos por estar sem classificação reconhecida.": "Saídas sem classificação reconhecida: "+brl(unclassified)+".";
  feedback.insertAdjacentHTML("beforeend",'<p class="education-footnote">'+note+' Classifique os registros para uma comparação mais completa. A análise é educativa e não substitui orientação financeira individual.</p>');
}
function renderFinanceAnalytics(){
  window.NexusAnalytics?.render(rows,goals,selectedMonth(),today());
  setDashboardChart($("#dashboardChartPicker").value);
  $("#statsMonthPicker").value=selectedMonth();
}
$("#analyticsMonths").addEventListener("change",renderFinanceAnalytics);
$("#statsMonthPicker").addEventListener("change",event=>{
  $("#monthPicker").value=event.target.value||today().slice(0,7);renderAll();
});

/* ---------- relatório ---------- */
function csvEscape(v){
  let s=String(v??"");
  if(typeof v==="string"&&/^\s*[=+@-]/.test(s))s="'"+s;
  return /[;",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
}
$("#downloadCsv").addEventListener("click",()=>{
  const headers=["ID","Data","Tipo","Descrição","Categoria","Subcategoria","Finalidade","Classificação","Valor","Status","Observação","Modalidade","Parcelas","Parcela atual","Dia vencimento","Recorrência","Prioridade","Pago em"];
  const lines=[headers.join(";"),...rows.map(r=>[r.id,r.date,r.type,r.description,r.category,r.subcategory,r.purpose,r.classification,r.amount,r.status,r.note,r.mode,r.installments,r.currentInstallment,r.dueDay,r.recurrence,r.priority,r.paidAt].map(csvEscape).join(";"))];
  const blob=new Blob(["\ufeff"+lines.join("\n")],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="nexus-finance-"+today()+".csv";a.click();URL.revokeObjectURL(a.href);
});
$("#printReport").addEventListener("click",()=>{
  const x=calcMonth(),cls=classificationData(),m=selectedMonth(),[y,mo]=m.split("-");
  const w=window.open("","_blank");
  if(!w){toast("Permita a abertura de janelas para imprimir o relatório.");return}
  w.addEventListener("load",()=>{w.focus();w.print()},{once:true});
  w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Relatório Nexus</title><style>body{font-family:Arial;padding:32px;color:#111}h1{margin:0}small{color:#666}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:24px 0}.k{border:1px solid #ddd;padding:14px;border-radius:8px}.k b{display:block;font-size:20px;margin-top:5px}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left;font-size:12px}@media print{button{display:none}}</style></head><body><h1>Nexus Finance</h1><small>Relatório de '+monthNames[Number(mo)-1]+' de '+y+'</small><div class="grid"><div class="k">Entradas<b>'+brl(x.income)+'</b></div><div class="k">Saídas<b>'+brl(x.expense)+'</b></div><div class="k">Saldo<b>'+brl(x.balance)+'</b></div><div class="k">Economia<b>'+x.savings.toFixed(1)+'%</b></div><div class="k">Investimentos<b>'+brl(x.invest)+'</b></div><div class="k">Pendentes<b>'+brl(x.pending)+'</b></div></div><h2>Gastos por classificação</h2><table><tr><th>Classificação</th><th>Valor</th></tr>'+Object.entries(cls).map(([k,v])=>'<tr><td>'+esc(k)+'</td><td>'+brl(v)+'</td></tr>').join("")+'</table><h2>Movimentações do mês</h2><table><tr><th>Data</th><th>Descrição</th><th>Tipo</th><th>Classificação</th><th>Valor</th></tr>'+x.m.map(r=>'<tr><td>'+esc(r.date)+'</td><td>'+esc(r.description)+'</td><td>'+esc(r.type)+'</td><td>'+esc(r.classification)+'</td><td>'+brl(r.amount)+'</td></tr>').join("")+'</table></body></html>');
  w.document.close();
});

/* ---------- lembrete pagamento ---------- */
function checkPaymentReminder(){
  if(sessionStorage.getItem("nexusPaidAskSnooze")===today())return;
  const due=rows.filter(r=>isPendingPayment(r)&&r.date&&dayDiff(r.date)<=0).sort((a,b)=>String(a.date).localeCompare(String(b.date)))[0];
  if(!due)return;
  paymentTarget=due;
  $("#paymentTitle").textContent="Você já pagou "+due.description+"?";
  $("#paymentText").textContent=(dayDiff(due.date)<0?"Está atrasado.":"Vence hoje.")+" Valor: "+brl(due.amount)+(due.installments?" • parcela "+due.currentInstallment+"/"+due.installments:"");
  $("#paymentModal").classList.add("open");
}
function closePaymentModal(){$("#paymentModal").classList.remove("open");paymentTarget=null}
$("#paymentDone").addEventListener("click",()=>paymentTarget&&markPaid(paymentTarget.id).catch(showAppError));
$("#paymentLater").addEventListener("click",()=>{sessionStorage.setItem("nexusPaidAskSnooze",today());closePaymentModal();toast("Vou lembrar de novo depois")});

/* ---------- metas + educação financeira ---------- */
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
  renderDashboardGoalMonitor();
}
$("#goalForm")?.addEventListener("submit",async e=>{
  e.preventDefault();
  const form=e.currentTarget,button=form.querySelector('[type="submit"]');
  if(button.disabled)return;
  const g={name:$("#gName").value.trim(),target:Number($("#gTarget").value),current:Number($("#gCurrent").value||0),date:$("#gDate").value};
  if(!g.name||g.target<=0)return toast("Informe a meta e o valor");
  if(!goalsAvailable)return showAppError(new Error("O backend não oferece suporte a metas. Esta meta não foi salva."));
  button.disabled=true;
  try{
    const result=await apiRequest("/api/goals",{method:"POST",body:g});
    if(result?.goal)goals.push(result.goal);
    else{
      const data=await apiRequest("/api/goals");
      if(!Array.isArray(data?.goals))throw new Error("Resposta inválida ao carregar metas.");
      goals=data.goals;
    }
    form.reset();$("#gCurrent").value=0;renderGoals();renderFinanceAnalytics();clearAppError();toast("Meta criada");
  }catch(error){showAppError(error);toast("Não foi possível salvar a meta")}
  finally{button.disabled=false}
});

/* ---------- mercado ---------- */
async function fetchJson(url){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
  try{
    const response=await fetch(url,{cache:"no-store",signal:controller.signal});
    if(!response.ok)throw new Error("HTTP "+response.status);
    return await response.json();
  }finally{clearTimeout(timeout)}
}
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
    const x=raw[sym]?.BRL||{};
    if(!Number.isFinite(Number(x.PRICE))||Number(x.PRICE)<=0)throw new Error("price_unavailable_"+sym);
    marketState.prices[sym]=x;
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
function safeNewsUrl(value){
  try{const url=new URL(value);return ["http:","https:"].includes(url.protocol)?url.href:"#"}catch{return "#"}
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
  $("#newsList").innerHTML=list.length?list.map(n=>'<a class="news-item" target="_blank" rel="noopener" href="'+esc(safeNewsUrl(n.url))+'"><b>'+esc(n.title)+'</b><span>'+esc(n.source)+" • "+n.time.toLocaleString("pt-BR")+'</span></a>').join(""):'<div class="insight">A API de notícias não respondeu agora. Tente novamente em alguns minutos.</div>';
}
function sentiment(){
  const text=marketState.news.map(n=>(n.title+" "+n.body).toLowerCase()).join(" ");
  const pos=["approval","adoption","rally","surge","record","inflow","bull","institutional","rate cut","partnership","growth"];
  const neg=["hack","ban","lawsuit","outflow","crash","selloff","war","tariff","inflation","liquidation","fraud","rate hike"];
  return pos.reduce((s,w)=>s+(text.includes(w)?1:0),0)-neg.reduce((s,w)=>s+(text.includes(w)?1:0),0);
}
function renderScenario(){
  const symbols=["BTC","ETH","SOL"];
  const hasCompletePrices=symbols.every(symbol=>Number(marketState.prices[symbol]?.PRICE)>0);
  if(!hasCompletePrices){
    $("#bullProb").textContent="—";$("#sideProb").textContent="—";$("#bearProb").textContent="—";
    $("#scenarioTitle").textContent="Cotações aguardando conexão";
    $("#scenarioText").textContent="O cenário só aparece depois que BTC, ETH e SOL forem carregados. Atualize quando a conexão estiver disponível.";
    $("#marketActions").innerHTML='<div class="action-item"><b>Leitura pausada</b><span>Não há dados suficientes para estimar a direção do mercado agora.</span></div>';
    return;
  }
  const changes=symbols.map(symbol=>Number(marketState.prices[symbol]?.CHANGEPCT24HOUR||0));
  const momentum=changes.reduce((a,b)=>a+b,0)/3,newsScore=sentiment(),fear=Number(marketState.fear?.value||50);
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
  if(marketState.loading)return marketState.loading;
  const button=$("#refreshMarket");
  button.disabled=true;button.textContent="Atualizando...";
  $("#newsStatus").textContent="Atualizando preços, sentimento e notícias...";
  marketState.loading=(async()=>{
    const results=await Promise.allSettled([loadPrices(),loadFear(),loadNews()]);
    const priceResult=results[0];
    if(priceResult.status==="fulfilled"){
      marketState.updatedAt=Date.now();
      $("#newsStatus").textContent="Atualizado às "+new Date(marketState.updatedAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
    }else{
      [["btc","BTC"],["eth","ETH"],["sol","SOL"]].forEach(([id,sym])=>{
        if(!marketState.prices[sym]?.PRICE)$("#"+id+"Change").textContent="Cotação indisponível";
      });
      $("#newsStatus").textContent=marketState.updatedAt
        ?"Cotação indisponível • mostrando a última leitura"
        :"Fontes indisponíveis • tente atualizar novamente";
    }
    renderScenario();
    if(results.every(result=>result.status==="rejected"))toast("As fontes de mercado não responderam. Tente novamente.");
    return results;
  })().finally(()=>{
    button.disabled=false;button.textContent="Atualizar";marketState.loading=null;
  });
  return marketState.loading;
}
$("#refreshMarket").addEventListener("click",()=>{loadMarket();toast("Atualizando mercado")});

/* ---------- settings ---------- */
function reflectBackendStatus(){
  $("#authBackendStatus").textContent="Conectando com segurança...";
  $("#backendStatus").textContent="Verificando conexão...";
}
let pwaUpdateRegistration=null;
let pwaUpdateAccepted=false;
function showPwaUpdate(registration){
  if(registration.waiting&&navigator.serviceWorker.controller)$("#pwaUpdateNotice").hidden=false;
}
async function setupPwa(){
  if(!("serviceWorker" in navigator)||!["http:","https:"].includes(location.protocol))return;
  try{
    pwaUpdateRegistration=await navigator.serviceWorker.register("/service-worker.js",{scope:"/"});
    showPwaUpdate(pwaUpdateRegistration);
    pwaUpdateRegistration.addEventListener("updatefound",()=>{
      const installing=pwaUpdateRegistration.installing;
      if(!installing)return;
      installing.addEventListener("statechange",()=>{
        if(installing.state==="installed")showPwaUpdate(pwaUpdateRegistration);
      });
    });
    navigator.serviceWorker.addEventListener("controllerchange",()=>{
      if(pwaUpdateAccepted)window.location.reload();
    });
    $("#pwaUpdateButton").addEventListener("click",()=>{
      if(!pwaUpdateRegistration?.waiting)return;
      if(!window.confirm("Atualizar o aplicativo agora? Salve antes qualquer formulário ainda não enviado."))return;
      pwaUpdateAccepted=true;
      pwaUpdateRegistration.waiting.postMessage({type:"SKIP_WAITING"});
    });
    $("#pwaUpdateLater").addEventListener("click",()=>{$("#pwaUpdateNotice").hidden=true});
  }catch(error){
    console.error("Não foi possível registrar o suporte offline do PWA.",error);
  }
}
$("#authModeToggle").addEventListener("click",()=>setAuthMode(authMode==="login"?"register":"login"));
$("#localImportButton").addEventListener("click",()=>importLocalData());
$("#authForm").addEventListener("submit",async event=>{
  event.preventDefault();
  if($("#authSubmit").disabled)return;
  setAuthError("");
  const email=$("#authEmail").value.trim(),password=$("#authPassword").value;
  $("#authSubmit").disabled=true;
  $("#authModeToggle").disabled=true;
  $("#authSubmit").setAttribute("aria-busy","true");
  $("#authSubmitCoins").hidden=false;
  $("#authSubmitLabel").textContent="Verificando...";
  try{
    await apiRequest("/api/auth/"+authMode,{method:"POST",body:{email,password}});
    let me;
    try{me=await apiRequest("/api/auth/me")}
    catch(error){
      if(authMode==="register"&&error.status===401){
        setAuthMode("login");setAuthError("Conta criada. Entre com seu e-mail e senha.");return;
      }
      throw error;
    }
    const user=me?.user||me;
    if(authMode==="register"&&(!user||!user.email)){
      setAuthMode("login");setAuthError("Conta criada. Entre com seu e-mail e senha.");return;
    }
    currentUser=user||{};
    await loadAccountData();
    unlockApp(currentUser);if(goalsAvailable)clearAppError();setAuthError("");
    $("#authBackendStatus").textContent="Conectado com segurança.";
    $("#backendStatus").textContent="Dados sincronizados com segurança.";
    $("#authPassword").value="";
  }catch(error){
    lockApp(apiErrorMessage(error),{preserveEmail:true});
    $("#authBackendStatus").textContent=error instanceof TypeError?"Não foi possível conectar. Verifique sua conexão e tente novamente.":"Não foi possível concluir a solicitação.";
  }finally{
    $("#authSubmit").disabled=false;
    $("#authModeToggle").disabled=false;
    $("#authSubmit").setAttribute("aria-busy","false");
    $("#authSubmitCoins").hidden=true;
    $("#authSubmitLabel").textContent=authMode==="register"?"Criar conta":"Entrar";
  }
});
$("#logoutButton").addEventListener("click",async()=>{
  try{await apiRequest("/api/auth/logout",{method:"POST"})}
  catch(error){lockApp("Sessão encerrada neste aparelho, mas o backend não confirmou o logout: "+apiErrorMessage(error));return}
  sessionStorage.removeItem("nexusPaidAskSnooze");
  lockApp();setAuthMode("login");$("#authPassword").value="";
});
$("#logoutAllButton").addEventListener("click",async()=>{
  if(!currentUser||!window.confirm("Encerrar todas as sessões desta conta, inclusive em outros dispositivos?"))return;
  try{
    await apiRequest("/api/auth/logout-all",{method:"POST",body:{}});
    sessionStorage.removeItem("nexusPaidAskSnooze");
    lockApp();setAuthMode("login");$("#authPassword").value="";
    setAuthError("Todas as sessões foram encerradas. Entre novamente para continuar.");
  }catch(error){showAppError(error)}
});
async function bootAuth(){
  $("#authSubmit").disabled=true;$("#authModeToggle").disabled=true;
  reflectBackendStatus();$("#authBackendStatus").textContent="Verificando conexão...";
  try{
    await apiRequest("/api/auth/logout",{method:"POST"});
    lockApp();
    $("#authBackendStatus").textContent="Conectado. Entre para carregar os dados da sua conta.";
    $("#backendStatus").textContent="Conectado. Entre para carregar os dados da sua conta.";
    setAuthError("");
  }catch(error){
    lockApp();
    const message=apiErrorMessage(error);
    $("#authBackendStatus").textContent="Não foi possível proteger a sessão anterior.";
    $("#backendStatus").textContent="Não foi possível verificar a sessão.";
    setAuthError(message);
  }finally{$("#authSubmit").disabled=false;$("#authModeToggle").disabled=false}
}

/* ---------- init ---------- */
function renderAll(){renderHistory();renderDashboard();renderInvestments();renderStats();renderGoals();window.NEXUS_SIMULATION?.render()}
$("#monthPicker").addEventListener("change",renderAll);
$("#monthPicker").value=today().slice(0,7);
sessionStorage.removeItem("nexusSheetsToken");
localStorage.removeItem("nexusSheetsEndpoint");
localStorage.removeItem("nexusApiBaseUrl");
rows=[];goals=[];renderAll();setMode("Movimentação");reflectBackendStatus();bootAuth();setupPwa();


/* ---------- Nexus Live: acompanhamento enquanto o site está aberto ---------- */
let cryptoLiveTab="radar";
let liveTimer=null;
let liveRunning=false;
let liveLast={};
let liveLogEntries=[];

function setCryptoTab(tab){
  const changed=cryptoLiveTab!==tab;
  cryptoLiveTab=tab;
  document.querySelectorAll("#cryptoTabs [data-crypto-tab]").forEach(b=>b.classList.toggle("active",b.dataset.cryptoTab===tab));
  const tabName=$("#cryptoTabs [data-crypto-tab='"+tab+"']")?.textContent.trim();
  const toggle=$(".crypto-tabs-switcher .mobile-tabs-toggle");
  if(toggle&&tabName)toggle.setAttribute("aria-label","Aba selecionada: "+tabName+". Abrir abas de cripto e mercado");
  closeMobileTabs($(".crypto-tabs-switcher"));
  $("#cryptoRadar").classList.toggle("active",tab==="radar");
  $("#cryptoLive").classList.toggle("active",tab==="live");
  setupReveal(tab==="live"?$("#cryptoLive"):$("#cryptoRadar"));
  if(tab==="live"){
    startLiveMonitor();
  }else stopLiveMonitor();
  if(changed)resetPageScroll();
}
// Crypto tabs are handled by NexusUIController.
// Binance shortcut is handled by NexusUIController.

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
  if(binanceBusy||!currentUser)return;
  const status=$("#binanceStatus"),box=$("#binanceBalances"),button=$("#binanceRefresh");
  if(!status||!box)return;
  binanceBusy=true;
  if(button)button.disabled=true;
  box.replaceChildren();
  status.textContent="Consultando conexão...";
  try{
    const info=await apiRequest("/api/binance/status");
    if(!info.configured){
      status.textContent="Aguardando configuração segura no Render.";
      box.innerHTML='<p class="muted">Nenhuma chave configurada. Siga as instruções abaixo para habilitar a leitura.</p>';
      return;
    }
    status.textContent="Conectado · buscando carteira Spot...";
    const data=await apiRequest("/api/binance/balances");
    const items=Array.isArray(data.balances)?data.balances:[];
    box.innerHTML=items.length?items.map(item=>
      '<div class="binance-asset"><b>'+esc(item.asset)+'</b><span>Livre: '+esc(item.free)+'</span><span>Bloqueado: '+esc(item.locked)+'</span></div>'
    ).join(""):'<p class="muted">Nenhum ativo com saldo positivo na carteira Spot.</p>';
    status.textContent="Carteira Spot atualizada.";
  }catch(error){
    box.replaceChildren();
    if(error.status===401)showAppError(error);
    status.textContent=error.status===403?"Acesso restrito ao proprietário configurado.":apiErrorMessage(error);
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
  if(notify)toast(value==="glass"?"Modo Vidro espelhado ativado":"Modo Sólido ativado");
}
setAppearance(localStorage.getItem("nexusAppearance")||"solid");
$$(".appearance-option").forEach(btn=>btn.addEventListener("click",()=>setAppearance(btn.dataset.appearance,true)));
/* ---------- MotionController: scroll reveal único e recorrente ---------- */
class MotionController{
  constructor(){
    this.selector=".hero,.card,.panel,.goal-card,.rule,.list-item,.indicator,.action-item,.news-item,.live-entry,.scenario-grid > div";
    this.io=window.matchMedia("(min-width: 821px)").matches&&("IntersectionObserver" in window)?new IntersectionObserver(entries=>this.onEntries(entries),{threshold:.08,rootMargin:"0px 0px -10% 0px"}):null;
  }
  onEntries(entries){
    entries.forEach(e=>{
      if(e.isIntersecting)e.target.classList.add("motion-visible");
      else e.target.classList.remove("motion-visible");
    });
  }
  scan(root=document){
    root.querySelectorAll(this.selector).forEach((el,i)=>{
      if(el.dataset.scrollMotion)return;
      el.dataset.scrollMotion="1";el.classList.add("scroll-motion");
      el.style.setProperty("--motion-delay",Math.min(i%4,3)*36+"ms");
      if(this.io)this.io.observe(el);else el.classList.add("motion-visible");
    });
  }
}
const nexusMotion=new MotionController();
window.addEventListener("nexus:motion-scan",e=>requestAnimationFrame(()=>nexusMotion.scan(e.detail?.root||document)));
if(window.matchMedia("(min-width: 821px)").matches)new MutationObserver(()=>nexusMotion.scan(document)).observe(document.body,{childList:true,subtree:true});
nexusMotion.scan(document);


/* ---------- PWA update notifications ---------- */
class NexusUpdateNotifier{
  constructor(){this.key="nexusAppVersion";this.timer=null;this.registration=null}
  async init(){
    if(!("serviceWorker" in navigator))return;
    try{this.registration=await navigator.serviceWorker.register("/service-worker.js",{scope:"/"});await this.check(false);this.timer=setInterval(()=>this.check(true),60000)}catch{}
  }
  async enable(){
    if(!("Notification" in window)){toast("Notificações não são suportadas neste aparelho");return}
    const permission=await Notification.requestPermission();
    if(permission==="granted"){toast("Notificações de atualização ativadas");await this.check(false)}
    else toast("Permissão de notificação não concedida");
  }
  async check(notify){
    try{
      const res=await fetch("/api/version",{cache:"no-store"});if(!res.ok)return;
      const data=await res.json(),version=String(data.version||"");if(!version)return;
      const previous=localStorage.getItem(this.key);localStorage.setItem(this.key,version);
      if(notify&&previous&&previous!==version)await this.show();
    }catch{}
  }
  async show(){
    const title="Nova versão do Nexus Finance";
    const options={body:"Salve seu trabalho e use o aviso de atualização para instalar a nova versão.",tag:"nexus-update",renotify:true};
    if(this.registration&&"Notification" in window&&Notification.permission==="granted")await this.registration.showNotification(title,options);
    await this.registration?.update();
    toast("Nova versão disponível — salve seu trabalho antes de atualizar");
  }
}
const nexusUpdateNotifier=new NexusUpdateNotifier();
nexusUpdateNotifier.init();
document.addEventListener("click",e=>{if(e.target.closest("#enableUpdateNotifications"))nexusUpdateNotifier.enable()});

/* Mobile: keep the month filter accessible without the native date field in the top bar. */
(()=>{
 const picker=document.getElementById("monthPicker"),home=document.getElementById("home");
 if(!picker||!home)return;
 const label=picker.closest(".month-label");
 if(!label)return;
 const slot=document.createElement("div");slot.className="mobile-month-slot";home.insertBefore(slot,home.firstChild);
 const originalParent=label.parentNode,nextSibling=label.nextSibling;
 function position(){if(window.matchMedia("(max-width:820px)").matches)slot.appendChild(label);else if(label.parentNode!==originalParent)originalParent.insertBefore(label,nextSibling)}
 window.addEventListener("resize",position,{passive:true});position();
})();
function setAccent(color,notify=false){
  const value=["gold","blue","green"].includes(color)?color:"gold";
  document.body.dataset.accent=value;
  $$(".accent-option").forEach(btn=>{
    const active=btn.dataset.accent===value;
    btn.classList.toggle("active",active);
    btn.setAttribute("aria-pressed",String(active));
  });
  localStorage.setItem("nexusAccent",value);
  if(notify)toast("Cor de destaque atualizada");
}
setAccent(localStorage.getItem("nexusAccent")||"gold");
$$(".accent-option").forEach(btn=>btn.addEventListener("click",()=>setAccent(btn.dataset.accent,true)));
function setGrid(enabled,notify=false){
  const visible=Boolean(enabled);
  document.body.classList.toggle("grid-hidden",!visible);
  $("#gridToggle").setAttribute("aria-checked",String(visible));
  localStorage.setItem("nexusGrid",String(visible));
  if(notify)toast(visible?"Grade de fundo ativada":"Grade de fundo desativada");
}
setGrid(localStorage.getItem("nexusGrid")!=="false");
$("#gridToggle").addEventListener("click",()=>setGrid($("#gridToggle").getAttribute("aria-checked")!=="true",true));
