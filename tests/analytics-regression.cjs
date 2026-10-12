const assert=require('node:assert/strict');
const {model,card}=require('../finance-analytics.js');
function run(){
  const rows=[
    {date:'2026-10-01',type:'Entrada',amount:1000,status:'Realizado',category:'Salário'},
    {date:'2026-10-02',type:'Saída',amount:200,status:'Pago',category:'Casa',mode:'Compromisso'},
    {date:'2026-10-03',type:'Saída',amount:100,status:'Realizado',category:'Reserva',mode:'Renda Fixa'},
    {date:'2026-10-11',type:'Saída',amount:50,status:'Pendente',category:'Serviço',mode:'Assinatura'},
    {date:'2026-09-01',type:'Entrada',amount:800,status:'Realizado',category:'Salário'},
    {date:'2026-09-02',type:'Saída',amount:250,status:'Pago',category:'Casa',mode:'Compromisso'},
  ];
  const data=model(rows,[{name:'Reserva',current:100,target:500}],'2026-10','2026-10-11',6);
  assert.equal(data.dashboard.length,4);assert.equal(data.stats.length,12);
  assert.deepEqual([data.current.income,data.current.expense,data.current.balance,data.current.invest],[1000,300,700,100]);
  assert.equal(data.before.balance,550);
  const get=id=>data.stats.find(chart=>chart.id===id);
  assert.equal(get('daily').rows.length,11);assert.equal(get('daily').rows.at(-1).values[0],700);
  assert.deepEqual(get('category-compare').rows.find(r=>r.label==='Casa').values,[200,250]);
  assert.equal(get('due').rows.find(r=>r.label==='Hoje').values[0],50);
  assert.equal(get('savings').rows.at(-1).values[0],70);
  assert.equal(get('savings').rows[0].values[0],null);
  assert.deepEqual(get('goals').rows[0].values,[100,500]);
  const negative=model([{date:'2026-10-01',type:'Saída',amount:123,status:'Realizado'}],[],'2026-10','2026-10-11');
  assert.equal(negative.current.balance,-123);
  assert(!card(negative.stats.find(c=>c.id==='daily')).includes('NaN'));
  const empty=model([],[],'2027-01','2026-10-11',12);
  assert.equal(empty.stats[0].rows.length,12);assert.equal(empty.dashboard[2].rows.length,0);
  assert(card(empty.dashboard[0]).includes('Sem valores'));
  const dangerous=card({id:'test',title:'<script>alert(1)</script>',note:'test',labels:['Valor'],rows:[{label:'<img onerror=alert(1)>',values:[5]}]});
  assert(!dangerous.includes('<script>'));assert(!dangerous.includes('<img'));
  console.log('Analytics: totals, periods, negative balance, missing income, goals, due dates and escaping OK');
  return 18;
}
module.exports=run;
if(require.main===module)run();
