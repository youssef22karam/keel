/* KEEL / Vessel generation: brief parsing, generate(), HUD updates and budget field helpers. */
import { $, money, number, reducedMotion } from './utils.js';
import { VesselDNA } from './dna.js';
import { disposeVessel } from './geometry.js';
import { VesselBuilder } from './builder.js';
import { state, viewport } from './state.js';
import { camera, contactShadow, fatal, grid, ground, renderer, scene, setView, toast } from './stage.js';
import { renderPartsList } from './parts.js';
import { applyRigState, buildDimensions, setRoof, setWireframe } from './viewtools.js';
import { syncFleetState } from './fleet.js';
import { debounceTimer } from './ui.js';
import { disposed } from './loop.js';
import { validateGeometry } from './selftest.js';

export let vessel=null,generation=0;

export function parseBrief(){
  const raw=$('vessel-cost').value.replace(/[$,\s]/g,'');const match=raw.match(/^(\d+(?:\.\d*)?|\.\d+)([kmbt])?$/i);
  if(!match)throw new Error('Enter a valid USD amount, such as 250,000 or 5M.');
  const suffix={k:1e3,m:1e6,b:1e9,t:1e12},cost=Number(match[1])*(suffix[match[2]?.toLowerCase()]||1);
  if(!Number.isFinite(cost)||cost<100||cost>Number.MAX_SAFE_INTEGER)throw new Error('Choose a budget between $100 and $9,007,199,254,740,991.');
  const rawSeed=$('vessel-seed').value.trim();if(!/^\d+$/.test(rawSeed))throw new Error('The design seed must be a whole number from 0 to 4,294,967,295.');
  const seed=Number(rawSeed);if(!Number.isInteger(seed)||seed>4294967295)throw new Error('The design seed must be between 0 and 4,294,967,295.');
  return {cost,seed};
}
export function inputError(message){$('input-error').textContent=message;$('input-error').classList.toggle('hidden',!message);const seedError=/seed/i.test(message);$('vessel-cost').setAttribute('aria-invalid',String(Boolean(message)&&!seedError));$('vessel-seed').setAttribute('aria-invalid',String(Boolean(message)&&seedError));}
function newSeed(){let seed;do{if(globalThis.crypto?.getRandomValues){const bytes=new Uint32Array(1);crypto.getRandomValues(bytes);seed=bytes[0];}else seed=Math.floor(Math.random()*4294967296);}while(seed===Number($('vessel-seed').value));$('vessel-seed').value=String(seed);return seed;}
export async function generate({random=false,notify=false}={}){
  clearTimeout(debounceTimer);if(random)newSeed();let brief;try{brief=parseBrief();inputError('');}catch(error){inputError(error.message);return false;}
  const ticket=++generation;viewport.setAttribute('aria-busy','true');$('busy-indicator').classList.remove('hidden');$('generate-text').textContent='Drawing your vessel...';$('generate-button').disabled=true;
  await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,18)));
  if(ticket!==generation||disposed)return false;
  let builder;const previous=vessel;
  try{
    // Upgrades belong to one exact brief; any change to cost or seed starts from factory parts.
    const briefKey=`${brief.cost}:${brief.seed}`;if(state.briefKey!==briefKey){state.upgrades={};state.briefKey=briefKey;}
    const start=performance.now(),dna=new VesselDNA(brief.cost,brief.seed,state.upgrades);builder=new VesselBuilder(dna);const next=builder.build();validateGeometry(next);
    if(ticket!==generation){disposeVessel(next);return false;}
    vessel=next;scene.add(next.root);if(previous)previous.root.visible=false;
    positionStage(dna);
    applyRigState();updateHUD();buildDimensions();setWireframe(state.wireframe);setRoof(state.roofOpen);state.exteriorPose=null;camera.up.set(0,1,0);
    setView(state.mode,true);renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);disposeVessel(previous);renderer.renderLists.dispose();
    $('engine-status').textContent='ENGINE READY';$('render-status').title=`Generated in ${Math.round(performance.now()-start)} ms. ${renderer.info.render.calls} draw calls.`;
    $('render-status').textContent=`${number.format(renderer.info.render.triangles/1000)}K FACES`;
    window.keelReady=true;clearTimeout(window.keelLoadingTimeout);$('loading').classList.add('ready');$('retry-button').classList.add('hidden');
    if(!reducedMotion)$('vessel-name').animate([{opacity:.3,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:400,easing:'ease-out'});
    if(notify)toast(random?'A new character. The same budget.':`${dna.name} is ready to explore.`);
    return true;
  }catch(error){
    if(builder)disposeVessel(builder);vessel=previous;console.error('Vessel generation failed:',error);
    if(previous){
      previous.root.visible=true;if(!previous.root.parent)scene.add(previous.root);
      $('vessel-cost').value=money.format(previous.dna.cost);$('vessel-seed').value=String(previous.dna.seed);
      positionStage(previous.dna);updateHUD();buildDimensions();setView(state.mode,true);toast('That design could not be assembled. Your previous vessel is safe.');
    }else fatal(error);
    return false;
  }
  finally{if(ticket===generation){viewport.setAttribute('aria-busy','false');$('busy-indicator').classList.add('hidden');$('generate-button').disabled=false;$('generate-text').textContent='Generate vessel';}}
}
function positionStage(dna){const y=-dna.D*dna.scale-.15;ground.position.y=y;grid.position.y=y+.015;contactShadow.position.set(0,y+.024,0);contactShadow.scale.set(dna.B*dna.scale*1.9,29.5,1);}
export function updateHUD(){
  const d=vessel.dna;fitBudgetInput();$('vessel-name').textContent=d.name;$('vessel-type').textContent=d.type;$('vessel-id').textContent=`K-${String(d.seed).padStart(6,'0')}`;$('tier-number').textContent=String(d.tier).padStart(2,'0');$('tier-name').textContent=d.info.name;$('tier-range').textContent=d.info.range;
  $('spec-length').textContent=`${number.format(d.L)} m`;$('spec-beam').textContent=`${number.format(d.B)} m`;$('spec-draft').textContent=`${number.format(d.D)} m`;$('spec-displacement').textContent=`${number.format(d.displacement)} t`;$('spec-speed').textContent=`${d.speed.toFixed(1)} kn`;$('spec-hold').textContent=`${number.format(d.hold)} t`;$('spec-material').textContent=d.material;
  document.querySelectorAll('.tier-scale i').forEach((el,i)=>{el.className=i===d.tier?'current':i<d.tier?'filled':'';});
  document.querySelectorAll('[data-cost]').forEach(el=>el.classList.toggle('active',Number(el.dataset.cost)===d.cost));
  $('equipment-list').replaceChildren(...[...vessel.equipment].map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));$('equipment-count').textContent=String(vessel.equipment.size).padStart(2,'0');
  renderPartsList();
  $('hull-label').textContent=d.tier===0?'CLINKER HULL / OILED TIMBER':d.tier===4?'TRIMARAN / CARBON COMPOSITE':`CUSTOM HULL / ${d.material.toUpperCase()}`;
  [...$('palette').children].forEach((el,i)=>el.style.background=[d.palette.hull,d.palette.body,d.palette.accent,d.palette.bottom][i]);$('palette').title=d.palette.name;
  $('dna-status').textContent=`DNA ${d.id}`;syncFleetState();
}

export function fitBudgetInput(){const n=$('vessel-cost').value.length;$('vessel-cost').style.fontSize=n>19?'14px':n>15?'17px':'22px';}
