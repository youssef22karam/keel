/* KEEL / Vessel DNA: palettes, price tiers, part registry data and the seeded VesselDNA generator. */
import * as THREE from 'three';
import { Random, TAU, clamp, hash, lerp } from './utils.js';

const PALETTES = [
  {name:'North Atlantic',hull:'#326f66',body:'#edece0',accent:'#d0a54e',bottom:'#98503e',deck:'#9eaaa0',trim:'#273d37'},
  {name:'Bluewater',hull:'#315570',body:'#f0ede0',accent:'#cf7850',bottom:'#8d493c',deck:'#9caaa7',trim:'#293c49'},
  {name:'Red ochre',hull:'#a34435',body:'#e9e6d5',accent:'#d6b369',bottom:'#463a36',deck:'#a6aaa0',trim:'#3b413c'},
  {name:'Harbor gold',hull:'#c39842',body:'#eae5d7',accent:'#4b737b',bottom:'#484742',deck:'#a5ac9c',trim:'#394641'},
  {name:'Sage passage',hull:'#708476',body:'#ede9dc',accent:'#d28753',bottom:'#635649',deck:'#b2b2a0',trim:'#34473f'},
  {name:'Arctic blue',hull:'#608e9a',body:'#f0eee6',accent:'#dc8752',bottom:'#465961',deck:'#a2b1ab',trim:'#304c53'},
  {name:'Ivory expedition',hull:'#d9ddd3',body:'#f4f1e6',accent:'#be8653',bottom:'#355c60',deck:'#b5a78b',trim:'#314c4d'},
  {name:'Classic trawler',hull:'#1f5fa8',body:'#f5f3e9',accent:'#e8641f',bottom:'#1a2c3c',deck:'#9aa4a6',trim:'#15324f'},
  {name:'Buoy orange',hull:'#f2f2ec',body:'#f7f5ea',accent:'#e2521e',bottom:'#2a3a44',deck:'#9fa9a3',trim:'#243239'},
  {name:'Regatta red',hull:'#c3251f',body:'#f3efe2',accent:'#17344a',bottom:'#2b1f1b',deck:'#a6a79a',trim:'#2c1e1a'},
  {name:'Cannery yellow',hull:'#e2b633',body:'#2e4259',accent:'#c8502a',bottom:'#3c3022',deck:'#9ea299',trim:'#1f2d3c'},
  {name:'Lagoon teal',hull:'#1c8d8a',body:'#f6f2e4',accent:'#f0a33a',bottom:'#163635',deck:'#9bb0ac',trim:'#143634'}
];
const TIERS = [
  {name:'Primitive craft',range:'$100 to $10K',min:100,max:1e4,length:[3,7],beam:[.27,.36],draft:[.055,.082],freeboard:[.09,.12],material:'Clinker-planked timber',types:['Clinker-built skiff','Estuary rowboat','Open-water panga']},
  {name:'Coastal commercial',range:'$10K to $500K',min:1e4,max:5e5,length:[8,20],beam:[.245,.31],draft:[.05,.08],freeboard:[.08,.11],material:'Composite / aluminum',types:['Coastal sportfisher','Pilothouse longliner','Coastal fishing launch']},
  {name:'Deep-sea commercial',range:'$500K to $15M',min:5e5,max:1.5e7,length:[20,50],beam:[.23,.285],draft:[.075,.108],freeboard:[.078,.10],material:'Marine-grade steel',types:['North Atlantic trawler','Offshore longliner','Stern-net trawler']},
  {name:'Industrial expedition',range:'$15M to $250M',min:1.5e7,max:2.5e8,length:[50,140],beam:[.175,.23],draft:[.055,.081],freeboard:[.052,.075],material:'High-tensile steel',types:['Factory expedition ship','Oceanic research trawler','Expedition fishing yacht']},
  {name:'Apex harvester',range:'$250M and beyond',min:2.5e8,max:1e9,length:[140,400],beam:[.225,.285],draft:[.045,.065],freeboard:[.042,.061],material:'Carbon / plasma alloy',types:['Hydrofoil trimaran','Apex deep-sea harvester','Wave-piercing fortress']}
];
const NAMES=['Peregrine','Halcyon','Meridian','Northstar','Calypso','Kestrel','Solstice','Tideliner','Wayfarer','Aurora','Haven','Albatross','Mariner','Sundowner','Nomad','Arctic Fox'];

