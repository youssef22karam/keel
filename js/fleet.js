/* KEEL / My fleet: localStorage persistence, saving vessels and the fleet dialog. */
import { $, money } from './utils.js';
import { toast } from './stage.js';
import { generate, vessel } from './generate.js';

let fleet=[];
try{const saved=JSON.parse(localStorage.getItem('keel-fleet-v1')||'[]');if(Array.isArray(saved))fleet=saved.filter(v=>Number.isFinite(v.cost)&&v.cost>=100&&v.cost<=Number.MAX_SAFE_INTEGER&&Number.isInteger(v.seed)&&v.seed>=0&&v.seed<=4294967295).slice(0,24);}catch{}

export function syncFleetState(){
  $('fleet-count').textContent=String(fleet.length).padStart(2,'0');const saved=vessel&&fleet.some(f=>f.cost===vessel.dna.cost&&f.seed===vessel.dna.seed);$('save-button').classList.toggle('saved',Boolean(saved));$('save-button').setAttribute('aria-pressed',String(Boolean(saved)));$('save-button').setAttribute('aria-label',saved?'Remove vessel from My fleet':'Save vessel to My fleet');
}
function persistFleet(){try{localStorage.setItem('keel-fleet-v1',JSON.stringify(fleet));return true;}catch{toast('Browser storage is unavailable. Export a blueprint to keep this design.');return false;}}
export function saveVessel(){
  if(!vessel)return;const d=vessel.dna,index=fleet.findIndex(v=>v.cost===d.cost&&v.seed===d.seed);
  if(index>=0){const [removed]=fleet.splice(index,1);if(!persistFleet()){fleet.splice(index,0,removed);syncFleetState();return;}syncFleetState();toast('Vessel removed from your fleet.');return;}
  if(fleet.length>=24){toast('Your fleet has 24 vessels. Remove one to make room.');return;}
  const item={name:d.name,cost:d.cost,seed:d.seed,color:d.palette.hull,type:d.type};fleet.unshift(item);if(!persistFleet())fleet.shift();else toast(`${d.name} saved to your fleet.`);syncFleetState();
}
export function renderFleet(){
  const list=$('fleet-list');list.replaceChildren();
  if(!fleet.length){const empty=document.createElement('div');empty.className='fleet-empty';empty.textContent='Your next favorite is out there. Use the bookmark beside a vessel name to keep it here.';list.append(empty);return;}
  fleet.forEach((item,index)=>{
    const row=document.createElement('div');row.className='fleet-item';const swatch=document.createElement('span');swatch.className='fleet-swatch';swatch.style.background=/^#[0-9a-f]{6}$/i.test(item.color)?item.color:'#51715a';
    const load=document.createElement('button');load.className='load-vessel';const name=document.createElement('strong');name.textContent=item.name||'Saved vessel';const small=document.createElement('small');small.textContent=`$${money.format(item.cost)} / SEED ${item.seed}`;load.append(name,small);
    load.addEventListener('click',()=>{$('vessel-cost').value=money.format(item.cost);$('vessel-seed').value=String(item.seed);$('fleet-dialog').close();generate({notify:true});});
    const remove=document.createElement('button');remove.className='delete-vessel';remove.setAttribute('aria-label',`Remove ${item.name||'vessel'} from fleet`);remove.innerHTML='<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.4"><use href="#i-trash"/></svg>';
    remove.addEventListener('click',()=>{const [removed]=fleet.splice(index,1);if(!persistFleet())fleet.splice(index,0,removed);syncFleetState();renderFleet();});row.append(swatch,load,remove);list.append(row);
  });
}
