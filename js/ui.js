/* KEEL / UI wiring: menus, mobile panel, click inspection and bindUI() with every event handler. */
import { $, clamp, money } from './utils.js';
import { pointer, raycaster, state, viewport } from './state.js';
import { applyEnvironment, camera, controls, renderer, resetCamera, resize, setView, toast } from './stage.js';
import { fitBudgetInput, generate, inputError, parseBrief, vessel } from './generate.js';
import { setRig, setRoof, setWireframe, updateDimensionVisibility } from './viewtools.js';
import { renderFleet, saveVessel, syncFleetState } from './fleet.js';
import { exportImage, exportModel, exportRecipe } from './export.js';

export let debounceTimer;

function toggleMenu(id,buttonId){const el=$(id),open=el.classList.contains('hidden');el.classList.toggle('hidden',!open);$(buttonId).setAttribute('aria-expanded',String(open));if(buttonId==='lighting-button')$(buttonId).classList.toggle('open',open);}
function mobileConfig(open){$('sidebar').classList.toggle('open',open);$('config-backdrop').classList.toggle('visible',open);$('mobile-config').setAttribute('aria-expanded',String(open));}
function inspectClick(event){
  if(!vessel||state.mode!=='bridge')return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObjects(vessel.hitTargets,true);if(!hits.length)return;let target=hits[0].object;while(target&&!target.userData.control)target=target.parent;
  if(target?.userData.control==='radar'){const ranges=[1.5,3,6,12,24];vessel.radarRange=ranges[(ranges.indexOf(vessel.radarRange)+1)%ranges.length];vessel.drawDisplays(performance.now()*.001);toast(`Radar range: ${vessel.radarRange} nautical miles.`);}
  if(target?.userData.control==='wheel'){vessel.steering+=Math.PI/4;toast('Helm adjusted 45 degrees.');}
}
export function bindUI(){
  $('design-form').addEventListener('submit',event=>{event.preventDefault();generate({notify:true});if(innerWidth<761)mobileConfig(false);});
  $('random-button').addEventListener('click',()=>generate({random:true,notify:true}));$('seed-button').addEventListener('click',()=>generate({random:true}));
  for(const el of document.querySelectorAll('[data-cost]'))el.addEventListener('click',()=>{$('vessel-cost').value=money.format(Number(el.dataset.cost));generate();});
  for(const id of ['vessel-cost','vessel-seed'])$(id).addEventListener('input',()=>{clearTimeout(debounceTimer);inputError('');fitBudgetInput();$('generate-text').textContent='Generate new design';debounceTimer=setTimeout(()=>generate(),700);});
  $('vessel-cost').addEventListener('blur',()=>{try{$('vessel-cost').value=money.format(parseBrief().cost);fitBudgetInput();}catch{}});
  $('exterior-button').addEventListener('click',()=>setView('exterior'));$('bridge-button').addEventListener('click',()=>setView('bridge'));
  $('wireframe-button').addEventListener('click',()=>setWireframe(!state.wireframe));$('dimensions-button').addEventListener('click',()=>{state.dimensions=!state.dimensions;updateDimensionVisibility();});$('reset-button').addEventListener('click',()=>resetCamera());
  $('fullscreen-button').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(viewport.requestFullscreen)await viewport.requestFullscreen();else toast('Full-screen viewing is not available in this browser.');}catch{toast('Full-screen viewing was not allowed by the browser.');}});
  document.addEventListener('fullscreenchange',()=>{$('fullscreen-button').classList.toggle('active',Boolean(document.fullscreenElement));resize();});
  $('lighting-button').addEventListener('click',()=>toggleMenu('environment-panel','lighting-button'));
  $('autorotate-toggle').addEventListener('click',()=>{state.autoRotate=!state.autoRotate;controls.autoRotate=state.autoRotate&&state.mode==='exterior';$('autorotate-toggle').setAttribute('aria-checked',String(state.autoRotate));});
  $('roof-toggle').addEventListener('click',()=>{if(vessel?.dna.tier===0){toast('This open skiff has no bridge roof.');return;}setRoof(!state.roofOpen);});
  $('fishing-rig').addEventListener('click',()=>setRig(!state.rig));
  $('sea-toggle').addEventListener('click',()=>{state.sea=!state.sea;$('sea-toggle').setAttribute('aria-checked',String(state.sea));applyEnvironment();if(!state.sea&&state.mode==='bridge')toast('The sea remains visible through the bridge windows.');});
  $('time-slider').addEventListener('input',event=>{state.time=Number(event.target.value)/100;applyEnvironment();});$('weather-slider').addEventListener('input',event=>{state.weather=Number(event.target.value)/100;applyEnvironment();});
  $('save-button').addEventListener('click',saveVessel);$('fleet-nav').addEventListener('click',()=>{renderFleet();$('fleet-dialog').showModal();});$('studio-nav').addEventListener('click',()=>{$('fleet-dialog').close();$('help-dialog').close();mobileConfig(false);});
  $('help-button').addEventListener('click',()=>$('help-dialog').showModal());document.querySelectorAll('[data-close]').forEach(el=>el.addEventListener('click',()=>$(el.dataset.close).close()));
  for(const dialog of document.querySelectorAll('dialog')){dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});dialog.addEventListener('close',()=>state.keys.clear());}
  $('mobile-config').addEventListener('click',()=>mobileConfig(!$('sidebar').classList.contains('open')));$('config-backdrop').addEventListener('click',()=>mobileConfig(false));
  $('export-button').addEventListener('click',()=>toggleMenu('export-menu','export-button'));
  for(const [id,action] of [['export-glb',exportModel],['export-image',exportImage],['export-recipe',exportRecipe]])$(id).addEventListener('click',()=>{$('export-menu').classList.add('hidden');$('export-button').setAttribute('aria-expanded','false');action();});
  document.addEventListener('pointerdown',event=>{if(!event.target.closest('.export-wrap')){$('export-menu').classList.add('hidden');$('export-button').setAttribute('aria-expanded','false');}if(!event.target.closest('#environment-panel')&&!event.target.closest('#lighting-button')){$('environment-panel').classList.add('hidden');$('lighting-button').classList.remove('open');$('lighting-button').setAttribute('aria-expanded','false');}});
  const canvas=renderer.domElement;
  canvas.addEventListener('pointerdown',event=>{canvas.focus({preventScroll:true});if(state.mode!=='bridge'||!event.isPrimary||event.button!==0)return;state.drag={x:event.clientX,y:event.clientY,moved:0,id:event.pointerId};canvas.setPointerCapture(event.pointerId);canvas.style.cursor='grabbing';});
  canvas.addEventListener('pointermove',event=>{if(state.mode!=='bridge'||!state.drag||event.pointerId!==state.drag.id)return;const dx=event.clientX-state.drag.x,dy=event.clientY-state.drag.y;state.drag.moved+=Math.abs(dx)+Math.abs(dy);state.yaw-=dx*.004;state.pitch=clamp(state.pitch-dy*.0035,-1.05,.80);state.drag.x=event.clientX;state.drag.y=event.clientY;});
  canvas.addEventListener('pointerup',event=>{if(state.mode==='bridge'&&state.drag?.moved<5)inspectClick(event);state.drag=null;if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);canvas.style.cursor='grab';});
  canvas.addEventListener('pointercancel',()=>{state.drag=null;canvas.style.cursor='grab';});
  canvas.addEventListener('wheel',event=>{if(state.mode!=='bridge')return;event.preventDefault();camera.fov=clamp(camera.fov+event.deltaY*.025,43,84);camera.updateProjectionMatrix();},{passive:false});
  document.addEventListener('keydown',event=>{
    if(document.querySelector('dialog[open]')||event.target.matches('input,textarea,[contenteditable="true"]'))return;
    const key=event.key.toLowerCase();
    if(state.mode==='bridge'&&['w','a','s','d','shift','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){event.preventDefault();state.keys.add(key);return;}
    if(event.repeat||event.ctrlKey||event.metaKey||event.altKey)return;
    if(key==='n'){event.preventDefault();generate({random:true});}else if(key==='b'){event.preventDefault();setView(state.mode==='bridge'?'exterior':'bridge');}else if(key==='r'){event.preventDefault();resetCamera();}else if(key==='d'){state.dimensions=!state.dimensions;updateDimensionVisibility();}else if(key==='escape'){mobileConfig(false);if(state.mode==='bridge')setView('exterior');}else if(key==='?'||key==='h')$('help-dialog').showModal();
  });
  document.addEventListener('keyup',event=>state.keys.delete(event.key.toLowerCase()));window.addEventListener('blur',()=>{state.keys.clear();state.drag=null;});
  syncFleetState();
}
