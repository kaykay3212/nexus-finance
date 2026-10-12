/* Runs the actual app in a DOM test double. Browser rendering is tested separately. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function run() {
  const root = path.resolve(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const elements = new Map();
  const deleted = new Set();
  const missing = new Set();
  function element(id = '') {
    const handlers = {};
    const classes = new Set();
    let text = '';
    return {
      id, handlers, value: '', hidden: false, disabled: false, dataset: {},
      style: {setProperty(){}, removeProperty(){}},
      classList: {add(...names){names.forEach(n=>classes.add(n));}, remove(...names){names.forEach(n=>classes.delete(n));},
        contains(n){return classes.has(n);}, toggle(n,on){on=on??!classes.has(n);on?classes.add(n):classes.delete(n);return on;}},
      get textContent(){return text;},
      set textContent(value){text=value;if(id==='authSubmit'){deleted.add('authSubmitLabel');deleted.add('authSubmitCoins');}},
      innerHTML: '', attributes: {},
      setAttribute(k,v){this.attributes[k]=v;}, getAttribute(k){return this.attributes[k];}, removeAttribute(k){delete this.attributes[k];},
      addEventListener(type,fn){(handlers[type]??=[]).push(fn);},
      querySelector(selector){return selector==='[type="submit"]'?submitGoal:select(selector);}, querySelectorAll(){return [];},
      closest(){return null;}, appendChild(){}, append(){}, insertBefore(){}, insertAdjacentHTML(position,html){this.innerHTML+=html;},
      replaceChildren(){this.innerHTML='';}, reset(){this.resets=(this.resets||0)+1;},
      getBoundingClientRect(){return {width:800};}, scrollTo(){}, focus(){}, click(){},
    };
  }
  for (const match of html.matchAll(/\bid="([^"]+)"/g)) {
    assert(!elements.has(match[1]), 'Duplicate HTML ID: '+match[1]);
    elements.set(match[1], element(match[1]));
  }
  const submitGoal=element('goalSubmit');
  function select(selector){
    if(/^#[\w-]+$/.test(selector)){
      const id=selector.slice(1);
      if(!elements.has(id))missing.add(id);
      return deleted.has(id)?null:elements.get(id)||null;
    }
    return element();
  }
  function storage(){const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};}
  const body=element('body');
  const document={body,hidden:false,querySelector:select,querySelectorAll:()=>[],
    getElementById:id=>elements.get(id)||null,createElement:()=>element(),addEventListener(){}};
  let responder=async()=>({ok:true});
  const requests=[];
  const context={document,console,URL,Blob,AbortController,Intl,Date,Math,Promise,
    navigator:{onLine:true},location:{protocol:'https:',origin:'https://nexus.test'},
    localStorage:storage(),sessionStorage:storage(),setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},
    requestAnimationFrame:()=>1,cancelAnimationFrame(){},matchMedia:()=>({matches:false}),
    MutationObserver:class{observe(){}},CustomEvent:class{},
    addEventListener(){},dispatchEvent(){},scrollTo(){},confirm:()=>true,
    async fetch(url,options={}){requests.push({url,options});const data=await responder(url,options);return {ok:true,status:200,json:async()=>data};},
  };
  context.window=context;
  vm.createContext(context);
  const execute=source=>vm.runInContext(source,context);
  for(const file of ['site-structure.js','dashboard-charts.js','finance-analytics.js','app.js']) {
    vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
  }
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual([...missing],[], 'Startup references missing HTML elements');
  let passed=1;
  function check(name,fn){fn();passed++;console.log('OK '+name);}
  check('Login/register toggle preserves loading elements',()=>{
    execute('setAuthMode("register");setAuthMode("login")');
    assert(select('#authSubmitCoins'));assert(select('#authSubmitLabel'));
    assert.equal(select('#authSubmitLabel').textContent,'Entrar');
  });
  check('CSV delimiter, quotes, line breaks and formula neutralization',()=>{
    assert.equal(execute('csvEscape("mercado; feira")'),'"mercado; feira"');
    assert.equal(execute('csvEscape("a\\rb")'),'"a\rb"');
    assert.equal(execute('csvEscape("=1+1")'),"'=1+1");
    assert.equal(execute('csvEscape(123.45)'),'123.45');
  });
  check('News accepts only HTTP(S) links',()=>{
    assert.equal(execute('safeNewsUrl("javascript:alert(1)")'),'#');
    assert.equal(execute('safeNewsUrl("https://example.org/news")'),'https://example.org/news');
  });
  check('Blocked print popup shows feedback instead of throwing',()=>{
    context.open=()=>null;
    select('#printReport').handlers.click[0]();
    assert.match(select('#toast').textContent,/Permita/);
  });
  check('History provides access to records after the first 80',()=>{
    execute('rows=Array.from({length:85},(_,i)=>normalize({id:i+1,date:"2026-01-01",description:"Record "+i,amount:1}));renderHistory()');
    assert.match(select('#historyList').innerHTML,/data-history-more/);
    execute('nexusUI.onClick({target:{closest:selector=>selector==="[data-history-more]"}})');
    assert.doesNotMatch(select('#historyList').innerHTML,/data-history-more/);
    assert.match(select('#historyList').innerHTML,/Record 84/);
  });
  check('Cash balance includes fixed-income outflows and pending subscriptions',()=>{
    execute(`$("#monthPicker").value="2026-01";rows=[
      {date:"2026-01-01",type:"Entrada",amount:1000,status:"Realizado",mode:"Movimentação"},
      {date:"2026-01-02",type:"Saída",amount:200,status:"Realizado",mode:"Renda Fixa"},
      {date:"2026-01-03",type:"Saída",amount:50,status:"Pendente",mode:"Assinatura"}
    ];`);
    const totals=execute('calcMonth()');
    assert.equal(totals.balance,800);assert.equal(totals.invest,200);assert.equal(totals.pending,50);
    assert.equal(execute('effectiveStatus(rows[2])'),'Atrasado');
  });
  const movement=select('#movementForm');
  const movementHandler=movement.handlers.submit[0];
  execute('rows=[];currentUser={id:8};editingId=null;setMode("Movimentação")');
  for(const [id,value] of Object.entries({fType:'Saída',fDescription:'Mercado',fCategory:'Outros',fClass:'Controlável',fAmount:'50',fDate:'2026-01-01',fStatus:'Realizado'}))select('#'+id).value=value;
  responder=async(url,options)=>({transaction:{id:1,...JSON.parse(options.body)}});
  const event={currentTarget:movement,preventDefault(){}};
  const before=requests.length;
  const saving=movementHandler(event);
  await movementHandler({currentTarget:movement,preventDefault(){}});
  event.currentTarget=null; // Real DOM events clear currentTarget after synchronous dispatch.
  await saving;
  assert.equal(requests.length-before,1);assert.equal(movement.resets,2); // initial lockApp reset + successful save
  assert.equal(select('#saveMovement').disabled,false);
  assert.equal(execute('rows.length'),1);
  passed++;console.log('OK Movement save resets form after await and blocks duplicate submit');

  execute('rows=[{id:2,date:"2026-01-01",type:"Saída",description:"Conta",amount:50,mode:"Compromisso",status:"Pago",paidAt:"2026-01-02",installments:1,currentInstallment:1,recurrence:"Único",category:"Outros",classification:"Compromisso"}];startEdit(2)');
  responder=async(url,options)=>({transaction:{id:2,...JSON.parse(options.body)}});
  await movementHandler({currentTarget:movement,preventDefault(){}});
  assert.equal(execute('rows[0].status'),'Pago');assert.equal(execute('rows[0].paidAt'),'2026-01-02');
  passed++;console.log('OK Editing a paid commitment preserves payment');

  const goal=select('#goalForm');
  select('#gName').value='Reserva';select('#gTarget').value='1000';select('#gCurrent').value='0';
  responder=async()=>({goal:{id:1,name:'Reserva',target:1000,current:0,date:''}});
  const goalEvent={currentTarget:goal,preventDefault(){}};
  const creating=goal.handlers.submit[0](goalEvent);
  goalEvent.currentTarget=null;
  await creating;
  assert.equal(goal.resets,1);assert.equal(submitGoal.disabled,false);assert.equal(execute('goals.length'),1);
  passed++;console.log('OK Goal save resets form after await');

  execute('rows=[{id:3,status:"Pendente",mode:"Assinatura"}]');
  responder=async()=>({transaction:{id:3,status:'Pago',mode:'Assinatura'},nextTransaction:{id:4,status:'Pendente',mode:'Assinatura'}});
  const paidRequests=requests.length;
  await execute('Promise.all([markPaid(3),markPaid(3)])');
  assert.equal(requests.length-paidRequests,1);assert.equal(execute('rows.length'),2);
  assert.equal(JSON.parse(requests.at(-1).options.body).atomicPayment,true);
  passed++;console.log('OK Payment uses one atomic API call despite duplicate clicks');

  let finish;
  responder=()=>new Promise(resolve=>{finish=resolve;});
  const pending=execute('reloadTransactions()');
  execute('lockApp()');
  finish({transactions:[{id:99,amount:999}]});
  await assert.rejects(pending,/conta mudou/);
  assert.equal(execute('rows.length'),0);
  passed++;console.log('OK Late response cannot restore private rows after logout');
  console.log(`${passed} frontend checks passed`);
  return passed;
}
module.exports=run;
if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1;});