const PART_KINDS=['radar','light','exhaust','propeller','outrigger','wheel','bridge'];
export const PART_INFO={
  radar:{label:'Radar array',styles:{dome:'Enclosed radome',array:'Open-array scanner',orbital:'Twin-ring orbital',dish:'Tracking dish'}},
  light:{label:'Searchlight',styles:{brass:'Brass barrel lamp',twin:'Twin halogen pods',array:'LED flood bar'}},
  exhaust:{label:'Exhaust stacks',styles:{classic:'Tall twin stacks',casing:'Streamlined funnel',vents:'Louvred vent towers'}},
  propeller:{label:'Propellers',styles:{classic:'Spade-blade bronze',skewed:'High-skew scimitar',ducted:'Ducted thruster'}},
  outrigger:{label:'Outrigger booms',styles:{carbon:'Carbon whip poles',telescopic:'Telescopic alloy',truss:'Braced steel truss'}},
  wheel:{label:'Helm wheel',styles:{spoke:'Varnished spoke wheel',sport:'Leather sport wheel',yoke:'Flight yoke'}},
  bridge:{label:'Bridge form',styles:{}}
};
// Continuous genes: discrete style plus real-valued shape parameters gives unbounded variety.
function partGenes(kind,r,tier){
  switch(kind){
    case 'radar':return {style:r.pick(['dome','array','orbital','dish']),span:r.range(.75,1.45),height:r.range(.85,1.3),speed:r.range(.45,1.1)};
    case 'light':return {style:r.pick(['brass','twin','array']),count:r.int(2,6),size:r.range(.8,1.35)};
    case 'exhaust':return {style:r.pick(['classic','casing','vents']),height:r.range(.75,1.6),rake:r.range(-.28,.04),girth:r.range(.8,1.3)};
    case 'propeller':return {style:r.pick(['classic','skewed','ducted']),blades:r.int(3,6),pitch:r.range(.14,.48),skew:r.range(.15,.6),rpm:r.range(2.2,4.2)};
    case 'outrigger':return {style:r.pick(['carbon','telescopic','truss']),reach:r.range(.8,1.25),lift:r.range(.85,1.2),rods:r.int(2,5)};
    case 'wheel':return {style:tier>=4?'yoke':r.pick(['spoke','spoke','sport','yoke']),spokes:r.int(5,10),radius:r.range(.85,1.18)};
    case 'bridge':{const style=tier<=2?r.pick(['visor','clean','flybridge']):r.pick(['visor','visor','clean']),v=r.range(.2,.7);return {style,visor:style==='visor'?v:0,visorTilt:r.range(.05,.28),flybridge:style==='flybridge'};}
  }
}
export function describePart(kind,g){
  const s=PART_INFO[kind].styles[g.style]||'Custom';
  switch(kind){
    case 'radar':return `${s}, span ${g.span.toFixed(2)}x, ${(g.speed*9.5).toFixed(0)} rpm`;
    case 'light':return `${s}, ${g.style==='array'?g.count+' LED cells':g.style==='twin'?'2 pods':'single beam'}, ${g.size.toFixed(2)}x`;
    case 'exhaust':return `${s}, ${g.height.toFixed(2)}x tall, rake ${(g.rake*57.3).toFixed(0)} deg`;
    case 'propeller':return `${s}, ${g.blades} blades, pitch ${g.pitch.toFixed(2)}`;
    case 'outrigger':return `${s}, reach ${g.reach.toFixed(2)}x, ${g.rods} rod holders a side`;
    case 'wheel':return `${s}, ${g.style==='yoke'?'twin grips':g.spokes+' spokes'}, ${g.radius.toFixed(2)}x`;
    case 'bridge':return g.style==='visor'?`Sun-visor brow, ${g.visor.toFixed(2)} m`:g.style==='flybridge'?'Open flybridge with rail':'Clean flush roofline';
  }
}

