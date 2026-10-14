/* KEEL / Stage: renderer, scene, camera, lights, toast/fatal helpers, camera views, bridge camera and environment. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { $, V, clamp, lerp, reducedMotion } from './utils.js';
import { state, viewport } from './state.js';
import { vessel } from './generate.js';
import { updateDimensionVisibility } from './viewtools.js';

export let renderer,scene,camera,controls,ground,grid,contactShadow,water,sun,fillLight,ambient,environmentTarget;

export let resizeObserver,toastTimer;

export function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3200);}
export function fatal(error){
  console.error('KEEL:',error);clearTimeout(window.keelLoadingTimeout);
  $('loading').classList.remove('ready');$('loading').classList.add('error');$('loading-title').textContent='THE SHIPYARD COULD NOT START';
  $('loading-detail').textContent=error?.message?.includes('WebGL')?'WebGL 2 is unavailable. Enable hardware acceleration or open KEEL in a current Chrome, Firefox, Safari, or Edge browser.':'The 3D engine could not load. Check your connection, enable WebGL 2, then reload the shipyard.';
  $('retry-button').classList.remove('hidden');$('engine-status').textContent='ENGINE OFFLINE';$('render-status').textContent='WEBGL REQUIRED';
}
export function initStage(){
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.14;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
  renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','Interactive 3D fishing vessel. Drag to orbit, scroll to zoom. Press B to enter its bridge.');viewport.prepend(renderer.domElement);
  scene=new THREE.Scene();scene.background=new THREE.Color('#e8ece5');scene.fog=new THREE.Fog('#e8ece5',70,190);
  camera=new THREE.PerspectiveCamera(35,1,.01,2500);camera.position.set(29,20,26);
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.075;controls.minDistance=5;controls.maxDistance=145;controls.maxPolarAngle=Math.PI*.48;controls.minPolarAngle=.10;controls.autoRotateSpeed=.40;controls.enablePan=true;
  controls.addEventListener('start',()=>{state.cameraTween=null;});
  ambient=new THREE.HemisphereLight('#e9efe4','#83907f',1.85);scene.add(ambient);
  sun=new THREE.DirectionalLight('#fff4db',2.8);sun.position.set(-16,31,26);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-27;sun.shadow.camera.right=27;sun.shadow.camera.top=27;sun.shadow.camera.bottom=-27;sun.shadow.camera.near=.2;sun.shadow.camera.far=110;sun.shadow.bias=-.00035;sun.shadow.normalBias=.024;sun.shadow.radius=3;sun.target.position.set(0,2,0);scene.add(sun,sun.target);
  fillLight=new THREE.DirectionalLight('#d4e3e0',.72);fillLight.position.set(24,13,-20);scene.add(fillLight);
  const environment=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);environmentTarget=pmrem.fromScene(environment,.06);scene.environment=environmentTarget.texture;scene.environmentIntensity=.66;environment.dispose();pmrem.dispose();
  ground=new THREE.Mesh(new THREE.PlaneGeometry(700,700),new THREE.MeshStandardMaterial({color:'#e5e9df',roughness:1,metalness:0}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
  grid=new THREE.GridHelper(220,110,'#a7b39e','#a7b39e');grid.material.transparent=true;grid.material.opacity=.15;grid.material.depthWrite=false;scene.add(grid);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d'),gradient=c.createRadialGradient(64,64,5,64,64,64);gradient.addColorStop(0,'rgba(36,51,27,0.20)');gradient.addColorStop(.48,'rgba(36,51,27,0.09)');gradient.addColorStop(1,'rgba(36,51,27,0)');c.fillStyle=gradient;c.fillRect(0,0,128,128);
  contactShadow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthWrite:false}));contactShadow.rotation.x=-Math.PI/2;scene.add(contactShadow);
  const seaGeometry=new THREE.PlaneGeometry(2200,2200,100,100);seaGeometry.rotateX(-Math.PI/2);
  const seaMaterial=new THREE.ShaderMaterial({
    uniforms:{time:{value:0},weather:{value:.12},light:{value:1},seaColor:{value:new THREE.Color('#4e7877')},horizon:{value:new THREE.Color('#becdc3')}},
    vertexShader:`uniform float time; uniform float weather; varying vec3 worldPosition; varying vec3 seaNormal;
          void main(){vec3 p=position; float a=(0.035+weather*0.22); float x=p.x*0.43+time*0.7; float z=p.z*0.29+time*0.53;
            p.y+=sin(x)*cos(z)*a+sin(p.x*1.2+p.z*0.8-time)*a*0.2;
            seaNormal=normalize(vec3(-cos(x)*cos(z)*a*0.43,1.0,sin(x)*sin(z)*a*0.29));
            worldPosition=(modelMatrix*vec4(p,1.0)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(worldPosition,1.0);}`,
    fragmentShader:`uniform vec3 seaColor; uniform vec3 horizon; uniform float light; uniform float time; uniform float weather; varying vec3 worldPosition; varying vec3 seaNormal;
          void main(){vec3 viewDir=normalize(cameraPosition-worldPosition);float fresnel=pow(1.0-max(dot(viewDir,seaNormal),0.0),4.0);
            float spec=pow(max(dot(reflect(-normalize(vec3(-0.4,1.0,0.7)),seaNormal),viewDir),0.0),90.0);
            float ripple=sin(worldPosition.x*4.0+sin(worldPosition.z*3.0+time))*sin(worldPosition.z*5.0-time)*0.014;
            vec3 color=mix(seaColor,horizon,fresnel*0.68)+vec3(spec*0.20+ripple);
            float fade=1.0-exp(-length(worldPosition.xz-cameraPosition.xz)*0.006); color=mix(color,horizon,fade*0.84);
            gl_FragColor=vec4(color*light,1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,side:THREE.DoubleSide});
  water=new THREE.Mesh(seaGeometry,seaMaterial);water.visible=false;water.frustumCulled=false;scene.add(water);
  resizeObserver=new ResizeObserver(resize);resizeObserver.observe(viewport);resize();
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();$('engine-status').textContent='CONTEXT INTERRUPTED';toast('The graphics context was interrupted. Reloading it may be necessary.');});
  renderer.domElement.addEventListener('webglcontextrestored',()=>location.reload());
}
export function resize(){
  if(!renderer)return;const w=Math.max(1,viewport.clientWidth),h=Math.max(1,viewport.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  if(vessel&&state.mode==='exterior'&&w<600&&!state.drag)resetCamera(false);
}
function fitPose(){
  const center=vessel.bounds.getCenter(V()),height=vessel.bounds.max.y-vessel.bounds.min.y;
  const target=V(0,center.y*.83+.30,0),distance=(37.8+Math.max(0,height-15)*.8)*Math.max(1,1.36/camera.aspect);
  return {position:target.clone().add(V(1.50,.88,1.18).normalize().multiplyScalar(distance)),target};
}
export function resetCamera(animate=true){
  if(!vessel)return;
  if(state.mode==='bridge'){state.eye.copy(vessel.helm.start);state.yaw=0;state.pitch=-.095;camera.fov=69;camera.updateProjectionMatrix();return;}
  const pose=fitPose();camera.fov=35;camera.near=.008;camera.updateProjectionMatrix();
  if(animate&&!reducedMotion){state.cameraTween={start:performance.now(),duration:700,from:camera.position.clone(),fromTarget:controls.target.clone(),to:pose.position,toTarget:pose.target};}
  else{state.cameraTween=null;camera.position.copy(pose.position);controls.target.copy(pose.target);controls.update();}
}
export function setView(mode,regenerated=false){
  if(!vessel)return;
  const previous=state.mode;
  if(mode==='bridge'&&previous==='exterior'&&!regenerated)state.exteriorPose={position:camera.position.clone(),target:controls.target.clone()};
  state.mode=mode;state.cameraTween=null;state.drag=null;state.keys.clear();
  controls.enabled=mode==='exterior';controls.autoRotate=mode==='exterior'&&state.autoRotate&&!reducedMotion;
  viewport.classList.toggle('view-mode-bridge',mode==='bridge');$('bridge-info').classList.toggle('hidden',mode!=='bridge');
  for(const [id,value] of [['exterior-button','exterior'],['bridge-button','bridge']]){$(id).classList.toggle('active',mode===value);$(id).setAttribute('aria-pressed',String(mode===value));}
  if(mode==='bridge'){
    const views=interiorViews();state.tourView=clamp(state.tourView,0,Math.max(0,views.length-1));
    renderTourChips(views);
    const view=views[state.tourView]||views[0];
    state.eye.copy(view.eye);state.yaw=0;state.pitch=-.06;camera.fov=69;camera.near=Math.max(.00015,.015*vessel.dna.scale);camera.updateProjectionMatrix();vessel.m.glass.opacity=.14;
    $('bridge-title').textContent=view.title;
    $('bridge-info').querySelector('p').textContent=view.hint;
    $('orbit-hint').textContent='Drag to look around / B to return';
    renderer.domElement.style.cursor='grab';updateBridgeCamera(0);
  }else{
    vessel.m.glass.opacity=.49;camera.fov=35;camera.near=.008;camera.up.set(0,1,0);camera.updateProjectionMatrix();renderer.domElement.style.cursor='grab';
    if(state.exteriorPose&&!regenerated&&previous==='bridge'){camera.position.copy(state.exteriorPose.position);controls.target.copy(state.exteriorPose.target);controls.update();}
    else resetCamera(!regenerated);
    $('orbit-hint').textContent='Drag to orbit \u00b7 Scroll to explore';
  }
  if(!reducedMotion)renderer.domElement.animate([{opacity:.5},{opacity:1}],{duration:460,easing:'ease-out'});
  applyEnvironment();updateDimensionVisibility();
}
function interiorViews(){
  if(!vessel)return[];
  if(vessel.tourViews?.length)return vessel.tourViews;
  const h=vessel.helm;if(!h)return[];
  const open=vessel.dna.openConsole;
  return [{name:'Wheelhouse',group:h.group,eye:h.start.clone(),minX:h.minX,maxX:h.maxX,minZ:h.minZ,maxZ:h.maxZ,fixedY:open?null:h.start.y,title:open?'THE OPEN HELM':'THE COMMAND BRIDGE',hint:'Drag to look. WASD to move.'}];
}
function renderTourChips(views){
  const wrap=$('tour-chips');wrap.replaceChildren();
  views.forEach((view,index)=>{
    const chip=document.createElement('button');chip.textContent=view.name;chip.className=index===state.tourView?'active':'';chip.setAttribute('role','tab');
    chip.setAttribute('aria-selected',String(index===state.tourView));
    chip.addEventListener('click',()=>{if(index===state.tourView)return;state.tourView=index;state.keys.clear();setView('bridge');});
    wrap.append(chip);
  });
  wrap.classList.toggle('hidden',views.length<2);
}
export function updateBridgeCamera(dt){
  if(!vessel||state.mode!=='bridge')return;
  const views=interiorViews(),view=views[clamp(state.tourView,0,views.length-1)]||views[0];
  if(!view)return;
  const keys=state.keys,unit=view.unit||vessel.helm?.unit||1,speed=unit*1.15*(keys.has('shift')?1.7:1)*dt;
  const direction=V(Math.sin(state.yaw),0,Math.cos(state.yaw)),right=V(-Math.cos(state.yaw),0,Math.sin(state.yaw));
  const next=state.eye.clone();
  if(keys.has('w'))next.addScaledVector(direction,speed);if(keys.has('s'))next.addScaledVector(direction,-speed);
  if(keys.has('d'))next.addScaledVector(right,speed);if(keys.has('a'))next.addScaledVector(right,-speed);
  if(keys.has('arrowleft'))state.yaw+=dt*.85;if(keys.has('arrowright'))state.yaw-=dt*.85;if(keys.has('arrowup'))state.pitch=clamp(state.pitch+dt*.60,-1.05,.80);if(keys.has('arrowdown'))state.pitch=clamp(state.pitch-dt*.60,-1.05,.80);
  // Walls are solid; an open door extends the walkable area out through that doorway only.
  const doors=view.group===vessel.helm?.group?(vessel.doors||[]):[];
  let minX=view.minX,maxX=view.maxX,minZ=view.minZ;
  const was=state.eye;
  for(const dr of doors){
    if(dr.open<.8)continue;
    if(dr.kind==='hinge'){if(Math.abs(was.x-dr.local.x)<dr.halfW&&Math.abs(next.x-dr.local.x)<dr.halfW)minZ=Math.min(minZ,dr.outZ);}
    else if(Math.abs(was.z-dr.local.z)<dr.halfW&&Math.abs(next.z-dr.local.z)<dr.halfW){if(dr.outX>0)maxX=Math.max(maxX,dr.outX);else minX=Math.min(minX,dr.outX);}
  }
  // Once outside, you stay in line with the doorway until you step back in.
  const outAft=was.z<view.minZ-.01,outSide=was.x>view.maxX+.01||was.x<view.minX-.01;
  if(outAft){const dr=doors.find(q=>q.kind==='hinge');if(dr){minZ=dr.outZ;next.x=clamp(next.x,dr.local.x-dr.halfW,dr.local.x+dr.halfW);}}
  if(outSide){const dr=doors.find(q=>q.kind!=='hinge'&&Math.sign(q.outX)===Math.sign(was.x));if(dr){next.z=clamp(next.z,dr.local.z-dr.halfW,dr.local.z+dr.halfW);if(dr.outX>0)maxX=dr.outX;else minX=dr.outX;}}
  next.z=clamp(next.z,minZ,view.maxZ);
  next.x=clamp(next.x,minX,maxX);
  if(view.fixedY!=null)next.y=view.fixedY;
  state.eye.copy(next);vessel.root.updateMatrixWorld(true);
  camera.position.copy(view.group.localToWorld(state.eye.clone()));
  const localTarget=state.eye.clone().add(V(Math.sin(state.yaw)*Math.cos(state.pitch),Math.sin(state.pitch),Math.cos(state.yaw)*Math.cos(state.pitch)));
  camera.up.set(0,1,0).applyQuaternion(vessel.root.quaternion);camera.lookAt(view.group.localToWorld(localTarget));
}
export function applyEnvironment(){
  if(!scene)return;const atSea=state.sea||state.mode==='bridge';ground.visible=grid.visible=contactShadow.visible=!atSea;water.visible=atSea;
  const stops=[{t:0,color:'#d8c6a6',sun:'#ffd3a0',power:1.7,ambient:1.45},{t:.4,color:'#e8ece5',sun:'#fff4dd',power:2.8,ambient:1.85},{t:.70,color:'#b8b6b0',sun:'#ffb077',power:1.85,ambient:1.24},{t:1,color:'#34454c',sun:'#99b7d2',power:.38,ambient:.48}];
  let a=stops[0],b=stops[1];for(let i=1;i<stops.length;i++){if(state.time<=stops[i].t){a=stops[i-1];b=stops[i];break;}}
  const t=clamp((state.time-a.t)/(b.t-a.t),0,1),bg=new THREE.Color(a.color).lerp(new THREE.Color(b.color),t);
  if(atSea&&state.time<.65)bg.lerp(new THREE.Color('#c1d1ce'),.33);
  scene.background.copy(bg);scene.fog.color.copy(bg);scene.fog.near=atSea?85:70;scene.fog.far=atSea?1200:190;
  sun.color.set(a.sun).lerp(new THREE.Color(b.sun),t);sun.intensity=lerp(a.power,b.power,t);sun.position.set(lerp(-23,19,state.time),state.time>.8?19:lerp(15,37,Math.sin(state.time*Math.PI)),26);ambient.intensity=lerp(a.ambient,b.ambient,t);
  fillLight.intensity=lerp(.72,.27,state.time);scene.environmentIntensity=lerp(.70,.35,state.time*.8);renderer.toneMappingExposure=state.mode==='bridge'?1.23:1.14;
  water.material.uniforms.weather.value=state.weather;water.material.uniforms.horizon.value.copy(bg);water.material.uniforms.light.value=lerp(1,.42,Math.max(0,(state.time-.6)/.4));
  $('time-output').textContent=state.time<.2?'DAWN':state.time<.56?'NOON':state.time<.85?'DUSK':'NIGHT';$('weather-output').textContent=state.weather<.34?'CALM':state.weather<.72?'ROUGH':'STORM';
  $('lighting-label').textContent=atSea?'At sea':state.time>.8?'Night lighting':'Studio lighting';viewport.classList.toggle('night',state.time>.8);renderer.shadowMap.needsUpdate=true;
}
