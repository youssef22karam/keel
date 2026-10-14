/* KEEL / Viewport tools: wireframe, roof, fishing rig toggle, dimension overlay and scale indicator. */
import * as THREE from 'three';
import { $, V, clamp, number } from './utils.js';
import { state, viewport } from './state.js';
import { camera, controls, renderer, scene, toast } from './stage.js';
import { updateHUD, vessel } from './generate.js';

export let dimensions=null;

export function setWireframe(on){
  state.wireframe=on;$('wireframe-button').classList.toggle('active',on);$('wireframe-button').setAttribute('aria-pressed',String(on));
  if(vessel)vessel.m.all.forEach(m=>{if(m.isMeshStandardMaterial&&!m.transparent)m.wireframe=on;});
  if(renderer)renderer.shadowMap.needsUpdate=true;
}
export function setRoof(on){state.roofOpen=on;$('roof-toggle').setAttribute('aria-checked',String(on));if(vessel)vessel.roofs.forEach(roof=>roof.visible=!on);if(renderer)renderer.shadowMap.needsUpdate=true;}
export function setRigNodes(v){
  for(const n of v.rigNodes){
    const t=clamp((v.rigProgress-n.userData.delay)/.6,0,1),e=t*t*(3-2*t);
    n.scale.setScalar(Math.max(.0001,e));n.visible=e>.003;
  }
}
export function applyRigState(){
  $('fishing-rig').setAttribute('aria-checked',String(state.rig&&Boolean(vessel?.rigNodes?.length)));
  if(!vessel?.rigNodes?.length)return;
  vessel.rigScaleTarget=vessel.rigProgress=state.rig?1:0;setRigNodes(vessel);vessel.updateRigEquipment();
}
export function setRig(on){
  if(!vessel)return;
  if(!vessel.rigNodes?.length){$('fishing-rig').setAttribute('aria-checked','false');toast('Rowing skiffs and apex harvesters carry no rod rig.');return;}
  state.rig=on;$('fishing-rig').setAttribute('aria-checked',String(on));
  vessel.rigScaleTarget=on?1:0;vessel.updateRigEquipment();updateHUD();
  toast(on?'Rods and outriggers deploying.':'Rods and outriggers stowing.');
}
export function buildDimensions(){
  if(dimensions){dimensions.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});dimensions.removeFromParent();}
  const d=vessel.dna,y=-d.D-.11,x=d.B*.72,z=-d.L*.565,tick=d.L*.011,vertices=[];
  const line=(a,b)=>vertices.push(...a,...b);
  line([x,y,-d.L*.5],[x,y,d.L*.5]);for(const zz of [-d.L*.5,d.L*.5])line([x-tick,y,zz],[x+tick,y,zz]);
  line([-d.B*.5,y,z],[d.B*.5,y,z]);for(const xx of [-d.B*.5,d.B*.5])line([xx,y,z-tick],[xx,y,z+tick]);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  dimensions=new THREE.Group();dimensions.add(new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:'#839477',transparent:true,opacity:.72,depthWrite:false,depthTest:false})));dimensions.scale.setScalar(d.scale);scene.add(dimensions);
  $('length-label').textContent=`${d.L.toFixed(1)} m LOA`;$('beam-label').textContent=`${d.B.toFixed(1)} m`;
  updateDimensionVisibility();
}
export function updateDimensionVisibility(){const visible=state.dimensions&&state.mode==='exterior';if(dimensions)dimensions.visible=visible;$('length-label').classList.toggle('hidden',!visible);$('beam-label').classList.toggle('hidden',!visible);$('dimensions-button').classList.toggle('active',state.dimensions);$('dimensions-button').setAttribute('aria-pressed',String(state.dimensions));}
export function updateDimensions(){
  if(!vessel||!dimensions?.visible)return;const d=vessel.dna;dimensions.position.copy(vessel.root.position);dimensions.quaternion.copy(vessel.root.quaternion);
  for(const [id,pos] of [['length-label',V(d.B*.72,-d.D-.11,0)],['beam-label',V(0,-d.D-.11,-d.L*.565)]]){
    const q=vessel.root.localToWorld(pos).project(camera),el=$(id);el.style.left=`${(q.x*.5+.5)*viewport.clientWidth}px`;el.style.top=`${(-q.y*.5+.5)*viewport.clientHeight+13}px`;el.style.visibility=q.z>1||q.z<-1?'hidden':'visible';
  }
}
export function updateScale(){
  if(!vessel||state.mode!=='exterior')return;const distance=camera.position.distanceTo(controls.target),pxPerMeter=viewport.clientHeight/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*distance)*vessel.dna.scale;
  const desired=74/pxPerMeter,power=10**Math.floor(Math.log10(desired)),value=([1,2,5].reverse().find(n=>n*power<=desired)||1)*power;
  document.querySelector('.scale-line').style.width=`${clamp(value*pxPerMeter,18,95)}px`;$('scale-text').textContent=`${number.format(value)} ${value===1?'METER':'METERS'}`;
}