export class VesselDNA {
  constructor(cost,seed,upgrades={}){
    this.cost=cost;this.seed=seed>>>0;
    // Hash the exact numeric brief, not a rounded budget bucket.
    this.key=`${cost.toString()}:${this.seed}:keel-v1`;
    this.hash=hash(this.key);
    const r=this.stream('architecture');
    this.tier=cost<1e4?0:cost<5e5?1:cost<1.5e7?2:cost<2.5e8?3:4;
    this.info=TIERS[this.tier];
    this.progress=clamp(Math.log(cost/this.info.min)/Math.log(this.info.max/this.info.min),0,1);
    const p=clamp(this.progress+r.range(-.095,.095),0,1);
    this.L=lerp(...this.info.length,p);
    if(this.tier===4&&cost>1e9)this.L+=230*Math.log10(cost/1e9);
    this.B=this.L*r.range(...this.info.beam);
    this.D=this.L*r.range(...this.info.draft);
    this.F=this.L*r.range(...this.info.freeboard);
    this.bowRise=this.F*r.range(.32,.78);
    this.fullness=r.range(.70,1.15);
    this.sternWidth=r.range(.62,.94);
    this.bowRake=r.range(.25,1.2);
    this.sternRake=r.range(.12,.65);
    this.flare=r.range(.03,.19);
    this.bilge=r.range(.62,1.05);
    this.shoulder=r.range(.60,.73);
    this.entrance=r.range(.81,.88);
    this.maxBeamAt=r.range(.25,.37);
    this.variant=r.int(0,2);
    this.type=this.info.types[this.variant];
    this.forward=this.tier<2||this.tier>2||r.next()>.23;
    this.openConsole=this.tier===1&&this.variant===0&&this.progress<.65;
    this.bridgeZ=this.L*(this.forward?r.range(.11,.19):r.range(-.19,-.11));
    this.bridgeW=this.tier===1?Math.max(1.8,this.B*.64):this.tier===2?this.B*r.range(.62,.70):this.tier===3?clamp(this.B*.62,7,17):clamp(this.B*.42,12,24);
    this.bridgeL=this.tier===1?clamp(this.L*.27,2.65,5.4):this.tier===2?clamp(this.L*.21,4.2,9.4):this.tier===3?clamp(this.L*.14,7.5,13):clamp(this.L*.10,10,17);
    this.bridgeH=[1.5,2.18,2.65,3.0,3.65][this.tier]*r.range(.95,1.05);
    // Pedestal only where a raised bridge is structurally plausible. No crew cabins anywhere.
    this.levels=this.tier<2?0:this.tier===2?(this.L>29?1:0):1;
    this.cabinRake=r.range(-.07,.12)*this.bridgeL;
    // Each upgradeable part reads its own isolated stream, so upgrading one part never
    // perturbs the hull, livery, or any other part.
    this.upgrades=upgrades||{};this.parts={};
    for(const kind of PART_KINDS){
      const up=this.upgrades[kind];
      const rr=up?new Random(hash(`${kind}:${up.seed}:keel-upgrade`)):this.stream('part-'+kind);
      this.parts[kind]={...partGenes(kind,rr,this.tier),mark:up?up.mark:1};
    }
    const tr=this.stream('theme');
    this.bridgeTheme=this.tier===4?'carbon':this.tier===3?tr.pick(['steel','carbon','teak']):this.tier===2?tr.pick(['teak','steel','steel']):tr.pick(['teak','teak','steel','carbon']);
    // Livery comes from the exact-cost stream, so a one-dollar change repaints the ship.
    // Colors must keep their leading '#': without it three.js silently falls back to white.
    const lr=this.stream('livery');
    this.palette={...PALETTES[lr.int(0,PALETTES.length-1)]};
    const c=this.palette,hs=lr.range(-.035,.035);
    c.hull='#'+new THREE.Color(c.hull).offsetHSL(hs,lr.range(-.05,.08),lr.range(-.035,.035)).getHexString();
    c.accent='#'+new THREE.Color(c.accent).offsetHSL(lr.range(-.03,.03),lr.range(0,.08),0).getHexString();
    c.trim='#'+new THREE.Color(c.trim).offsetHSL(hs,0,lr.range(-.02,.03)).getHexString();
    if(this.tier===4){this.palette.hull=r.pick(['#354c56','#d5dfdd','#324c4d','#536878']);this.palette.accent=r.pick(['#71dbc3','#a6d582','#6cc9e5']);this.palette.bottom='#23343c';this.palette.trim='#152b34';}
    this.name=NAMES[this.hash%NAMES.length];
    this.id=this.hash.toString(16).padStart(8,'0').toUpperCase();
    // The exact decimal value bends the livery, so every dollar is a different paint job.
    this.costHue=(1/cost)%(TAU/PALETTES.length);
    this.blockCoefficient=this.tier===0?.38:this.tier===1?.46:this.tier===4?.32:r.range(.54,.68);
    this.displacement=this.L*this.B*this.D*this.blockCoefficient*1.025;
    this.speed=this.tier===0?(cost>4200?lerp(8.5,16,(cost-4200)/5800):lerp(2.8,4.8,this.progress)):this.tier===1?r.range(18,34):this.tier===2?r.range(10,16):this.tier===3?r.range(14,23):r.range(38,72);
    this.hold=this.displacement*[.12,.17,.36,.42,.38][this.tier];
    this.material=this.info.material;
    if(this.tier===1)this.material=this.variant===2?'Marine aluminum':'Reinforced fiberglass';
    this.scale=28/this.L;
  }
  stream(label){return new Random(hash(`${this.key}:${label}`));}
}
