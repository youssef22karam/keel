/* KEEL / VesselBuilder mixin: cabin, wheelhouse interior, helm and the cozy bridge. */
import * as THREE from 'three';
import { TAU, V, clamp, lerp } from './utils.js';
import { VesselBuilder } from './builder-core.js';

Object.assign(VesselBuilder.prototype, {
  cabin(g){
    const d=this.dna,p=this.p,m=this.m,W=d.bridgeW,D=d.bridgeL,H=d.bridgeH,u=H/2.65;
    const floor=p.footprint(W,D,.13),sill=1.03*u,top=H-.15*u;
    
    // Interior theme drives every surface: cozy teak, workboat steel, or carbon command deck.
    const theme=d.bridgeTheme;
    const wallMat=theme==='teak'?m.innerWood:theme==='steel'?m.body:m.dark;
    const floorMat=theme==='teak'?m.wood:theme==='steel'?m.deck:m.console;
    const trimMat=theme==='teak'?m.bronze:theme==='steel'?m.metal:m.glow;
    this.themeMats={wallMat,floorMat,trimMat};
    p.slab(floor,-.035,.10,floorMat,g);
    // Woven runner rug down the helm aisle.
    p.box(W*.38,.018,D*.74,0,.074,0,theme==='teak'?m.fabric:m.rubber,g);
    p.box(W*.40,.012,D*.76,0,.068,0,trimMat,g);
    // Doorways are real openings: walls, liners, and glazing are split around them.
    const doorW=Math.min(.82*u,D*.20),doorZ=-D*.06,doorH=1.92*u,aftHW=.44*u;
    const gaps=d.openConsole?[]:[{c:[W*.5,doorZ],hw:doorW*.5},{c:[-W*.5,doorZ],hw:doorW*.5},{c:[0,-D*.5],hw:aftHW}];
    const at=(a,b,t)=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t)];
    const spans=(a,b)=>{
      const dx=b[0]-a[0],dz=b[1]-a[1],L2=dx*dx+dz*dz,L=Math.sqrt(L2),cuts=[];
      for(const gp of gaps){
        const t=((gp.c[0]-a[0])*dx+(gp.c[1]-a[1])*dz)/L2;if(t<=0||t>=1)continue;
        if(Math.hypot(a[0]+dx*t-gp.c[0],a[1]+dz*t-gp.c[1])>.04*Math.max(W,D)+.05)continue;
        cuts.push([clamp(t-gp.hw/L,0,1),clamp(t+gp.hw/L,0,1)]);
      }
      cuts.sort((x,y)=>x[0]-y[0]);const keep=[];let s=0;
      for(const [c0,c1] of cuts){if(c0>s+1e-4)keep.push([s,c0]);s=Math.max(s,c1);}
      if(s<1-1e-4)keep.push([s,1]);
      return {keep,cuts};
    };
    // Wainscot lining inside the sill walls, capped with a rail.
    const liner=floor.map(a=>[a[0]*.962,a[1]*.962]);
    liner.forEach((a,i)=>{
      const b=liner[(i+1)%liner.length];if(d.openConsole&&(a[1]+b[1])*.5<D*.24)return;
      const ang=-Math.atan2(b[1]-a[1],b[0]-a[0]);
      for(const [s,e] of spans(a,b).keep){
        const A=at(a,b,s),B=at(a,b,e),L=Math.hypot(B[0]-A[0],B[1]-A[1]);if(L<.03)continue;
        p.box(L,sill*.94,.03*u,(A[0]+B[0])*.5,sill*.47,(A[1]+B[1])*.5,wallMat,g,[0,ang,0]);
        p.box(L,.045*u,.09*u,(A[0]+B[0])*.5,sill*.96,(A[1]+B[1])*.5,theme==='teak'?m.wood:trimMat,g,[0,ang,0]);
        const nk=Math.floor(L/(.42*u));
        if(theme==='teak')for(let k=1;k<nk;k++){const t=k/nk;p.box(.022*u,sill*.80,.012*u,lerp(A[0],B[0],t),sill*.47,lerp(A[1],B[1],t),m.dark,g,[0,ang,0]);}
      }
    });
    const upper=a=>[a[0]*.97,top,a[1]+(a[1]>0?d.cabinRake:0)];
    const edgeBox=(a,b,y,height,thick,mat)=>p.box(Math.hypot(b[0]-a[0],b[1]-a[1]),height,thick,(a[0]+b[0])*.5,y,(a[1]+b[1])*.5,mat,g,[0,-Math.atan2(b[1]-a[1],b[0]-a[0]),0]);
    
    floor.forEach((a,i)=>{
      const b=floor[(i+1)%floor.length],front=(a[1]+b[1])*.5>D*.24;
      if(d.openConsole&&!front)return;
      const {keep,cuts}=spans(a,b),ang=-Math.atan2(b[1]-a[1],b[0]-a[0]);
      const solidAft=!d.openConsole&&(a[1]+b[1])*.5<-D*.47;
      for(const [s,e] of keep){
        const A=at(a,b,s),B=at(a,b,e),L=Math.hypot(B[0]-A[0],B[1]-A[1]);if(L<.03)continue;
        edgeBox(A,B,sill*.5,sill,.095*u,m.body);
        if(solidAft){
          // Solid aft bulkhead: painted outside, lined inside. It carries the settee, shelf, and clocks.
          const mx=(A[0]+B[0])*.5,mz=(A[1]+B[1])*.5,hh=top-sill;
          p.box(L,hh,.05*u,mx,sill+hh*.5,mz-.03*u,m.body,g,[0,ang,0]);
          p.box(L,hh,.035*u,mx,sill+hh*.5,mz+.012*u,wallMat,g,[0,ang,0]);
          continue;
        }
        const n=Math.max(1,Math.round(L/(1.30*u)));
        for(let j=0;j<n;j++){
          const aa=at(A,B,j/n),bb=at(A,B,(j+1)/n);
          const a0=[aa[0],sill,aa[1]],b0=[bb[0],sill,bb[1]],a1=upper(aa),b1=upper(bb);
          const glass=p.quad(a0,b0,b1,a1,m.glass,g);glass.castShadow=false;
          p.rod(a0,b0,.038*u,trimMat,g);p.rod(a1,b1,.05*u,m.body,g);
          // Window posts follow the windscreen rake: broad varnished pillars in teak, slim elsewhere.
          for(const q of (j===0?[[a0,a1],[b0,b1]]:[[b0,b1]]))p.rod(q[0],q[1],theme==='teak'?.075*u:.040*u,theme==='teak'?m.wood:trimMat,g);
        }
      }
      // Solid header over each doorway, from door head to roof line.
      for(const [s,e] of cuts){const A=at(a,b,s),B=at(a,b,e),hh=top-doorH;if(hh>.02)edgeBox(A,B,doorH+hh*.5,hh,.095*u,m.body);}
      p.rod([a[0],.06,a[1]],upper(a),.052*u,m.body,g);
    });
    
    // WAYS IN & OUT: port and starboard sliding doors on overhead tracks, plus a hinged aft door.
    // Each door is a live assembly that opens as you approach and lets you step outside.
    this.doors=[];
    const sideClear=this.sideClear??.6*u,aftClear=this.aftClear??1.2*u;
    if(!d.openConsole){
      for(const side of [-1,1]){
        const doorX=side*(W*.5+.055*u);
        p.box(.05*u,.07*u,doorW*2.15,doorX,doorH+.06*u,doorZ-doorW*.55,m.metal,g);
        p.box(.06*u,.05*u,doorW*1.05,doorX,.035*u,doorZ,m.metal,g);
        for(const e of [-1,1])p.box(.07*u,doorH,.06*u,doorX,doorH*.5,doorZ+e*doorW*.52,theme==='teak'?m.wood:m.dark,g);
        const leaf=new THREE.Group();leaf.name='Sliding bridge door';leaf.userData.unbatched=true;leaf.position.set(doorX+side*.03*u,0,doorZ);g.add(leaf);
        p.box(.045*u,doorH-.04*u,doorW,0,doorH*.5,0,theme==='teak'?m.innerWood:m.body,leaf);
        p.box(.05*u,.58*u,doorW*.66,0,doorH*.70,0,m.glass,leaf);
        p.box(.052*u,.045*u,doorW*.72,0,doorH*.70+.31*u,0,trimMat,leaf);p.box(.052*u,.045*u,doorW*.72,0,doorH*.70-.31*u,0,trimMat,leaf);
        for(const s of [-1,1])p.rod([s*.04*u,doorH*.40,doorW*.36],[s*.04*u,doorH*.58,doorW*.36],.016*u,m.bronze,leaf);
        for(const e of [-.3,.3])p.cylinder(.03*u,.03*u,.03*u,0,doorH+.035*u,e*doorW,m.bronze,leaf,[0,0,Math.PI/2]);
        this.doors.push({kind:'slide',object:leaf,closedZ:doorZ,openZ:doorZ-doorW*.98,local:V(side*W*.42,0,doorZ),open:0,halfW:doorW*.40,outX:side*(W*.5+sideClear),unit:u});
        // Outside step and grab rail so the exit is physically readable.
        p.box(.30*u,.05*u,doorW*.95,side*(W*.5+.20*u),-.04*u,doorZ,m.metal,g);
        p.rod([side*(W*.5+.12*u),.95*u,doorZ+doorW*.62],[side*(W*.5+.12*u),1.65*u,doorZ+doorW*.62],.017*u,m.rail,g);
      }
      // Hinged aft door with jambs, kick plate, window, and handles on both faces. Swings outward.
      const az=-D*.5,dw=aftHW*2-.03*u;
      for(const e of [-1,1])p.box(.07*u,doorH,.11*u,e*(aftHW+.035*u),doorH*.5,az,theme==='teak'?m.wood:m.dark,g);
      p.box(aftHW*2+.16*u,.05*u,.20*u,0,.025*u,az,m.metal,g);
      const hinge=new THREE.Group();hinge.name='Aft bridge door';hinge.userData.unbatched=true;hinge.position.set(-aftHW+.015*u,0,az-.03*u);g.add(hinge);
      p.box(dw,doorH-.05*u,.05*u,dw*.5,doorH*.5,0,theme==='teak'?m.innerWood:m.body,hinge);
      p.box(dw*.6,.52*u,.056*u,dw*.5,doorH*.70,0,m.glass,hinge);
      for(const yy of [doorH*.70+.28*u,doorH*.70-.28*u])p.box(dw*.66,.04*u,.06*u,dw*.5,yy,0,trimMat,hinge);
      p.box(dw,.16*u,.058*u,dw*.5,.11*u,0,trimMat,hinge);
      for(const s of [-1,1])p.rod([dw-.09*u,doorH*.44,s*.05*u],[dw-.09*u,doorH*.56,s*.05*u],.016*u,m.bronze,hinge);
      for(const yy of [.35*u,doorH-.35*u])p.cylinder(.025*u,.025*u,.12*u,0,yy,0,m.bronze,hinge);
      this.doors.push({kind:'hinge',object:hinge,local:V(0,0,az),open:0,halfW:aftHW*.72,outZ:az-aftClear,unit:u});
      // Weather awning over the aft door, carried on brackets fixed outside the bulkhead.
      const awD=.48*u;
      p.box(aftHW*2+.4*u,.05*u,awD,0,doorH+.18*u,az-awD*.5-.03*u,m.body,g,[-.16,0,0]);
      p.box(aftHW*2+.42*u,.07*u,.025*u,0,doorH+.13*u,az-awD-.03*u,m.accent,g);
      for(const e of [-1,1])p.rod([e*(aftHW+.12*u),doorH-.20*u,az-.04*u],[e*(aftHW+.12*u),doorH+.15*u,az-awD*.92],.018*u,m.metal,g);
    }else{
      for(const side of [-1,1])for(const z of [-D*.36,D*.30])p.rod([side*W*.42,.04,z],[side*W*.42,H,z],.045*u,m.metal,g);
    }
    
    const roof=new THREE.Group();roof.name='Removable bridge roof';roof.userData.unbatched=true;g.add(roof);this.roofs.push(roof);
    const roofPlan=floor.map(a=>[a[0]*1.07,a[1]*1.07+(a[1]>0?d.cabinRake:0)]);
    p.slab(roofPlan,H-.04,.16*u,m.body,roof,.03*u);
    p.slab(floor.map(a=>[a[0]*1.025,a[1]*1.025]),H-.075,.045,m.dark,roof);
    for(const side of [-1,1])p.box(.06*u,.035*u,D*.51,side*W*.32,H-.102,-D*.08,m.led,roof);
    // Ceiling character per theme: teak battens, steel grab rail, or carbon light ribs.
    const bat=Math.max(3,Math.floor(D/(.55*u)));
    for(let k=0;k<bat;k++){
      const zz=lerp(-D*.40,D*.40,k/(bat-1));
      if(theme==='teak')p.box(W*.86,.05*u,.07*u,0,H-.12*u,zz,m.wood,roof);
      else if(theme==='carbon')p.box(W*.80,.018*u,.03*u,0,H-.10*u,zz,m.glow,roof);
    }
    if(theme==='steel')for(const s of [-1,1])p.rod([s*W*.22,H-.30*u,-D*.38],[s*W*.22,H-.30*u,D*.30],.02*u,m.metal,roof);
    // Bridge silhouette genes: sun visor over the windscreen and an optional flybridge rail.
    const bg=d.parts.bridge;
    if(bg.visor>.05){
      const vz=D*.5+d.cabinRake+bg.visor*u*.5;
      p.box(W*.92,.07*u,bg.visor*u,0,H+.05*u,vz,m.body,roof,[-bg.visorTilt,0,0]);
      p.box(W*.92,.06*u,.02*u,0,H+.02*u,vz+bg.visor*u*.5,m.accent,roof);
    }
    if(bg.flybridge&&d.tier<=2){
      const rp=roofPlan.map(a=>[a[0]*.94,H+.12*u+.85*u,a[1]*.94]);
      p.pipe([...rp,rp[0]],.022*u,m.rail,roof,true,48);
      for(const a of rp)p.rod([a[0],H+.12*u,a[2]],a,.018*u,m.rail,roof);
      p.box(W*.5,.42*u,.38*u,0,H+.33*u,D*.24,m.body,roof);p.box(W*.52,.06*u,.40*u,0,H+.56*u,D*.24,m.seat,roof);
    }
    
    const consoleZ=D*.22,consoleW=W*.84,helmX=-Math.min(W*.18,.78*u);
    p.box(consoleW,.77*u,.63*u,0,.46*u,consoleZ,m.console,g);
    p.box(consoleW+.065*u,.13*u,.83*u,0,.91*u,consoleZ-.025*u,d.tier===1?m.innerWood:m.dark,g,[-.07,0,0]);
    p.box(consoleW*.96,.035*u,.028*u,0,.99*u,consoleZ+.35*u,m.metal,g);
    const screenWidth=Math.min(1.02*u,(consoleW-.14*u)/3*.87),screenHeight=screenWidth*.75;
    ['chart','radar','sounder'].forEach((kind,i)=>{
      const x=(i-1)*(consoleW/3),screen=new THREE.Group();screen.position.set(x,1.26*u,consoleZ+.06*u);screen.rotation.set(-.17,Math.PI,0);g.add(screen);
      p.box(.055*u,.31*u,.07*u,x,1.04*u,consoleZ+.09*u,m.metal,g);
      p.box(screenWidth+.075*u,screenHeight+.095*u,.065*u,0,0,0,m.rubber,screen);
      const monitor=p.mesh(new THREE.PlaneGeometry(screenWidth,screenHeight),m.display(kind),[0,.006*u,.034*u],null,screen);monitor.userData.unbatched=true;monitor.userData.control=kind==='radar'?'radar':null;
      if(kind==='radar')this.hitTargets.push(monitor);
      for(let b=0;b<4;b++)p.sphere(.010*u,.010*u,.004*u,(b-1.5)*screenWidth*.20,-screenHeight*.5-.025*u,.036*u,b===0?m.green:m.metal,screen);
    });
    
    for(let side=0;side<2;side++){
      const x=consoleW*(side===0?-.40:.41);
      p.box(.19*u,.06*u,.23*u,x,.998*u,consoleZ-.20*u,m.metal,g);
      p.rod([x,.995*u,consoleZ-.20*u],[x,1.24*u,consoleZ-.27*u],.018*u,m.dark,g);
      p.sphere(.04*u,.03*u,.062*u,x,1.25*u,consoleZ-.275*u,side?m.red:m.rubber,g);
    }
    for(let row=0;row<2;row++)for(let b=0;b<8;b++){
      const x=(b-3.5)*consoleW*.055+.13*u;
      p.box(.065*u,.035*u,.07*u,x,1.005*u,consoleZ-.16*u-row*.10*u,b%4===0?m.green:b%4===1?m.orange:m.rubber,g);
    }
    
    // Brass-rimmed analog gauge cluster, like a well-loved wheelhouse console.
    // It sits on the console top between the switch rows and the starboard throttle, tilted to face the helm.
    {
      const R=.05*u,gx0=consoleW*.19+.22*u,gx1=consoleW*.41-.16*u,n=Math.min(7,Math.floor((gx1-gx0)/(2.4*R)));
      if(n>=2){
        const pod=new THREE.Group();pod.position.set((gx0+gx1)*.5,.985*u,consoleZ-.33*u);pod.rotation.x=.6;g.add(pod);
        const pw=n*2.4*R+.06*u;
        p.box(pw,2.7*R,.06*u,0,1.3*R,0,theme==='teak'?m.wood:m.dark,pod);
        p.box(pw+.02*u,.02*u,.07*u,0,2.7*R,0,trimMat,pod);
        for(let i=0;i<n;i++){
          const x=(i-(n-1)/2)*2.4*R;
          p.cylinder(R,R,.03*u,x,1.35*R,-.04*u,theme==='carbon'?m.metal:m.bronze,pod,[Math.PI/2,0,0],20);
          p.cylinder(R*.8,R*.8,.032*u,x,1.35*R,-.043*u,m.paper,pod,[Math.PI/2,0,0],20);
          p.box(R*.09,R*.75,.004*u,x,1.35*R+R*.3,-.061*u,m.red,pod,[0,0,this.r.range(-1.1,1.1)]);
        }
      }
    }
    
    // Procedural Custom Steering Wheel Upgrade Case
    this.proceduralWheel(helmX, consoleZ-.61*u, u, g);
    p.rod([helmX,.76*u,consoleZ-.34*u],[helmX,.97*u,consoleZ-.61*u],.056*u,m.dark,g);
    
    const overhead=new THREE.Group();overhead.position.set(0,H-.26*u,D*.35);overhead.rotation.set(.18,Math.PI,0);g.add(overhead);
    p.box(W*.72,.31*u,.16*u,0,0,0,m.console,overhead);
    const overheadW=Math.min(W*.68,4.4*u),overheadH=.245*u;
    p.mesh(new THREE.PlaneGeometry(overheadW,overheadH),m.display('overhead',overheadW/overheadH),[0,0,.085*u],null,overhead);
    this.helmSeat(helmX,consoleZ-1.96*u,u,g);
    if(W>4.5*u)this.helmSeat(W*.24,consoleZ-2.10*u,u,g);
    
    // VHF handset on its coiled cord, hanging beside the helm like a real working wheelhouse.
    const micX=-W*.40,micZ=consoleZ-.50*u;
    const coil=[];for(let i=0;i<=62;i++){const a=i*TAU/7;coil.push([micX+Math.cos(a)*.017*u,H-.25*u-i*.009*u,micZ+Math.sin(a)*.017*u]);}p.pipe(coil,.008*u,m.rubber,g,false,110);
    p.box(.07*u,.14*u,.045*u,micX,H-.88*u,micZ,m.rubber,g);for(let i=0;i<4;i++)p.box(.052*u,.006*u,.004,micX,H-.92*u+i*.025*u,micZ-.025*u,m.metal,g);
    // Pendant lamp over the helm aisle.
    p.rod([W*.13,H-.05,D*.02],[W*.13,H-.34*u,D*.02],.012*u,m.dark,g);
    p.cylinder(.11*u,.15*u,.11*u,W*.13,H-.40*u,D*.02,m.accent,g);
    p.sphere(.045*u,.045*u,.045*u,W*.13,H-.47*u,D*.02,m.led,g);
    
    if(!d.openConsole){p.box(.86*u,.055*u,.26*u,0,.028*u,-D*.5+.14*u,wallMat,g);p.box(.86*u,.012*u,.22*u,0,.062*u,-D*.5+.14*u,m.rubber,g);}
    const lamp=new THREE.PointLight('#ffe9c1',4*d.scale*d.scale,9*d.scale,2);lamp.position.set(0,H-.4,0);g.add(lamp);this.cabinLight=lamp;
    this.cozyBridge(g,{W,D,u,theme,trimMat,consoleZ,helmX,aftHW});
    
    // Windscreen wipers: outside the glass, pivoting at the sill, lying along the windscreen rake,
    // parked flat and sweeping in tandem across their own pane only.
    {
      const fw=W*.74,fn=Math.max(1,Math.round(fw/(1.30*u))),pw=fw/fn,glassH=top-sill;
      const tilt=Math.atan2(d.cabinRake,glassH),L=Math.min(pw*.70,glassH*.78);
      const ks=[...Array(fn).keys()].sort((a,b)=>Math.abs(a-(fn-1)/2)-Math.abs(b-(fn-1)/2)).slice(0,Math.min(fn,3));
      for(const k of ks){
        const cx=-fw*.5+pw*(k+.5),py=sill+.08*u,pz=D*.5+d.cabinRake*(.08*u/glassH)+.045*u;
        const w=new THREE.Group();w.name='Windscreen wiper';w.userData.unbatched=true;w.position.set(cx+pw*.36,py,pz);w.rotation.x=tilt;w.rotation.z=Math.PI/2;g.add(w);
        p.cylinder(.032*u,.036*u,.05*u,0,0,0,m.dark,w,[Math.PI/2,0,0],12);
        p.rod([0,0,.02*u],[0,L,.02*u],.011*u,m.dark,w);
        p.box(.03*u,.045*u,.02*u,0,L*.62,.034*u,m.dark,w);
        p.rod([0,L*.26,.045*u],[0,L*1.02,.045*u],.015*u,m.rubber,w);
        this.animators.push({object:w,kind:'wiper',park:Math.PI/2,sweep:1.72});
      }
    }
    
    const startZ=Math.max(-D*.5+.47*u,consoleZ-1.66*u);
    this.helm={group:g,start:V(helmX,1.67*u,startZ),minX:-W*.5+.42*u,maxX:W*.5-.42*u,minZ:-D*.5+.39*u,maxZ:consoleZ-.88*u,unit:u,open:d.openConsole};
    this.tourViews=[{name:'Wheelhouse',group:g,eye:this.helm.start.clone(),minX:this.helm.minX,maxX:this.helm.maxX,minZ:this.helm.minZ,maxZ:this.helm.maxZ,fixedY:d.openConsole?null:1.67*u,unit:u,title:d.openConsole?'THE OPEN HELM':'THE COMMAND BRIDGE',hint:'Drag to look. WASD to move. Click radar to change range.'}];
  },
  
  // Procedural Wheel Upgrade design engine
  proceduralWheel(helmX, z, u, g){
    const p=this.p,m=this.m,d=this.dna;
    const wheel=new THREE.Group();wheel.name='Interactive helm wheel';wheel.userData.unbatched=true;wheel.userData.control='wheel';wheel.position.set(helmX,.97*u,z);wheel.rotation.x=-.22;g.add(wheel);this.wheel=wheel;this.hitTargets.push(wheel);
    
    this.buildWheelPart(wheel,u);
  },
  buildWheelPart(wheel,u){
    const p=this.p,m=this.m,G=this.dna.parts.wheel,R=.235*u*G.radius;
    if(G.style==='spoke'){
      // Traditional ship's wheel: rim, turned spokes running through to handles, brass hub.
      p.torus(R,.026*u,0,0,0,m.wood,wheel);p.torus(R*.62,.012*u,0,0,.004*u,m.bronze,wheel);
      for(let i=0;i<G.spokes;i++){
        const a=i*TAU/G.spokes,s=Math.sin(a),c=Math.cos(a);
        p.rod([0,0,0],[s*R,c*R,0],.013*u,m.wood,wheel);
        p.rod([s*R,c*R,0],[s*(R+.085*u),c*(R+.085*u),0],.016*u,m.wood,wheel);
        p.sphere(.022*u,.022*u,.022*u,s*(R+.10*u),c*(R+.10*u),0,m.wood,wheel);
      }
      p.cylinder(.06*u,.06*u,.07*u,0,0,0,m.bronze,wheel,[Math.PI/2,0,0]);
      p.cylinder(.03*u,.03*u,.075*u,0,0,.01*u,m.wood,wheel,[Math.PI/2,0,0]);
    }else if(G.style==='sport'){
      // Stitched leather rim on a dished stainless spider.
      p.torus(R*.92,.024*u,0,0,0,m.rubber,wheel);
      const arms=Math.max(3,Math.min(5,Math.round(G.spokes/2)));
      for(let i=0;i<arms;i++){const a=i*TAU/arms+Math.PI/2;p.rod([0,0,.03*u],[Math.cos(a)*R*.9,Math.sin(a)*R*.9,0],.016*u,m.metal,wheel);}
      for(let i=0;i<24;i++){const a=i*TAU/24;p.box(.006*u,.006*u,.03*u,Math.cos(a)*R*.92,Math.sin(a)*R*.92,.022*u,m.metal,wheel);}
      p.cylinder(.055*u,.065*u,.06*u,0,0,.03*u,m.metal,wheel,[Math.PI/2,0,0]);
      p.cylinder(.035*u,.035*u,.065*u,0,0,.034*u,m.accent,wheel,[Math.PI/2,0,0]);
    }else{
      // Aerospace-style yoke with lit thumb controls.
      const span=.34*u*G.radius;
      p.box(span,.045*u,.05*u,0,.0,0,m.dark,wheel);
      for(const sx of [-1,1]){
        p.box(.05*u,.20*u,.065*u,sx*span*.5,.08*u,0,m.rubber,wheel,[0,0,sx*-.12]);
        p.sphere(.026*u,.026*u,.026*u,sx*span*.5,.19*u,.02*u,m.glow,wheel);
        p.box(.02*u,.02*u,.02*u,sx*span*.42,.12*u,.04*u,m.red,wheel);
      }
      p.cylinder(.045*u,.045*u,.08*u,0,0,0,m.metal,wheel,[Math.PI/2,0,0]);
    }
  },
  // Lived-in wheelhouse fit-out, set against the solid aft bulkhead so doorways and the helm aisle stay clear.
  cozyBridge(g,o){
    const p=this.p,m=this.m,d=this.dna,r=this.r,{W,D,u,theme,trimMat,consoleZ,helmX,aftHW}=o;
    const wood=theme==='teak'?m.wood:theme==='steel'?m.console:m.dark,cush=theme==='carbon'?m.seat:m.fabric;
    // Brass binnacle compass, binoculars, and the skipper's mug at the helm.
    const cz=consoleZ-.37*u;
    p.cylinder(.075*u,.085*u,.07*u,helmX,.99*u,cz,m.bronze,g,null,20);
    p.cylinder(.055*u,.055*u,.01*u,helmX,1.028*u,cz,m.paper,g,null,20);
    p.sphere(.06*u,.045*u,.06*u,helmX,1.032*u,cz,m.glass,g);
    for(const e of [-1,1])p.cylinder(.027*u,.03*u,.13*u,helmX+.30*u+e*.034*u,.99*u,cz,m.dark,g,[Math.PI/2,0,0],12);
    p.box(.05*u,.03*u,.04*u,helmX+.30*u,1.0*u,cz,m.metal,g);
    p.cylinder(.035*u,.03*u,.075*u,helmX+.50*u,1.0*u,cz,m.accent,g);p.torus(.021*u,.007*u,helmX+.535*u,1.0*u,cz,m.accent,g);
    if(d.openConsole){
      // Open helm: a cushioned leaning post behind the wheel.
      const z=consoleZ-1.30*u;
      p.box(.78*u,.42*u,.48*u,0,.23*u,z,m.body,g);p.box(.80*u,.07*u,.50*u,0,.475*u,z,cush,g);
      p.box(.74*u,.26*u,.12*u,0,.84*u,z-.20*u,cush,g);
      for(const s of [-1,1])p.rod([s*.33*u,.50*u,z-.22*u],[s*.33*u,1.04*u,z-.22*u],.02*u,m.metal,g);
      return;
    }
    const zw=-D*.5+.07*u,xa=W*.37-.06*u,xb=aftHW+.12*u,run=xa-xb,free=(consoleZ-2.45*u)-zw;
    // Port: upholstered settee with bolsters under a framed sea painting; a dinette when the bridge is deep.
    if(run>.95*u&&free>.62*u){
      const x0=-xa,x1=-xb-.34*u,cx=(x0+x1)*.5,len=x1-x0,sd=Math.min(.52*u,free-.08*u);
      if(len>.8*u){
        p.box(len,.38*u,sd,cx,.20*u,zw+sd*.5,wood,g);
        p.box(len-.04*u,.10*u,sd-.02*u,cx,.44*u,zw+sd*.5+.01*u,cush,g);
        p.box(len-.04*u,.46*u,.11*u,cx,.74*u,zw+.07*u,cush,g,[-.08,0,0]);
        for(const e of [-1,1])p.sphere(.15*u,.12*u,.06*u,cx+e*len*.30,.63*u,zw+.16*u,m.accent,g);
        const fw=Math.min(len*.7,.95*u);
        p.box(fw+.09*u,.63*u,.03*u,cx,1.64*u,zw+.006*u,m.wood,g);
        p.mesh(new THREE.PlaneGeometry(fw,.54*u),m.painting,[cx,1.64*u,zw+.024*u],null,g);
        if(free>1.80*u){
          const tz=zw+sd+.52*u;
          p.cylinder(.34*u,.34*u,.045*u,cx,.74*u,tz,m.wood,g,null,28);
          p.torus(.34*u,.012*u,cx,.765*u,tz,trimMat,g,[Math.PI/2,0,0]);
          p.cylinder(.035*u,.06*u,.70*u,cx,.37*u,tz,m.metal,g);
          p.cylinder(.22*u,.24*u,.03*u,cx,.015*u,tz,m.metal,g,null,20);
          p.box(.26*u,.008*u,.34*u,cx-.06*u,.768*u,tz,m.paper,g,[0,.3,0]);
          for(const e of [-1,1]){
            const sx=cx+e*.40*u,sz=tz+.36*u;
            p.cylinder(.17*u,.17*u,.07*u,sx,.63*u,sz,cush,g,null,20);
            p.cylinder(.025*u,.05*u,.6*u,sx,.31*u,sz,m.metal,g);
            p.torus(.12*u,.012*u,sx,.26*u,sz,m.metal,g,[Math.PI/2,0,0]);
            p.cylinder(.16*u,.18*u,.02*u,sx,.01*u,sz,m.metal,g,null,16);
          }
        }
      }
    }
    // Beside the door, port: foul-weather jacket on brass hooks, extinguisher below.
    if(run>.35*u){
      const hx=-xb-.17*u;
      for(const e of [-1,1])p.rod([hx+e*.07*u,1.62*u,zw],[hx+e*.07*u,1.58*u,zw+.09*u],.012*u,m.bronze,g);
      p.box(.28*u,.55*u,.08*u,hx,1.30*u,zw+.07*u,m.orange,g);
      p.box(.20*u,.13*u,.09*u,hx,1.56*u,zw+.07*u,m.orange,g);
      this.fireExtinguisher(-(aftHW+.25*u),.42*u,zw+.10*u,u,g);
    }
    // Starboard: chart table with drawers, a bookshelf of almanacs, and the ship's clock and barometer.
    if(run>.75*u){
      const x0=xb+.18*u,len=Math.min(xa-x0,1.15*u),cx=x0+len*.5,deep=clamp(free-.08*u,.30*u,.60*u);
      if(free>.40*u){
        p.box(len,.80*u,deep,cx,.40*u,zw+deep*.5,wood,g);
        for(let k=0;k<3;k++){p.box(len*.86,.012*u,.012*u,cx,.18*u+k*.2*u,zw+deep+.005*u,m.dark,g);p.sphere(.02*u,.02*u,.02*u,cx,.27*u+k*.2*u,zw+deep+.02*u,m.bronze,g);}
        p.box(len+.04*u,.04*u,deep+.04*u,cx,.82*u,zw+deep*.5,theme==='teak'?m.wood:trimMat,g);
        if(deep>.42*u){
          p.box(len*.80,.006*u,deep*.74,cx,.845*u,zw+deep*.5,m.paper,g);
          p.rod([cx-.12*u,.852*u,zw+deep*.45],[cx+.14*u,.852*u,zw+deep*.62],.006*u,m.metal,g);
          p.cylinder(.035*u,.03*u,.08*u,cx+len*.36,.885*u,zw+deep*.78,m.accent,g);
        }
      }
      const sy=1.40*u,sw=Math.min(len,.95*u);
      p.box(sw,.03*u,.22*u,cx,sy,zw+.11*u,m.wood,g);
      for(const e of [-1,1])p.box(.03*u,.32*u,.22*u,cx+e*sw*.5,sy+.16*u,zw+.11*u,m.wood,g);
      p.rod([cx-sw*.5,sy+.17*u,zw+.21*u],[cx+sw*.5,sy+.17*u,zw+.21*u],.008*u,m.bronze,g);
      const spine=[m.red,m.accent,m.dark,m.green,m.paper,m.orange];let bx=cx-sw*.5+.05*u;
      while(bx<cx+sw*.5-.07*u){const bw=r.range(.03,.06)*u,bh=r.range(.18,.27)*u;p.box(bw,bh,.16*u,bx+bw*.5,sy+.015*u+bh*.5,zw+.10*u,spine[r.int(0,5)],g);bx+=bw+.004*u;}
      for(const ix of [-.18,.18]){
        const x=cx+ix*u,y=sy+.62*u;
        p.cylinder(.13*u,.13*u,.04*u,x,y,zw+.02*u,m.bronze,g,[Math.PI/2,0,0],24);
        p.cylinder(.11*u,.11*u,.045*u,x,y,zw+.025*u,m.paper,g,[Math.PI/2,0,0],24);
        p.box(.008*u,.08*u,.005*u,x,y+.03*u,zw+.05*u,m.dark,g,[0,0,r.range(-1,1)]);
      }
    }
  },
  helmSeat(x,z,u,g){
    const p=this.p,m=this.m,cush=this.dna.bridgeTheme==='teak'?m.fabric:m.seat;p.cylinder(.12*u,.22*u,.49*u,x,.31*u,z,m.metal,g);p.cylinder(.31*u,.31*u,.045*u,x,.10*u,z,m.dark,g);
    p.box(.56*u,.13*u,.53*u,x,.62*u,z,cush,g);p.box(.56*u,.65*u,.13*u,x,.99*u,z-.23*u,cush,g,[-.10,0,0]);
    p.box(.39*u,.17*u,.13*u,x,1.38*u,z-.27*u,cush,g);
    for(const side of [-1,1]){p.rod([x+side*.24*u,.64*u,z],[x+side*.32*u,.89*u,z],.024*u,m.metal,g);p.box(.08*u,.06*u,.38*u,x+side*.32*u,.91*u,z+.035*u,m.rubber,g);}
    p.torus(.19*u,.018*u,x,.28*u,z,m.metal,g,[Math.PI/2,0,0]);
  },
});
