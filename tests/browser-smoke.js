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
    go('movements');setMode('Movimentação');fill('fType','Entrada');
    document.getElementById('fType').dispatchEvent(new Event('change'));
    check(document.getElementById('fClassField').hidden&&document.getElementById('fNoteField').hidden,'income hides expense-only fields');
    check(document.getElementById('fCategoryLabel').textContent==='Origem','income asks for source');
    check([...document.getElementById('fCategory').options].every(option=>['Salário','Renda extra','Reembolso','Venda','Rendimentos','Outros'].includes(option.value)),'income has source categories');
    fill('fDescription','Smoke salary');fill('fAmount','1200');fill('fDate','2026-10-11');submit('movementForm');
    await wait(()=>!document.getElementById('saveMovement').disabled);
    check(rows.length===2&&rows[1].type==='Entrada'&&rows[1].category==='Salário'&&rows[1].amount===1200,'essential income saves correctly');
    fill('fType','Saída');document.getElementById('fType').dispatchEvent(new Event('change'));
    check(!document.getElementById('fClassField').hidden&&!document.getElementById('fNoteField').hidden,'expense fields return');
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
    check(document.querySelectorAll('#dashboardAnalytics [data-analytics-chart]').length===5,'dashboard has five charts');
    check(!document.getElementById('dashboardSummary').hidden&&document.getElementById('dashboardCharts').hidden&&document.getElementById('dashboardFollowup').hidden,'dashboard starts with compact summary');
    const dashboardTabs=document.querySelector('.dashboard-tabs'),tabBounds=dashboardTabs.getBoundingClientRect();
    check([...dashboardTabs.querySelectorAll('button')].every(button=>{const rect=button.getBoundingClientRect();return rect.left-tabBounds.left>=5&&tabBounds.right-rect.right>=5&&rect.top-tabBounds.top>=5&&tabBounds.bottom-rect.bottom>=5;}),'dashboard selection has consistent insets');
    check([...document.querySelectorAll('#dashboardChartPicker option')].every(option=>document.querySelector('#dashboardAnalytics [data-analytics-chart="'+option.value+'"]')),'every chart choice has data');
    document.getElementById('dashboardTabCharts').click();
    check(document.getElementById('dashboardSummary').hidden&&!document.getElementById('dashboardCharts').hidden&&document.querySelectorAll('#dashboardAnalytics [data-analytics-chart]:not([hidden])').length===1,'charts tab shows one chart at a time');
    fill('dashboardChartPicker','flow');document.getElementById('dashboardChartPicker').dispatchEvent(new Event('change'));
    check(!document.querySelector('#dashboardAnalytics [data-analytics-chart="flow"]').hidden&&document.querySelector('#dashboardAnalytics [data-analytics-chart="annual-result"]').hidden,'chart picker changes the visible comparison');
    renderFinanceAnalytics();
    check(!document.querySelector('#dashboardAnalytics [data-analytics-chart="flow"]').hidden,'selected chart survives data refresh');
    document.getElementById('dashboardTabFollowup').click();
    check(!document.getElementById('dashboardFollowup').hidden&&document.getElementById('dashboardCharts').hidden,'follow-up tab shows goals and due items');
    document.getElementById('dashboardTabFollowup').focus();
    document.getElementById('dashboardTabFollowup').dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true}));
    check(document.activeElement===document.getElementById('dashboardTabSummary')&&document.getElementById('dashboardTabSummary').getAttribute('aria-selected')==='true','dashboard tabs support keyboard navigation');
    document.getElementById('dashboardTabSummary').click();
    check(document.querySelectorAll('#statisticsAnalytics [data-analytics-chart]').length===13,'statistics has thirteen charts');
    check(document.querySelectorAll('#statisticsAnalytics details').length===13,'all statistics charts have data tables');
    check(document.querySelector('#dashboardAnalytics [data-analytics-chart="annual-result"] tbody').rows.length===12,'annual result shows all twelve months');
    go('stats');fill('analyticsMonths','12');document.getElementById('analyticsMonths').dispatchEvent(new Event('change'));
    check(document.querySelector('#statisticsAnalytics [data-analytics-chart=flow] tbody').rows.length===12,'history switches to twelve months');
    fill('statsMonthPicker','2026-09');document.getElementById('statsMonthPicker').dispatchEvent(new Event('change'));
    check(document.getElementById('monthPicker').value==='2026-09','statistics month selector synchronizes');
    check(document.documentElement.scrollWidth<=innerWidth+1,'statistics does not overflow viewport');
    if(matchMedia('(max-width:820px)').matches){
      go('settings');const nav=document.querySelector('.mobile-nav');
      const navBounds=nav.getBoundingClientRect(),navStyle=getComputedStyle(nav);
      const navWidth=navBounds.width,viewportWidth=document.documentElement.clientWidth;
      check(navStyle.display!=='none'&&navWidth>0&&navWidth<=Math.min(360,viewportWidth-30)+1,'mobile navigation is narrower than viewport');
      check(Math.abs((navBounds.left+navBounds.right)/2-viewportWidth/2)<=1,'mobile navigation is horizontally centered');
      check(navBounds.height<=54&&navBounds.height>=44,'mobile navigation compact height');
      const activeNav=nav.querySelector('button.active').getBoundingClientRect();
      check(activeNav.top-navBounds.top>=4&&navBounds.bottom-activeNav.bottom>=4,'active mobile tab has a consistent vertical inset');
      const buttons=[...nav.querySelectorAll('button')];
      check(buttons.length>=4,'mobile navigation has overflow items to scroll');
      check(buttons.every(button=>{const rect=button.getBoundingClientRect();return rect.height>=44&&rect.width>=44;}),'mobile navigation targets are at least 44 pixels');
      nav.scrollTo({left:0,behavior:'instant'});await new Promise(resolve=>setTimeout(resolve,80));
      const bounds=nav.getBoundingClientRect(),firstThree=buttons.slice(0,3),fourth=buttons[3];
      check(firstThree.every(button=>{const rect=button.getBoundingClientRect();return rect.left>=bounds.left-1&&rect.right<=bounds.right+1;} )&&fourth.getBoundingClientRect().right>bounds.right+1,'mobile navigation shows three complete items');
      nav.scrollTo({left:nav.scrollWidth,behavior:'instant'});await new Promise(resolve=>setTimeout(resolve,100));
      const last=buttons.at(-1).getBoundingClientRect();
      check(nav.scrollLeft>=nav.scrollWidth-nav.clientWidth-1,'mobile navigation can scroll to its end');
      check(last.left>=bounds.left+4&&last.right<=bounds.right-4&&Math.abs(bounds.right-last.right)<=8,'last mobile item is reachable with a small edge inset');

      const coins=[...document.querySelectorAll('.coin-field .coin')].filter(coin=>{
        const style=getComputedStyle(coin);return style.display!=='none'&&style.visibility!=='hidden';
      });
      check(coins.length>=16,'at least sixteen mobile coins are enabled');
      const coinRects=coins.map(coin=>coin.getBoundingClientRect());
      const quarters=[0,0,0,0];
      coinRects.forEach(rect=>{
        const center=(rect.left+rect.right)/2;
        const quarter=Math.min(3,Math.max(0,Math.floor(center/viewportWidth*4)));
        quarters[quarter]++;
      });
      check(quarters.every(count=>count>0),'mobile coins cover all four viewport quarters');
      check(coinRects.every(rect=>rect.left>=-1&&rect.right<=viewportWidth+1),'mobile coins stay within viewport width '+JSON.stringify({outside:coinRects.filter(rect=>rect.left< -1||rect.right>viewportWidth+1).map(rect=>({left:rect.left,right:rect.right})),clientWidth:document.documentElement.clientWidth,innerWidth}));
    }
    check(getComputedStyle(document.body).userSelect==='none'&&getComputedStyle(document.querySelector('.app')).userSelect==='none','body text is not casually selectable');
    const selectionProbe=document.createElement('textarea');document.body.append(selectionProbe);
    const formControlsSelectable=getComputedStyle(document.querySelector('input')).userSelect==='text'&&getComputedStyle(selectionProbe).userSelect==='text';
    selectionProbe.remove();
    check(formControlsSelectable,'inputs and textareas remain selectable');
    if(!matchMedia('(max-width:820px)').matches){
      const nav=document.querySelector('.mobile-nav');
      check(getComputedStyle(nav).display==='none','mobile navigation stays hidden on desktop');
      check(document.documentElement.scrollWidth<=document.documentElement.clientWidth+1,'desktop has no horizontal overflow');
    }
    fill('monthPicker','2026-10');renderAll();go('home');window.scrollTo(0,0);
    check(getComputedStyle(document.querySelector('#home')).gap==='12px'&&getComputedStyle(document.getElementById('dashboardAnalytics')).gap==='12px'&&getComputedStyle(document.getElementById('movementForm')).gap==='12px','main sections use consistent spacing');
    check(document.documentElement.scrollWidth<=innerWidth+1,'dashboard does not overflow viewport');
    document.getElementById('dashboardTabCharts').click();
    document.getElementById('dashboardAnalytics').scrollIntoView({block:'start',behavior:'instant'});
    check(getComputedStyle(document.querySelector('#dashboardAnalytics [data-analytics-chart="flow"]')).display!=='none','selected dashboard chart is visible');
    const visibleChart=document.querySelector('#dashboardAnalytics [data-analytics-chart]:not([hidden])');
    check(visibleChart.getBoundingClientRect().height<=Math.max(320,innerHeight-260)+1,'dashboard chart height stays within the viewport');
    check(smokeErrors.length===0,'no JavaScript errors');
    result.textContent=JSON.stringify({ok:true,checks});
  }catch(error){result.textContent=JSON.stringify({ok:false,error:String(error),checks,smokeErrors});}
});
