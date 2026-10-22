(() => {
'use strict';
const plants=window.COAL_PLANTS||[];
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const val=(p,key)=>p[key]??'';
const coalClass=p=>val(p,'Coal Status').trim()==='Active'?'active':val(p,'Coal Status').trim()==='Retired'?'retired':'unknown';
const colors={active:'#a94731',retired:'#517d6a',unknown:'#c58c2c'};
const label=p=>[p.City,p.State].filter(Boolean).join(', ');
function populate(id,vals){const sel=$(id);[...new Set(vals.map(x=>(x||'').trim()||'Unspecified'))].sort().forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;sel.appendChild(o);});}
populate('state',plants.map(p=>p.State));populate('coal',plants.map(p=>p['Coal Status']));populate('plant',plants.map(p=>p['Plant Status']));
$('totals').textContent=`${plants.length} records · ${new Set(plants.map(p=>p.State)).size} states · ${plants.filter(p=>coalClass(p)==='active').length} coal-active`;
if(typeof L==='undefined'){$('mapError').hidden=false;return;}
const map=L.map('map',{preferCanvas:true,zoomControl:true,worldCopyJump:false});
// Keyless basemaps only. No CARTO endpoints.
const layers={
  street:L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>',keepBuffer:2
  }),
  satellite:L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{
    maxZoom:19,attribution:'Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community',keepBuffer:2
  })
};
let activeBase=layers.street.addTo(map);
let tileErrors=0;
function attachTileChecks(layer){
  layer.on('tileload',()=>{$('tileWarning').hidden=true;tileErrors=0;});
  layer.on('tileerror',()=>{if(++tileErrors>=3)$('tileWarning').hidden=false;});
}
Object.values(layers).forEach(attachTileChecks);
$('baseStyle').addEventListener('change',()=>{
  const newLayer=layers[$('baseStyle').value];
  if(!newLayer||newLayer===activeBase)return;
  map.removeLayer(activeBase);activeBase=newLayer;tileErrors=0;
  $('tileWarning').hidden=true;activeBase.addTo(map);
});
const pointLayer=L.featureGroup().addTo(map);
const markers=new Map();
plants.forEach(p=>{if(!Number.isFinite(p.Latitude)||!Number.isFinite(p.Longitude))return;const m=L.circleMarker([p.Latitude,p.Longitude],{radius:8,color:'#fff',weight:2,fillColor:colors[coalClass(p)],fillOpacity:1,bubblingMouseEvents:false});m.bindTooltip(esc(p['Coal Plant Name']),{direction:'top'});m.on('click',()=>{map.setView(m.getLatLng(),13,{animate:true});showDetail(p);});markers.set(p.id,m);});
function zoomAll(){const ll=[...markers.values()].map(m=>m.getLatLng());if(ll.length)map.fitBounds(L.latLngBounds(ll).pad(.14),{maxZoom:6,animate:false});else map.setView([38,-98],4);}
$('fit').addEventListener('click',()=>{zoomAll();render();});
function yearMatch(p,v){const y=p.retirement_year_filter;if(!v)return true;if(v==='missing')return !y;if(!y)return false;return v==='past'?y<=2026:v==='near'?y>=2027&&y<=2029:v==='mid'?y>=2030&&y<=2035:y>=2036;}
function render(){
 const q=$('search').value.trim().toLowerCase(),state=$('state').value,coal=$('coal').value,plant=$('plant').value,year=$('year').value;
 const matching=plants.filter(p=>(!state||p.State===state)&&(!coal||(p['Coal Status']||'Unspecified')===coal)&&(!plant||(p['Plant Status']||'Unspecified')===plant)&&yearMatch(p,year)&&(!q||[p['Coal Plant Name'],p['Parent Company'],p.City,p.County,p.State,p['Updated Summary']].join(' ').toLowerCase().includes(q)));
 pointLayer.clearLayers();for(const p of matching){const m=markers.get(p.id);if(m)pointLayer.addLayer(m);}
 const bounds=map.getBounds();
 const visible=matching.filter(p=>{const m=markers.get(p.id);return m&&bounds.contains(m.getLatLng());});
 $('matchCount').textContent=`${visible.length} in view · ${matching.length} matching`;
 $('viewportNote').textContent=`Plants in the current map view · Zoom or pan to update`;
 const root=$('list');root.replaceChildren();
 if(!visible.length){root.textContent=matching.length?'No matching plants are in this map view. Click Show All Plants to see the full area.':'No matching plants. Try clearing a filter.';return;}
 visible.forEach(p=>{
  const b=document.createElement('button');b.className='plant-card';
  b.innerHTML=`<strong>${esc(p['Coal Plant Name'])}</strong><small>${esc(label(p))} · ${esc(p['Parent Company'])}</small><small>Coal Retirement: ${esc(p['Coal Retirement Year']||'Not specified')}</small><span class="chip ${coalClass(p)}">Coal: ${esc(p['Coal Status']||'Unspecified')}</span>`;
  b.addEventListener('click',()=>{const m=markers.get(p.id);if(m){map.setView(m.getLatLng(),13,{animate:true});}showDetail(p);});root.appendChild(b);
 });
}
map.on('moveend',render);

