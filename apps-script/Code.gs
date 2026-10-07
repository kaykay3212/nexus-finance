const PROPS = PropertiesService.getScriptProperties();

function cfg_(key){ return PROPS.getProperty(key) || ""; }
function json_(obj){ return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function auth_(token){ const expected=cfg_("API_TOKEN"); return expected && token && String(token)===expected; }

function sheet_(){
  const id=cfg_("SPREADSHEET_ID");
  if(!id) throw new Error("SPREADSHEET_ID não configurado");
  const sh=SpreadsheetApp.openById(id).getSheetByName("Movimentações");
  if(!sh) throw new Error("Aba Movimentações não encontrada");
  return sh;
}
function dateText_(v){
  if(v instanceof Date) return Utilities.formatDate(v,"America/Sao_Paulo","yyyy-MM-dd");
  return String(v||"");
}
function monthPt_(d){
  return ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"][d.getMonth()];
}
function rowObj_(r){
  return {
    id:r[0],date:dateText_(r[1]),type:r[2],description:r[3],category:r[4],subcategory:r[5],
    purpose:r[6],classification:r[7],amount:Number(r[8])||0,month:r[9],year:r[10],
    status:r[11],note:r[12],mode:r[13]||"Movimentação",installments:Number(r[14])||0,
    currentInstallment:Number(r[15])||0,dueDay:Number(r[16])||0,recurrence:r[17]||"Único",
    priority:r[18]||"",paidAt:dateText_(r[19])
  };
}
function list_(){
  const sh=sheet_(),values=sh.getDataRange().getValues();
  if(values.length<2)return [];
  return values.slice(1).filter(r=>r[0]!==""&&r[0]!=null).map(rowObj_);
}
function doGet(e){
  const p=e&&e.parameter?e.parameter:{};
  if(!auth_(p.token))return json_({error:"unauthorized"});
  if((p.action||"list")==="list")return json_({ok:true,transactions:list_()});
  return json_({error:"unknown_action"});
}
function doPost(e){
  let d={};
  try{d=JSON.parse((e&&e.postData&&e.postData.contents)||"{}")}catch(_){return json_({error:"invalid_json"})}
  if(!auth_(d.token))return json_({error:"unauthorized"});
  const action=d.action||"create";
  if(action==="create")return create_(d);
  if(action==="markPaid")return markPaid_(d);
  return json_({error:"unknown_action"});
}
function create_(d){
  const sh=sheet_();
  const ds=d.date||Utilities.formatDate(new Date(),"America/Sao_Paulo","yyyy-MM-dd");
  const date=new Date(ds+"T12:00:00");
  const id=Date.now();
  const row=[
    id,date,d.type||"Saída",d.description||"",d.category||"Outros",d.subcategory||"",
    d.purpose||"Registrado pelo Nexus Finance",d.classification||"Controlável",Number(d.amount)||0,
    monthPt_(date),Number(Utilities.formatDate(date,"America/Sao_Paulo","yyyy")),
    d.status||"Realizado",d.note||"",d.mode||"Movimentação",Number(d.installments)||0,
    Number(d.currentInstallment)||0,Number(d.dueDay)||0,d.recurrence||"Único",d.priority||"",
    d.paidAt?new Date(d.paidAt+"T12:00:00"):""
  ];
  sh.appendRow(row);
  return json_({ok:true,transaction:rowObj_(row)});
}
function markPaid_(d){
  if(d.id==null)return json_({error:"missing_id"});
  const sh=sheet_(),values=sh.getRange(2,1,Math.max(sh.getLastRow()-1,1),1).getValues();
  let row=-1;
  for(let i=0;i<values.length;i++){if(String(values[i][0])===String(d.id)){row=i+2;break}}
  if(row<0)return json_({error:"not_found"});
  const paid=new Date();
  sh.getRange(row,12).setValue("Pago");
  sh.getRange(row,20).setValue(paid);
  return json_({ok:true,id:d.id,status:"Pago",paidAt:Utilities.formatDate(paid,"America/Sao_Paulo","yyyy-MM-dd")});
}
