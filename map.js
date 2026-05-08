// ===== AccessFlow — Map Module =====
const API = 'http://localhost:8000';

const LOCATIONS = {
  silk_board:[12.9175,77.6229], whitefield:[12.9698,77.7499],
  ecity:[12.8399,77.6770], majestic:[12.9767,77.5713],
  hebbal:[13.0450,77.5970], koramangala:[12.9279,77.6271],
  mg_road:[12.9757,77.6011], orr:[12.9352,77.6861]
};

const TEST_PINS = [
  {id:1,type:"ACCIDENT",lat:12.9175,lng:77.6229,location:"Silk Board Junction",severity:"HIGH",emergency:true,accessible:false,description:"Multi-vehicle collision blocking 2 lanes. Emergency vehicles en route."},
  {id:2,type:"FLOOD",lat:12.9352,lng:77.6861,location:"ORR Underpass",severity:"HIGH",emergency:false,accessible:false,description:"Severe waterlogging, underpass inaccessible for all vehicles."},
  {id:3,type:"BLOCKED",lat:12.9279,lng:77.6271,location:"Koramangala 5th Block",severity:"MEDIUM",emergency:false,accessible:false,description:"Construction debris blocking ramp access."},
  {id:4,type:"CONGESTION",lat:12.9698,lng:77.7499,location:"Whitefield Main Road",severity:"LOW",emergency:false,accessible:true,description:"Heavy traffic, slow movement. Wheelchair paths clear."},
  {id:5,type:"CLEAR",lat:12.9757,lng:77.6011,location:"MG Road",severity:"LOW",emergency:false,accessible:true,description:"Road clear, all lanes and ramps accessible."}
];

const MOCK_ROUTES = {
  fastest:{route:[[12.9698,77.7499],[12.968,77.735],[12.96,77.72],[12.95,77.70],[12.94,77.68],[12.935,77.66],[12.93,77.64],[12.9279,77.6271]],confidence:62,distance_km:12.8,time_min:32,accessible:false},
  accessible:{route:[[12.9698,77.7499],[12.97,77.73],[12.972,77.71],[12.97,77.69],[12.965,77.67],[12.96,77.655],[12.95,77.645],[12.94,77.635],[12.935,77.631],[12.9279,77.6271]],confidence:87,distance_km:14.2,time_min:38,accessible:true}
};

// --- Map ---
const map = L.map('map-container',{center:[12.9716,77.5946],zoom:12,minZoom:11,maxZoom:16,maxBounds:[[12.7343,77.3791],[13.1737,77.8826]],zoomControl:true});
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{attribution:'© OpenStreetMap © CartoDB',subdomains:'abcd',maxZoom:19}).addTo(map);

const pinLayer = L.layerGroup().addTo(map);
const routeLayer = L.layerGroup().addTo(map);
let currentPins = [];
let fastLine = null, accLine = null;

function mkIcon(type){
  return L.divIcon({className:'pin-marker pin-'+type.toLowerCase(),html:'<div class="pin-wave"></div><div class="pin-core"></div>',iconSize:[34,34],iconAnchor:[17,17],popupAnchor:[0,-20]});
}

function popupHTML(p){
  const tc='b-'+p.type.toLowerCase(), sc='sev-'+p.severity.toLowerCase();
  let btns='';
  if(p.type==='ACCIDENT'&&p.severity==='HIGH') btns+=`<button class="popup-btn red" onclick="openAlert('${p.location}','${p.type}','${p.severity}',${p.lat},${p.lng})">🚨 Send Alert</button>`;
  if(p.type==='BLOCKED') btns+=`<button class="popup-btn orange" onclick="openBBMP('${p.location}','${p.type}','${p.severity}',${p.lat},${p.lng})">📋 BBMP Complaint</button>`;
  if(!btns) btns=`<button class="popup-btn" onclick="map.closePopup()">Close</button>`;
  return `<div class="popup-inner"><h3>${p.location}</h3><div class="popup-badges"><span class="badge ${tc}">${p.type}</span><span class="sev ${sc}">${p.severity}</span>${p.emergency?'<span style="font-size:11px;font-weight:800;color:var(--danger)">🚨</span>':''}</div><p>${p.description}</p><div class="popup-actions">${btns}</div></div>`;
}

function renderPins(pins){
  pinLayer.clearLayers();
  currentPins=pins;
  pins.forEach(p=>{
    L.marker([p.lat,p.lng],{icon:mkIcon(p.type)}).bindPopup(popupHTML(p),{maxWidth:290,minWidth:250}).addTo(pinLayer);
  });
}

