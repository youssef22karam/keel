/* KEEL / VesselBuilder mixin: mast, radar, lights, exhaust, propulsion, propeller and outboard. */
import * as THREE from 'three';
import { TAU, clamp, lerp } from './utils.js';
import { VesselBuilder } from './builder-core.js';

Object.assign(VesselBuilder.prototype, {
  mast(parent,y,x,z){
    const d=this.dna,p=this.p,m=this.m,h=clamp(d.L*.12,2.4,12),u=clamp(d.L/35,.65,2.5);
    // The radar rides its own forward bracket; yardarm, antennas, stays, and flag all sit outside its sweep.
    const G=d.parts.radar,sweep=(G.style==='array'?.875*G.span+.12:.62*G.span+.12)*u,half=sweep+.18*u;
    p.cylinder(.055*u,.13*u,h,x,y+h/2,z,m.body,parent);
    for(const side of [-1,1])p.rod([x,y+h*.10,z],[x+side*half*.8,y+h*.62,z],.04*u,m.body,parent);
    p.box(half*2,.12*u,.16*u,x,y+h*.62,z,m.body,parent);
    const ry=y+h*.50,rz=z+sweep+.16*u;
    p.box(.22*u,.06*u,rz-z,x,ry,(z+rz)*.5,m.body,parent);
    p.rod([x,y+h*.30,z+.05*u],[x,ry-.03*u,rz-.10*u],.03*u,m.body,parent);
    p.cylinder(.22*u,.22*u,.05*u,x,ry+.03*u,rz,m.dark,parent);
    const scanner=new THREE.Group();scanner.name='Rotating navigation radar';scanner.userData.unbatched=true;scanner.position.set(x,ry+.055*u,rz);parent.add(scanner);
    this.proceduralRadar(scanner, u);
    this.animators.push({object:scanner,kind:'radar',speed:G.speed*(G.style==='dome'?0:1)});
    
    for(const side of [-1,1]){
      const ex=x+side*(half-.05*u);
      p.rod([ex,y+h*.62,z],[ex,y+h*.62+1.8*u,z],.016*u,m.metal,parent);
      p.cylinder(.065*u,.065*u,.09*u,x+side*(half-.24*u),y+h*.62+.11*u,z,side===1?m.green:m.port,parent);
      p.rod([x,y+h*.79,z],[x+side*d.bridgeW*.35,y+.17,z-d.bridgeL*.25],.009*u,m.rubber,parent);
    }
    
    // Procedurally styled searchlight
    this.proceduralLight(parent, x, y+h+.05, z, u);
    
    if(d.tier<4){
      const canvas=document.createElement('canvas');canvas.width=192;canvas.height=128;const c=canvas.getContext('2d');
      c.fillStyle=d.palette.hull;c.beginPath();c.moveTo(0,0);c.lineTo(192,0);c.lineTo(143,64);c.lineTo(192,128);c.lineTo(0,128);c.closePath();c.fill();c.fillStyle=d.palette.body;c.fillRect(44,0,18,128);c.fillRect(0,52,168,16);
      const mat=m.standard('Shipyard pennant','#ffffff',{map:m.texture(canvas),transparent:true,alphaTest:.35,side:THREE.DoubleSide,roughness:.9});
      const geometry=new THREE.PlaneGeometry(.82*u,.46*u,12,5);geometry.translate(.41*u,0,0);
      geometry.getAttribute('position').setUsage(THREE.DynamicDrawUsage);geometry.getAttribute('normal').setUsage(THREE.DynamicDrawUsage);
      const flag=p.mesh(geometry,mat,[x,y+h*.89,z-.07*u],[0,Math.PI/2,0],parent);flag.userData.unbatched=true;
      this.animators.push({object:flag,kind:'flag',width:.82*u,amplitude:.065*u,speed:1.9});
    }
    
    // Procedurally styled exhaust stacks / casing vents
    this.proceduralExhaust(parent, y, x, z, u);
  },
  
  // Procedural Radar Upgrade generator
  proceduralRadar(scanner, u){
    const p=this.p,m=this.m,G=this.dna.parts.radar,S=G.span,Hh=G.height;
    p.cylinder(.17*u,.20*u,.18*u*Hh,0,.09*u*Hh,0,m.body,scanner);
    p.cylinder(.21*u,.21*u,.03*u,0,.19*u*Hh,0,m.dark,scanner);
    const y0=.2*u*Hh;
    if(G.style==='dome'){
      p.cylinder(.44*u*S,.44*u*S,.10*u,0,y0+.05*u,0,m.dark,scanner,null,32);
      p.sphere(.46*u*S,.30*u*S,.46*u*S,0,y0+.10*u,0,m.body,scanner);
      p.torus(.445*u*S,.012*u,0,y0+.10*u,0,m.accent,scanner,[Math.PI/2,0,0]);
    }else if(G.style==='array'){
      // Tapered slotted-waveguide array on a gearbox.
      p.box(.42*u,.16*u,.30*u,0,y0+.08*u,0,m.dark,scanner);
      const len=1.75*u*S;
      p.box(len,.15*u,.16*u,0,y0+.26*u,0,m.body,scanner);
      for(const e of [-1,1])p.box(.10*u,.12*u,.15*u,e*len*.5,y0+.26*u,0,m.body,scanner,[0,0,e*.25]);
      p.box(len*.94,.03*u,.012*u,0,y0+.26*u,.082*u,m.dark,scanner);
    }else if(G.style==='orbital'){
      p.rod([0,y0,0],[0,y0+.42*u*Hh,0],.026*u,m.dark,scanner);
      p.torus(.42*u*S,.04*u,0,y0+.24*u,0,m.metal,scanner,[0,0,0]);
      p.torus(.28*u*S,.03*u,0,y0+.24*u,0,m.glow,scanner,[0,Math.PI/2,0]);
      p.sphere(.07*u,.07*u,.07*u,0,y0+.24*u,0,m.body,scanner);
    }else{
      // Parabolic dish: closed lathe profile so it reads solid from both sides.
      const R=.42*u*S,pts=[];
      for(let i=0;i<=10;i++){const r=R*i/10;pts.push(new THREE.Vector2(r,(r*r)/(2.2*R)));}
      for(let i=10;i>=0;i--){const r=R*i/10;pts.push(new THREE.Vector2(r,(r*r)/(2.2*R)-.03*u));}
      const dish=new THREE.Group();dish.position.set(0,y0+.36*u,0);dish.rotation.x=-1.05;scanner.add(dish);
      p.mesh(new THREE.LatheGeometry(pts,28),m.metal,[0,0,0],null,dish);
      for(let i=0;i<3;i++){const a=i*TAU/3;p.rod([Math.cos(a)*R*.95,R*.42,Math.sin(a)*R*.95],[0,R*.62,0],.008*u,m.dark,dish);}
      p.sphere(.035*u,.035*u,.035*u,0,R*.62,0,m.dark,dish);
      p.rod([0,y0,0],[0,y0+.36*u,0],.03*u,m.dark,scanner);
    }
  },
  
  // Procedural Searchlight Upgrade generator
  proceduralLight(parent, x, y, z, u){
    const p=this.p,m=this.m,G=this.dna.parts.light,s=u*G.size;
    p.cylinder(.05*s,.06*s,.12*s,x,y,z,m.metal,parent);
    const head=new THREE.Group();head.position.set(x,y+.10*s,z);parent.add(head);
    if(G.style==='brass'){
      // Trunnion fork carrying a barrel lamp aimed forward.
      for(const e of [-1,1])p.box(.02*s,.16*s,.04*s,e*.14*s,.06*s,0,m.bronze,head);
      p.cylinder(.11*s,.13*s,.26*s,0,.10*s,0,m.bronze,head,[Math.PI/2,0,0],20);
      p.torus(.115*s,.016*s,0,.10*s,.13*s,m.bronze,head);
      p.cylinder(.10*s,.10*s,.01*s,0,.10*s,.135*s,m.led,head,[Math.PI/2,0,0],20);
      for(let i=0;i<4;i++)p.torus(.125*s,.008*s,0,.10*s,-.08*s+i*.045*s,m.dark,head);
    }else if(G.style==='twin'){
      p.box(.42*s,.03*s,.05*s,0,.02*s,0,m.dark,head);
      for(const e of [-1,1]){
        p.box(.15*s,.14*s,.17*s,e*.17*s,.10*s,0,m.dark,head);
        p.box(.125*s,.115*s,.01*s,e*.17*s,.10*s,.088*s,m.led,head);
        p.box(.16*s,.02*s,.06*s,e*.17*s,.18*s,.09*s,m.dark,head);
      }
    }else{
      const n=G.count,len=(n*.13+.08)*s;
      p.box(len,.10*s,.09*s,0,.08*s,0,m.dark,head);
      for(let i=0;i<n;i++)p.box(.10*s,.065*s,.01*s,(i-(n-1)/2)*.13*s,.08*s,.047*s,m.led,head);
      for(const e of [-1,1])p.box(.02*s,.12*s,.06*s,e*len*.5,.06*s,0,m.metal,head);
    }
  },
  
  // Exhaust stacks: each stack is its own group so its rake gene tilts the whole assembly.
  proceduralExhaust(parent, y, x, z, u){
    const p=this.p,m=this.m,d=this.dna,G=d.parts.exhaust;
    if(d.tier<2) return;
    const Hs=2.2*u*G.height,r=.2*u*G.girth;
    for(const side of [-1,1]){
      const sg=new THREE.Group();sg.position.set(side*d.bridgeW*.30,y,-d.bridgeL*.26);sg.rotation.x=G.rake;parent.add(sg);
      if(G.style==='classic'){
        p.cylinder(r*1.5,r*1.7,.12*u,0,.06*u,0,m.metal,sg);
        p.cylinder(r,r*1.1,Hs,0,Hs*.5,0,m.body,sg,null,20);
        p.cylinder(r*1.06,r*1.06,Hs*.12,0,Hs*.70,0,m.accent,sg,null,20);
        p.cylinder(r*1.04,r*1.04,Hs*.10,0,Hs*.95,0,m.rubber,sg,null,20);
        p.torus(r*1.04,.02*u,0,Hs,0,m.metal,sg,[Math.PI/2,0,0]);
      }else if(G.style==='casing'){
        const cas=p.mesh(new THREE.CapsuleGeometry(r*2.1,Hs*.55,6,16),m.body,[0,Hs*.42,0],null,sg);cas.scale.set(.62,1,1.25);
        p.box(r*2.7,Hs*.10,r*5.1,0,Hs*.62,0,m.accent,sg);
        p.box(r*2.68,Hs*.08,r*5.0,0,Hs*.80,0,m.rubber,sg);
        for(const e of [-1,1])p.cylinder(r*.45,r*.45,Hs*.25,0,Hs*.92,e*r*1.2,m.metal,sg);
      }else{
        p.box(r*2.6,Hs*.8,r*2.2,0,Hs*.4,0,m.dark,sg);
        const n=Math.max(4,Math.round(G.height*5));
        for(let i=0;i<n;i++)p.box(r*2.75,.035*u,r*2.0,0,Hs*.12+i*(Hs*.62/n),r*.25,d.tier===4?m.glow:m.metal,sg,[-.4,0,0]);
        p.box(r*2.8,.05*u,r*2.4,0,Hs*.81,0,m.accent,sg);
      }
    }
  },

  propulsion(){
    const d=this.dna,p=this.p,m=this.m;
    if(d.tier===1){
      const count=d.cost>70000?2:1,u=clamp(d.L/12,.75,1.55);
      for(let i=0;i<count;i++)this.outboard(count===1?0:(i-.5)*d.B*.35,-d.L*.49,u);
      this.equipment.add(count===2?'Twin high-output outboards':'Single commercial outboard');return;
    }
    if(d.tier===4)return;
    p.sphere(d.D*.25,d.D*.27,d.D*.64,0,-d.D*.61,d.L*.46,m.hull);
    p.box(.08,d.D*.56,d.L*.47,0,-d.D*.70,-d.L*.05,m.dark);
    const radius=clamp(d.B*.098,.35,2.3);
    
    for(const side of [-1,1]){
      const x=side*d.B*.18,y=-d.D*.66,z=-d.L*.477;
      p.rod([x,y,z+.4],[x,y+.18,z+radius*2.2],radius*.09,m.metal);
      const prop=new THREE.Group();prop.position.set(x,y,z);prop.userData.unbatched=true;this.root.add(prop);
      
      this.proceduralPropeller(prop, radius, m, side);
      // Twin screws counter-rotate, as on real twin-screw vessels.
      this.animators.push({object:prop,kind:'propeller',speed:d.parts.propeller.rpm*side});
      
      p.box(radius*.11,radius*1.80,radius*.76,x,y,z-radius*.47,m.dark);
      p.rod([x,y+radius*.94,z-radius*.47],[x,-.05,z-radius*.47],radius*.05,m.metal);
    }
    this.equipment.add('Twin-screw diesel propulsion');this.equipment.add('Bulbous displacement bow');
  },
  
  // Procedural Propeller Upgrade generator
  // Blades are true swept, pitched surfaces built from the gene set, not boxes.
  proceduralPropeller(prop, radius, m, hand=1){
    const p=this.p,G=this.dna.parts.propeller;
    const R=G.style==='ducted'?radius*.92:radius;
    p.cylinder(R*.16,R*.22,R*.55,0,0,0,m.bronze,prop,[Math.PI/2,0,0],20);
    p.sphere(R*.16,R*.16,R*.22,0,0,-R*.32,m.bronze,prop);
    const bladeGeo=()=>{
      const pos=[],idx=[],uv=[],nr=8,nc=5;
      for(let i=0;i<=nr;i++){
        const t=i/nr,rr=lerp(R*.2,R,t);
        const chord=R*(G.style==='classic'?.52:.42)*Math.sin(Math.PI*lerp(.18,.96,t))+R*.06;
        const sweep=G.skew*R*t*t*(G.style==='skewed'?1.4:.6);
        for(let j=0;j<=nc;j++){
          const c=(j/nc-.5)*chord,ang=G.pitch*hand;
          pos.push(c*Math.cos(ang)+sweep,rr,c*Math.sin(ang));uv.push(j/nc,t);
        }
      }
      for(let i=0;i<nr;i++)for(let j=0;j<nc;j++){const a=i*(nc+1)+j,b=a+nc+1;idx.push(a,b,a+1,a+1,b,b+1);}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
    };
    // Thin blade sheets need double-sided shading to read solid from every angle.
    this.m.bladeBronze=this.m.bladeBronze||this.m.standard('Propeller blade bronze','#b08a48',{metalness:.78,roughness:.3,side:THREE.DoubleSide});
    this.m.bladeSteel=this.m.bladeSteel||this.m.standard('Thruster blade steel','#b4c0b8',{metalness:.8,roughness:.28,side:THREE.DoubleSide});
    const mat=G.style==='ducted'?this.m.bladeSteel:this.m.bladeBronze;
    for(let i=0;i<G.blades;i++){
      const blade=new THREE.Group();blade.rotation.z=i*TAU/G.blades;prop.add(blade);
      const mesh=p.mesh(bladeGeo(),mat,[0,0,0],null,blade);mesh.material=mat;
    }
    if(G.style==='ducted'){
      // Kort nozzle: open shroud plus stator struts. Lives on the rotating group only for its rim.
      const pts=[];for(let i=0;i<=12;i++){const t=i/12;pts.push(new THREE.Vector2(radius*(1.02+.12*Math.sin(Math.PI*t)),(t-.5)*radius*.75));}
      for(let i=12;i>=0;i--){const t=i/12;pts.push(new THREE.Vector2(radius*(1.0+.02*Math.sin(Math.PI*t)),(t-.5)*radius*.75));}
      p.mesh(new THREE.LatheGeometry(pts,32),this.m.accent,[0,0,0],[Math.PI/2,0,0],prop);
    }
  },
  outboard(x,z,u){
    const p=this.p,m=this.m,g=new THREE.Group();g.position.set(x,this.hull.deckHeight(z)-.09,z-.08);this.root.add(g);
    p.slab(p.footprint(.52*u,.75*u,.18),-.04*u,.66*u,m.dark,g,.055*u);
    p.box(.535*u,.10*u,.58*u,0,.10*u,-.015*u,m.body,g);
    p.box(.13*u,.83*u,.21*u,0,-.42*u,.1*u,m.dark,g);p.box(.40*u,.05*u,.38*u,0,-.70*u,.10*u,m.dark,g);
    p.cylinder(.085*u,.105*u,.30*u,0,-.79*u,.12*u,m.dark,g,[Math.PI/2,0,0]);
    for(let i=0;i<3;i++){const a=i*TAU/3;p.box(.15*u,.045*u,.06*u,Math.sin(a)*.11*u,-.79*u+Math.cos(a)*.11*u,-.06*u,m.metal,g,[0,0,-a]);}
    p.box(.30*u,.20*u,.34*u,0,.005*u,.43*u,m.metal,g);
    p.mesh(new THREE.PlaneGeometry(.33*u,.11*u),m.label(this.dna.cost>70000?'250':this.dna.cost>30000?'90':'40'),[0,.39*u,-.431*u],[0,Math.PI,0],g);
  },
});
