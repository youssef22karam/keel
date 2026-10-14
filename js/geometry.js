/* KEEL / Geometry helpers: part wrappers, hull sculpting, deck planning, static batching and disposal. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TAU, V, clamp, lerp } from './utils.js';

export class Parts {
  constructor(root){this.root=root;}
  mesh(geo,mat,pos=[0,0,0],rot=null,parent=this.root){
    const m=new THREE.Mesh(geo,mat);m.position.set(...pos);if(rot)m.rotation.set(...rot);m.castShadow=!mat.transparent;m.receiveShadow=true;parent.add(m);return m;
  }
  box(w,h,d,x,y,z,mat,parent=this.root,rot=null){return this.mesh(new THREE.BoxGeometry(w,h,d),mat,[x,y,z],rot,parent);}
  cylinder(rt,rb,h,x,y,z,mat,parent=this.root,rot=null,segments=16){return this.mesh(new THREE.CylinderGeometry(rt,rb,h,segments),mat,[x,y,z],rot,parent);}
  sphere(rx,ry,rz,x,y,z,mat,parent=this.root){const m=this.mesh(new THREE.SphereGeometry(1,20,12),mat,[x,y,z],null,parent);m.scale.set(rx,ry,rz);return m;}
  torus(radius,tube,x,y,z,mat,parent=this.root,rot=null,arc=TAU){return this.mesh(new THREE.TorusGeometry(radius,tube,8,32,arc),mat,[x,y,z],rot,parent);}
  rod(a,b,r,mat,parent=this.root){a=Array.isArray(a)?V(...a):a;b=Array.isArray(b)?V(...b):b;const delta=b.clone().sub(a),m=this.mesh(new THREE.CylinderGeometry(r,r,delta.length(),8),mat,a.clone().add(b).multiplyScalar(.5).toArray(),null,parent);m.quaternion.setFromUnitVectors(V(0,1,0),delta.normalize());return m;}
  pipe(points,r,mat,parent=this.root,closed=false,segments=null){const curve=new THREE.CatmullRomCurve3(points.map(p=>Array.isArray(p)?V(...p):p),closed,'centripetal');return this.mesh(new THREE.TubeGeometry(curve,segments||Math.max(16,points.length*3),r,6,closed),mat,[0,0,0],null,parent);}
  quad(a,b,c,d,mat,parent=this.root){
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([...a,...b,...c,...d],3));geo.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));geo.setIndex([0,1,2,0,2,3]);geo.computeVertexNormals();return this.mesh(geo,mat,[0,0,0],null,parent);
  }
  slab(points,y,thickness,mat,parent=this.root,bevel=0){
    const shape=new THREE.Shape(points.map(p=>new THREE.Vector2(p[0],-p[1])));
    return this.mesh(new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:bevel>0,bevelSegments:1,steps:1,bevelSize:bevel,bevelThickness:bevel}),mat,[0,y,0],[-Math.PI/2,0,0],parent);
  }
  footprint(w,d,cut=.12){return [[-w*.5,-d*(.5-cut) ],[-w*(.5-cut),-d*.5],[w*(.5-cut),-d*.5],[w*.5,-d*(.5-cut)],[w*.5,d*(.5-cut)],[w*(.5-cut),d*.5],[-w*(.5-cut),d*.5],[-w*.5,d*(.5-cut)]];}
}

export class HullSculptor {
  constructor(dna,overrides={}){
    Object.assign(this,{L:dna.L,B:dna.B,D:dna.D,F:dna.F,bowRise:dna.bowRise,fullness:dna.fullness,sternWidth:dna.sternWidth,bowRake:dna.bowRake,sternRake:dna.sternRake,flare:dna.flare,bilge:dna.bilge,shoulder:dna.shoulder,entrance:dna.entrance,maxBeamAt:dna.maxBeamAt},overrides);
    const stations=[[0,this.sternWidth,.08],[.10,.94,.025],[this.maxBeamAt,1,0],[.49,.99,0],[this.shoulder,.85,.06],[this.entrance,.56,.32],[.95,.25,.70],[1,.002,1]];
    this.outline=new THREE.CatmullRomCurve3(stations.map(([t,w,s])=>V(this.B*.5*Math.pow(w,this.fullness),this.F+s*this.bowRise,(t-.5)*this.L)),false,'centripetal');
    this.sections=[];for(let i=0;i<=96;i++){const t=i/96,p=this.outline.getPoint(t);this.sections.push({t,z:p.z,width:p.x,sheer:p.y,bottom:-this.D+this.D*(.19*Math.pow(1-t,7)+.55*Math.pow(t,8))});}
    this.bulwark=Math.min(.46,this.F*.26);this.angular=dna.tier===4;
  }
  measure(z){
    z=clamp(z,-this.L*.5,this.L*.5);let a=0,b=this.sections.length-1;
    while(b-a>1){const m=(a+b)>>1;if(this.sections[m].z<z)a=m;else b=m;}
    const s=this.sections[a],e=this.sections[b],u=clamp((z-s.z)/(e.z-s.z||1),0,1);
    return {z,width:lerp(s.width,e.width,u),sheer:lerp(s.sheer,e.sheer,u),bottom:lerp(s.bottom,e.bottom,u)};
  }
  deckHeight(z){return this.measure(z).sheer-this.bulwark;}
  point(s,theta,inset=0){
    const q=Math.pow(1-Math.cos(theta),this.bilge);
    return [Math.sin(theta)*Math.max(.001,s.width-inset)*(1-this.flare*(1-q)),lerp(s.bottom+inset,s.sheer,q),s.z+this.sternRake*this.D*(1-q)*Math.pow(1-s.t,9)-this.bowRake*this.D*(1-q)*Math.pow(s.t,9)];
  }
  shell(parts,mat,parent,inset=0){
    const pos=[],uv=[],indices=[],n=this.angular?14:40;
    for(let i=0;i<this.sections.length;i++){const s=this.sections[i];for(let j=0;j<=n;j++){pos.push(...this.point(s,-Math.PI/2+Math.PI*j/n,inset));uv.push(i/(this.sections.length-1),j/n);}}
    for(let i=0;i<this.sections.length-1;i++)for(let j=0;j<n;j++){const a=i*(n+1)+j,b=a+n+1;indices.push(a,a+1,b,a+1,b+1,b);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();parts.mesh(g,mat,[0,0,0],null,parent);
    for(const end of [0,this.sections.length-1]){
      const s=this.sections[end],ring=[];for(let j=0;j<=n;j++)ring.push(this.point(s,-Math.PI/2+Math.PI*j/n,inset));
      const center=ring.reduce((v,a)=>v.add(V(...a)),V()).multiplyScalar(1/ring.length).toArray(),capPos=[],capUv=[];
      for(let j=0;j<ring.length;j++){const a=ring[j],b=ring[(j+1)%ring.length];capPos.push(...center,...(end===0?b:a),...(end===0?a:b));capUv.push(.5,.5,0,j/n,1,(j+1)/n);}
      const cap=new THREE.BufferGeometry();cap.setAttribute('position',new THREE.Float32BufferAttribute(capPos,3));cap.setAttribute('uv',new THREE.Float32BufferAttribute(capUv,2));cap.computeVertexNormals();parts.mesh(cap,mat,[0,0,0],null,parent);
    }
  }
  deck(parts,mat,parent){
    const p=[],uv=[],idx=[];
    this.sections.forEach((s,i)=>{const y=s.sheer-this.bulwark;p.push(-s.width*.975,y,s.z,0,y+.035,s.z,s.width*.975,y,s.z);uv.push(0,i/12,.5,i/12,1,i/12);});
    for(let i=0;i<this.sections.length-1;i++)for(let k=0;k<2;k++){const a=i*3+k,b=a+3;idx.push(a,b,a+1,a+1,b,b+1);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();parts.mesh(g,mat,[0,0,0],null,parent);
  }
}

export class DeckPlanner {
  constructor(hull){this.hull=hull;this.reserved=[];}
  reserve(id,x,z,w,d,gap=.2){this.reserved.push({id,x,z,w:w+gap*2,d:d+gap*2});return {x,z};}
  fits(x,z,w,d){
    const margin=Math.min(.4,this.hull.B*.035);
    if(Math.abs(z)+d/2>this.hull.L*.46)return false;
    for(const dz of [-d/2,0,d/2])if(Math.abs(x)+w/2+margin>this.hull.measure(z+dz).width)return false;
    return !this.reserved.some(a=>Math.abs(x-a.x)<(w+a.w)/2&&Math.abs(z-a.z)<(d+a.d)/2);
  }
  place(id,w,d,candidates){for(const [x,z] of candidates)if(this.fits(x,z,w,d))return this.reserve(id,x,z,w,d);return null;}
}

// Bake static assemblies by material while retaining animated and inspectable parts.
export function batchStatics(root){
  root.updateMatrixWorld(true);const rootInverse=root.matrixWorld.clone().invert(),buckets=new Map(),remove=[],oldGeometries=new Set();
  root.traverse(obj=>{
    if(!obj.isMesh||obj.isInstancedMesh)return;
    for(let p=obj;p&&p!==root;p=p.parent)if(p.userData.unbatched)return;
    if(Array.isArray(obj.material))return;
    let g=obj.geometry.clone();if(g.index){const n=g.toNonIndexed();g.dispose();g=n;}
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(rootInverse,obj.matrixWorld));
    for(const key of Object.keys(g.attributes))if(!['position','normal','uv'].includes(key))g.deleteAttribute(key);
    if(!g.attributes.uv)g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
    if(!g.attributes.normal)g.computeVertexNormals();
    const key=`${obj.material.uuid}:${obj.castShadow}:${obj.receiveShadow}`;
    if(!buckets.has(key))buckets.set(key,{material:obj.material,cast:obj.castShadow,receive:obj.receiveShadow,geometries:[]});
    buckets.get(key).geometries.push(g);remove.push(obj);oldGeometries.add(obj.geometry);
  });
  for(const obj of remove)obj.removeFromParent();for(const g of oldGeometries)g.dispose();
  for(const b of buckets.values()){
    const geo=mergeGeometries(b.geometries,false);for(const g of b.geometries)g.dispose();
    if(!geo)throw new Error('Static geometry batching failed.');
    const mesh=new THREE.Mesh(geo,b.material);mesh.name=b.material.name;mesh.castShadow=b.cast;mesh.receiveShadow=b.receive;root.add(mesh);
  }
}
export function disposeVessel(vessel){
  if(!vessel)return;const geometries=new Set(),materials=new Set(vessel.materials?.all||[]),textures=new Set(vessel.materials?.textures||[]);
  vessel.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));if(o.isInstancedMesh)o.dispose();});
  materials.forEach(m=>{for(const value of Object.values(m))if(value?.isTexture)textures.add(value);m.dispose();});
  geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());vessel.root.removeFromParent();
}
