/* Loaded only by browser_smoke.py; exercises actual DOM events with synthetic data. */
const smokeErrors=[];
window.addEventListener('error',event=>smokeErrors.push(event.message));
window.addEventListener('unhandledrejection',event=>smokeErrors.push(String(event.reason)));
window.addEventListener('load',async()=>{
  const checks=[];
  const result=document.createElement('pre');result.id='smoke-result';document.body.append(result);
  const wait=async(predicate)=>{
    for(let i=0;i<200;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,25));}
    throw Error('Timed out waiting for UI');
  };
  const check=(condition,label)=>{if(!condition)throw Error(label);checks.push(label);};
  const fill=(id,value)=>{document.getElementById(id).value=value;};
  const submit=id=>document.getElementById(id).dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  try{
    await wait(()=>!document.getElementById('authSubmit').disabled);
    document.getElementById('authModeToggle').click();
    document.getElementById('authModeToggle').click();
    check(!!document.getElementById('authSubmitCoins'),'auth toggle keeps nested elements');
    fill('authEmail','test@example.com');fill('authPassword','test-password-123');submit('authForm');
    await wait(()=>!document.body.classList.contains('auth-locked'));
    check(document.getElementById('accountStatus').textContent.includes('test@example.com'),'login loads account');
    go('movements');setMode('Movimentação');
    fill('fType','Saída');fill('fDescription','Smoke market');fill('fAmount','42.50');fill('fDate','2026-10-11');
    submit('movementForm');submit('movementForm');
    await wait(()=>!document.getElementById('saveMovement').disabled);
    check(rows.length===1&&rows[0].amount===42.5,'one movement saved after double submit');
    check(document.getElementById('fDescription').value==='','movement form resets after response');
    go('goals');fill('gName','Smoke reserve');fill('gTarget','1000');fill('gCurrent','50');
    submit('goalForm');
    await wait(()=>!document.querySelector('#goalForm [type=submit]').disabled);
    check(goals.length===1&&document.getElementById('gName').value==='','goal saved and form reset');
    document.getElementById('logoutButton').click();
    await wait(()=>document.body.classList.contains('auth-locked'));
    check(rows.length===0&&goals.length===0,'logout clears private data');
    fill('authEmail','test@example.com');fill('authPassword','test-password-123');submit('authForm');
    await wait(()=>!document.body.classList.contains('auth-locked'));
    check(rows.length===1&&goals.length===1,'login works again after logout');
    rows=[
      {id:1,date:'2026-10-01',type:'Entrada',amount:5000,category:'Salário',status:'Realizado',mode:'Movimentação'},
      {id:2,date:'2026-10-02',type:'Saída',amount:1300,category:'Moradia',classification:'Essencial',status:'Pago',mode:'Compromisso'},
      {id:3,date:'2026-10-05',type:'Saída',amount:700,category:'Alimentação',classification:'Essencial',status:'Realizado',mode:'Movimentação'},
      {id:4,date:'2026-10-06',type:'Saída',amount:500,category:'Investimentos',classification:'Investimento',status:'Realizado',mode:'Renda Fixa'},
      {id:5,date:'2026-10-15',type:'Saída',amount:150,category:'Serviços',classification:'Compromisso',status:'Pendente',mode:'Assinatura'},
      {id:6,date:'2026-09-01',type:'Entrada',amount:4800,category:'Salário',status:'Realizado',mode:'Movimentação'},
      {id:7,date:'2026-09-02',type:'Saída',amount:2200,category:'Moradia',classification:'Essencial',status:'Realizado',mode:'Movimentação'}
    ].map(normalize);
    fill('monthPicker','2026-10');renderAll();go('home');
    check(document.querySelectorAll('#dashboardAnalytics [data-analytics-chart]').length===4,'dashboard has four charts');
    check(document.querySelectorAll('#statisticsAnalytics [data-analytics-chart]').length===12,'statistics has twelve charts');
    check(document.querySelectorAll('#statisticsAnalytics details').length===12,'all statistics charts have data tables');
    go('stats');fill('analyticsMonths','12');document.getElementById('analyticsMonths').dispatchEvent(new Event('change'));
    check(document.querySelector('#statisticsAnalytics [data-analytics-chart=flow] tbody').rows.length===12,'history switches to twelve months');
    fill('statsMonthPicker','2026-09');document.getElementById('statsMonthPicker').dispatchEvent(new Event('change'));
    check(document.getElementById('monthPicker').value==='2026-09','statistics month selector synchronizes');
    check(document.documentElement.scrollWidth<=innerWidth+1,'statistics does not overflow viewport');
    if(matchMedia('(max-width:820px)').matches){
      go('settings');const nav=document.querySelector('.mobile-nav');
      nav.scrollTo({left:nav.scrollWidth,behavior:'instant'});
      await new Promise(resolve=>setTimeout(resolve,350));
      const last=nav.lastElementChild.getBoundingClientRect(),bounds=nav.getBoundingClientRect();
      check(bounds.height<=58,'mobile navigation compact height');
      check(bounds.right-last.right<=8,'no trailing blank space after last mobile option');
    }
    fill('monthPicker','2026-10');renderAll();go('home');window.scrollTo(0,0);
    check(document.documentElement.scrollWidth<=innerWidth+1,'dashboard does not overflow viewport');
    document.getElementById('dashboardAnalytics').scrollIntoView({block:'start',behavior:'instant'});
    check(Number(getComputedStyle(document.querySelector('#dashboardAnalytics .analytics-card')).opacity)>.5,'dashboard charts are visible');
    check(smokeErrors.length===0,'no JavaScript errors');
    result.textContent=JSON.stringify({ok:true,checks});
  }catch(error){result.textContent=JSON.stringify({ok:false,error:String(error),checks,smokeErrors});}
});
