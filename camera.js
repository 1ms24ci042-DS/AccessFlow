// ===== AccessFlow — Camera Module =====
const DEMO_IMAGES = [
  {src:"data/images/silk_board_accident.jpg",location:"Silk Board CCTV-04",lat:12.9175,lng:77.6229,key:"silk_board"},
  {src:"data/images/orr_flood.jpg",location:"ORR Cam-12",lat:12.9352,lng:77.6861,key:"orr_flood"},
  {src:"data/images/koramangala_blocked.jpg",location:"Koramangala Cam-07",lat:12.9279,lng:77.6271,key:"koramangala"},
  {src:"data/images/whitefield_congestion.jpg",location:"Whitefield CCTV-19",lat:12.9698,lng:77.7499,key:"whitefield"},
  {src:"data/images/clear_road.jpg",location:"MG Road Cam-03",lat:12.9757,lng:77.6011,key:"clear"}
];

const MOCK_AI = {
  silk_board:{type:"ACCIDENT",severity:"HIGH",description:"Multi-vehicle collision blocking 2 lanes. Emergency vehicles en route.",emergency:true,accessible:false},
  orr_flood:{type:"FLOOD",severity:"HIGH",description:"Severe waterlogging detected. Underpass inaccessible for all vehicles.",emergency:false,accessible:false},
  koramangala:{type:"BLOCKED",severity:"MEDIUM",description:"Construction debris blocking sidewalk ramp access.",emergency:false,accessible:false},
  whitefield:{type:"CONGESTION",severity:"LOW",description:"Heavy traffic with slow movement. Wheelchair paths remain clear.",emergency:false,accessible:true},
  clear:{type:"CLEAR",severity:"LOW",description:"Road clear — all lanes and ramps accessible.",emergency:false,accessible:true}
};

let curIdx=0, activeSlot='a';
const imgA=document.getElementById('img-a'), imgB=document.getElementById('img-b');
const camLoc=document.getElementById('cam-loc'), camTs=document.getElementById('cam-ts');
const aiCard=document.getElementById('ai-card');
const aiBadge=document.getElementById('ai-type-badge'), aiSev=document.getElementById('ai-sev');
const aiEmg=document.getElementById('ai-emg'), aiDesc=document.getElementById('ai-desc');
const aiScan=document.getElementById('ai-scanning'), aiRes=document.getElementById('ai-result');
const camBadge=document.getElementById('cam-status-badge');

function updTs(){
  camTs.textContent=new Date().toLocaleTimeString('en-IN',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});
}

function showImg(idx){
  const img=DEMO_IMAGES[idx];
  const inc=activeSlot==='a'?imgB:imgA, out=activeSlot==='a'?imgA:imgB;
  inc.src=img.src;
  inc.onload=()=>{inc.classList.remove('out');out.classList.add('out');activeSlot=activeSlot==='a'?'b':'a';};
  inc.onerror=()=>{inc.style.background='linear-gradient(135deg,#1a2b4a,#3d5a80)';inc.src='';inc.classList.remove('out');out.classList.add('out');activeSlot=activeSlot==='a'?'b':'a';};
  camLoc.textContent=img.location;
  camBadge.textContent='SCANNING'; camBadge.className='badge b-congestion';
  scanAndShow(img.key);
}

function scanAndShow(key){
  aiScan.classList.add('show');aiRes.classList.add('hide');aiCard.classList.remove('emergency');
  setTimeout(()=>{
    const r=MOCK_AI[key]; if(r) displayAI(r);
  },1500);
}

function displayAI(r){
  aiScan.classList.remove('show'); aiRes.classList.remove('hide');
  aiBadge.className='badge b-'+r.type.toLowerCase(); aiBadge.textContent=r.type;
  aiSev.className='sev sev-'+r.severity.toLowerCase(); aiSev.textContent=r.severity;
  aiEmg.style.display=r.emergency?'inline':'none';
  aiCard.classList.toggle('emergency',!!r.emergency);
  aiDesc.textContent=r.description;
  camBadge.textContent=r.type; camBadge.className='badge b-'+r.type.toLowerCase();
}

function cycle(){curIdx=(curIdx+1)%DEMO_IMAGES.length;showImg(curIdx);}
function startCam(){showImg(0);setInterval(cycle,5000);}

// Analyze button — try API, fallback mock
document.getElementById('analyze-btn').addEventListener('click',async()=>{
  const img=DEMO_IMAGES[curIdx];
  aiScan.classList.add('show');aiRes.classList.add('hide');aiCard.classList.remove('emergency');
  try{
    const c=new AbortController();const t=setTimeout(()=>c.abort(),4000);
    const r=await fetch(API+'/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image_path:img.src}),signal:c.signal});
    clearTimeout(t);if(!r.ok)throw 0;displayAI(await r.json());
  }catch(e){const r=MOCK_AI[img.key];if(r)setTimeout(()=>displayAI(r),800);}
});

// Upload handlers
document.getElementById('upload-img').addEventListener('change',function(){
  if(this.files.length){
    const url=URL.createObjectURL(this.files[0]);
    const inc=activeSlot==='a'?imgB:imgA, out=activeSlot==='a'?imgA:imgB;
    inc.src=url; inc.onload=()=>{inc.classList.remove('out');out.classList.add('out');activeSlot=activeSlot==='a'?'b':'a';};
    camLoc.textContent='📷 User Upload';
    camBadge.textContent='UPLOADED'; camBadge.className='badge b-flood';
    toast('📷 Image uploaded — click Analyze to process');
  }
});
document.getElementById('upload-vid').addEventListener('change',function(){
  if(this.files.length){
    camLoc.textContent='🎥 Video: '+this.files[0].name;
    camBadge.textContent='VIDEO'; camBadge.className='badge b-flood';
    toast('🎥 Video uploaded — backend will process frames');
  }
});

// Init
updTs(); setInterval(updTs,1000);
startCam();
