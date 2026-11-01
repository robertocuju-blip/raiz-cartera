import {dateDay,todayISO,money,percent,portfolioStats,project} from './finance.mjs';
import {parseDecimal,formatDecimal} from './decimal.mjs';

const KEY='raiz.portfolio.v1';
const icons={dashboard:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',list:'<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',spark:'<path d="m3 17 6-6 4 4 8-11M15 4h6v6"/><path d="M3 22h18"/>',settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="currentColor"/><circle cx="15" cy="17" r="3" fill="currentColor"/>',share:'<path d="M12 16V3m-4 4 4-4 4 4M6 11H4v10h16V11h-2"/>',plus:'<path d="M12 5v14M5 12h14"/>',arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',up:'<path d="m6 17 12-12M6 5h12v12"/>',coin:'<circle cx="12" cy="12" r="9"/><path d="M15 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9m3-10v12"/>',edit:'<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-4-4L5 15l-1 5Z"/>',value:'<path d="M3 18V6m0 12h18M7 14l4-5 4 3 6-8"/>',download:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>'};
const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.arrow}</svg>`;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=s=>document.querySelector(s);
const fmtDate=(iso,long=false)=>iso?new Intl.DateTimeFormat('es-ES',long?{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}:{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(iso+'T12:00:00Z')):'Sin valoración';
const prettyMoney=value=>Number.isFinite(value)?money(value):'—';
const signedMoney=value=>Number.isFinite(value)?(value>=0?'+':'')+money(value):'—';
const signedPercent=value=>Number.isFinite(value)?(value>=0?'+':'')+percent(value):'—';
const emptyData=()=>({schemaVersion:1,name:'Mi cartera indexada',currency:'EUR',contributions:[],valuations:[],settings:{annualRate:.06,monthlyContribution:300,targetDate:futureYear(todayISO(),10)}});
function futureYear(date,years){const [y,m,d]=date.split('-').map(Number);return `${y+years}-${String(m).padStart(2,'0')}-${String(Math.min(d,new Date(Date.UTC(y+years,m,0)).getUTCDate())).padStart(2,'0')}`;}
function nextMonth(date){const [y,m,d]=date.split('-').map(Number);const dt=new Date(Date.UTC(y,m,1)),last=new Date(Date.UTC(dt.getUTCFullYear(),dt.getUTCMonth()+1,0)).getUTCDate();return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}-${String(Math.min(d,last)).padStart(2,'0')}`;}
const uid=()=>globalThis.crypto?.randomUUID?.()??`r-${Date.now()}-${Math.random().toString(36).slice(2)}`;
let storageOK=true,collapsedValuations=false;
function validateData(raw){
  if(!raw||typeof raw!=='object'||raw.schemaVersion!==1||raw.currency!=='EUR')throw new Error('No es una copia de Raíz compatible (versión 1, euros).');
  if(!Array.isArray(raw.contributions)||!Array.isArray(raw.valuations))throw new Error('El archivo no contiene un historial válido.');
  if(raw.contributions.length+raw.valuations.length>20000)throw new Error('La copia supera el máximo de 20.000 registros.');
  const ids=new Set(),valuationDates=new Set();
  const records=(items,kind)=>items.map(item=>{
    dateDay(item.date);if(item.date>todayISO())throw new Error('Los registros reales no pueden tener fecha futura.');
    if(!Number.isFinite(item.amount)||item.amount<0||item.amount>1e9||(kind==='contribution'&&item.amount===0))throw new Error('Hay un importe no válido. Las aportaciones deben ser positivas.');
    if(Math.abs(item.amount*100-Math.round(item.amount*100))>1e-5)throw new Error('Los importes pueden tener como máximo dos decimales.');
    const id=typeof item.id==='string'&&item.id.length<=100?item.id:uid();if(ids.has(id))throw new Error('La copia contiene identificadores duplicados.');ids.add(id);
    if(kind==='valuation'){if(valuationDates.has(item.date))throw new Error('Hay dos valoraciones del mismo día. Combínalas antes de importar.');valuationDates.add(item.date);}
    return {id,date:item.date,amount:Math.round(item.amount*100)/100,note:String(item.note??'').slice(0,160)};
  });
  const settings=raw.settings&&typeof raw.settings==='object'?raw.settings:{};
  const clean=emptyData();
  clean.name=String(raw.name||clean.name).slice(0,60);clean.contributions=records(raw.contributions,'contribution');clean.valuations=records(raw.valuations,'valuation').sort((a,b)=>a.date.localeCompare(b.date)).slice(-1);
  if(Number.isFinite(settings.annualRate)&&settings.annualRate>=-.999&&settings.annualRate<=1)clean.settings.annualRate=settings.annualRate;
  if(Number.isFinite(settings.monthlyContribution)&&settings.monthlyContribution>=0&&settings.monthlyContribution<=1e9)clean.settings.monthlyContribution=settings.monthlyContribution;
  if(typeof settings.targetDate==='string'){dateDay(settings.targetDate);clean.settings.targetDate=settings.targetDate;}
  if(settings.scenario&&typeof settings.scenario==='object'){
    const s=settings.scenario,scenario={initial:s.initial,monthly:s.monthly,annualRate:s.annualRate,startDate:s.startDate,endDate:s.endDate,firstContributionDate:s.firstContributionDate};
    dateDay(scenario.firstContributionDate);project(scenario);clean.settings.scenario=scenario;
  }
  return clean;
}
let data=emptyData();
try{const saved=localStorage.getItem(KEY);if(saved){const parsed=JSON.parse(saved);data=validateData(parsed);if(parsed.valuations.length>1){localStorage.setItem(KEY,JSON.stringify(data));collapsedValuations=true;}}localStorage.setItem('raiz.test','1');localStorage.removeItem('raiz.test');}catch(error){storageOK=false;$('#storage-warning').hidden=false;$('#storage-warning').textContent='No se ha podido abrir o guardar tu cartera. No se sobrescribirá una copia existente. Puedes importar una copia válida en Tu espacio. '+error.message;}
let demo=null,page=['resumen','historial','simulador','ajustes'].includes(location.hash.slice(1))?location.hash.slice(1):'resumen',historyPage=0,searchTerm='',simulation=null,toastTimer;
const current=()=>demo??data;
function persist(next){
  if(demo){demo=next;return true;}
  try{localStorage.setItem(KEY,JSON.stringify(next));data=next;storageOK=true;$('#storage-warning').hidden=true;return true;}catch{storageOK=false;$('#storage-warning').hidden=false;toast('No se han guardado los cambios. Exporta una copia.');return false;}
}
function commit(next){if(!demo&&!storageOK){toast('Importa una copia válida antes de modificar esta cartera.');return false;}return persist(next);}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4200);}
function renderIcons(){document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));}
function navigate(next){if(!['resumen','historial','simulador','ajustes'].includes(next))next='resumen';page=next;historyPage=0;location.hash=next;render();window.scrollTo({top:0,behavior:'instant'});}
function intro(title,subtitle,actions=''){return `<div class="intro"><div><h1>${title}</h1><p>${subtitle}</p></div>${actions}</div>`;}
function addButton(){return `<button class="btn btn-primary" data-action="add">${icon('plus')} Aportar</button>`;}
function statCard(title,value,note,type='coin',positive=false){return `<article class="stat-card"><div class="stat-title"><span>${title}</span>${icon(type)}</div><div class="stat-value ${positive?'positive':''}">${value}</div><div class="stat-note">${note}</div></article>`;}
function render(){
  document.querySelectorAll('[data-page]').forEach(b=>{b.classList.toggle('active',b.dataset.page===page);if(b.dataset.page===page)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  $('#demo-bar').hidden=!demo;
  $('#view').innerHTML=({resumen:renderOverview,historial:renderHistory,simulador:renderSimulator,ajustes:renderSettings})[page]();
  document.title=`${{resumen:'Resumen',historial:'Historial',simulador:'Simulador',ajustes:'Tu espacio'}[page]} · Raíz`;
  renderIcons();bindView();if(page==='simulador')updateProjection();
}
function renderOverview(){
  const d=current(),s=portfolioStats(d),empty=!d.contributions.length&&!d.valuations.length;
  const latest=s.latest;
  const recent=[...d.contributions].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,4);
  return intro('Cada aportación cuenta.','Un lugar tranquilo para seguir tu cartera.',addButton())+
  (empty?`<section class="welcome"><div><h2>Tu próximo capítulo empieza aquí.</h2><p>Añade tu primera aportación o importa una copia de Raíz. Tu cartera se guarda en este dispositivo.</p></div><div class="welcome-actions"><button class="btn btn-primary" data-action="import">Importar cartera</button><button class="btn btn-outline" data-action="demo">Ver ejemplo ${icon('arrow')}</button></div></section>`:'')+
  `<section class="balance-card" aria-label="Valor de la cartera"><div class="balance-top"><span class="eyebrow">VALOR DE TU CARTERA</span><span class="pill"><i></i> ${demo?'Ejemplo':'Registro manual'}</span></div><div class="balance-value">${latest?prettyMoney(latest.amount).replace(/\s?€/,'<span class="currency">€</span>'):'— <span class="currency">€</span>'}</div><p class="balance-sub">${latest?'Valoración del '+fmtDate(latest.date,true):'Añade una valoración para calcular la rentabilidad'}</p><div class="balance-bottom"><span class="gain-chip">${Number.isFinite(s.gain)?signedMoney(s.gain)+' de ganancia':'El tiempo también cuenta'}</span><button class="btn btn-light btn-small" data-action="valuation">${icon('value')} Actualizar valor</button></div></section>`+
  `<section class="stats-grid" aria-label="Rentabilidad">${statCard('Capital aportado',prettyMoney(latest?s.totalContributed:s.totalAllContributed),latest?'Hasta la fecha de valoración':'Todas tus aportaciones','coin')}${statCard('Rentabilidad total',signedPercent(s.simpleReturn),'Ganancia / capital aportado','spark',s.simpleReturn>=0&&s.simpleReturn!==null)}${statCard('Anualizada · TIR',signedPercent(s.annualized),s.annualized===null?'Necesita fechas y valoración':'Tiene en cuenta cuándo aportas','up',s.annualized>=0&&s.annualized!==null)}</section>`+
  (s.pendingAmount>0&&latest?`<div class="warning">Hay ${money(s.pendingAmount)} aportados después del ${fmtDate(latest.date)}. Se incluirán en la rentabilidad al actualizar la valoración. <button class="text-btn" data-action="valuation">Actualizar ${icon('arrow')}</button></div>`:'')+
  (s.days>0&&s.days<365?'<p class="value-note">La TIR extrapola a un año un historial de menos de 12 meses; puede resultar muy elevada o muy negativa.</p>':'')+
  `<div class="two-col"><section class="panel"><div class="panel-heading"><div><h2>Lo que vas construyendo</h2><p>Tu evolución, aportación a aportación.</p></div><span class="badge">${demo?'EJEMPLO':'HISTÓRICO'}</span></div><div class="legend"><span><i></i> Aportado</span><span><i class="dot"></i> Última valoración${demo?' (ejemplo)':''}</span></div>${historyChart(d,s)}</section><section class="panel"><div class="panel-heading"><div><h2>Últimas aportaciones</h2><p>Pequeños pasos. Una visión a largo plazo.</p></div></div><div class="record-list">${recent.length?recent.map(record=>recordRow(record)).join(''):'<div class="empty-state">Tu historial empieza con<br>la primera aportación.<br><button class="text-btn" data-action="add">Añadir aportación '+icon('arrow')+'</button></div>'}</div><button class="text-btn panel-link" data-action="history">Ver todo el historial ${icon('arrow')}</button></section></div>`+
  `<section class="forecast-teaser"><div class="teaser-icon">↗</div><div><h3>Dale perspectiva al futuro.</h3><p>Explora hasta dónde pueden llevarte la constancia y el tiempo.</p></div><button class="text-btn" data-action="simulate">Abrir simulador ${icon('arrow')}</button></section>`;
}
function recordRow(r){return `<div class="record"><span class="record-icon">${icon('plus')}</span><div class="record-text"><div class="record-title">${esc(r.note||'Aportación a mi cartera')}</div><div class="record-date">${fmtDate(r.date)}</div></div><span class="record-amount">+${money(r.amount)}</span><button class="edit-btn" data-edit="${esc(r.id)}" data-kind="contributions" aria-label="Editar aportación del ${fmtDate(r.date)}">${icon('edit')}</button></div>`;}
function chartSVG(points,{projection=false,contributions=[]}={}){
  if(!points.length&&!contributions.length)return '<div class="empty-chart">El crecimiento empieza<br>con tu primer registro.</div>';
  const W=620,H=240,L=55,R=12,T=24,B=29,allDates=[...points.map(p=>p.date),...contributions.map(c=>c.date)].sort();
  const from=dateDay(allDates[0]),to=dateDay(allDates.at(-1)),span=Math.max(30,to-from),right=to===from?from+span:to;
  const max=Math.max(1,...points.flatMap(p=>[p.value,p.invested??p.contributed??0]),...contributions.map(c=>c.cumulative??c.amount))*1.12;
  const x=date=>L+(dateDay(date)-from)/(right-from)*(W-L-R),y=value=>T+(1-value/max)*(H-T-B);
  let grid='';for(let i=0;i<4;i++){const v=max*i/3,yy=y(v);grid+=`<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" stroke="#edf0e7"/><text x="${L-10}" y="${yy+3}" text-anchor="end">${compact(v)}</text>`;}
  let path='';
  if(projection){const val=points.map((p,i)=>`${i?'L':'M'}${x(p.date).toFixed(2)} ${y(p.value).toFixed(2)}`).join(' '),invested=points.map((p,i)=>`${i?'L':'M'}${x(p.date).toFixed(2)} ${y(p.contributed).toFixed(2)}`).join(' ');path=`<path d="${val} L${x(points.at(-1).date)} ${y(0)} L${x(points[0].date)} ${y(0)}Z" fill="#edf3df"/><path d="${invested}" stroke="#b9c8a2" stroke-width="2" fill="none" stroke-dasharray="4 5"/><path d="${val}" stroke="#658c45" stroke-width="2.5" fill="none"/>`;
  }else{
    if(contributions.length){let d=`M${x(contributions[0].date)} ${y(0)}`;for(const c of contributions)d+=`H${x(c.date)}V${y(c.cumulative)}`;d+=`H${W-R}`;path+=`<path d="${d}" stroke="#91ad6a" stroke-width="2" fill="none"/>`;}
    for(const p of points)path+=`<circle cx="${x(p.date)}" cy="${y(p.value)}" r="4.5" fill="#173c32" stroke="white" stroke-width="2"><title>${fmtDate(p.date)}: ${money(p.value)}</title></circle>`;
  }
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${projection?'Proyección hipotética de capital y crecimiento':'Aportaciones acumuladas y última valoración registrada'}">${grid}${path}<text x="${L}" y="${H-5}">${fmtDate(allDates[0])}</text><text x="${W-R}" y="${H-5}" text-anchor="end">${to===from?'':fmtDate(allDates.at(-1))}</text></svg>`;
}
function compact(n){return n>=1e6?new Intl.NumberFormat('es-ES',{maximumFractionDigits:1}).format(n/1e6)+' M':n>=1000?new Intl.NumberFormat('es-ES',{maximumFractionDigits:0}).format(n/1000)+' mil':String(Math.round(n));}
function historyChart(d,s){let cumulative=0;const contrib=[...d.contributions].sort((a,b)=>a.date.localeCompare(b.date)).map(r=>({...r,cumulative:cumulative+=r.amount}));return chartSVG(s.series,{contributions:contrib});}
function filteredHistory(){const list=[...current().contributions].sort((a,b)=>b.date.localeCompare(a.date));const term=searchTerm.toLocaleLowerCase('es');return list.filter(r=>[r.note,r.date,fmtDate(r.date),money(r.amount)].join(' ').toLocaleLowerCase('es').includes(term));}
function renderHistory(){
  const list=filteredHistory();
  historyPage=Math.min(historyPage,Math.max(0,Math.ceil(list.length/15)-1));
  const total=list.reduce((t,r)=>t+r.amount,0),items=list.slice(historyPage*15,(historyPage+1)*15);
  return intro('El camino, paso a paso.','Todas tus aportaciones, siempre a mano.',addButton())+
  `<div class="history-toolbar"><input class="search" id="search" type="search" placeholder="Buscar fecha, nota, importe…" aria-label="Buscar en el historial" value="${esc(searchTerm)}"></div><div class="history-summary"><span><strong>${list.length}</strong> aportaciones</span><span>Total registrado <strong>${money(total)}</strong></span></div><section class="panel"><div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Nota</th><th>Importe</th><th><span class="visually-hidden">Editar</span></th></tr></thead><tbody>${items.length?items.map(r=>`<tr><td class="nowrap">${fmtDate(r.date)}</td><td class="note-cell">${esc(r.note||'Aportación')}</td><td class="nowrap">+${money(r.amount)}</td><td><button class="edit-btn" data-edit="${esc(r.id)}" data-kind="contributions" aria-label="Editar aportación del ${fmtDate(r.date)}">${icon('edit')}</button></td></tr>`).join(''):`<tr><td colspan="4"><div class="empty-state">${searchTerm?'No hay aportaciones con esa búsqueda.':'Aquí aparecerán tus aportaciones.'}<br>${searchTerm?'':'<button class="text-btn" data-action="add">Añadir aportación '+icon('arrow')+'</button>'}</div></td></tr>`}</tbody></table></div>${list.length>15?`<div class="pagination"><button class="btn btn-outline btn-small" data-paginate="-1" ${historyPage===0?'disabled':''}>← Anterior</button><span>${historyPage+1} de ${Math.ceil(list.length/15)}</span><button class="btn btn-outline btn-small" data-paginate="1" ${(historyPage+1)*15>=list.length?'disabled':''}>Siguiente →</button></div>`:''}</section><p class="value-note">Se admiten varias aportaciones el mismo día. Registra el dinero que entra desde fuera de la cartera; un traspaso entre tus fondos no es una aportación nueva.</p>`;
}
function simDefaults(useSaved=true){const d=current();if(useSaved&&d.settings.scenario)return {...d.settings.scenario};const latest=portfolioStats(d).latest,start=latest?.date??todayISO();return {initial:latest?.amount??0,monthly:d.settings.monthlyContribution,annualRate:d.settings.annualRate,startDate:start,endDate:d.settings.targetDate>start?d.settings.targetDate:futureYear(start,10),firstContributionDate:nextMonth(start)};}
function simField(name,label,value,{type='number',suffix='',hint=''}={}){
  const numeric=type==='number',shown=numeric?formatDecimal(value,{maxDecimals:8}):value;
  return `<div class="field"><label for="sim-${name}">${label}</label><div class="input-suffix"><input id="sim-${name}" name="${name}" type="${numeric?'text':type}" value="${esc(shown)}" required ${numeric?'inputmode="decimal" autocomplete="off" autocapitalize="off" spellcheck="false" title="Coma o punto decimal, sin separadores de miles"':''}>${suffix?`<b>${suffix}</b>`:''}</div>${hint?`<small>${hint}</small>`:''}</div>`;
}
function renderSimulator(){simulation??=simDefaults();const s=simulation;return intro('El tiempo, a tu favor.','Una hipótesis. Muchas posibilidades.')+`<div class="sim-layout"><section class="panel form-panel"><h2>Traza tu escenario</h2><form id="simulation-form" novalidate>${simField('initial','Capital inicial',s.initial,{suffix:'€',min:0,max:1e9,step:'.01',hint:'Valor de partida. Coma o punto decimal, sin separadores de miles.'})}${simField('monthly','Aportación mensual',s.monthly,{suffix:'€',min:0,max:1e9,step:'.01'})}${simField('annualRate','Rentabilidad anual efectiva',s.annualRate*100,{suffix:'%',min:-99.9,max:100,step:'.1',hint:'Puedes simular también pérdidas o rentabilidad cero.'})}${simField('startDate','Fecha de inicio',s.startDate,{type:'date'})}${simField('firstContributionDate','Primera aportación futura',s.firstContributionDate,{type:'date',hint:'Se repetirá cada mes en este día. En meses cortos, el último día.'})}${simField('endDate','Fecha objetivo',s.endDate,{type:'date'})}<p class="small-muted">Atajos desde la fecha de inicio</p><div class="sim-presets"><button type="button" data-years="5">5 años</button><button type="button" data-years="10">10 años</button><button type="button" data-years="20">20 años</button></div><button class="btn btn-primary sim-save" type="button" id="save-scenario">Guardar escenario</button><p class="value-note">Los cambios son una prueba hasta que guardes el escenario.</p></form></section><div><div id="sim-error" class="error" role="status"></div><div id="sim-output"></div><p class="sim-notice">Escenario hipotético con rentabilidad constante, sin inflación ni impuestos. La tasa debe ser neta de comisiones si quieres reflejarlas. No es una previsión ni una garantía.</p><details class="panel method"><summary>Cómo funciona esta simulación</summary><p>La proyección capitaliza el valor inicial y cada aportación desde su fecha hasta la fecha objetivo, con una rentabilidad anual efectiva constante. El plazo se expresa como días reales divididos entre 365,2425.</p><p class="formula">Valor futuro = capital inicial × (1 + r)^t + Σ aportación × (1 + r)^ti</p><p>r es la rentabilidad anual expresada como decimal; t y ti son los años desde cada importe hasta la fecha objetivo. Una aportación en la fecha objetivo se incluye sin generar rendimiento. «Capital de partida + nuevas aportaciones» incluye el valor inicial completo. El crecimiento estimado corresponde solo al período simulado.</p></details></div></div>`;}
function updateProjection(){
  const form=$('#simulation-form');if(!form)return;
  try{
    const f=new FormData(form),numeric=name=>parseDecimal(f.get(name),{label:({initial:'El capital inicial',monthly:'La aportación mensual',annualRate:'La rentabilidad anual'})[name],maxDecimals:name==='annualRate'?8:2});
    const config={initial:numeric('initial'),monthly:numeric('monthly'),annualRate:numeric('annualRate')/100,startDate:String(f.get('startDate')),endDate:String(f.get('endDate')),firstContributionDate:String(f.get('firstContributionDate'))};
    dateDay(config.firstContributionDate);const result=project(config);simulation=config;
    $('#sim-error').textContent='';$('#sim-output').innerHTML=`<section class="sim-result"><span class="eyebrow">TU CARTERA PODRÍA ALCANZAR</span><div class="result-value">${money(result.value)}</div><p class="small-muted">el ${fmtDate(config.endDate,true)}</p><div class="split"><div>Capital de partida +<br>nuevas aportaciones<strong>${money(result.contributed)}</strong></div><div>Crecimiento estimado<br>durante este escenario<strong>${signedMoney(result.gain)}</strong></div></div></section><section class="panel"><div class="panel-heading"><div><h2>La constancia toma forma</h2><p>${result.months} aportaciones mensuales · ${percent(config.annualRate)} anual</p></div></div><div class="legend"><span><i></i> Valor estimado</span><span><i class="alt"></i> Capital de partida + aportaciones</span></div>${chartSVG(result.points,{projection:true})}</section><details class="panel method"><summary>Ver desglose anual</summary><div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Capital + aport.</th><th>Valor estimado</th></tr></thead><tbody>${annualPoints(result.points).map(p=>`<tr><td>${fmtDate(p.date)}</td><td>${money(p.contributed)}</td><td>${money(p.value)}</td></tr>`).join('')}</tbody></table></div></details>`;
  }catch(error){$('#sim-error').textContent=error.message;$('#sim-output').innerHTML='';}
}
function annualPoints(points){return points.filter((p,i)=>i===0||i===points.length-1||points[i+1]?.date.slice(0,4)!==p.date.slice(0,4));}
function renderSettings(){const d=current();return intro('Tu espacio. Tus datos.','Una cartera sencilla, que tú controlas.')+`<div class="settings-grid"><section class="panel"><div class="privacy-mark"><span>${icon('lock')}</span><div><h2>Se queda contigo</h2><p>Sin cuentas. Sin enviar tu cartera a un servidor.</p></div></div><p>Los registros se guardan en este navegador y dispositivo. La app funciona sin conexión después de abrirla por primera vez y completar la descarga. No se sincroniza entre dispositivos.</p><p>Exporta una copia periódica: borrar los datos de Safari, cambiar de teléfono o usar navegación privada puede hacer que pierdas los registros. El almacenamiento local no es una copia de seguridad.</p><div class="settings-buttons"><button class="btn btn-primary" data-action="export">${icon('download')} Exportar copia</button><button class="btn btn-outline" data-action="import">Importar copia</button></div><p class="value-note">${d.contributions.length} aportaciones · ${d.valuations.length} valoraciones · formato JSON reutilizable.</p></section><section class="panel"><h2>Un sitio en tu iPhone</h2><p>Abre el enlace de Raíz en Safari y añádela a la pantalla de inicio para usarla como app.</p><div class="install-steps"><b>1</b><span>En Safari, abre el menú y toca <strong>Compartir</strong>.</span></div><div class="install-steps"><b>2</b><span>Elige <strong>Añadir a pantalla de inicio</strong>.</span></div><div class="install-steps"><b>3</b><span>Activa <strong>Abrir como app web</strong> si aparece, y pulsa Añadir.</span></div><p class="value-note">Importa tu copia desde el icono instalado. Safari y la app instalada pueden tener almacenes separados.</p><button class="text-btn" data-action="share">Compartir solo la aplicación ${icon('share')}</button></section></div><details class="panel method" open><summary>Entender tus rentabilidades</summary>
<h3>Datos utilizados y fecha de valoración</h3>
<p>Los resultados se calculan a partir de las aportaciones registradas y del valor total de la cartera en la fecha de valoración. El valor de la cartera se introduce manualmente; los precios no se actualizan de forma automática.</p>
<p>La valoración corresponde al cierre del día e incluye las aportaciones de esa misma fecha. Las aportaciones posteriores quedan pendientes y no intervienen en la rentabilidad hasta que se registre una nueva valoración que las incluya.</p>
<h3>Ganancia acumulada y rentabilidad total</h3>
<p>La ganancia acumulada es la diferencia entre el valor de la cartera y las aportaciones acumuladas hasta la fecha de valoración. La rentabilidad total expresa esa diferencia como porcentaje del capital aportado.</p>
<p class="formula">Ganancia = valor de la cartera − capital aportado<br>Rentabilidad total = ganancia / capital aportado</p>
<p>Este porcentaje no considera cuánto tiempo ha permanecido invertida cada aportación. No es una tasa anual ni mide por sí solo la rentabilidad de los fondos. Si el capital aportado es cero, no se calcula este porcentaje.</p>
<h3>Rentabilidad anualizada · TIR / XIRR</h3>
<p>La tasa interna de rentabilidad anualizada tiene en cuenta el importe y la fecha de cada aportación y el valor final de la cartera. Expresa una rentabilidad anual equivalente ponderada por el dinero.</p>
<p>Las aportaciones se consideran flujos negativos y la valoración final, un flujo positivo. El cálculo utiliza los días reales entre fechas y una base anual de 365 días.</p>
<p class="formula">Σ flujo / (1 + r)^((fecha − fecha inicial) / 365) = 0</p>
<p>Esta tasa no representa la rentabilidad de cada año natural. Cuando faltan datos, no ha transcurrido tiempo o no existe una solución válida, se muestra «—». En períodos inferiores a un año, la anualización puede producir porcentajes elevados o muy negativos. <a href="https://support.microsoft.com/en-us/excel/functions/xirr-function" target="_blank" rel="noopener noreferrer">Documentación del método XIRR</a>.</p>
<h3>Simulación de la cartera</h3>
<p>La proyección aplica una rentabilidad anual efectiva constante al capital inicial y a las aportaciones mensuales, desde sus fechas hasta la fecha objetivo. Los plazos se calculan con días reales y una base anual de 365,2425 días.</p>
<p>Las aportaciones se repiten cada mes en el día de la primera aportación indicada. Si ese día no existe en un mes, se utiliza el último día de ese mes. Una aportación en la fecha objetivo se incluye sin generar rendimiento.</p>
<p class="formula">Valor futuro = capital inicial × (1 + r)^t + Σ aportación × (1 + r)^ti</p>
<p>r es la rentabilidad anual expresada como decimal; t y ti son los años desde cada importe hasta la fecha objetivo. El capital inicial puede contener ganancias anteriores. El crecimiento estimado corresponde únicamente al período simulado.</p>
<h3>Supuestos y limitaciones</h3>
<p>La simulación es un escenario hipotético, no una previsión ni una garantía. Los importes son nominales: no se descuentan impuestos ni inflación. Para reflejar comisiones u otros costes recurrentes, debe utilizarse una rentabilidad anual neta de esos costes.</p>
<p>La aplicación registra aportaciones y una única valoración actual. No permite registrar retiradas ni reconstruye valoraciones históricas. La TIR y la simulación utilizan las bases de tiempo indicadas en sus respectivos apartados.</p>
</details><section class="panel top-spacer"><div class="panel-heading"><div><h2>Empieza de nuevo, cuando quieras</h2><p>La cartera de ejemplo no modifica tus datos.</p></div></div><div class="inline-actions"><button class="btn btn-outline" data-action="demo">Explorar ejemplo</button><button class="btn btn-danger" data-action="clear">Borrar ${demo?'ejemplo':'mi cartera'}</button></div></section>`;}
function bindView(){
  document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>action(b.dataset.action)));
  document.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>openRecord(b.dataset.kind,b.dataset.edit)));
  document.querySelectorAll('[data-paginate]').forEach(b=>b.addEventListener('click',()=>{historyPage+=Number(b.dataset.paginate);render();}));
  $('#search')?.addEventListener('input',event=>{const pos=event.target.selectionStart;searchTerm=event.target.value;historyPage=0;render();$('#search').focus();try{$('#search').setSelectionRange(pos,pos);}catch{}});
  $('#simulation-form')?.addEventListener('input',updateProjection);
  $('#simulation-form')?.addEventListener('submit',event=>event.preventDefault());
  $('#save-scenario')?.addEventListener('click',()=>{updateProjection();if($('#sim-error').textContent)return;const next=structuredClone(current());next.settings={...next.settings,annualRate:simulation.annualRate,monthlyContribution:simulation.monthly,targetDate:simulation.endDate,scenario:{...simulation}};if(commit(next))toast('Escenario guardado e incluido en tus copias.');});
  document.querySelectorAll('[data-years]').forEach(b=>b.addEventListener('click',()=>{try{$('#sim-endDate').value=futureYear($('#sim-startDate').value,Number(b.dataset.years));updateProjection();}catch{toast('Introduce primero una fecha de inicio.');}}));
}
function action(name){({add:()=>openRecord('contributions'),valuation:()=>openRecord('valuations'),history:()=>navigate('historial'),simulate:()=>{simulation=simDefaults();navigate('simulador');},import:()=>$('#import-file').click(),export:exportData,demo:loadDemo,clear:clearData,share:shareApp}[name]??(()=>{}))();}
function showModal(title,body){$('#modal-content').innerHTML=`<div class="modal-top"><h2 id="modal-title">${title}</h2><button class="close-modal" aria-label="Cerrar">×</button></div>${body}`;$('.close-modal').addEventListener('click',()=>$('#modal').close());if(!$('#modal').open)$('#modal').showModal();}
function openRecord(kind,id){
  const existing=current()[kind].find(r=>r.id===id),isContribution=kind==='contributions';
  showModal(isContribution?((existing?'Editar ':'Añadir ')+'aportación'):'Actualizar valoración',`<form id="record-form"><div class="field"><label for="record-date">Fecha${isContribution?' de la aportación':' de valoración (cierre del día)'}</label><input id="record-date" name="date" type="date" max="${todayISO()}" required value="${existing?.date??todayISO()}"></div><div class="field"><label for="record-amount">${isContribution?'Dinero aportado':'Valor total de la cartera'}</label><div class="input-suffix"><input id="record-amount" name="amount" type="text" inputmode="decimal" autocomplete="off" autocapitalize="off" spellcheck="false" required placeholder="0,00" value="${formatDecimal(existing?.amount,{maxDecimals:2})}"><b>€</b></div><small>${isContribution?'Solo dinero nuevo que entra en tu cartera.':'Esta valoración sustituye a la anterior. Incluye todas las aportaciones de esa fecha.'} Coma o punto decimal, sin separadores de miles.</small></div><div class="field"><label for="record-note">Nota <span class="small-muted">(opcional)</span></label><input id="record-note" name="note" type="text" maxlength="160" placeholder="${isContribution?'Por ejemplo, ahorro de octubre':'Por ejemplo, cierre de mes'}" value="${esc(existing?.note??'')}"></div><p id="record-error" class="error" role="alert"></p><div class="modal-actions">${existing?'<button class="btn btn-danger" id="delete-record" type="button">Eliminar</button>':''}<button class="btn btn-outline" id="cancel-record" type="button">Cancelar</button><button class="btn btn-primary" type="submit">Guardar ${isContribution?'aportación':'valoración'}</button></div></form>`);
  $('#cancel-record').onclick=()=>$('#modal').close();
  $('#record-form').addEventListener('submit',event=>{
    event.preventDefault();
    try{const f=new FormData(event.currentTarget),date=String(f.get('date')),amount=parseDecimal(f.get('amount'),{label:'El importe',maxDecimals:2});dateDay(date);if(date>todayISO())throw new Error('El historial real no admite fechas futuras.');
      const next=structuredClone(current()),record={id:existing?.id??uid(),date,amount,note:String(f.get('note')??'').trim()};if(!isContribution)next.valuations=[record];else if(existing)next[kind]=next[kind].map(r=>r.id===id?record:r);else next[kind].push(record);const clean=validateData(next);if(commit(clean)){$('#modal').close();simulation=null;render();toast((isContribution?'Aportación guardada':'Valoración actualizada')+(demo?' en el ejemplo.':'.'));}
    }catch(error){$('#record-error').textContent=error.message;}
  });
  if(existing){let confirmDelete=false;$('#delete-record').onclick=()=>{if(!confirmDelete){confirmDelete=true;$('#delete-record').textContent='Confirmar eliminación';$('#record-error').textContent='Se eliminará este registro y se recalculará la cartera.';return;}const next=structuredClone(current());next[kind]=next[kind].filter(r=>r.id!==id);if(commit(next)){$('#modal').close();simulation=null;render();toast('Registro eliminado.');}};}
}
async function exportData(){
  const text=JSON.stringify({...current(),exportedAt:new Date().toISOString()},null,2),file=new File([text],`Raiz-cartera-${todayISO()}${demo?'-ejemplo':''}.json`,{type:'application/json'});
  try{if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:'Copia de mi cartera Raíz'});return;}}catch(error){if(error.name==='AbortError')return;}
  download(file);toast('Copia exportada. Guárdala en un lugar privado.');
}
function download(file){const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
$('#import-file').addEventListener('change',async event=>{
  const file=event.target.files[0];event.target.value='';if(!file)return;
  try{if(file.size>4e6)throw new Error('El archivo supera el límite de 4 MB.');const imported=validateData(JSON.parse(await file.text())),s=portfolioStats(imported);
    showModal('Importar tu cartera',`<p class="small-muted">La copia contiene <strong>${imported.contributions.length} aportaciones</strong> y <strong>${imported.valuations.length} valoraciones</strong>.</p><div class="stat-card"><div class="stat-title">Capital aportado total</div><div class="stat-value">${money(s.totalAllContributed)}</div><p class="small-muted">Última valoración: ${s.latest?money(s.latest.amount)+' · '+fmtDate(s.latest.date):'Sin valoración'}</p></div><p class="small-muted">Si la copia contiene varias valoraciones, se conservará solo la más reciente. La importación sustituirá ${demo?'el ejemplo y tu cartera guardada':'la cartera guardada en este dispositivo'}. Exporta antes una copia si quieres conservarla.</p><div class="modal-actions"><button id="import-cancel" class="btn btn-outline">Cancelar</button><button id="import-confirm" class="btn btn-primary">Importar y sustituir</button></div>`);
    $('#import-cancel').onclick=()=>$('#modal').close();$('#import-confirm').onclick=()=>{const previousDemo=demo;demo=null;if(persist(imported)){$('#modal').close();simulation=null;page='resumen';location.hash=page;render();toast('Cartera importada en este dispositivo.');}else demo=previousDemo;};
  }catch(error){showModal('No se ha podido importar',`<p class="error">${esc(error.message)}</p><p class="small-muted">Selecciona una copia JSON compatible con Raíz. La cartera guardada se conserva si la importación no puede completarse.</p>`);}
});
function clearData(){showModal('Borrar '+(demo?'el ejemplo':'tu cartera'),`<p class="small-muted">Se eliminarán ${current().contributions.length} aportaciones y ${current().valuations.length} valoraciones ${demo?'del ejemplo':'de este dispositivo'}. Exporta antes una copia si quieres conservarlas.</p><div class="modal-actions"><button class="btn btn-outline" id="clear-cancel">Cancelar</button><button class="btn btn-danger" id="clear-confirm">Borrar todos los registros</button></div>`);$('#clear-cancel').onclick=()=>$('#modal').close();$('#clear-confirm').onclick=()=>{if(commit(emptyData())){$('#modal').close();simulation=null;render();toast('Registros eliminados.');}};}
function loadDemo(){
  const sample=emptyData(),today=todayISO();const [y,m]=today.split('-').map(Number);let contributed=0;
  for(let i=0;i<25;i++){const dt=new Date(Date.UTC(y,m-1-24+i,1)),date=dt.toISOString().slice(0,10),amount=i===0?6000:400;sample.contributions.push({id:'demo-c'+i,date,amount,note:i===0?'El comienzo':'Ahorro mensual'});contributed+=amount;const growth=1+(.19*i/24)+.018*Math.sin(i*.6);sample.valuations.push({id:'demo-v'+i,date,amount:Math.round(contributed*growth*100)/100,note:'Valoración de ejemplo'});}
  sample.valuations=sample.valuations.slice(-1);sample.settings={annualRate:.06,monthlyContribution:400,targetDate:futureYear(today,10)};demo=sample;simulation=null;page='resumen';location.hash=page;render();toast('Ejemplo ficticio. Tu cartera guardada se conserva.');
}
async function shareApp(){const url=new URL('./',location.href).href;try{if(navigator.share)await navigator.share({title:'Raíz · Tu cartera, con perspectiva',text:'Lleva tu propia cartera de fondos indexados. Los datos se guardan en tu dispositivo.',url});else{await navigator.clipboard.writeText(url);toast('Enlace copiado. No incluye tus registros.');}}catch(error){if(error.name!=='AbortError')showModal('Compartir Raíz',`<p class="small-muted">Comparte este enlace. No incluye tus datos.</p><input class="search" readonly value="${esc(url)}" aria-label="Enlace para compartir">`);}}
document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.page)));
$('#share-btn').onclick=shareApp;
$('#exit-demo').onclick=()=>{demo=null;simulation=null;page='resumen';location.hash=page;render();};
$('#modal').addEventListener('click',event=>{if(event.target===$('#modal')){const r=$('#modal').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('#modal').close();}});
window.addEventListener('hashchange',()=>{const next=location.hash.slice(1);if(['resumen','historial','simulador','ajustes'].includes(next)&&next!==page){page=next;render();}});
window.addEventListener('storage',event=>{if(event.key===KEY){try{data=event.newValue?validateData(JSON.parse(event.newValue)):emptyData();simulation=null;render();toast('Cartera actualizada desde otra pestaña.');}catch{toast('No se pudo leer el cambio de otra pestaña.');}}});
$('#today-label').textContent=new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'long',year:'numeric'}).format(new Date());
render();
if(collapsedValuations)toast('Se ha conservado solo la última valoración. Todas tus aportaciones se mantienen.');
if('serviceWorker'in navigator){
  const wasControlled=Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(wasControlled)$('#update-bar').hidden=false;});
  window.addEventListener('load',async()=>{
    try{const registration=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});registration.update().catch(()=>{});document.addEventListener('visibilitychange',()=>{if(!document.hidden)registration.update().catch(()=>{});});}
    catch{toast('La descarga sin conexión no se ha completado. Vuelve a abrir la app con conexión.');}
  });
  $('#reload-update').addEventListener('click',()=>location.reload());
}