function addData(key,text,asLink=false){if(!text)return;const d=document.createElement('section');d.className='datum';const title=document.createElement('label');title.textContent=key;const value=document.createElement('div');if(asLink){const urls=String(text).match(/https?:\/\/[^\s<>"']+/g)||[];if(urls.length){urls.forEach((u,i)=>{try{const x=new URL(u);if(!['https:','http:'].includes(x.protocol))return;const a=document.createElement('a');a.href=x.href;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Source '+(i+1)+' ↗';value.appendChild(a);value.appendChild(document.createElement('br'));}catch(e){}});}else value.textContent=text;}else value.textContent=text;d.append(title,value);$('detailBody').append(d);}
function showDetail(p){$('detailName').textContent=p['Coal Plant Name'];$('detailLoc').textContent=label(p)+' · '+p['Parent Company'];$('detailBody').replaceChildren();
if(p.duplicate_source_note)addData('Source record discrepancy',p.duplicate_source_note);
for(const [title,key] of [['Plant status','Plant Status'],['Coal status','Coal Status'],['Coal retirement year','Coal Retirement Year'],['Plant retirement timeline','Retirement Year of Plant'],['Parent company','Parent Company'],['Capacity (MW)','Capacity MW'],['Capacity source wording','Capacity Source Text'],['Coal capacity (MW; approximate)','Coal Capacity MW Approx'],['Generating units','# Generating Units'],['Active coal units','# of Active Coal Units'],['Generator status','Generator Status'],['Energy source breakdown','Plant Energy Source Breakdown'],['Renewables','Renewables?'],['Coal conversions','Coal Conversions'],['Changes in operation','Changes in Operation'],['Research summary','Updated Summary'],['Demolished','Demolished?'],['Start year','Start Year'],['Site acres','Acres'],['Media sources','Media'],['Community partners','Community Partners'],['Advocacy conversation','Tone of Conversation'],['Primary contact information','Contact Information'],['Additional contacts','Additional Contacts'],['Contact email directory (from spreadsheet)','Contact Email Directory'],['Organization websites','Website']])addData(title,p[key],key==='Media'||key==='Website');
$('detail').hidden=false;}
$('closeDetail').addEventListener('click',()=>{$('detail').hidden=true;});
for(const id of ['search','state','coal','plant','year'])$(id).addEventListener(id==='search'?'input':'change',render);
$('clear').addEventListener('click',()=>{for(const id of ['search','state','coal','plant','year'])$(id).value='';render();zoomAll();});
zoomAll();render();window.addEventListener('resize',()=>map.invalidateSize());setTimeout(()=>map.invalidateSize(),200);
})();
