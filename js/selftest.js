/* KEEL / Validation and self-tests: DNA checks, geometry checks and runSelfTests(). */
import { VesselDNA } from './dna.js';
import { disposeVessel } from './geometry.js';
import { VesselBuilder } from './builder.js';

export function validateDNA(){
  const costs=[100,9999,10000,499999,500000,14999999,15000000,249999999,250000000,1e9,1e12];
  for(const cost of costs)for(const seed of [0,42819,4294967295]){const d=new VesselDNA(cost,seed);if(![d.L,d.B,d.D,d.F,d.speed,d.displacement].every(Number.isFinite)||d.L<=d.B||d.B<=d.D)throw new Error('Vessel parameter validation failed.');const again=new VesselDNA(cost,seed);if(d.id!==again.id||d.L!==again.L)throw new Error('Deterministic generation validation failed.');}
  if(new VesselDNA(5000000,42819).id===new VesselDNA(5000001,42819).id)throw new Error('Cost sensitivity validation failed.');
  return {parameterCases:costs.length*3,deterministic:true,costSensitive:true};
}

export function validateGeometry(model){
  let meshes=0,vertices=0,instances=0;
  model.root.traverse(o=>{
    if(!o.isMesh)return;meshes++;const position=o.geometry.getAttribute('position');vertices+=position.count;
    for(let i=0;i<position.array.length;i++)if(!Number.isFinite(position.array[i]))throw new Error(`Non-finite geometry in ${o.name||'vessel component'}.`);
    if(o.isInstancedMesh){instances+=o.count;for(const value of o.instanceMatrix.array)if(!Number.isFinite(value))throw new Error('Invalid instance transform.');}
  });
  const h=model.helm;if(!h||h.start.x<h.minX||h.start.x>h.maxX||h.start.z<h.minZ||h.start.z>h.maxZ)throw new Error('The helm camera is outside the navigable interior.');
  if(model.dna.tier>0&&!model.layoutFits)throw new Error('Invalid superstructure-to-hull fit.');
  if(!model.tourViews?.length)throw new Error('No walkable interior was generated.');
  for(const view of model.tourViews){
    if(!view.group||!view.eye)throw new Error('Malformed interior viewpoint.');
    if(view.eye.x<view.minX||view.eye.x>view.maxX||view.eye.z<view.minZ||view.eye.z>view.maxZ)throw new Error(`The ${view.name} viewpoint sits outside its room.`);
  }
  if(!model.parts?.length)throw new Error('The parts registry was not generated.');
  return {meshes,vertices,instances,finite:true,interiorBounds:true,layoutFits:true,rooms:model.tourViews.length,parts:model.parts.length};
}
export async function runSelfTests(){
  const result={parameters:validateDNA(),geometry:[]};
  for(const cost of [100,1000,10000,250000,500000,5000000,15000000,80000000,250000000,1000000000,1000000000000]){
    let model;try{model=new VesselBuilder(new VesselDNA(cost,42819));model.build();result.geometry.push({cost,tier:model.dna.tier,...validateGeometry(model)});}finally{disposeVessel(model);}
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  console.table(result.geometry);return result;
}
