/* KEEL / VesselBuilder core: constructor, part registry, arrangement solver, build() pipeline, hull-level pieces and superstructure. */
import * as THREE from 'three';
import { V, clamp, lerp } from './utils.js';
import { PART_INFO, describePart } from './dna.js';
import { MaterialFactory } from './materials.js';
import { DeckPlanner, HullSculptor, Parts, batchStatics } from './geometry.js';

export class VesselBuilder {
  constructor(dna){
    this.dna=dna;this.root=new THREE.Group();this.root.name=`KEEL ${dna.name} ${dna.id}`;
    this.materials=new MaterialFactory(dna);this.m=this.materials;this.p=new Parts(this.root);
    this.r=dna.stream('outfitting');this.equipment=new Set();this.animators=[];this.hitTargets=[];this.roofs=[];
    this.hull=new HullSculptor(dna,dna.tier===4?{B:dna.B*.48}:{});
    this.planner=new DeckPlanner(this.hull);this.radarRange=6;this.steering=0;
    this.tourViews=[];this.tourCabinViews=[];this.rigGroup=null;this.rigScaleTarget=1;this.parts=[];
    // Bridge window language varies by DNA, not just tier, so no two wheelhouses read alike.
    this.windowStyle=dna.stream('windowstyle').pick(['rectangular','rectangular','arched']);
    this.solveArrangement();
  }
  // Every fitted assembly is logged as an upgrade-ready part with a DNA-derived series ID.
  part(category,detail,kind=null){
    const up=kind?this.dna.upgrades[kind]:null;
    const r=this.dna.stream('part:'+category+':'+(up?up.seed:0));
    const series=String.fromCharCode(65+r.int(0,25))+String.fromCharCode(65+r.int(0,25));
    const mark=kind?this.dna.parts[kind].mark:r.int(1,12),code=((this.dna.hash^r.int(0,65535))&0xfff).toString(16).toUpperCase().padStart(3,'0');
    this.parts.push({category,detail,kind,mark,id:`${series}-${mark}${code}`});
  }
  registerParts(){
    const d=this.dna,reserved=new Set(this.planner.reserved.map(a=>a.id)),P=d.parts;
    this.part('Hull form',`${d.L.toFixed(1)} m / ${d.material}`);
    this.part('Keel & skeg','faired displacement line');
    if(d.tier===0){this.part('Rowing rig','bronze oarlocks, feathering oars');this.part('Timber frames','steam-bent ribs');if(d.cost>4200)this.part('Outboard engine','tiller steered');return;}
    // Upgradeable, procedurally re-designable parts first.
    this.part(PART_INFO.bridge.label,`${describePart('bridge',P.bridge)}, ${d.bridgeTheme} interior`,'bridge');
    this.part(PART_INFO.wheel.label,describePart('wheel',P.wheel),'wheel');
    this.part(PART_INFO.radar.label,describePart('radar',P.radar),'radar');
    this.part(PART_INFO.light.label,describePart('light',P.light),'light');
    if(d.tier>=2)this.part(PART_INFO.exhaust.label,describePart('exhaust',P.exhaust),'exhaust');
    if(d.tier>=2&&d.tier<4)this.part(PART_INFO.propeller.label,describePart('propeller',P.propeller),'propeller');
    if(this.rigNodes?.length)this.part(PART_INFO.outrigger.label,describePart('outrigger',P.outrigger),'outrigger');
    this.part('Helm console','triple glass bridge displays');
    if(d.tier===1)this.part('Outboard propulsion',d.cost>70000?'twin engines':'single engine');
    else if(d.tier<4)this.part('Propulsion train','twin screws, bulbous bow');
    else this.part('Plasma nacelles','paired stern drives');
    if(reserved.has('anchor windlass'))this.part('Anchor windlass','chain and davit set');
    if(reserved.has('deck crane'))this.part('Deck crane','articulated, swinging hook');
    if(reserved.has('net drum'))this.part('Net drum','powered trawl winch');
    if(reserved.has('net gantry'))this.part('Stern gantry','A-frame with ramp');
    if(reserved.has('longline derrick'))this.part('Line derrick','hauling block and boom');
    if(reserved.has('fish hold hatch'))this.part('Hold hatch','refrigerated access');
    if(this.doors?.length)this.part('Bridge access','sliding wing doors and aft door');
    if(d.levels)this.part('Engine casing','louvred pedestal with bridge-wing stair');
    if(d.tier>=3){this.part('Helipad','stern platform');this.part('Tender davits','enclosed rescue boats');this.part('Satellite domes','dual comm radomes');}
    if(d.tier===4){this.part('Drone pods','four autonomous harvesters');this.part('Sonar hologram','volumetric projector');this.part('Hydrofoils','active submerged wings');this.part('Containment wells','bioluminescent holds');}
    this.part('Safety suite','rings, rafts, floodlights');
  }
  solveArrangement(){
    const d=this.dna;if(d.tier===0)return;
    const factor=d.levels?1.18:1,length=d.bridgeL*(d.levels?1.2:1),margin=Math.min(.30,this.hull.B*.045);
    const desiredWidth=Math.min(d.bridgeW*factor,this.hull.B-margin*2),targetZ=d.forward?d.L*.02:-d.L*.04;
    // Solve against the actual sheer footprint, preserving side access instead of intersecting the bow.
    const fits=(width,z)=>{
      const polygon=this.p.footprint(width,length,.09);
      return polygon.every((a,i)=>{
        const b=polygon[(i+1)%polygon.length];
        for(let k=0;k<=3;k++){const x=lerp(a[0],b[0],k/3),zz=z+lerp(a[1],b[1],k/3);if(Math.abs(zz)>d.L*.47||Math.abs(x)+margin>this.hull.measure(zz).width)return false;}
        return true;
      });
    };
    for(const reduction of [1,.96,.91,.86,.80])for(let i=0;i<=10;i++){
      const z=lerp(d.bridgeZ,targetZ,i/10),width=desiredWidth*reduction;
      if(!fits(width,z))continue;
      this.houseW=width;this.houseL=length;d.bridgeW=Math.min(d.bridgeW,width/factor);d.bridgeZ=z;this.layoutFits=true;return;
    }
    throw new Error('No coherent superstructure footprint could be solved for this brief.');
  }
  build(){
    const d=this.dna,m=this.m,p=this.p;
    this.hull.shell(p,d.tier===0?m.wood:m.hull,this.root);
    if(d.tier===0)this.skiff();
    else {
      this.hull.deck(p,d.tier===1?m.wood:m.deck,this.root);
      if(d.tier===4)this.multihull();
      this.rails(this.hull);
      this.superstructure();
      this.propulsion();
      this.deckEquipment();
      this.safety();
      this.identity();
      this.liveryAccents();
    }
    this.registerParts();
    this.root.updateMatrixWorld(true);
    const movingAssemblies=[];this.root.traverse(o=>{if(o.isGroup&&o.userData.unbatched)movingAssemblies.push(o);});
    for(const assembly of movingAssemblies.reverse())batchStatics(assembly);
    batchStatics(this.root);
    this.root.userData={cost:d.cost,seed:d.seed,dna:d.id,tier:d.tier,name:d.name,engine:'KEEL 1.0',conceptOnly:true};
    this.root.scale.setScalar(d.scale);this.root.updateMatrixWorld(true);
    this.bounds=new THREE.Box3().setFromObject(this.root);
    const size=this.bounds.getSize(V());
    if(!Number.isFinite(size.length())||size.length()===0)throw new Error('Invalid vessel geometry.');
    this.drawDisplays(0);
    return this;
  }
  rails(hull,parent=this.root){
    const p=this.p,d=this.dna,m=this.m,h=clamp(.88+d.L*.002,.9,1.5),rad=clamp(.026+d.L*.00012,.026,.065);
    const n=clamp(Math.ceil(hull.L/1.65),12,96),posts=[];
    for(const side of [-1,1]){
      const top=[],lower=[],gunwale=[];
      for(let i=0;i<=n;i++){
        const z=lerp(-hull.L*.482,hull.L*.493,i/n),s=hull.measure(z),x=side*s.width*.987;
        top.push([x,s.sheer+h,z]);lower.push([x,s.sheer+h*.47,z]);gunwale.push([x,s.sheer+.022,z]);
        if(i<n)posts.push({x,y:s.sheer+h*.5,z});
      }
      p.pipe(top,rad,m.rail,parent);p.pipe(lower,rad*.69,m.rail,parent);p.pipe(gunwale,rad*1.85,d.tier===4?m.glow:m.dark,parent);
    }
    const geometry=new THREE.CylinderGeometry(1,1,1,7),mesh=new THREE.InstancedMesh(geometry,m.rail,posts.length),o=new THREE.Object3D();
    posts.forEach((q,i)=>{o.position.set(q.x,q.y,q.z);o.scale.set(rad,h,rad);o.updateMatrix();mesh.setMatrixAt(i,o.matrix);});
    mesh.castShadow=true;mesh.receiveShadow=true;mesh.instanceMatrix.needsUpdate=true;parent.add(mesh);
  }
  skiff(){
    const d=this.dna,p=this.p,m=this.m,h=this.hull;
    h.shell(p,m.innerWood,this.root,.045);
    const floor=[];
    for(let i=0;i<=18;i++){const z=lerp(-d.L*.40,d.L*.41,i/18);floor.push([-h.measure(z).width*.64,z]);}
    for(let i=18;i>=0;i--){const z=lerp(-d.L*.40,d.L*.41,i/18);floor.push([h.measure(z).width*.64,z]);}
    p.slab(floor,d.F*.05,.055,m.wood);
    for(const side of [-1,1]){
      for(let j=1;j<=6;j++){
        const theta=side*(.44+j*.155),line=h.sections.filter((_,i)=>i%3===0).map(s=>h.point(s,theta,-.006));
        p.pipe(line,.006,m.innerWood);
      }
      p.pipe(h.sections.filter((_,i)=>i%3===0).map(s=>[side*s.width,s.sheer+.018,s.z]),.035,m.hull);
    }
    const count=d.L>5?3:2;
    for(let i=0;i<count;i++){
      const z=lerp(-d.L*.25,d.L*.22,count===1?.5:i/(count-1)),w=h.measure(z).width*1.70;
      p.box(w,.075,d.L*.065,0,d.F*.70,z,m.wood);
      for(const side of [-1,1])p.box(.065,d.F*.6,.09,side*w*.38,d.F*.36,z,m.innerWood);
    }
    for(let i=0;i<8;i++){
      const z=lerp(-d.L*.35,d.L*.34,i/7),s=h.measure(z),points=[];
      for(let j=0;j<=18;j++){const a=-1.4+2.8*j/18;points.push([Math.sin(a)*s.width*.92,lerp(s.bottom+.06,s.sheer-.03,Math.pow(1-Math.cos(a),d.bilge)),z]);}
      p.pipe(points,.022,m.innerWood);
    }
    for(const side of [-1,1]){
      // Pivot sits on the oarlock; the loom runs outboard, the grip inboard.
      const oz=d.L*.06,pivot=new THREE.Group();pivot.name='Rowing oar';pivot.userData.unbatched=true;
      pivot.position.set(side*d.B*.46,d.F+.13,oz);pivot.rotation.z=side*-.14;this.root.add(pivot);
      p.torus(.055,.013,0,-.02,0,m.bronze,pivot,[Math.PI/2,0,0]);
      p.box(d.L*.27,.034,.05,side*d.L*.145,0,0,m.wood,pivot);
      p.box(d.L*.07,.012,.15,side*d.L*.305,0,0,m.wood,pivot);
      p.box(d.L*.075,.042,.046,-side*d.L*.048,0,0,m.innerWood,pivot);
      this.animators.push({object:pivot,kind:'oar',dir:side});
    }
    this.ropeCoil(d.B*.16,d.F*.1+.07,d.L*.26,d.B*.14);
    p.cylinder(.075,.075,.11,-d.B*.19,d.F*.78,-d.L*.24,m.rope);
    p.box(.33,.24,.42,d.B*.19,d.F*.17,-d.L*.20,m.crate);
    if(d.cost>4200){this.outboard(0,-d.L*.49,.58);this.equipment.add('Single tiller outboard');}else this.equipment.add('Hand-carved rowing oars');
    this.equipment.add('Clinker planking and bent frames');this.equipment.add('Timber rowing benches');this.equipment.add('Handline and mooring rope');
    this.helm={group:this.root,start:V(0,d.F*.65+1.02,-d.L*.19),minX:-d.B*.22,maxX:d.B*.22,minZ:-d.L*.30,maxZ:d.L*.20,unit:1,open:true};
    this.tourViews=[{name:'Cockpit',group:this.root,eye:this.helm.start.clone(),minX:this.helm.minX,maxX:this.helm.maxX,minZ:this.helm.minZ,maxZ:this.helm.maxZ,fixedY:null,unit:1,title:'THE OPEN COCKPIT',hint:'Drag to look. WASD to step along the planks.'}];
    this.identity();
  }
  identity(){
    const d=this.dna,p=this.p,h=this.hull,m=this.m;
    const material=m.label(d.name.toUpperCase(),d.tier===0?'#eee4ce':d.palette.body);
    const width=d.L*(d.tier===0?.24:.22),height=width*.11,zc=d.L*.205,yc=d.F*.69;
    for(const side of [-1,1]){
      const positions=[],uv=[],idx=[],n=28;
      for(let i=0;i<=n;i++)for(let j=0;j<2;j++){
        const z=zc+(i/n-.5)*width*side,y=yc+(j-.5)*height,s=h.measure(z),q=clamp((y-s.bottom)/(s.sheer-s.bottom),.01,.99),theta=Math.acos(1-Math.pow(q,1/h.bilge));
        const x=(Math.sin(theta)*s.width*(1-h.flare*(1-q))+.012)*side;
        positions.push(x,y,z);uv.push(1-i/n,j);
      }
      for(let i=0;i<n;i++){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();p.mesh(g,material);
      if(d.tier>0){
        const z=d.L*.32,s=h.measure(z);
        for(let i=0;i<5;i++){const y=.15+i*d.D*.15,q=clamp((y-s.bottom)/(s.sheer-s.bottom),0,1),theta=Math.acos(1-Math.pow(q,1/h.bilge)),x=(Math.sin(theta)*s.width*(1-h.flare*(1-q))+.025)*side;p.box(.018,.035,d.L*.011,x,y,z,m.body);}
      }
    }
  }
  liveryAccents(){
    const d=this.dna,p=this.p,m=this.m,h=this.hull;if(d.tier===4)return;
    const stripeR=clamp(d.L*.0035,.028,.12);
    // Signature sheer stripe sweeping the full run of the hull.
    for(const side of [-1,1]){
      const line=h.sections.filter((s,i)=>i%3===0&&s.t>.01&&s.t<.955).map(s=>{
        const q=.88,theta=Math.acos(1-Math.pow(q,1/h.bilge));
        return [side*Math.sin(theta)*s.width*(1-h.flare*(1-q))*1.004,lerp(s.bottom,s.sheer,q),s.z];
      });
      p.pipe(line,stripeR,m.accent);
      // Bow chevron flash.
      const s=h.measure(d.L*.335);
      p.box(stripeR*1.4,d.F*.30,d.L*.016,side*(s.width*.90+stripeR),d.F*.55,d.L*.335,m.accent,this.root,[0,0,side*.42]);
      // Rubbing strake just under the gunwale.
      const strake=h.sections.filter((s,i)=>i%3===0&&s.t>.015&&s.t<.97).map(s=>{
        const q=.965,th=Math.acos(1-Math.pow(q,1/h.bilge));
        return [side*(Math.sin(th)*s.width*(1-h.flare*(1-q))+stripeR*.6),lerp(s.bottom,s.sheer,q),s.z];
      });
      p.pipe(strake,stripeR*1.3,m.dark);
    }
    const onHull=(z,y,side,off)=>{
      const s=h.measure(z),q=clamp((y-s.bottom)/(s.sheer-s.bottom),.02,.98),th=Math.acos(1-Math.pow(q,1/h.bilge));
      return side*(Math.sin(th)*s.width*(1-h.flare*(1-q))+off);
    };
    const u=clamp(d.L/38,.6,2.2);
    // Freeing ports along the working bulwark let green water drain off the trawl deck.
    if(d.tier===2){
      const n=Math.round(clamp(d.L/4,5,11));
      for(let i=0;i<n;i++){
        const z=lerp(-d.L*.42,d.L*.05,i/(n-1));if(Math.abs(z-d.bridgeZ)<d.bridgeL*.7)continue;
        const y=h.deckHeight(z)+.12*u;
        for(const side of [-1,1])p.box(.04,.18*u,.55*u,onHull(z,y,side,.012),y,z,m.dark);
      }
    }
    // Forepeak portholes with brass rims on larger hulls.
    if(d.tier>=2){
      for(const z of [d.L*.245,d.L*.29])for(const side of [-1,1]){
        const s=h.measure(z),y=lerp(s.bottom,s.sheer,.6),x=onHull(z,y,side,.02);
        p.torus(.14*u,.03*u,x,y,z,m.bronze,this.root,[0,Math.PI/2,0]);
        p.cylinder(.12*u,.12*u,.04,x-side*.01,y,z,m.glass,this.root,[0,0,Math.PI/2],16);
      }
    }
  }
  superstructure(){
    const d=this.dna,p=this.p,m=this.m;
    const deckY=this.hull.deckHeight(d.bridgeZ)+.04;let y=deckY;
    const u2=clamp(d.L/38,.7,2.6);
    const levelH=d.tier>=3?3.15:2.55;
    const baseW=this.houseW,baseL=this.houseL;
    this.planner.reserve('superstructure',0,d.bridgeZ,baseW,baseL,.38);
    
    // No crew cabins. Larger hulls get a sealed engine-casing pedestal that lifts the bridge
    // for sightlines; its roof becomes the bridge-wing deck. Smaller hulls mount the bridge on deck.
    const w=baseW,len=baseL,z=d.bridgeZ;
    if(d.levels){
      const g=new THREE.Group();g.position.z=z;this.root.add(g);
      p.slab(p.footprint(w,len,.09),y,levelH,m.body,g,.025);
      p.slab(p.footprint(w+.18,len+.18,.09),y+levelH-.045,.12,m.body,g);
      p.slab(p.footprint(w+.05,len+.05,.09),y+levelH*.13,.085,m.accent,g);
      // Louvred engine-room vents and a watertight hatch: honest machinery, no false windows.
      const ventN=clamp(Math.floor(len/2.2),2,6);
      for(const side of [-1,1])for(let k=0;k<ventN;k++){
        const vz=lerp(-len*.30,len*.30,ventN===1?.5:k/(ventN-1));
        p.box(.05,.62,.86,side*(w*.5+.02),y+levelH*.58,vz,m.dark,g);
        for(let s=0;s<5;s++)p.box(.07,.035,.80,side*(w*.5+.045),y+levelH*.58-.24+s*.12,vz,m.metal,g,[0,0,side*.5]);
      }
      const hz=-len*.5-.03;
      p.box(.92,1.86,.06,w*.18,y+.96,hz,m.dark,g);p.box(.80,1.74,.07,w*.18,y+.95,hz-.03,m.body,g);
      p.torus(.13,.025,w*.18,y+1.42,hz-.07,m.metal,g);p.box(.20,.06,.05,w*.18+.25,y+.95,hz-.08,m.metal,g);
      // Wing-deck railing: straight rails and posts, left open at the head of the stair.
      const top=y+levelH+.07,fp=p.footprint(w+.1,len+.1,.09),sx=-w*.22;
      fp.forEach((a,i)=>{
        const b=fp[(i+1)%fp.length],segs=[];
        if(a[1]===b[1]&&a[1]<0){const g0=Math.min(a[0],b[0]),g1=Math.max(a[0],b[0]);segs.push([[g0,a[1]],[sx-.5,a[1]]],[[sx+.5,a[1]],[g1,a[1]]]);}
        else segs.push([a,b]);
        for(const [s,e] of segs){
          const L=Math.hypot(e[0]-s[0],e[1]-s[1]);if(L<.1)continue;
          for(const hh of [.95,.5])p.rod([s[0],top+hh,s[1]+z],[e[0],top+hh,e[1]+z],hh>.9?.03:.022,m.rail);
          const n=Math.max(1,Math.ceil(L/1.2));
          for(let k=0;k<=n;k++){const t=k/n;p.rod([lerp(s[0],e[0],t),top,lerp(s[1],e[1],t)+z],[lerp(s[0],e[0],t),top+.95,lerp(s[1],e[1],t)+z],.026,m.rail);}
        }
      });
      // Stairway from the working deck to the bridge wing.
      // Runs fore-aft against the aft face so it never overhangs the hull side.
      const run=Math.ceil(levelH/.24)*.24,sz=z-len*.5-run*.5-.04;
      this.stairs(-w*.22,sz,y,levelH,.77);
      this.planner.reserve('bridge stair',-w*.22,sz,.9,run,.3);
      y+=levelH+.07;
    }
    this.bridgeFloor=y;
    // How far you can step outside each door before reaching a railing or the hull side.
    this.sideClear=d.levels?clamp((this.houseW-d.bridgeW)*.5-.15,.25,.75):clamp(this.hull.measure(d.bridgeZ).width-d.bridgeW*.5-.3,.25,.8);
    this.aftClear=d.levels?clamp((this.houseL-d.bridgeL)*.5-.12,.3,1.4):1.3;
    const cabin=new THREE.Group();cabin.name='Walk-in bridge';cabin.position.set(0,y,d.bridgeZ);this.root.add(cabin);
    this.bridge=cabin;
    this.cabin(cabin);
    const roof=this.roofs[0];
    this.mast(roof,d.bridgeH+.20,0,-d.bridgeL*.10);
    this.equipment.add(d.openConsole?'Open center-console helm':'Fully modeled walk-in bridge');
    this.equipment.add('Navigation radar and chartplotter');
  }
  stairs(x,z,y,height,width){
    const p=this.p,m=this.m,n=Math.ceil(height/.24),run=n*.24;
    for(let i=0;i<n;i++)p.box(width,.09,.28,x,y+(i+1)*height/n,z-run/2+i*.24,m.metal);
    for(const side of [-1,1]){const xx=x+side*width*.48;p.rod([xx,y+.03,z-run/2],[xx,y+height,z+run/2],.045,m.dark);p.rod([xx,y+.92,z-run/2],[xx,y+height+.92,z+run/2],.029,m.rail);for(let i=0;i<=3;i++)p.rod([xx,y+height*i/3,z-run/2+run*i/3],[xx,y+height*i/3+.92,z-run/2+run*i/3],.025,m.rail);}
  }
  accessLadder(x,z,topY,dh){
    const p=this.p,m=this.m,n=Math.max(3,Math.ceil(dh/.26));
    for(const sx of [-.34,.34])p.rod([x+sx,topY,z],[x+sx,topY-dh,z],.042,m.dark);
    for(let i=0;i<n;i++){const yy=topY-.14-i*(dh-.2)/Math.max(1,n-1);p.box(.78,.045,.07,x,yy,z,m.metal);}
    for(const sx of [-.34,.34])for(let i=0;i<=2;i++){const yy=lerp(topY-.1,topY-dh,i/2);p.rod([x+sx,yy+.98,z],[x+sx,yy,z],.026,m.rail);p.rod([x+sx,yy+.98,z-.34],[x+sx,yy+.98,z],.026,m.rail);}
  }
}
