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
    fill('monthPicker','2026-10');renderAll();go('simulation');
    check(!!document.getElementById('simulationForm')&&!!document.querySelector('.nav [data-page="simulation"]'),'simulation has a form and desktop destination');
    check(document.getElementById('simIncomeTotal').textContent.includes('5.000')&&document.getElementById('simExpenseTotal').textContent.includes('2.500'),'simulation starts from realized month values');
    fill('simType','income');fill('simName','Renda extra');fill('simAmount','100');fill('simFrequency','monthly');submit('simulationForm');
    fill('simType','expense');fill('simName','Compra única');fill('simAmount','50');fill('simFrequency','once');submit('simulationForm');
    fill('simMonths','3');document.getElementById('simMonths').dispatchEvent(new Event('change'));
    check(document.getElementById('simMonthResult').textContent.includes('2.550')&&document.getElementById('simFinalBalance').textContent.includes('7.750'),'simulation calculates recurring and one-time values');
    check(document.querySelectorAll('#simFlowChart .simulation-bar-group').length===3&&document.querySelectorAll('#simBalanceChart circle').length===3,'simulation renders both charts');
    document.querySelector('#simItems [data-remove-simulation]').click();
    check(document.querySelectorAll('#simItems .simulation-item').length===1,'simulation removes a hypothetical entry');
    if(matchMedia('(max-width:820px)').matches){
      go('settings');const nav=document.querySelector('.mobile-nav');
      const toggle=nav.querySelector('.mobile-nav-toggle'),items=nav.querySelector('.mobile-nav-items');
      const expectedPages=['home','movements','investments','goals','simulation','stats','crypto','settings'];
      const viewportWidth=document.documentElement.clientWidth;
      check(!!toggle&&!!items&&items.hidden&&!nav.classList.contains('mobile-nav-open'),'mobile navigation starts collapsed');
      const collapsed=toggle.getBoundingClientRect(),navBounds=nav.getBoundingClientRect();
      check(collapsed.width>=58&&collapsed.height>=58&&navBounds.left<=20&&navBounds.width<=72,'collapsed mobile navigation is a larger left-side icon');
      check(getComputedStyle(toggle).backdropFilter!=='none','floating navigation has a glass surface');
      const priorAppearance=document.body.classList.contains('appearance-glass')?'glass':'solid';
      setAppearance('glass');toggle.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch'}));
      await new Promise(resolve=>setTimeout(resolve,210));
      check(toggle.classList.contains('is-holding'),'long press energizes glass navigation');
      toggle.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerType:'touch'}));setAppearance(priorAppearance);
      check(nav.querySelectorAll('.mobile-nav-items [data-page]').length===8&&expectedPages.every(page=>items.querySelector('[data-page="'+page+'"]')),'mobile navigation has all eight destinations');
      check([...items.querySelectorAll('[data-page]')].every(button=>button.children.length===1&&button.querySelector('b')&&!button.querySelector('span')),'mobile destinations use icons only');
      check(!!items.querySelector('[data-page="stats"] svg path'),'statistics destination uses an SVG graph icon');
      const openNav=()=>toggle.click();
      const verifyCurrent=page=>{
        const buttons=[...items.querySelectorAll('[data-page]')],current=buttons[0];
        check(current.dataset.page===page&&current.classList.contains('active')&&current.getAttribute('aria-current')==='page','current '+page+' destination is first and marked current');
        check(getComputedStyle(current).color===getComputedStyle(toggle).color,'current '+page+' destination is yellow');
      };
      openNav();
      check(nav.classList.contains('mobile-nav-open')&&!items.hidden&&toggle.getAttribute('aria-expanded')==='true'&&toggle.getAttribute('aria-label')==='Fechar navegação','mobile navigation opens');
      await new Promise(resolve=>setTimeout(resolve,260));
      const opened=items.getBoundingClientRect(),toggleBounds=toggle.getBoundingClientRect();
      check(opened.width>=44&&opened.height>=44&&opened.right<=viewportWidth+1&&opened.bottom<=toggleBounds.top+1,'open mobile navigation forms an upward rail');
      check(getComputedStyle(items).borderRadius!=='0px','open mobile navigation rail has rounded corners');
      check([...items.querySelectorAll('[data-page]')].every(button=>{const rect=button.getBoundingClientRect();return rect.width>=44&&rect.height>=44;}),'mobile navigation targets are at least 44 pixels');
      verifyCurrent('settings');
      openNav();
      for(const page of expectedPages){
        openNav();items.querySelector('[data-page="'+page+'"]').click();verifyCurrent(page);
        check(items.hidden&&!nav.classList.contains('mobile-nav-open'),'mobile navigation closes after selecting '+page);
      }
      go('home');verifyCurrent('home');
      check(items.hidden&&!nav.classList.contains('mobile-nav-open')&&toggle.getAttribute('aria-expanded')==='false','mobile navigation closes after page selection');
      syncMobileNav('binance');
      check(items.querySelector('[data-page="binance"]')===items.firstElementChild&&items.firstElementChild.getAttribute('aria-current')==='page','a destination opened from a shortcut also appears first');
      syncMobileNav('home');
      check(!items.querySelector('[data-page="binance"]'),'temporary shortcut destination leaves the compact menu afterward');
      openNav();document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
      check(items.hidden&&!nav.classList.contains('mobile-nav-open'),'Escape closes mobile navigation');
      openNav();document.body.dispatchEvent(new MouseEvent('click',{bubbles:true}));
      check(items.hidden&&!nav.classList.contains('mobile-nav-open'),'outside click closes mobile navigation');
      go('home');
      const swipeToStats=()=>{go('stats');verifyCurrent('stats');};
      openNav();swipeToStats();
      check(items.hidden&&!nav.classList.contains('mobile-nav-open'),'mobile navigation closes after swipe page change');
      check(document.documentElement.scrollWidth<=document.documentElement.clientWidth+1,'mobile navigation has no horizontal overflow');

      go('movements');setMode('Renda Fixa');
      const search=document.getElementById('historySearch'),filterToggle=document.querySelector('.history-filter-switcher .mobile-tabs-toggle');
      const searchBox=search.getBoundingClientRect(),filterBox=filterToggle.getBoundingClientRect();
      check(filterBox.left-searchBox.right>=10&&Math.abs((filterBox.top+filterBox.bottom-searchBox.top-searchBox.bottom)/2)<=4,'history filter toggle is aligned and spaced from search');
      filterToggle.click();
      check(filterToggle.getAttribute('aria-expanded')==='true'&&getComputedStyle(document.getElementById('historyFilters')).display!=='none','history filters open below search');
      document.querySelector('#historyFilters [data-filter="Assinatura"]').click();
      check(filterToggle.getAttribute('aria-expanded')==='false','history filter closes after selection');
      setMode('Assinatura');
      const fieldRadius=parseFloat(getComputedStyle(document.getElementById('fRecurrence')).borderTopLeftRadius);
      const saveRadius=parseFloat(getComputedStyle(document.getElementById('saveMovement')).borderTopLeftRadius);
      check(fieldRadius>=10&&saveRadius>=fieldRadius&&saveRadius<=18,'subscription fields and Save button have proportional corners');
      setMode('Renda Fixa');
      check(Math.abs(parseFloat(getComputedStyle(document.getElementById('fFixedProduct')).borderTopLeftRadius)-fieldRadius)<=2,'fixed-income fields share the form shape');

      window.scrollTo({top:Math.min(300,document.documentElement.scrollHeight-innerHeight),behavior:'instant'});
      check(scrollY>100,'movement page can scroll before page switch');
      go('stats');
      check(scrollY<=2,'changing page returns to top');
      window.scrollTo({top:160,behavior:'instant'});
      const retainedScroll=scrollY;go('stats');
      check(retainedScroll>80&&Math.abs(scrollY-retainedScroll)<=2,'reselecting the same page retains scroll');
      nexusUI.touchPage=document.querySelector('.page.active');
      const heightBefore=document.documentElement.scrollHeight,preview=nexusUI.prepareNeighbor(-100);
      const previewTop=preview?.getBoundingClientRect().top,headerBottom=document.querySelector('.topbar').getBoundingClientRect().bottom;
      check(preview&&Math.abs(previewTop-headerBottom)<=8,'swipe preview starts in the visible area');
      check(document.documentElement.scrollHeight<=heightBefore+1,'swipe preview does not add blank scroll area');
      nexusUI.clearNeighbor();nexusUI.touchPage=null;
      go('settings');window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'});
      check(innerHeight-document.querySelector('.page.active').getBoundingClientRect().bottom<=70,'page end has no large empty strip');
      check(getComputedStyle(document.body).overscrollBehaviorY==='none','mobile page avoids blank overscroll at the top');

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
