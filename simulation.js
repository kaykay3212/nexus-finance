/* Simulações ficam somente na sessão e nunca alteram os lançamentos reais. */
(()=>{
  const root=document.getElementById("simulation");
  if(!root)return;
  const $=selector=>root.querySelector(selector);
  const money=value=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number.isFinite(value)?value:0);
  const safe=value=>String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]));
  const items=[];
  let nextId=1;

  function values(){
    const [year,month]=selectedMonth().split("-").map(Number);
    const count=Number($("#simMonths").value);
    const actual=$("#simUseActual").checked?calcMonth():{income:0,expense:0};
    const rawInitial=Number($("#simInitial").value);
    const initial=Number.isFinite(rawInitial)?Math.max(-1e12,Math.min(1e12,rawInitial)):0;
    let balance=initial;
    return Array.from({length:count},(_,index)=>{
      const date=new Date(year,month-1+index,1);
      const income=actual.income+items.filter(item=>item.type==="income"&&(item.frequency==="monthly"||index===0)).reduce((sum,item)=>sum+item.amount,0);
      const expense=actual.expense+items.filter(item=>item.type==="expense"&&(item.frequency==="monthly"||index===0)).reduce((sum,item)=>sum+item.amount,0);
      balance+=income-expense;
      return{label:new Intl.DateTimeFormat("pt-BR",{month:"short"}).format(date).replace(".",""),income,expense,balance};
    });
  }

  function flowChart(months){
    const max=Math.max(1,...months.flatMap(month=>[month.income,month.expense]));
    const bars=months.map(month=>'<div class="simulation-bar-group" title="'+safe(month.label)+': entradas '+safe(money(month.income))+', saídas '+safe(money(month.expense))+'"><div class="simulation-bar-pair"><i class="simulation-bar income" style="height:'+Math.max(2,month.income/max*100)+'%"></i><i class="simulation-bar expense" style="height:'+Math.max(2,month.expense/max*100)+'%"></i></div><span>'+safe(month.label)+'</span></div>').join("");
    return '<div class="simulation-legend"><span><i class="income"></i>Entradas</span><span><i class="expense"></i>Saídas</span></div><div class="simulation-bars">'+bars+'</div>';
  }

  function balanceChart(months){
    const rawInitial=Number($("#simInitial").value);
    const data=[Number.isFinite(rawInitial)?Math.max(-1e12,Math.min(1e12,rawInitial)):0,...months.map(month=>month.balance)];
    const low=Math.min(0,...data),high=Math.max(0,...data),range=Math.max(1,high-low);
    const x=index=>36+index*(648/months.length);
    const y=value=>190-(value-low)/range*152;
    const points=data.map((value,index)=>x(index).toFixed(1)+","+y(value).toFixed(1)).join(" ");
    const zero=y(0).toFixed(1);
    const grid='<line x1="36" x2="684" y1="'+zero+'" y2="'+zero+'" class="simulation-zero"/>';
    const dots=months.map((month,index)=>'<circle cx="'+x(index+1).toFixed(1)+'" cy="'+y(month.balance).toFixed(1)+'" r="3.5"/>').join("");
    const labels=months.map((month,index)=>'<text x="'+x(index+1).toFixed(1)+'" y="215" text-anchor="middle">'+safe(month.label)+'</text>').join("");
    return '<svg viewBox="0 0 720 225" role="presentation" preserveAspectRatio="none"><line x1="36" x2="684" y1="38" y2="38" class="simulation-grid"/>'+grid+'<polyline pathLength="1" points="'+points+'" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>'+dots+labels+'</svg>';
  }

  function render(){
    const months=values(),first=months[0],last=months.at(-1);
    const actual=$("#simUseActual").checked?calcMonth():{income:0,expense:0};
    $("#simBaseNote").textContent=$("#simUseActual").checked?"Base mensal repetida: "+money(actual.income)+" em entradas e "+money(actual.expense)+" em saídas.":"Base desligada: apenas os valores simulados entram na conta.";
    for(const [id,value] of [["simIncomeTotal",first.income],["simExpenseTotal",first.expense],["simMonthResult",first.income-first.expense],["simFinalBalance",last.balance]]){
      const node=$("#"+id);node.textContent=money(value);node.classList.toggle("negative",value<0);
    }
    $("#simItems").innerHTML=items.length?items.map(item=>'<div class="simulation-item"><div><b>'+safe(item.name)+'</b><small>'+safe(item.type==="income"?"Entrada":"Saída")+' · '+safe(item.frequency==="monthly"?"Todo mês":"Uma vez")+'</small></div><strong class="'+(item.type==="income"?"income":"expense")+'">'+safe(money(item.amount))+'</strong><button type="button" class="secondary" data-remove-simulation="'+item.id+'" aria-label="Remover '+safe(item.name)+'">×</button></div>').join(""):'<p class="muted">Nenhum valor hipotético adicionado.</p>';
    $("#simFlowChart").innerHTML=flowChart(months);
    $("#simFlowChart").setAttribute("aria-label","Entradas e saídas projetadas por "+months.length+" meses.");
    $("#simBalanceChart").innerHTML=balanceChart(months);
    $("#simBalanceChart").setAttribute("aria-label","Saldo acumulado ao final: "+money(last.balance)+".");
  }

  $("#simulationForm").addEventListener("submit",event=>{
    event.preventDefault();
    const name=$("#simName").value.trim();
    const amount=Number($("#simAmount").value);
    if(!name||!Number.isFinite(amount)||amount<=0||amount>1e12)return;
    items.push({id:nextId++,name,amount,type:$("#simType").value,frequency:$("#simFrequency").value});
    $("#simName").value="";$("#simAmount").value="";
    render();$("#simName").focus();
  });
  $("#simItems").addEventListener("click",event=>{
    const button=event.target.closest("[data-remove-simulation]");if(!button)return;
    const index=items.findIndex(item=>item.id===Number(button.dataset.removeSimulation));
    if(index>=0){items.splice(index,1);render()}
  });
  for(const id of ["simUseActual","simMonths","simInitial"]){$("#"+id).addEventListener("input",render);$("#"+id).addEventListener("change",render)}
  window.NEXUS_SIMULATION={render,reset(){items.length=0;render()}};
  render();
})();