// --- Refresh ---
let cd=10;
function updCD(){ const e=document.getElementById('countdown'); if(e) e.textContent=cd; }

async function fetchPins(){
  try{ const c=new AbortController(); const t=setTimeout(()=>c.abort(),3000); const r=await fetch(API+'/pins',{signal:c.signal}); clearTimeout(t); if(!r.ok) throw 0; return await r.json(); }catch(e){ return TEST_PINS; }
}

function modalOpen(){ return !!document.querySelector('.modal-bg.open'); }

async function refreshPins(){
  if(modalOpen()||document.querySelector('.leaflet-popup')){cd=10;updCD();return;}
  renderPins(await fetchPins()); cd=10; updCD();
}

function startRefresh(){
  refreshPins();
  setInterval(()=>{cd--;updCD();if(cd<=0)refreshPins();},1000);
}

// --- Routes ---
function clearRoutes(){routeLayer.clearLayers();fastLine=null;accLine=null;}

function drawRoute(d,type){
  const col=d.confidence>=80?'#2DC98E':d.confidence>=50?'#F4A237':'#E63946';
  const opts={color:col,weight:type==='accessible'?5:4,opacity:type==='accessible'?0.9:0.45,dashArray:type==='accessible'?'10 6':null,lineCap:'round',lineJoin:'round'};
  const pl=L.polyline(d.route,opts); routeLayer.addLayer(pl);
  if(type==='fastest') fastLine=pl; else accLine=pl;
  return pl;
}

function fillCard(prefix,d){
  document.getElementById(prefix+'-score').textContent=d.confidence+'%';
  document.getElementById(prefix+'-time').textContent=d.time_min;
  document.getElementById(prefix+'-dist').textContent=d.distance_km;
  const bar=document.getElementById(prefix+'-bar');
  bar.className='conf-fill '+(d.confidence>=80?'conf-green':d.confidence>=50?'conf-amber':'conf-red');
  setTimeout(()=>bar.style.width=d.confidence+'%',80);
  const a=document.getElementById(prefix+'-a11y');
  a.textContent=d.accessible?'♿ ✓':'♿ ✗';
  a.style.color=d.accessible?'var(--safe)':'var(--danger)';
}

function showRoutes(f,a){
  clearRoutes(); drawRoute(f,'fastest'); drawRoute(a,'accessible');
  const all=[...f.route,...a.route];
  if(all.length) map.fitBounds(L.latLngBounds(all).pad(0.15));
  fillCard('fast',f); fillCard('acc',a);
  const el=document.getElementById('route-results');
  el.classList.add('show');
  setTimeout(()=>el.scrollIntoView({behavior:'smooth',block:'nearest'}),200);
}

async function findRoute(){
  const sv=document.getElementById('route-start').value, ev=document.getElementById('route-end').value;
  if(!sv||!ev){toast('Please select start and destination');return;}
  const s=sv.split(',').map(Number), e=ev.split(',').map(Number);
  const acc=document.getElementById('wheelchair-btn').classList.contains('on');
  try{
    const c=new AbortController(); const t=setTimeout(()=>c.abort(),5000);
    const r=await fetch(API+'/route',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({start:s,end:e,accessible:acc}),signal:c.signal});
    clearTimeout(t); if(!r.ok) throw 0; const d=await r.json();
    showRoutes({...d,accessible:false},{...d,accessible:true});
  }catch(e){ showRoutes(MOCK_ROUTES.fastest,MOCK_ROUTES.accessible); }
}

document.getElementById('go-btn').addEventListener('click',findRoute);
document.getElementById('wheelchair-btn').addEventListener('click',function(){this.classList.toggle('on');});

document.querySelectorAll('.route-opt').forEach(el=>{
  el.addEventListener('click',()=>{
    document.querySelectorAll('.route-opt').forEach(o=>o.classList.remove('picked'));
    el.classList.add('picked');
    const rt=el.dataset.rt;
    if(fastLine) fastLine.setStyle({opacity:rt==='fastest'?0.9:0.3});
    if(accLine) accLine.setStyle({opacity:rt==='accessible'?0.9:0.3});
  });
});

