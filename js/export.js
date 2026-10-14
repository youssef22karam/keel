/* KEEL / Export: GLB model, studio PNG and JSON blueprint downloads. */
import * as THREE from 'three';
import { $ } from './utils.js';
import { camera, renderer, scene, toast } from './stage.js';
import { vessel } from './generate.js';

function download(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function filename(ext,source=vessel){return `keel-${source.dna.name.toLowerCase().replace(/\s+/g,'-')}-${source.dna.id.toLowerCase()}.${ext}`;}
export async function exportModel(){
  if(!vessel)return;const source=vessel,temporaryGeometry=new Set(),temporaryMaterials=new Set();$('export-button').disabled=true;toast('Preparing your vessel as a full-size GLB model...');
  try{
    const { GLTFExporter }=await import('three/addons/exporters/GLTFExporter.js');
    const copy=source.root.clone(true);copy.scale.setScalar(1);copy.position.set(0,0,0);copy.rotation.set(0,0,0);
    // Expand GPU instances only for export. The live renderer keeps its efficient batches.
    const instances=[];copy.traverse(o=>{if(o.isInstancedMesh)instances.push(o);});
    for(const inst of instances){
      inst.updateMatrix();for(let i=0;i<inst.count;i++){
        const matrix=new THREE.Matrix4();inst.getMatrixAt(i,matrix);let material=inst.material;
        if(inst.instanceColor){material=material.clone();const color=new THREE.Color();inst.getColorAt(i,color);material.color.multiply(color);temporaryMaterials.add(material);}
        const mesh=new THREE.Mesh(inst.geometry,material);mesh.name=inst.name;mesh.matrix.multiplyMatrices(inst.matrix,matrix);mesh.matrixAutoUpdate=false;inst.parent.add(mesh);
      }inst.removeFromParent();
    }
    copy.traverse(o=>{
      if(!o.isMesh||o.material!==source.m.hull||source.dna.tier===0)return;
      const g=o.geometry.clone(),colors=[],pos=g.getAttribute('position'),d=source.dna,band=Math.max(.045,d.D*.11),anti=new THREE.Color(d.palette.bottom),boot=new THREE.Color(d.palette.body);
      for(let i=0;i<pos.count;i++){
        const y=pos.getY(i),waterline=THREE.MathUtils.smoothstep(y,-band*.1,band*.1),stripe=1-THREE.MathUtils.smoothstep(Math.abs(y-band*.65),band*.3,band*.43),color=anti.clone().lerp(source.m.hull.color,waterline).lerp(boot,stripe);colors.push(color.r,color.g,color.b);
      }
      g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));if(source.m.hull.flatShading)g.computeVertexNormals();const mat=source.m.hull.clone();mat.color.set('#ffffff');mat.vertexColors=true;mat.wireframe=false;o.geometry=g;o.material=mat;temporaryGeometry.add(g);temporaryMaterials.add(mat);
    });
    const file=await new GLTFExporter().parseAsync(copy,{binary:true,onlyVisible:false,maxTextureSize:1024});download(new Blob([file],{type:'model/gltf-binary'}),filename('glb',source));toast('Full-scale vessel exported. Units are meters.');
  }catch(error){console.error(error);toast('The model export failed. You can still export its blueprint.');}
  finally{temporaryGeometry.forEach(g=>g.dispose());temporaryMaterials.forEach(m=>m.dispose());$('export-button').disabled=false;}
}
export function exportRecipe(){
  if(!vessel)return;const d=vessel.dna,recipe={engine:'KEEL',version:1,cost:d.cost,seed:d.seed,fingerprint:d.id,name:d.name,tier:d.tier,type:d.type,dimensions:{lengthMeters:d.L,beamMeters:d.B,draftMeters:d.D,freeboardMeters:d.F,bowFlare:d.flare,sternRake:d.sternRake},estimates:{displacementTons:d.displacement,topSpeedKnots:d.speed,fishHoldTons:d.hold},material:d.material,livery:d.palette,equipment:[...vessel.equipment],parts:vessel.parts,partGenes:vessel.dna.parts,upgrades:vessel.dna.upgrades,bridgeTheme:vessel.dna.bridgeTheme,disclaimer:'Procedural concept visualization. Not a certified naval engineering design.'};
  download(new Blob([JSON.stringify(recipe,null,2)],{type:'application/json'}),filename('json'));toast('Blueprint exported. Recreate it using its cost and seed.');
}
export function exportImage(){
  if(!vessel)return;renderer.render(scene,camera);const name=filename('png');renderer.domElement.toBlob(blob=>{if(blob){download(blob,name);toast('Your current view has been saved.');}else toast('This browser could not capture the view.');},'image/png');
}
