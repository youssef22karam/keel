/* KEEL / VesselBuilder mixin: hatches, crates, safety gear, fenders, industrial and apex equipment, bridge displays. */
import * as THREE from 'three';
import { TAU, clamp, lerp } from './utils.js';
import { HullSculptor } from './geometry.js';
import { VesselBuilder } from './builder-core.js';

Object.assign(VesselBuilder.prototype, {
  hatch(x,z,w,len){
    const p=this.p,m=this.m,y=this.hull.deckHeight(z);
    p.box(w+.15,.13,len+.15,x,y+.07,z,m.dark);p.box(w,.16,len,x,y+.19,z,m.body);p.box(w-.15,.018,len-.15,x,y+.28,z,m.deck);
    for(const side of [-1,1]){p.box(.06,.015,len+.32,x+side*(w*.5+.18),y+.03,z,m.accent);for(const dz of [-len*.32,len*.32])p.box(.17,.07,.25,x+side*w*.48,y+.27,z+dz,m.metal);}
    p.torus(.115,.02,x,y+.33,z,m.metal,this.root,[Math.PI/2,0,0]);
    for(let i=0;i<8;i++)p.box(w/12,.015,.14,x-w*.46+i*w*.13,y+.029,z-len*.5-.19,m.accent,this.root,[0,-.55,0]);
  },
  cratePile(x,y,z,u,nx,nz,levels){
    const records=[],w=.68*u,h=.39*u,depth=.50*u,gap=.07*u;
    const colors=['#80a095','#d0a766','#a8b2a2','#7c9eac'];
    for(let row=0;row<nz;row++)for(let col=0;col<nx;col++)for(let l=0;l<levels;l++){
      const xx=x+(col-(nx-1)/2)*(w+gap),zz=z+(row-(nz-1)/2)*(depth+gap),yy=y+l*(h+.02*u),color=new THREE.Color(colors[(col+row*2+l)%colors.length]);
      const add=(a,b,c,dx,dy,dz)=>records.push({position:[a,b,c],scale:[dx,dy,dz],color});
      add(xx,yy+.03*u,zz,w,.05*u,depth);
      for(let k=0;k<3;k++)for(const side of [-1,1]){const yh=yy+.10*u+k*.12*u;add(xx,yh,zz+side*depth/2,w,.065*u,.035*u);add(xx+side*w/2,yh,zz,.035*u,.065*u,depth);}
      for(const sx of [-1,1])for(const sz of [-1,1])add(xx+sx*w*.46,yy+h/2,zz+sz*depth*.45,.045*u,h,.045*u);
    }
    const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),this.m.crate,records.length),o=new THREE.Object3D();
    records.forEach((a,i)=>{o.position.set(...a.position);o.scale.set(...a.scale);o.updateMatrix();mesh.setMatrixAt(i,o.matrix);mesh.setColorAt(i,a.color);});mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.castShadow=true;mesh.receiveShadow=true;mesh.name='Instanced ventilated fish boxes';this.root.add(mesh);
  },
  lifeRing(x,y,z,u,side=1){
    const p=this.p,m=this.m,g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=side*Math.PI/2;this.root.add(g);
    p.torus(.29*u,.074*u,0,0,0,m.orange,g);
    for(let i=0;i<4;i++)p.torus(.29*u,.077*u,0,0,0,m.body,g,[0,0,i*Math.PI/2-.16],.33);
    const points=[];for(let i=0;i<=32;i++){const a=i*TAU/32;points.push([Math.cos(a)*.395*u,Math.sin(a)*.395*u,-.015*u]);}p.pipe(points,.009*u,m.rope,g,true);
    p.box(.48*u,.035*u,.04*u,0,-.15*u,-.105*u,m.metal,g);
  },
  fireExtinguisher(x,y,z,u,parent=this.root){
    const p=this.p,m=this.m;p.cylinder(.085*u,.082*u,.38*u,x,y,z,m.red,parent);p.sphere(.085*u,.07*u,.085*u,x,y+.19*u,z,m.red,parent);p.box(.085*u,.032*u,.06*u,x,y+.29*u,z,m.dark,parent);p.rod([x,y+.25*u,z],[x+.14*u,y+.23*u,z],.018*u,m.rubber,parent);p.pipe([[x+.11*u,y+.23*u,z],[x+.15*u,y+.04*u,z],[x+.10*u,y-.10*u,z]],.015*u,m.rubber,parent);p.box(.105*u,.11*u,.014*u,x,y+.015*u,z-.084*u,m.body,parent);
  },
  safety(){
    const d=this.dna,p=this.p,m=this.m,u=clamp(d.L/38,.7,2.1);
    for(const side of [-1,1]){
      this.lifeRing(side*(d.bridgeW*.5+.12),this.bridgeFloor+.75,d.bridgeZ-d.bridgeL*.20,u,side);
      const z=d.bridgeZ-d.bridgeL*.41,y=this.hull.deckHeight(z)+.62*u,x=side*this.hull.measure(z).width*.80;
      p.cylinder(.32*u,.32*u,1.2*u,x,y,z,m.body,this.root,[Math.PI/2,0,0]);
      p.sphere(.32*u,.32*u,.22*u,x,y,z-.60*u,m.body);p.sphere(.32*u,.32*u,.22*u,x,y,z+.60*u,m.body);
      for(const dz of [-.38,.38]){p.torus(.324*u,.018*u,x,y,z+dz*u,m.dark);p.box(.65*u,.08*u,.13*u,x,y-.32*u,z+dz*u,m.metal);for(const sx of [-1,1])p.box(.045*u,.29*u,.09*u,x+sx*.24*u,y-.47*u,z+dz*u,m.metal);}
      for(let i=0;i<(d.tier===1?2:3);i++){
        const zz=-d.L*.33+i*d.L*.11,s=this.hull.measure(zz),xx=side*(s.width*.955+.12*u),yy=s.sheer-.43*u;
        p.rod([xx,s.sheer+.12,zz],[xx,yy,zz],.012*u,m.rope);
        if(i%2===0){p.torus(.23*u,.075*u,xx,yy-.21*u,zz,m.rubber,this.root,[0,Math.PI/2,0]);}
        else {p.sphere(.20*u,.27*u,.20*u,xx,yy-.21*u,zz,m.orange);p.cylinder(.047*u,.07*u,.11*u,xx,yy+.07*u,zz,m.body);}
      }
      p.cylinder(.07*u,.07*u,.13*u,side*d.bridgeW*.54,this.bridgeFloor+d.bridgeH*.54,d.bridgeZ+d.bridgeL*.34,side===1?m.green:m.port);
      const lightZ=d.bridgeZ-d.bridgeL*.5-.08;
      p.box(.40*u,.25*u,.19*u,side*d.bridgeW*.35,this.bridgeFloor+d.bridgeH-.3,lightZ,m.dark);p.box(.32*u,.18*u,.021*u,side*d.bridgeW*.35,this.bridgeFloor+d.bridgeH-.3,lightZ-.11*u,m.led);
    }
    this.fireExtinguisher(-d.bridgeW*.49,this.bridgeFloor+.43,d.bridgeZ-d.bridgeL*.46,.9);
    this.equipment.add('Life rings and capsule life rafts');this.equipment.add('Navigation lights and deck floodlights');this.equipment.add('Fire and emergency equipment');
    if(d.tier<=2)this.buoyFenders(u);
  },
  // Rail-slung buoys and fenders: the bright color pops that make a working boat feel alive.
  buoyFenders(u){
    const d=this.dna,p=this.p,m=this.m,r=this.r,count=Math.round(lerp(4,11,clamp(d.L/26,0,1)));
    for(let i=0;i<count;i++){
      const side=i%2===0?-1:1,z=lerp(-d.L*.44,d.L*.30,(i+.5)/count),s=this.hull.measure(z);
      if(Math.abs(z-d.bridgeZ)<d.bridgeL*.6&&side*s.width<d.bridgeW)continue;
      const x=side*(s.width*.99),y=s.sheer-r.range(.30,.60);
      const kind=r.next();
      if(kind<.55){
        p.cylinder(.11*u,.13*u,.30*u,x,y,z,r.pick([m.orange,m.accent,m.rubber]),this.root,[Math.PI/2,0,0]);
        p.torus(.13*u,.018*u,x,y+.14*u,z,m.rope,this.root,[Math.PI/2,0,0]);
      }else{
        p.sphere(.14*u,.14*u,.14*u,x,y,z,r.pick([m.orange,m.green,m.body]));
      }
      p.rod([x,s.sheer+.02,z],[x,y+.12*u,z],.011*u,m.rope);
    }
  },
  industrialEquipment(){
    const d=this.dna,p=this.p,m=this.m,u=clamp(d.L/43,1.2,3.3);
    for(const side of [-1,1]){
      const z=-d.L*.08,x=side*d.B*.32;this.crane(x,this.hull.deckHeight(z),z,u,Math.PI+side*.33);
    }
    const padZ=-d.L*.347,padW=d.B*.79,padL=d.L*.176,y=this.hull.deckHeight(padZ)+.30;
    const g=new THREE.Group();g.position.z=padZ;this.root.add(g);
    p.slab(p.footprint(padW,padL,.14),y,.24,m.body,g);p.slab(p.footprint(padW*.94,padL*.94,.14),y+.245,.035,m.dark,g);
    const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');x.clearRect(0,0,512,512);x.strokeStyle='#eee8cc';x.lineWidth=7;x.beginPath();x.arc(256,256,212,0,TAU);x.stroke();x.fillStyle='#eee8cc';x.font='bold 260px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText('H',256,269);
    const mat=new THREE.MeshBasicMaterial({name:'Helipad markings',map:m.texture(c),transparent:true,depthWrite:false,side:THREE.DoubleSide});m.all.push(mat);
    const diam=Math.min(padW,padL)*.85;p.mesh(new THREE.PlaneGeometry(diam,diam),mat,[0,y+.29,0],[-Math.PI/2,0,0],g);
    for(const side of [-1,1])for(let i=0;i<6;i++)p.sphere(.075*u,.05*u,.075*u,side*padW*.47,y+.30,lerp(-padL*.37,padL*.37,i/5),m.led,g);
    for(let i=0;i<3;i++)this.hatch(0,-d.L*.18+i*d.L*.055,d.B*.32,d.L*.034);
    this.cratePile(-d.B*.29,this.hull.deckHeight(-d.L*.205)+.04,-d.L*.205,Math.min(u,1.8),2,2,2);
    for(const side of [-1,1]){
      const z=d.bridgeZ+d.bridgeL*.15,x=side*d.B*.36,yy=this.hull.deckHeight(z)+1.2*u;
      p.sphere(.68*u,.43*u,1.50*u,x,yy,z,m.orange);p.sphere(.54*u,.30*u,.72*u,x,yy+.27*u,z+.23*u,m.body);p.box(.61*u,.30*u,.85*u,x,yy+.32*u,z+.30*u,m.glass);
      p.rod([side*d.B*.29,this.hull.deckHeight(z),z-.6*u],[x,yy+.7*u,z-.6*u],.065*u,m.body);
    }
    this.equipment.add('Twin heavy hydraulic cranes');this.equipment.add('Stern helipad and perimeter lighting');this.equipment.add('Covered processing holds');this.equipment.add('Enclosed rescue tenders');this.equipment.add('Satellite communication domes');
  },
  multihull(){
    const d=this.dna,p=this.p,m=this.m;
    for(const side of [-1,1]){
      const g=new THREE.Group();g.position.set(side*d.B*.398,0,-d.L*.015);this.root.add(g);
      const outrigger=new HullSculptor(d,{L:d.L*.86,B:d.B*.185,D:d.D*.76,F:d.F*.60,bowRise:d.F*.42,sternWidth:.6,fullness:1.15,flare:.13});
      outrigger.shell(p,m.hull,g);outrigger.deck(p,m.dark,g);
      for(const edge of [-1,1])p.pipe(outrigger.sections.filter((_,i)=>i%3===0).map(s=>[edge*s.width*.985,s.sheer+.055,s.z]),Math.max(.06,d.L*.0005),m.glow,g);
      const aft=-outrigger.L*.48,y=-d.D*.1,R=d.B*.045;
      p.cylinder(R,R*1.2,R*1.15,0,y,aft,m.dark,g,[Math.PI/2,0,0]);p.torus(R*.86,R*.08,0,y,aft-R*.60,m.glow,g);p.cylinder(R*.72,R*.72,.05,0,y,aft-R*.61,m.glow,g,[Math.PI/2,0,0]);
    }
    const plan=[[-d.B*.43,-d.L*.24],[-d.B*.19,-d.L*.34],[d.B*.19,-d.L*.34],[d.B*.43,-d.L*.24],[d.B*.43,d.L*.21],[d.B*.20,d.L*.32],[-d.B*.20,d.L*.32],[-d.B*.43,d.L*.21]];
    p.slab(plan,d.F*.77,d.F*.10,m.dark);
    for(const side of [-1,1])for(const z of [-d.L*.21,d.L*.20]){
      p.box(d.B*.115,d.F*.25,d.L*.08,side*d.B*.385,d.F*.66,z,m.dark);
      const foil=[[side*d.B*.12,z-d.L*.035],[side*d.B*.46,z-d.L*.07],[side*d.B*.47,z-d.L*.035],[side*d.B*.13,z+d.L*.025]];
      p.slab(foil,-d.D*.85,d.D*.065,m.dark);p.rod([side*d.B*.37,-d.D*.8,z-d.L*.025],[side*d.B*.39,d.F*.3,z],d.D*.028,m.metal);
    }
    this.equipment.add('Triple wave-piercing carbon hulls');this.equipment.add('Active submerged hydrofoils');this.equipment.add('Paired plasma-drive nacelles');
  },
  apexEquipment(){
    const d=this.dna,p=this.p,m=this.m,u=d.L/100,y=d.F*.87;
    for(const side of [-1,1]){
      const x=side*d.B*.31,z=-d.L*.14,r=d.B*.072;
      p.mesh(new THREE.CylinderGeometry(r,r,r*.7,32,1,true),m.dark,[x,y+r*.21,z]);
      p.cylinder(r*.93,r*.93,.06*u,x,y+r*.28,z,m.glow);
      p.torus(r,r*.037,x,y+r*.57,z,m.glow,this.root,[Math.PI/2,0,0]);
      p.torus(r,r*.025,x,y-r*.13,z,m.metal,this.root,[Math.PI/2,0,0]);
      for(let i=0;i<8;i++){const a=i*TAU/8;p.rod([x+Math.sin(a)*r,y-r*.10,z+Math.cos(a)*r],[x+Math.sin(a)*r,y+r*.55,z+Math.cos(a)*r],.04*u,m.metal);}
      for(const zz of [d.L*.12,-d.L*.28]){
        const pod=new THREE.Group();pod.position.set(side*d.B*.34,y+.6*u,zz);pod.userData.unbatched=true;this.root.add(pod);
        p.sphere(1.25*u,.45*u,1.85*u,0,.6*u,0,m.body,pod);p.sphere(.75*u,.4*u,1.08*u,0,.85*u,.24*u,m.glass,pod);
        for(const sx of [-1,1])for(const sz of [-1,1]){p.rod([sx*.5*u,.48*u,sz*.65*u],[sx*1.65*u,.40*u,sz*1.10*u],.07*u,m.dark,pod);p.torus(.46*u,.085*u,sx*1.65*u,.4*u,sz*1.10*u,m.dark,pod,[Math.PI/2,0,0]);p.torus(.33*u,.035*u,sx*1.65*u,.39*u,sz*1.10*u,m.glow,pod,[Math.PI/2,0,0]);}
        this.animators.push({object:pod,kind:'drone',baseY:pod.position.y,phase:zz,speed:.55});
      }
    }
    const hologram=new THREE.Group();hologram.position.set(0,this.hull.deckHeight(-d.L*.21)+1.1*u,-d.L*.21);hologram.userData.unbatched=true;this.root.add(hologram);
    p.cylinder(.9*u,1.2*u,.55*u,0,-.25*u,0,m.dark,hologram);
    for(let i=0;i<3;i++)p.torus((1.1+i*.24)*u,.018*u,0,.8*u,0,m.glow,hologram,[i*.65,0,i*.42]);
    this.animators.push({object:hologram,kind:'radar',speed:.16});
    this.equipment.add('Four autonomous fishing drones');this.equipment.add('Bioluminescent containment wells');this.equipment.add('Holographic volumetric sonar');this.equipment.add('Multilevel command spire');
  },

  drawDisplays(time){
    for(const display of this.m.screenTextures){
      const {ctx:c,canvas,kind}=display,w=canvas.width,h=canvas.height;
      c.fillStyle='#071d20';c.fillRect(0,0,w,h);
      if(kind==='overhead'){
        c.textAlign='left';c.fillStyle='#729f90';c.font=`${Math.max(7,h*.12)}px monospace`;c.fillText('KEEL / PROPULSION MONITORING',w*.015,h*.16);
        for(let i=0;i<6;i++){
          const x=(i+.5)*w/6,y=h*.54,r=h*.265;c.strokeStyle='#2b5b53';c.lineWidth=Math.max(2,h*.033);c.beginPath();c.arc(x,y,r,.6,5.7);c.stroke();c.strokeStyle=i===4?'#d9b573':'#bbd89e';c.beginPath();c.arc(x,y,r,.6,3.6+i*.17);c.stroke();
          c.strokeStyle='#bbd89e';c.lineWidth=1;c.beginPath();c.moveTo(x,y);c.lineTo(x-Math.cos(i*.30)*r*.70,y-Math.sin(i*.30)*r*.70);c.stroke();
          c.fillStyle='#cce8ba';c.font=`${h*.15}px monospace`;c.textAlign='center';c.fillText(['780','780','4.2','82','24','98'][i],x,y+r*.60);c.fillStyle='#76a28d';c.font=`${h*.12}px monospace`;c.fillText(['PORT RPM','STBD RPM','OIL / BAR','COOLANT','VOLTS','FUEL %'][i],x,h*.94);
        }
        display.texture.needsUpdate=true;continue;
      }
      c.font='14px monospace';c.fillStyle='#769b92';c.textAlign='left';
      c.fillText(kind==='radar'?'KEEL / X-BAND RADAR':kind==='chart'?'KEEL / NAVIGATION':kind==='sounder'?'KEEL / ECHO SOUNDER':'PROPULSION  /  SYSTEMS NOMINAL',18,27);
      c.strokeStyle='#1a4241';c.lineWidth=1;
      if(kind==='radar'){
        const cx=238,cy=208,R=146;
        for(let r=1;r<=4;r++){c.beginPath();c.arc(cx,cy,R*r/4,0,TAU);c.stroke();}
        for(let i=0;i<12;i++){const a=i*TAU/12;c.beginPath();c.moveTo(cx+Math.sin(a)*18,cy+Math.cos(a)*18);c.lineTo(cx+Math.sin(a)*R,cy+Math.cos(a)*R);c.stroke();}
        const angle=time*.55;
        for(let i=0;i<25;i++){const a=angle-i*.013;c.strokeStyle=`rgba(94,226,146,${.50*(1-i/25)})`;c.beginPath();c.moveTo(cx,cy);c.lineTo(cx+Math.sin(a)*R,cy-Math.cos(a)*R);c.stroke();}
        for(let i=0;i<9;i++){const a=i*2.47+.4,rr=(40+(i*37)%100)*6/this.radarRange;if(rr>R)continue;const age=((angle-a)%TAU+TAU)%TAU;c.fillStyle=`rgba(183,234,176,${.35+.65*Math.exp(-age)})`;c.fillRect(cx+Math.sin(a)*rr,cy-Math.cos(a)*rr,3+i%3,3);}
        c.fillStyle='#d2ecb2';c.beginPath();c.moveTo(cx,cy-8);c.lineTo(cx-5,cy+7);c.lineTo(cx+5,cy+7);c.fill();
        c.font='12px monospace';c.fillStyle='#87b694';c.fillText(`${this.radarRange}.0 NM`,405,58);c.fillText('HDG 034',399,80);c.fillText('GAIN 76',397,101);c.fillText('N',232,49);c.fillText('RANGE + : CLICK DISPLAY',18,369);
      }else if(kind==='chart'){
        c.fillStyle='#123437';c.fillRect(14,45,484,316);
        for(let i=0;i<14;i++){
          c.strokeStyle=i<6?'#48755c':'#28514c';c.beginPath();
          for(let k=0;k<=35;k++){const x=k*w/35,y=85+i*14+Math.sin(k*.25+i*.15)*45+Math.cos(k*.52+i*.20)*15;if(k===0)c.moveTo(x,y);else c.lineTo(x,y);}c.stroke();
        }
        c.strokeStyle='#a5c882';c.lineWidth=2;c.setLineDash([5,6]);c.beginPath();c.moveTo(155,355);c.lineTo(259,218);c.lineTo(334,81);c.stroke();c.setLineDash([]);
        c.fillStyle='#c5e9a4';c.beginPath();c.moveTo(262,194);c.lineTo(251,220);c.lineTo(272,220);c.closePath();c.fill();
        c.fillStyle='#8cb7a1';c.font='12px monospace';c.fillText('58 21.842 N',28,67);c.fillText('006 14.096 E',28,84);c.fillText('DEPTH  124 m',362,343);
      }else if(kind==='sounder'){
        for(let x=0;x<480;x+=3){const depth=230+Math.sin(x*.017+time*.18)*23+Math.sin(x*.05)*12;c.fillStyle='#be7443';c.fillRect(x+16,depth,3,h-depth-26);c.fillStyle='#d3b75e';c.fillRect(x+16,depth-7,3,7);c.fillStyle='#346552';c.fillRect(x+16,depth-14,3,7);}
        c.strokeStyle='#397175';for(let i=0;i<5;i++){c.beginPath();c.moveTo(18,70+i*49);c.lineTo(492,70+i*49);c.stroke();}
        c.fillStyle='#b2d5b0';c.font='48px monospace';c.fillText('124.6',24,105);c.font='13px monospace';c.fillText('METERS / 200 kHz',27,128);c.fillText('BOTTOM LOCK  /  ACTIVE',20,370);
      }else{
        for(let i=0;i<6;i++){
          const x=47+i*83,y=204;c.strokeStyle='#39766b';c.lineWidth=6;c.beginPath();c.arc(x,y,29,.7,5.6);c.stroke();c.strokeStyle=i===4?'#d9b573':'#bbd89e';c.beginPath();c.arc(x,y,29,.7,3.6+i*.17);c.stroke();c.fillStyle='#cce8ba';c.font='19px monospace';c.textAlign='center';c.fillText(['780','780','4.2','82','24','98'][i],x,y+6);c.font='13px monospace';c.fillStyle='#73a08c';c.fillText(['PORT RPM','STBD RPM','OIL BAR','COOLANT','VOLTS','FUEL %'][i],x,276);
        }c.textAlign='left';
      }
      display.texture.needsUpdate=true;
    }
  },
});