// --- Modals ---
function openAlert(loc,type,sev,lat,lng){
  map.closePopup();
  document.getElementById('alert-ta').value=`EMERGENCY: ${type} at ${loc}. Bengaluru.\nSeverity: ${sev}.\nWheelchair user may be involved.\nRequesting immediate response.\nCoordinates: ${lat}, ${lng}`;
  showMod('alert-modal');
}
function openBBMP(loc,type,sev,lat,lng){
  map.closePopup();
  const now=new Date().toLocaleString('en-IN');
  document.getElementById('bbmp-ta').value=`To: BBMP Commissioner\nSubject: Inaccessible Infrastructure — ${loc}\n\nI wish to report ${type} at ${loc} that renders the path inaccessible for differently-abled citizens. Immediate remediation is requested.\n\nLocation: ${lat}, ${lng}\nDate/Time: ${now}\nSeverity: ${sev}`;
  showMod('bbmp-modal');
}

function showMod(id){const m=document.getElementById(id);m.classList.add('open');}
function hideMod(id){document.getElementById(id).classList.remove('open');}

document.getElementById('alert-close').onclick=()=>hideMod('alert-modal');
document.getElementById('bbmp-close').onclick=()=>hideMod('bbmp-modal');
document.getElementById('alert-modal').onclick=e=>{if(e.target.id==='alert-modal')hideMod('alert-modal');};
document.getElementById('bbmp-modal').onclick=e=>{if(e.target.id==='bbmp-modal')hideMod('bbmp-modal');};

document.getElementById('alert-copy').onclick=()=>{navigator.clipboard.writeText(document.getElementById('alert-ta').value).then(()=>toast('✅ Alert copied to clipboard'));};
document.getElementById('alert-send').onclick=()=>{toast('🚑 Alert sent to 108 — ETA 8 min');setTimeout(()=>hideMod('alert-modal'),700);};
document.getElementById('bbmp-copy').onclick=()=>{navigator.clipboard.writeText(document.getElementById('bbmp-ta').value).then(()=>toast('✅ Complaint copied'));};
document.getElementById('bbmp-send').onclick=()=>{toast('📨 Submitted to BBMP — Ref #BLR-'+Math.floor(1000+Math.random()*9000));setTimeout(()=>hideMod('bbmp-modal'),700);};

// Bottom bar shortcuts
document.getElementById('btn-108').onclick=()=>{
  const pin=currentPins.find(p=>p.type==='ACCIDENT'&&p.severity==='HIGH');
  if(pin) openAlert(pin.location,pin.type,pin.severity,pin.lat,pin.lng);
  else{ document.getElementById('alert-ta').value='EMERGENCY: Reporting incident in Bengaluru.\nRequesting immediate 108 ambulance response.';showMod('alert-modal');}
};
document.getElementById('btn-bbmp').onclick=()=>{
  const pin=currentPins.find(p=>p.type==='BLOCKED');
  if(pin) openBBMP(pin.location,pin.type,pin.severity,pin.lat,pin.lng);
  else{ document.getElementById('bbmp-ta').value='To: BBMP Commissioner\nSubject: Infrastructure Complaint\n\nReporting accessibility issue in Bengaluru.';showMod('bbmp-modal');}
};
document.getElementById('btn-voice').onclick=()=>toast('🔊 Voice navigation coming soon!');
document.getElementById('btn-braille').onclick=()=>toast('⠿ Braille display integration coming soon!');

// --- Toast ---
let toastT=null;
function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),3500);}

// --- Accessibility Mode ---
let a11yOn=false;
document.getElementById('a11y-toggle').addEventListener('click',function(){
  a11yOn=!a11yOn;
  this.classList.toggle('active',a11yOn);
  const banner=document.getElementById('a11y-banner');
  const mapBadge=document.getElementById('a11y-map-badge');
  if(banner) banner.classList.toggle('show',a11yOn);
  if(mapBadge) mapBadge.classList.toggle('show',a11yOn);
  if(a11yOn) document.getElementById('wheelchair-btn').classList.add('on');
});

// Search bar functionality
document.getElementById('search-input').addEventListener('keydown',function(e){
  if(e.key==='Enter'){
    const q=this.value.trim().toLowerCase();
    const found=Object.entries(LOCATIONS).find(([k])=>k.replace('_',' ').includes(q)||q.includes(k.replace('_',' ')));
    if(found){ map.setView(found[1],14);toast('📍 Moved to '+found[0].replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())); }
    else toast('Location not found in Bengaluru');
  }
});

// --- Init ---
// Render pins immediately so they always show (even on file:// protocol)
renderPins(TEST_PINS);
startRefresh();
