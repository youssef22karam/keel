/* KEEL / Render loop and lifecycle: animate(), start(), visibility and pagehide handling. */
import * as THREE from 'three';
import { $, clamp, lerp, number, reducedMotion } from './utils.js';
import { VesselDNA } from './dna.js';
import { disposeVessel } from './geometry.js';
import { state } from './state.js';
import { camera, contactShadow, controls, environmentTarget, grid, ground, initStage, renderer, resizeObserver, scene, toast, toastTimer, updateBridgeCamera, water } from './stage.js';
import { generate, parseBrief, vessel } from './generate.js';
import { dimensions, setRigNodes, updateDimensions, updateScale } from './viewtools.js';
import { bindUI, debounceTimer } from './ui.js';
import { validateDNA } from './selftest.js';

export let disposed=false;

let lastTime=0,lastDisplays=0,lastMetrics=0,metricFrames=0,lastScale=0;
function animate(now){
  if(disposed||document.hidden)return;const dt=lastTime?Math.min((now-lastTime)/1000,.05):.016;lastTime=now;const t=now*.001;
  if(vessel){
    const atSea=state.sea||state.mode==='bridge',motion=atSea&&!reducedMotion?state.weather:0;
    vessel.root.rotation.z=Math.sin(t*.52)*motion*.009;vessel.root.rotation.x=Math.sin(t*.37)*motion*.005;vessel.root.position.y=Math.sin(t*.8)*motion*.035;
    for(const a of vessel.animators){
      if(reducedMotion)continue;
      if(a.kind==='radar')a.object.rotation.y+=dt*a.speed;
      else if(a.kind==='propeller')a.object.rotation.z+=dt*a.speed;
      else if(a.kind==='drone')a.object.position.y=a.baseY+Math.sin(t*a.speed+a.phase)*vessel.dna.L*.0009;
      // Tandem wipers: rest flat on the sill, sweep up across the pane and back.
      else if(a.kind==='wiper')a.object.rotation.z=a.park-a.sweep*(.5-.5*Math.cos(t*1.7));
      // Both oars stroke together: blades dip and drive aft, then lift and recover forward.
      else if(a.kind==='oar'){const w=t*.9;a.object.rotation.z=a.dir*(-.14-.085*Math.sin(w));a.object.rotation.y=-a.dir*Math.cos(w)*.16;}
      else if(a.kind==='hook'){a.object.rotation.z=Math.sin(t*.62+a.phase)*.11;a.object.rotation.x=Math.cos(t*.47+a.phase)*.07;}
      else if(a.kind==='slew')a.object.rotation.y=Math.sin(t*.13+a.phase)*a.amp;
      else if(a.kind==='drum')a.object.rotation.x+=dt*a.speed;
      else if(a.kind==='flag'){
        const position=a.object.geometry.getAttribute('position');
        for(let i=0;i<position.count;i++){const x=position.getX(i)/a.width;position.setZ(i,Math.sin(x*9-t*a.speed)*a.amplitude*x);}
        position.needsUpdate=true;a.object.geometry.computeVertexNormals();
      }
    }
    if(vessel.rigNodes?.length&&vessel.rigProgress!==vessel.rigScaleTarget){
      const step=dt*(reducedMotion?10:.85),target=vessel.rigScaleTarget;
      vessel.rigProgress=target>vessel.rigProgress?Math.min(target,vessel.rigProgress+step):Math.max(target,vessel.rigProgress-step);
      setRigNodes(vessel);renderer.shadowMap.needsUpdate=true;
    }
    // Sliding doors glide open when you walk up to them inside the bridge.
    for(const dr of vessel.doors||[]){
      const near=state.mode==='bridge'&&vessel.helm&&Math.hypot(state.eye.x-dr.local.x,state.eye.z-dr.local.z)<1.6*dr.unit+Math.abs(dr.local.x)*.2;
      const target=near?1:0;if(Math.abs(dr.open-target)<.001)continue;
      dr.open=reducedMotion?target:THREE.MathUtils.damp(dr.open,target,4.5,dt);
      if(dr.kind==='hinge')dr.object.rotation.y=dr.open*1.45;
      else dr.object.position.z=lerp(dr.closedZ,dr.openZ,dr.open);
    }
    if(vessel.dna.tier===4&&!reducedMotion)vessel.m.glow.emissiveIntensity=1.5+.8*Math.sin(t*1.8);
    if(vessel.wheel)vessel.wheel.rotation.z=THREE.MathUtils.damp(vessel.wheel.rotation.z,vessel.steering,5,dt);
    if(now-lastDisplays>125&&state.mode==='bridge'){vessel.drawDisplays(t);lastDisplays=now;}
    if(state.mode==='bridge')updateBridgeCamera(dt);
    else{
      camera.up.set(0,1,0);
      if(state.cameraTween){const a=state.cameraTween,u=clamp((now-a.start)/a.duration,0,1),ease=1-Math.pow(1-u,4);camera.position.lerpVectors(a.from,a.to,ease);controls.target.lerpVectors(a.fromTarget,a.toTarget,ease);if(u===1)state.cameraTween=null;}
      controls.update(dt);
    }
    if(state.dimensions)updateDimensions();if(now-lastScale>250){updateScale();lastScale=now;}
  }
  water.material.uniforms.time.value=t;renderer.render(scene,camera);metricFrames++;
  if(now-lastMetrics>1100){const fps=Math.round(metricFrames*1000/Math.max(1,now-lastMetrics)),triangles=renderer.info.render.triangles;$('render-status').textContent=`${Math.min(fps,240)} FPS / ${number.format(triangles/1000)}K FACES`;lastMetrics=now;metricFrames=0;}
}

export async function start(){
  validateDNA();initStage();bindUI();
  const params=new URLSearchParams(location.search);if(params.has('cost'))$('vessel-cost').value=params.get('cost');if(params.has('seed'))$('vessel-seed').value=params.get('seed');
  if(!params.has('cost')&&!params.has('seed')){
    // Curate a reproducible opening silhouette without substituting a prebuilt model.
    for(let i=0;i<32;i++){const seed=42819+i*112,d=new VesselDNA(5000000,seed);if(d.forward&&d.variant===2){$('vessel-seed').value=String(seed);break;}}
  }
  if(params.has('cost')||params.has('seed')){try{parseBrief();}catch{$('vessel-cost').value='5,000,000';$('vessel-seed').value='42819';toast('The shared brief was invalid. Opening the default vessel instead.');}}
  await generate();lastMetrics=performance.now();lastTime=lastMetrics;renderer.setAnimationLoop(animate);
}
document.addEventListener('visibilitychange',()=>{lastTime=0;lastMetrics=performance.now();metricFrames=0;state.keys.clear();});
window.addEventListener('pagehide',event=>{
  if(event.persisted)return;disposed=true;clearTimeout(debounceTimer);clearTimeout(toastTimer);clearTimeout(window.keelLoadingTimeout);renderer?.setAnimationLoop(null);resizeObserver?.disconnect();controls?.dispose();disposeVessel(vessel);environmentTarget?.dispose();
  for(const item of [ground,grid,contactShadow,water]){item?.geometry?.dispose();if(item?.material){item.material.map?.dispose();item.material.dispose();}}
  if(dimensions)dimensions.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});renderer?.dispose();
});
