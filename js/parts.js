/* KEEL / Parts registry and showroom dialog: list, upgrade, restore and preview parts. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { $, V, reducedMotion } from './utils.js';
import { PART_INFO } from './dna.js';
import { Parts } from './geometry.js';
import { VesselBuilder } from './builder.js';
import { state } from './state.js';
import { toast } from './stage.js';
import { generate, vessel } from './generate.js';

// ---------- Parts registry and live 3D showroom ----------
function upgradeableParts(){return vessel?vessel.parts.filter(p=>p.kind):[];}
export function renderPartsList(){
  const list=$('parts-list');list.replaceChildren();
  for(const part of vessel.parts){
    const li=document.createElement('li');li.className='part-row';
    const text=document.createElement('div');text.className='part-text';
    const name=document.createElement('strong');name.textContent=part.kind?`${part.category} · Mk ${part.mark}`:part.category;
    const id=document.createElement('span');id.className='part-id';id.textContent=part.id;
    const det=document.createElement('small');det.textContent=part.detail;
    text.append(name,id,det);li.append(text);
    if(part.kind){
      const view=document.createElement('button');view.textContent='3D';view.setAttribute('aria-label',`View ${part.category} in 3D`);
      view.addEventListener('click',()=>openShowroom(part.kind));
      const up=document.createElement('button');up.className='up';up.textContent='Upgrade';up.setAttribute('aria-label',`Upgrade ${part.category}`);
      up.addEventListener('click',()=>upgradePart(part.kind));
      li.append(view,up);
    }
    list.append(li);
  }
  $('parts-count').textContent=String(vessel.parts.length).padStart(2,'0');
}
async function upgradePart(kind){
  const current=vessel.dna.parts[kind];
  state.upgrades[kind]={seed:(crypto.getRandomValues(new Uint32Array(1))[0])>>>0,mark:(current?.mark||1)+1};
  const ok=await generate();
  if(ok){toast(`${PART_INFO[kind].label} upgraded to Mark ${state.upgrades[kind].mark}.`);if($('parts-dialog').open)showroomShow(kind);}
}
async function restorePart(kind){
  if(!state.upgrades[kind]){toast('This part is already the factory design.');return;}
  delete state.upgrades[kind];
  if(await generate()){toast(`${PART_INFO[kind].label} restored to factory design.`);if($('parts-dialog').open)showroomShow(kind);}
}
const showroom={renderer:null,scene:null,camera:null,controls:null,group:null,spin:[],kind:null,raf:0};
function showroomBuild(kind){
  const group=new THREE.Group(),b=Object.create(VesselBuilder.prototype),dna=Object.create(vessel.dna);
  // Preview at a neutral reference scale so every part fills the stage.
  dna.bridgeW=2.4;dna.bridgeL=2.2;dna.L=12;dna.B=4;dna.scale=1;
  Object.assign(b,{dna,m:vessel.m,materials:vessel.m,p:new Parts(group),root:group,animators:[],hitTargets:[],roofs:[],doors:[],equipment:new Set(),r:vessel.dna.stream('preview'),tourViews:[]});
  const spin=[];
  if(kind==='radar'){const s=new THREE.Group();group.add(s);b.proceduralRadar(s,1);spin.push({o:s,axis:'y',v:vessel.dna.parts.radar.speed||.3});}
  else if(kind==='light')b.proceduralLight(group,0,0,0,1.6);
  else if(kind==='exhaust')b.proceduralExhaust(group,0,0,0,1);
  else if(kind==='propeller'){const pr=new THREE.Group();group.add(pr);b.proceduralPropeller(pr,1,vessel.m,1);spin.push({o:pr,axis:'z',v:1.2});}
  else if(kind==='wheel'){const w=new THREE.Group();group.add(w);b.buildWheelPart(w,1.6);spin.push({o:w,axis:'z',v:.35,swing:true});}
  else if(kind==='outrigger'){b.hull={measure:()=>({width:1.6,sheer:0}),deckHeight:()=>0};b.buildRig(1,2,vessel.dna.parts.outrigger.rods);}
  else if(kind==='bridge'){dna.bridgeW=vessel.dna.bridgeW;dna.bridgeL=vessel.dna.bridgeL;b.cabin(group);group.traverse(o=>{if(o.isLight)o.intensity=2;});vessel.drawDisplays(0);}
  const box=new THREE.Box3().setFromObject(group),size=box.getSize(V()),center=box.getCenter(V());
  const s=2.4/Math.max(size.x,size.y,size.z,.001);group.scale.setScalar(s);group.position.copy(center.multiplyScalar(-s));
  const holder=new THREE.Group();holder.add(group);return {holder,spin};
}
function showroomShow(kind){
  const parts=upgradeableParts();if(!parts.length)return;
  if(!parts.some(p=>p.kind===kind))kind=parts[0].kind;
  showroom.kind=kind;const idx=parts.findIndex(p=>p.kind===kind),part=parts[idx];
  $('part-index').textContent=`PART ${String(idx+1).padStart(2,'0')} / ${String(parts.length).padStart(2,'0')}`;
  $('part-title').textContent=part.category;$('part-mark').textContent=`MARK ${part.mark}  ·  ${part.id}`;$('part-detail').textContent=part.detail;
  $('part-restore').disabled=!state.upgrades[kind];
  if(showroom.group){showroom.scene.remove(showroom.group);showroom.group.traverse(o=>o.geometry?.dispose());}
  const built=showroomBuild(kind);showroom.group=built.holder;showroom.spin=built.spin;showroom.scene.add(built.holder);
}
function openShowroom(kind){
  if(!vessel||!upgradeableParts().length){toast('This vessel has no upgradeable parts yet.');return;}
  const stage=$('showroom-stage');
  if(!showroom.renderer){
    const r=new THREE.WebGLRenderer({antialias:true,alpha:true});r.setPixelRatio(Math.min(devicePixelRatio||1,2));r.outputColorSpace=THREE.SRGBColorSpace;r.toneMapping=THREE.ACESFilmicToneMapping;
    stage.prepend(r.domElement);showroom.renderer=r;
    showroom.scene=new THREE.Scene();showroom.scene.add(new THREE.HemisphereLight('#f4f8ee','#7d8a77',2.2));
    const key=new THREE.DirectionalLight('#fff3dc',2.6);key.position.set(3,5,4);showroom.scene.add(key);
    const rim=new THREE.DirectionalLight('#cfe3ea',1.2);rim.position.set(-4,2,-3);showroom.scene.add(rim);
    showroom.camera=new THREE.PerspectiveCamera(34,1,.01,100);showroom.camera.position.set(3.2,2.1,3.6);
    showroom.controls=new OrbitControls(showroom.camera,r.domElement);showroom.controls.enableDamping=true;showroom.controls.enablePan=false;showroom.controls.minDistance=2.2;showroom.controls.maxDistance=9;showroom.controls.autoRotate=!reducedMotion;showroom.controls.autoRotateSpeed=1.4;
  }
  $('parts-dialog').showModal();
  const w=stage.clientWidth,h=stage.clientHeight;showroom.renderer.setSize(w,h,false);showroom.camera.aspect=w/h;showroom.camera.updateProjectionMatrix();
  showroomShow(kind);
  const loop=t=>{
    if(!$('parts-dialog').open)return;
    for(const s of showroom.spin){if(reducedMotion)break;if(s.swing)s.o.rotation.z=Math.sin(t*.001*s.v*3)*.9;else s.o.rotation[s.axis]+=.016*s.v*3;}
    showroom.controls.update();showroom.renderer.render(showroom.scene,showroom.camera);showroom.raf=requestAnimationFrame(loop);
  };
  cancelAnimationFrame(showroom.raf);showroom.raf=requestAnimationFrame(loop);
}
$('parts-dialog').addEventListener('close',()=>{cancelAnimationFrame(showroom.raf);if(showroom.group){showroom.scene.remove(showroom.group);showroom.group.traverse(o=>o.geometry?.dispose());showroom.group=null;}});
$('part-upgrade').addEventListener('click',()=>showroom.kind&&upgradePart(showroom.kind));
$('part-restore').addEventListener('click',()=>showroom.kind&&restorePart(showroom.kind));
for(const [id,dir] of [['part-prev',-1],['part-next',1]])$(id).addEventListener('click',()=>{const parts=upgradeableParts(),i=parts.findIndex(p=>p.kind===showroom.kind);showroomShow(parts[(i+dir+parts.length)%parts.length].kind);});
