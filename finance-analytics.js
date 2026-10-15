"use strict";

/* Pure calculations + responsive SVG/HTML charts, independent of external CDNs. */
((global)=>{
  const colors=["#d6b400","#8faec5","#cf917f"];
  const escape=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money=value=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(value);
  const numeric=value=>Number.isFinite(Number(value))?Number(value):0;
  const amount=row=>numeric(row.amount);
  const done=row=>["pago","realizado","recebido","concluído","concluido"].includes(String(row.status||"").trim().toLowerCase());
  const outgoing=row=>row.type==="Saída";
  const invested=row=>outgoing(row)&&(row.classification==="Investimento"||["Investimentos","Reserva"].includes(row.category)||row.mode==="Renda Fixa");
  const pending=row=>["Compromisso","Assinatura"].includes(row.mode)&&!done(row);
  const sum=rows=>Math.round(rows.reduce((total,row)=>total+amount(row),0)*100)/100;
  function months(key,count){
    const [year,month]=key.split("-").map(Number);
    return Array.from({length:count},(_,i)=>{const date=new Date(year,month-count+i,1);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`});
  }
  function group(rows,field){
    const result=new Map();
    rows.forEach(row=>{const key=String(row[field]||"Sem categoria");result.set(key,(result.get(key)||0)+amount(row))});
    return [...result].sort((a,b)=>b[1]-a[1]);
  }
  const monthLabel=key=>new Date(Number(key.slice(0,4)),Number(key.slice(5,7))-1,1).toLocaleDateString("pt-BR",{month:"short",year:"2-digit"});
  function model(records,goals,key,today,count=6){
    const inMonth=month=>records.filter(row=>String(row.date).slice(0,7)===month);
    const totals=month=>{
      const all=inMonth(month),real=all.filter(done),income=sum(real.filter(r=>r.type==="Entrada")),expense=sum(real.filter(outgoing));
      return {all,real,income,expense,balance:Math.round((income-expense)*100)/100,invest:sum(real.filter(invested))};
    };
    const keys=months(key,count),previous=months(key,2)[0],current=totals(key),before=totals(previous);
    const series=keys.map(month=>({key:month,...totals(month)}));
    const annualRows=Array.from({length:12},(_,index)=>{
      const monthKey=key.slice(0,4)+"-"+String(index+1).padStart(2,"0"),monthTotals=totals(monthKey);
      return {label:monthLabel(monthKey),values:[monthTotals.real.length?monthTotals.balance:null]};
    });
    const expenses=current.real.filter(outgoing),incomes=current.real.filter(r=>r.type==="Entrada");
    const [year,month]=key.split("-").map(Number),days=new Date(year,month,0).getDate();
    // Do not draw zero-valued future days as if they were observed history.
    const elapsed=key===today.slice(0,7)?Number(today.slice(8,10)):key<today.slice(0,7)?days:0;
    let cumulative=0;
    const daily=Array.from({length:elapsed},(_,i)=>{
      const date=key+"-"+String(i+1).padStart(2,"0"),rows=current.real.filter(r=>r.date===date);
      cumulative+=sum(rows.filter(r=>r.type==="Entrada"))-sum(rows.filter(outgoing));
      return {label:String(i+1).padStart(2,"0"),values:[Math.round(cumulative*100)/100]};
    });
    const due=[{label:"Atrasados",values:[0]},{label:"Hoje",values:[0]},{label:"Próximos 7 dias",values:[0]},{label:"8 a 30 dias",values:[0]},{label:"Após 30 dias",values:[0]}];
    records.filter(pending).forEach(row=>{
      const diff=Math.round((Date.parse(row.date+"T12:00:00Z")-Date.parse(today+"T12:00:00Z"))/86400000);
      if(Number.isFinite(diff))due[diff<0?0:diff===0?1:diff<=7?2:diff<=30?3:4].values[0]+=amount(row);
    });
    const oldCategories=new Map(group(before.real.filter(outgoing),"category"));
    const newCategories=new Map(group(expenses,"category"));
    const categoryCompare=[...new Set([...oldCategories.keys(),...newCategories.keys()])]
      .sort((a,b)=>Math.max(newCategories.get(b)||0,oldCategories.get(b)||0)-Math.max(newCategories.get(a)||0,oldCategories.get(a)||0))
      .map(label=>({label,values:[newCategories.get(label)||0,oldCategories.get(label)||0]}));
    const grouped=(rows,field)=>group(rows,field).map(([label,value])=>({label,values:[value]}));
    const flow={id:"flow",title:"Entradas e saídas",note:"Valores realizados por mês. Aportes estão incluídos nas saídas.",labels:["Entradas","Saídas"],rows:series.map(m=>({label:monthLabel(m.key),values:[m.income,m.expense]}))};
    const annual={id:"annual-result",title:"Resultado mensal · "+key.slice(0,4),note:"Entradas − saídas realizadas. Meses sem registros ficam vazios.",kind:"line",emptyLabel:"Sem registros",labels:["Resultado"],rows:annualRows};
    const categories={id:"categories",title:"Gastos por categoria",note:"Saídas realizadas no mês selecionado, incluindo investimentos.",labels:["Saídas"],rows:grouped(expenses,"category")};
    const accumulated={id:"daily",title:"Saldo acumulado no mês",note:"Entradas menos saídas, a partir de zero no início do mês. Não é o saldo da conta bancária.",kind:"line",labels:["Saldo acumulado"],rows:current.real.length?daily:[]};
    const deadlines={id:"due",title:"Vencimentos em aberto",note:`Compromissos e assinaturas de todos os meses. Referência: ${today.split("-").reverse().join("/")}.`,labels:["A pagar"],rows:due};
    const stats=[annual,flow,
      {id:"monthly-balance",title:"Resultado de cada mês",note:"Saldo de entradas e saídas realizadas. Valores negativos indicam saídas maiores que entradas.",kind:"line",labels:["Saldo mensal"],rows:series.some(m=>m.real.length)?series.map(m=>({label:monthLabel(m.key),values:[m.balance]})):[]},
      accumulated,categories,
      {id:"income",title:"De onde veio a renda",note:"Entradas realizadas agrupadas por categoria no mês selecionado.",labels:["Entradas"],rows:grouped(incomes,"category")},
      {id:"classification",title:"Classificação dos gastos",note:"Comparação entre as classificações que você atribuiu às saídas realizadas.",labels:["Saídas"],rows:grouped(expenses,"classification")},
      {id:"category-compare",title:"Categorias: este mês × anterior",note:`Compara ${monthLabel(key)} com ${monthLabel(previous)}. Meses sem lançamentos não comprovam ausência de gastos.`,labels:["Selecionado","Anterior"],rows:categoryCompare},
      {id:"status",title:"Realizado e ainda em aberto",note:"Saídas do mês: separa registros realizados das situações pendentes ou previstas.",labels:["Valor"],rows:grouped(current.all.filter(outgoing).map(r=>({...r,paymentState:done(r)?"Realizado / pago":r.date<today&&pending(r)?"Atrasado":r.status||"Pendente"})),"paymentState")},
      {id:"investments",title:"Evolução dos aportes",note:"Investimentos realizados por mês. Não inclui rentabilidade ou valorização de mercado.",labels:["Aportes"],rows:series.map(m=>({label:monthLabel(m.key),values:[m.invest]}))},
      {id:"savings",title:"Quanto sobrou da renda",note:"Saldo ÷ entradas realizadas.",kind:"line",percent:true,emptyLabel:"Sem renda",labels:["Percentual da renda"],rows:series.map(m=>({label:monthLabel(m.key),values:[m.income?m.balance/m.income*100:null]}))},
      {id:"goals",title:"Metas: acumulado × objetivo",note:"Valores informados nas metas, independentemente do mês selecionado. Não são calculados automaticamente pelas movimentações.",labels:["Acumulado","Objetivo"],rows:goals.map(g=>({label:g.name,values:[numeric(g.current),numeric(g.target)]}))},
      deadlines
    ];
    [...stats,flow,accumulated,deadlines].forEach(chart=>{chart.monthIncome=current.income});
    return {key,previous,current,before,dashboard:[annual,flow,categories,accumulated,deadlines],stats};
  }
  function financialTone(chart,value,change=false){
    if(value===null||!Number.isFinite(value)||value===0)return "neutral";
    const bad=["categories","classification","category-compare","status","due"].includes(chart.id);
    if(change)return (bad?value<0:value>0)?"good":"bad";
    if(bad)return "bad";
    return value>0?"good":"bad";
  }
  function table(chart){
    const format=value=>value===null?(chart.emptyLabel||"Sem dados"):chart.percent?value.toFixed(1)+"%":money(value);
    return '<details><summary>Ver valores em tabela</summary><div class="analytics-table-wrap"><table class="analytics-table"><caption class="sr-only">'+escape(chart.title)+'</caption><thead><tr><th scope="col">Período / grupo</th>'+chart.labels.map(label=>'<th scope="col">'+escape(label)+'</th>').join("")+'</tr></thead><tbody>'+chart.rows.map(row=>'<tr><th scope="row">'+escape(row.label)+'</th>'+row.values.map(value=>'<td class="nexus-tone-'+financialTone(chart,value)+'">'+escape(format(value))+'</td>').join("")+'</tr>').join("")+'</tbody></table></div></details>';
  }
  function bars(chart,limit){
    const rows=limit?chart.rows.slice(0,limit):chart.rows,max=Math.max(1,...chart.rows.flatMap(r=>r.values.filter(v=>v!==null)));
    return '<div class="analytics-bars">'+rows.map(row=>'<div><div class="analytics-row-head"><span>'+escape(row.label)+'</span><b>'+row.values.map(money).map(escape).join(" / ")+'</b></div>'+row.values.map((value,index)=>'<div class="analytics-track"><div class="analytics-fill" style="--bar-width:'+Math.max(0,value/max*100)+'%;--series:'+colors[index%colors.length]+'" title="'+escape(chart.labels[index]+": "+money(value))+'"></div></div>').join("")+'</div>').join("")+'</div>'+(rows.length<chart.rows.length?'<p class="analytics-note">'+rows.length+' maiores categorias. A tabela contém todas.</p>':"");
  }
  function line(chart){
    const entries=chart.rows.map((r,i)=>({i,v:r.values[0]})).filter(p=>p.v!==null&&Number.isFinite(p.v));
    if(!entries.length)return '<div class="analytics-empty">Sem dados neste período.</div>';
    const values=entries.map(p=>p.v),low=Math.min(0,...values),high=Math.max(1,...values),range=high-low;
    const expense=/expense|spend|due|gasto|despesa|saída|vencimento/i.test(chart.id+" "+chart.title);
    const delta=values[values.length-1]-values[0];
    const good=expense?delta<0:delta>0;
    const color=values.length<2||delta===0?"#aeb1aa":good?"#42cc70":"#ff6666";
    const x=i=>28+i*514/Math.max(1,chart.rows.length-1),y=v=>186-(v-low)/range*154,base=y(0);
    let paths=[],segment=[];
    chart.rows.forEach((r,i)=>{const v=r.values[0];if(v===null||!Number.isFinite(v)){if(segment.length)paths.push(segment);segment=[]}else segment.push([x(i),y(v)])});
    if(segment.length)paths.push(segment);
    const id="nexus-trend-"+chart.id.replace(/[^a-zA-Z0-9_-]/g,"");
    const areas=paths.map(p=>'<path d="M'+p[0][0]+' '+base+' L'+p.map(x=>x.join(" ")).join(" L")+' L'+p[p.length-1][0]+' '+base+' Z" fill="url(#'+id+')"/>').join("");
    const lines=paths.map(p=>'<path d="M'+p.map(x=>x.join(" ")).join(" L")+'" stroke="'+color+'" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>').join("");
    const ticks=[...new Set([0,Math.floor((chart.rows.length-1)/2),chart.rows.length-1])];
    return '<svg class="analytics-line nexus-market-line" viewBox="0 0 570 230" role="img" aria-label="'+escape(chart.title)+'. Valores exatos na tabela."><title>'+escape(chart.title)+'</title><defs><linearGradient id="'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="'+color+'" stop-opacity=".4"/><stop offset="100%" stop-color="'+color+'" stop-opacity="0"/></linearGradient></defs><line x1="28" x2="542" y1="'+base+'" y2="'+base+'" stroke="'+color+'" stroke-dasharray="6 6" opacity=".5"/>'+areas+lines+ticks.map(i=>'<text x="'+x(i)+'" y="218" text-anchor="'+(i===0?"start":i===chart.rows.length-1?"end":"middle")+'">'+escape(chart.rows[i]?.label||"")+'</text>').join("")+'</svg>';
  }
  function card(chart,compact=false){
    const available=chart.rows.length&&(chart.kind==="line"?chart.rows.some(r=>r.values[0]!==null):chart.rows.some(r=>r.values.some(v=>v>0)));
    const legend='<div class="analytics-legend">'+chart.labels.map((label,i)=>'<span><i style="--series:'+colors[i]+'"></i>'+escape(label)+'</span>').join("")+'</div>';
    return '<article class="panel analytics-card" data-analytics-chart="'+chart.id+'"><h3>'+escape(chart.title)+'</h3>'+(compact?"":'<p class="analytics-note">'+escape(chart.note)+'</p>')+(available?legend+(chart.kind==="line"?line(chart):bars(chart,compact&&chart.id==="categories"?5:0)):'<div class="analytics-empty">Sem dados neste período.</div>')+table(chart)+'</article>';
  }
  function comparison(data){
    return [["Entradas","income"],["Saídas","expense"],["Saldo de caixa","balance"]].map(([label,key])=>{
      const current=data.current[key],before=data.before[key],delta=current-before;
      const change=!data.current.all.length?"Sem registros no mês selecionado":!data.before.all.length?"Sem registros no mês anterior":before===0?"Sem base para variação percentual":(delta>=0?"+":"")+(delta/Math.abs(before)*100).toFixed(1)+"% em relação ao anterior";
      return '<div class="analytics-comparison"><span>'+label+'</span><strong class="nexus-tone-'+(current===0?'neutral':key==='expense'?'bad':current>0?'good':'bad')+'">'+escape(money(current))+'</strong><em class="nexus-tone-'+(!data.before.all.length||!data.current.all.length||delta===0?'neutral':key==='expense'?(delta<0?'good':'bad'):(delta>0?'good':'bad'))+'">'+escape(change)+'</em><small>Anterior: '+escape(money(before))+(data.before.all.length?' · diferença: '+escape(money(delta)):"")+'</small></div>';
    }).join("");
  }
  function render(records,goals,key,today){
    const count=Number(global.document.getElementById("analyticsMonths")?.value)||6;
    const data=model(records,goals,key,today,count);
    const dashboard=global.document.getElementById("dashboardAnalytics"),stats=global.document.getElementById("statisticsAnalytics");
    if(dashboard)dashboard.innerHTML=data.dashboard.map(chart=>card(chart,true)).join("");
    if(stats)stats.innerHTML=data.stats.map(chart=>card(chart)).join("");
    const comparisons=global.document.getElementById("monthComparisons");
    if(comparisons)comparisons.innerHTML=comparison(data);
    const caption=global.document.getElementById("comparisonPeriod");
    if(caption)caption.textContent=monthLabel(key)+" × "+monthLabel(data.previous)+(key===today.slice(0,7)?" · mês atual em andamento; anterior completo":" · totais registrados em cada mês");
  }
  const api={model,render,card};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  global.NexusAnalytics=api;
})(typeof window!=="undefined"?window:globalThis);
