/* KEEL / VesselBuilder mixin: deck equipment and fishing rigs (winches, gantry, derrick, crane, net winch). */
import * as THREE from 'three';
import { TAU, clamp, lerp } from './utils.js';
import { VesselBuilder } from './builder-core.js';

Object.assign(VesselBuilder.prototype, {
  deckEquipment(){
    const d=this.dna,p=this.p,m=this.m,u=clamp(d.L/35,.65,3.1);
    const bow=this.planner.place('anchor windlass',1.6*u,1.4*u,[[0,d.L*.365],[0,d.L*.32]]);
    if(bow){this.windlass(bow.x,this.hull.deckHeight(bow.z)+.05,bow.z,u);this.equipment.add('Anchor windlass and mooring gear');}
    for(const z of [-d.L*.42,d.L*.35])for(const side of [-1,1]){
      const s=this.hull.measure(z),x=side*s.width*.70,y=this.hull.deckHeight(z);
      p.box(.46*u,.07*u,.29*u,x,y+.04*u,z,m.dark);
      for(const dx of [-.13,.13]){p.cylinder(.047*u,.047*u,.30*u,x+dx*u,y+.18*u,z,m.metal);p.cylinder(.066*u,.066*u,.04*u,x+dx*u,y+.345*u,z,m.metal);}
    }
    if(d.tier===1){
      this.buildRig(u,2,3);
      const z=-d.L*.27,y=this.hull.deckHeight(z);p.box(d.B*.46,.39*u,d.L*.09,0,y+.20*u,z,m.body);p.box(d.B*.47,.045*u,d.L*.092,0,y+.415*u,z,m.wood);
      this.ropeCoil(-d.B*.26,y+.035,z+.7*u,.20*u);
      this.equipment.add('Insulated aft fish locker');
      return;
    }
    if(d.tier===4){this.apexEquipment();return;}
    if(d.tier===3){this.industrialEquipment();this.buildRig(u,2,3);return;}
    const side=d.forward?-1:1,workZ=side*d.L*.27;
    if(d.forward&&d.variant!==1)this.gantry(-d.L*.365,u);
    else this.longlineDerrick(workZ,u);
    const crane=this.planner.place('deck crane',1.45*u,1.65*u,[[d.B*.29,workZ*.57],[-d.B*.29,workZ*.57],[d.B*.26,workZ*.87]]);
    if(crane){this.crane(crane.x,this.hull.deckHeight(crane.z),crane.z,u,side<0?Math.PI-.24:.20);this.equipment.add('Articulated hydraulic deck crane');}
    const winchZ=d.forward?-d.L*.285:d.L*.24;
    const winch=this.planner.place('net drum',d.B*.44,1.8*u,[[0,winchZ],[0,side*d.L*.37]]);
    if(winch){this.netWinch(0,this.hull.deckHeight(winch.z),winch.z,u);this.equipment.add('Powered trawl-net drum');}
    const hatch=this.planner.place('fish hold hatch',d.B*.29,d.L*.085,[[0,workZ*.48],[0,workZ*.80],[0,side*d.L*.37]]);
    if(hatch){this.hatch(hatch.x,hatch.z,d.B*.29,d.L*.085);this.equipment.add('Refrigerated hold and deck hatch');}
    const crate=this.planner.place('fish-box stacks',2.3*u,1.20*u,[[-d.B*.28,workZ*.68],[d.B*.25,workZ*.88],[-d.B*.25,workZ*1.20],[-d.B*.26,workZ*.48]]);
    if(crate){this.cratePile(crate.x,this.hull.deckHeight(crate.z)+.03,crate.z,u,3,2,this.r.int(2,4));this.equipment.add('Stacked ventilated fish boxes');}
    this.buildRig(u,1,4);
    this.ropeCoil(d.B*.24,this.hull.deckHeight(side*d.L*.41)+.02,side*d.L*.41,.31*u);
  },
  buildRig(u,outriggerSides=2,holders=3){
    const d=this.dna,p=this.p,m=this.m,G=d.parts.outrigger;
    const g=new THREE.Group();g.name='Fishing rod rig';g.userData.unbatched=true;this.root.add(g);
    this.rigGroup=g;this.rigScaleTarget=1;this.rigNodes=[];this.rigProgress=1;
    // Each piece pivots at its own mount, so the rig telescopes in and out of its holders.
    const node=(b)=>{const n=new THREE.Group();n.position.set(...b);n.userData.unbatched=true;g.add(n);this.rigNodes.push(n);return n;};
    const loc=(pt,b)=>[pt[0]-b[0],pt[1]-b[1],pt[2]-b[2]];
    const Ls=Math.min(d.L,24),Bs=Math.min(d.B,7.5),reach=Bs*.40*G.reach,lift=Ls*.24*G.lift;
    for(const side of (outriggerSides?[-1,1]:[])){
      const z=-d.L*.12,s=this.hull.measure(z),b=[side*s.width*.86,this.hull.deckHeight(z)+.06,z];
      // Fixed deck base stays put; the boom is the moving node.
      p.cylinder(.07*u,.09*u,.12*u,b[0],b[1]+.06*u,b[2],m.dark,g);
      const n=node(b),tip=[side*reach,lift,-Ls*.18];
      if(G.style==='carbon'){
        p.rod([0,0,0],tip,.022*u,m.dark,n);
        for(let k=1;k<5;k++){const t=k/5;p.torus(.035*u,.008*u,tip[0]*t,tip[1]*t,tip[2]*t,m.metal,n);}
      }else if(G.style==='telescopic'){
        const a=tip.map(v=>v*.45),bb=tip.map(v=>v*.78);
        p.rod([0,0,0],a,.032*u,m.metal,n);p.rod(a,bb,.022*u,m.metal,n);p.rod(bb,tip,.014*u,m.metal,n);
        p.cylinder(.04*u,.04*u,.06*u,...a,m.dark,n);p.cylinder(.03*u,.03*u,.05*u,...bb,m.dark,n);
      }else{
        const heel=[side*reach*.15,lift*.10,Ls*.05];
        p.rod([0,0,0],tip,.028*u,m.metal,n);p.rod(heel,tip,.02*u,m.metal,n);p.rod(heel,[0,0,0],.02*u,m.metal,n);
        for(let k=1;k<5;k++){const t=k/5;p.rod([tip[0]*t,tip[1]*t,tip[2]*t],[lerp(heel[0],tip[0],t),lerp(heel[1],tip[1],t),lerp(heel[2],tip[2],t)],.01*u,m.metal,n);}
      }
      // Halyard and release clip running back to the rail.
      p.rod(tip,[side*reach*.25,.9*u,-Ls*.20],.004*u,m.rope,n);
      p.sphere(.035*u,.05*u,.035*u,side*reach*.25,.9*u,-Ls*.20,m.orange,n);
    }
    const count=Math.max(holders,G.rods),span=d.L*(d.tier>1?.20:.30);
    for(const side of [-1,1])for(let i=0;i<count;i++){
      const zz=-d.L*.36+i*span/Math.max(1,count-1);if(Math.abs(zz)>d.L*.42)continue;
      const s=this.hull.measure(zz),b=[side*s.width*.93,s.sheer+.02,zz];
      p.cylinder(.03,.034,.24,b[0],b[1]+.08,b[2],m.metal,g,[-.35,0,side*.25]);
      const n=node(b),rodLen=lerp(1.9,2.8,(i%3)/2)*Math.min(1.2,u),tip=[side*rodLen*.42,rodLen*.82,-rodLen*.38];
      p.rod([0,0,0],[side*.05,.3,-.12],.02,m.rubber,n);
      p.cylinder(.045,.045,.07,side*.05,.24,-.11,m.metal,n,[0,0,Math.PI/2]);
      p.rod([side*.05,.3,-.12],tip,.011,m.dark,n);
      for(let k=1;k<5;k++){const t=k/5;p.torus(.014,.004,lerp(side*.05,tip[0],t),lerp(.3,tip[1],t),lerp(-.12,tip[2],t),m.metal,n);}
      // Line running from the tip down into the water, swaying with the ship.
      const water=[tip[0]+side*(1.2+i*.3),-b[1]+.05,tip[2]-1.5];
      p.pipe([tip,[lerp(tip[0],water[0],.5),lerp(tip[1],water[1],.62),lerp(tip[2],water[2],.5)],water],.0035,m.rope,n,false,12);
    }
    this.rigNodes.forEach((n,i)=>n.userData.delay=i/Math.max(1,this.rigNodes.length)*.4);
    this.updateRigEquipment();
  },
  updateRigEquipment(){
    if(!this.rigGroup)return;
    this.equipment.delete('Paired outriggers and six rod holders');
    this.equipment.delete('Fishing rod rig and outriggers');
    if(this.rigScaleTarget>0)this.equipment.add(this.dna.tier===1?'Paired outriggers and rod holders':'Fishing rod rig and outriggers');
  },
  windlass(x,y,z,u){
    const p=this.p,m=this.m;
    p.box(1.05*u,.14*u,.74*u,x,y+.08*u,z,m.dark);
    for(const side of [-1,1]){
      p.box(.12*u,.48*u,.52*u,x+side*.42*u,y+.27*u,z,m.body);
      p.cylinder(.20*u,.20*u,.34*u,x+side*.29*u,y+.44*u,z,m.metal,this.root,[0,0,Math.PI/2]);
      p.cylinder(.235*u,.235*u,.06*u,x+side*.44*u,y+.44*u,z,m.dark,this.root,[0,0,Math.PI/2]);
    }
    p.box(.35*u,.23*u,.38*u,x,y+.48*u,z,m.accent);
    for(let i=0;i<17;i++){const zz=z+.30*u+i*.079*u,yy=Math.max(y+.02*u,this.hull.deckHeight(zz)+.05*u);p.torus(.039*u,.012*u,x,yy,zz,m.metal,this.root,i%2===0?[Math.PI/2,0,0]:[0,Math.PI/2,0]);}
    if(this.dna.tier<4)for(const side of [-1,1]){
      const zz=this.dna.L*.365,s=this.hull.measure(zz),xx=side*(s.width*.91+.08*u),yy=this.dna.F*.58;
      p.torus(.11*u,.036*u,xx,yy+.5*u,zz,m.dark,this.root,[0,Math.PI/2,0]);
      p.rod([xx,yy+.43*u,zz],[xx,yy-.37*u,zz],.045*u,m.metal);
      p.rod([xx,yy+.20*u,zz-.28*u],[xx,yy+.20*u,zz+.28*u],.039*u,m.dark);
      for(const end of [-1,1]){p.rod([xx,yy-.35*u,zz],[xx,yy-.14*u,zz+end*.34*u],.043*u,m.dark);p.box(.035*u,.22*u,.19*u,xx,yy-.10*u,zz+end*.34*u,m.dark,this.root,[end*.40,0,0]);}
    }
    this.ropeCoil(x-.69*u,y+.025,z-.28*u,.19*u);
  },
  ropeCoil(x,y,z,r){
    const points=[];for(let i=0;i<160;i++){const a=i*.24,rr=r*(.42+.58*i/159);points.push([x+Math.cos(a)*rr,y+.025,z+Math.sin(a)*rr]);}
    this.p.pipe(points,.012*Math.max(.7,r/.22),this.m.rope,this.root,false,200);
  },
  gantry(z,u){
    const p=this.p,m=this.m,d=this.dna,s=this.hull.measure(z),span=s.width*1.70,h=d.L*this.r.range(.12,.144),y=this.hull.deckHeight(z);
    this.planner.reserve('net gantry',0,z,span,.56*u,.1);
    for(const side of [-1,1]){
      const x=side*span*.5;
      p.box(.56*u,.12*u,.74*u,x,y+.06*u,z,m.dark);
      p.rod([x,y+.1,z],[x*.94,y+h,z+.28*u],.15*u,m.accent);
      p.rod([x,y+.15,z+1.2*u],[x*.94,y+h*.78,z+.22*u],.064*u,m.accent);
      for(let k=0;k<12;k++)p.rod([x-.12*u,y+.24*u+k*(h-.45)/12,z-.17*u],[x+.12*u,y+.24*u+k*(h-.45)/12,z-.17*u],.019*u,m.metal);
      p.box(.36*u,.22*u,.26*u,x*.86,y+h+.17*u,z+.31*u,m.dark);p.box(.30*u,.16*u,.03*u,x*.86,y+h+.15*u,z+.455*u,m.led);
    }
    p.box(span*.96,.32*u,.38*u,0,y+h,z+.28*u,m.accent);
    p.box(span*.58,.05*u,.40*u,0,y+h+.18*u,z+.28*u,m.metal);
    for(const side of [-1,1]){
      p.torus(.20*u,.055*u,side*span*.22,y+h-.30*u,z+.28*u,m.dark,this.root,[0,Math.PI/2,0]);
      p.rod([side*span*.22,y+h-.30*u,z+.28*u],[side*span*.18,y+.9*u,z+2*u],.015*u,m.rope);
    }
    const rampZ=-d.L*.485,ry=this.hull.deckHeight(rampZ);
    p.box(span*.45,.10*u,1.10*u,0,ry-.10*u,rampZ,m.dark,this.root,[-.25,0,0]);
    for(let k=0;k<7;k++)p.box(span*.43,.035*u,.025*u,0,ry+.03-k*.035*u,rampZ+.38*u-k*.12*u,m.metal);
    this.equipment.add('A-frame net-recovery gantry');
  },
  longlineDerrick(z,u){
    const p=this.p,m=this.m,d=this.dna,y=this.hull.deckHeight(z),h=d.L*.13;
    const x=-d.B*.25;this.planner.reserve('longline derrick',x,z,.8*u,.9*u);
    p.cylinder(.10*u,.18*u,h,x,y+h/2,z,m.body);
    p.rod([x,y+1.1*u,z],[x+d.B*.25,y+h*.70,z+.9*u],.08*u,m.accent);
    p.rod([x,y+h,z],[x+d.B*.25,y+h*.70,z+.9*u],.011*u,m.rope);
    p.rod([x+d.B*.25,y+h*.70,z+.9*u],[x+d.B*.25,y+.8*u,z+.9*u],.014*u,m.rope);
    p.torus(.35*u,.14*u,x+d.B*.22,y+.69*u,z,m.dark,this.root,[0,Math.PI/2,0]);
    this.equipment.add('Longline recovery derrick');
  },
  crane(x,y,z,u,yaw){
    const p=this.p,m=this.m,g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=yaw+this.r.range(-.16,.16);g.scale.setScalar(this.r.range(.9,1.12));this.root.add(g);
    // The fixed deck pedestal stays put; everything above the slewing ring turns as one assembly.
    p.cylinder(.49*u,.56*u,.17*u,0,.085*u,0,m.dark,g);
    p.cylinder(.42*u,.42*u,.05*u,0,.19*u,0,m.metal,g,null,24);
    const t=new THREE.Group();t.name='Crane slewing column';t.userData.unbatched=true;g.add(t);
    p.cylinder(.33*u,.41*u,.95*u,0,.69*u,0,m.accent,t);
    p.box(.60*u,.48*u,.66*u,0,1.25*u,0,m.accent,t);
    const a=[0,1.39*u,0],b=[0,3.45*u,1.28*u],c=[0,4.05*u,3.83*u];
    p.rod(a,b,.18*u,m.accent,t);p.rod(b,c,.14*u,m.accent,t);
    for(const q of [a,b])p.cylinder(.23*u,.23*u,.52*u,...q,m.dark,t,[0,0,Math.PI/2]);
    p.rod([.15*u,1.61*u,.05*u],[.15*u,2.80*u,.96*u],.075*u,m.dark,t);p.rod([.15*u,2.1*u,.40*u],[.15*u,3.05*u,1.09*u],.040*u,m.metal,t);
    p.rod([.13*u,3.1*u,1.13*u],[.13*u,3.89*u,3.18*u],.043*u,m.metal,t);
    p.pipe([[.22*u,.8*u,0],[.25*u,2.4*u,.48*u],[.23*u,3.53*u,1.3*u],[.18*u,4.10*u,3.8*u]],.023*u,m.rubber,t);
    const hook=new THREE.Group();hook.name='Crane hook';hook.userData.unbatched=true;hook.position.set(0,4.05*u,3.83*u);t.add(hook);
    p.rod([0,0,0],[0,-1.83*u,0],.014*u,m.rope,hook);
    p.torus(.105*u,.026*u,0,-1.9*u,0,m.dark,hook,[0,0,.5],Math.PI*1.65);
    p.sphere(.05*u,.05*u,.07*u,0,-1.70*u,0,m.accent,hook);
    this.animators.push({object:hook,kind:'hook',phase:this.r.range(0,TAU)});
    for(const side of [-1,1])p.rod([side*.08*u,1.34*u,0],[side*.08*u,4.08*u,3.83*u],.008*u,m.rubber,t);
    p.box(.50*u,.04*u,.46*u,-.59*u,.7*u,-.02*u,m.metal,t);
    this.animators.push({object:t,kind:'slew',phase:this.r.range(0,TAU),amp:this.r.range(.18,.32)});
  },
  netWinch(x,y,z,u){
    const p=this.p,m=this.m,d=this.dna,width=d.B*.42,r=clamp(d.L*.025,.56,1.35);
    p.box(width+.45*u,.18*u,1.15*u,x,y+.09*u,z,m.dark);
    for(const side of [-1,1])p.box(.15*u,r*1.5,.91*u,x+side*(width/2+.06*u),y+r*.75,z,m.accent);
    // The drum, its flanges, and the wound net turn together on the shaft as the net is hauled.
    const drum=new THREE.Group();drum.name='Net drum';drum.userData.unbatched=true;drum.position.set(x,y+r,z);this.root.add(drum);
    for(const side of [-1,1]){
      p.cylinder(r*1.15,r*1.15,.10*u,side*width*.5,0,0,m.accent,drum,[0,0,Math.PI/2],24);
      for(let k=0;k<6;k++){const a=k*TAU/6;p.box(.11*u,r*.9,.08*u,side*(width*.5-.06*u),Math.cos(a)*r*.55,Math.sin(a)*r*.55,m.dark,drum,[a,0,0]);}
    }
    p.cylinder(r,r,width,0,0,0,m.net,drum,[0,0,Math.PI/2],24);
    for(let i=0;i<19;i++)p.torus(r+.014,.018*u,-width*.46+i*width*.92/18,0,0,m.rope,drum,[0,Math.PI/2,0]);
    this.animators.push({object:drum,kind:'drum',speed:this.r.range(.18,.35)});
    p.cylinder(.23*u,.23*u,.35*u,x+width*.5+.25*u,y+r,z,m.body,this.root,[0,0,Math.PI/2]);
    for(const side of [-1,1])p.rod([x+side*width*.28,y+r*1.70,z],[x+side*width*.23,y+.04,z-1.3*u],.015*u,m.net);
  },
});
