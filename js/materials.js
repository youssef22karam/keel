/* KEEL / MaterialFactory: shared Three.js materials and procedural textures for every vessel. */
import * as THREE from 'three';
import { TAU } from './utils.js';

export class MaterialFactory {
  constructor(dna){
    this.dna=dna;this.all=[];this.textures=new Set();
    const p=dna.palette,r=dna.stream('surface');
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    const c=canvas.getContext('2d');c.fillStyle='#f0f0e8';c.fillRect(0,0,256,256);
    for(let i=0;i<4500;i++){const v=r.int(195,255);c.fillStyle=`rgba(${v},${v},${v},${r.range(.05,.17)})`;c.fillRect(r.int(0,255),r.int(0,255),r.range(.5,2),r.range(1,7));}
    if(dna.tier===2){
      c.strokeStyle='#6c75651b';c.lineWidth=.65;for(let y=0;y<256;y+=64){c.beginPath();c.moveTo(0,y);c.lineTo(256,y);c.stroke();for(let x=0;x<256;x+=64){c.beginPath();c.moveTo(x+(y%128?32:0),y);c.lineTo(x+(y%128?32:0),y+64);c.stroke();}}
      for(let i=0;i<34;i++){c.fillStyle=`rgba(105,78,49,${r.range(.025,.1)})`;c.fillRect(r.int(0,255),r.int(0,255),r.range(.4,1.8),r.range(6,40));}
    }
    if(dna.tier===4){for(let y=0;y<256;y+=8)for(let x=0;x<256;x+=8){c.fillStyle=(x/8+y/8)%2?'#9ba5a35b':'#e8edecb3';c.fillRect(x,y,7,7);c.strokeStyle='#60737735';c.beginPath();if((x/8+y/8)%2){c.moveTo(x+2,y);c.lineTo(x+2,y+7);}else{c.moveTo(x,y+2);c.lineTo(x+7,y+2);}c.stroke();}}
    const paint=this.texture(canvas);paint.wrapS=paint.wrapT=THREE.RepeatWrapping;paint.repeat.set(4,1.5);
    const normalData=new Uint8Array(64*64*4);
    for(let i=0;i<64*64;i++){normalData[i*4]=r.int(119,137);normalData[i*4+1]=r.int(119,137);normalData[i*4+2]=254;normalData[i*4+3]=255;}
    const normal=new THREE.DataTexture(normalData,64,64);normal.wrapS=normal.wrapT=THREE.RepeatWrapping;normal.repeat.set(18,8);normal.needsUpdate=true;this.textures.add(normal);
    this.hull=this.standard('Hull enamel',p.hull,{map:paint,normalMap:normal,normalScale:new THREE.Vector2(.17,.17),roughness:dna.tier===2?.58:.39,metalness:dna.tier>=2?.32:.08,side:THREE.DoubleSide,flatShading:dna.tier===4});
    const anti=new THREE.Color(p.bottom),boot=new THREE.Color(p.body),band=Math.max(.045,dna.D*.11);
    if(dna.tier>0){
      this.hull.onBeforeCompile=shader=>{
        shader.uniforms.keelAnti={value:anti};shader.uniforms.keelBoot={value:boot};shader.uniforms.keelBand={value:band};
        shader.vertexShader='varying vec3 keelPosition;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nkeelPosition = position;');
        shader.fragmentShader='varying vec3 keelPosition; uniform vec3 keelAnti; uniform vec3 keelBoot; uniform float keelBand;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
              float aboveWater = smoothstep(-keelBand * 0.1, keelBand * 0.1, keelPosition.y);
              diffuseColor.rgb = mix(keelAnti, diffuseColor.rgb, aboveWater);
              float bootLine = 1.0 - smoothstep(keelBand * 0.30, keelBand * 0.43, abs(keelPosition.y - keelBand * 0.65));
              diffuseColor.rgb = mix(diffuseColor.rgb, keelBoot, bootLine);`);
      };
      this.hull.customProgramCacheKey=()=>`keel-hull-${dna.id}`;
    }
    this.body=this.standard('Warm ivory superstructure',p.body,{roughness:.42,metalness:.16});
    this.accent=this.standard('Signature equipment paint',p.accent,{roughness:.43,metalness:.28});
    this.dark=this.standard('Graphite trim',p.trim,{roughness:.57,metalness:.25});
    this.deck=this.standard('Non-slip working deck',p.deck,{roughness:.87,normalMap:normal,normalScale:new THREE.Vector2(.4,.4)});
    this.metal=this.standard('Brushed stainless steel','#a7b6ac',{metalness:.78,roughness:.30});
    this.rail=this.standard('Powder-coated railings','#e4e7dc',{metalness:.36,roughness:.4});
    this.orange=this.standard('Safety orange','#d96e35',{roughness:.58});
    this.red=this.standard('Fire equipment red','#b83d30',{roughness:.42});
    this.rubber=this.standard('Marine rubber','#263532',{roughness:.93});
    this.rope=this.standard('Natural braided rope','#a99b70',{roughness:.95});
    this.net=this.standard('Fishing net','#475d4c',{roughness:1});
    this.bronze=this.standard('Propeller bronze','#a98647',{metalness:.76,roughness:.34});
    this.seat=this.standard('Helm upholstery','#384c46',{roughness:.9});
    this.fabric=this.standard('Tapestry upholstery','#ffffff',{map:this.fabricTexture(r,p),roughness:.96});
    this.painting=this.standard('Framed sea painting','#ffffff',{map:this.paintingTexture(r,p),roughness:.75});
    this.console=this.standard('Console powder coat','#233c3c',{roughness:.63,metalness:.23});
    this.glass=new THREE.MeshPhysicalMaterial({name:'Marine glazing',color:'#548b90',metalness:.18,roughness:.16,transparent:true,opacity:.49,depthWrite:false,side:THREE.DoubleSide,clearcoat:1,envMapIntensity:1.3});this.all.push(this.glass);
    this.led=this.standard('Warm work lamps','#f2e8c7',{emissive:'#ffdfaa',emissiveIntensity:.65,roughness:.25});
    this.green=this.standard('Starboard navigation','#426e51',{emissive:'#50db89',emissiveIntensity:1.1});
    this.port=this.standard('Port navigation','#a13d37',{emissive:'#ee5144',emissiveIntensity:.9});
    this.glow=this.standard('Apex energy lighting',p.accent,{emissive:p.accent,emissiveIntensity:1.8,roughness:.25});
    this.wood=this.standard('Oiled teak','#ffffff',{map:this.woodTexture(r),roughness:.73});
    this.innerWood=this.standard('Dark walnut joinery','#aa8c68',{map:this.wood.map,roughness:.58,side:THREE.DoubleSide});
    this.paper=this.standard('Navigation chart paper','#e8dfb6',{roughness:.85});
    this.crate=this.standard('Fish boxes','#b1b3a0',{roughness:.85});
    this.screenTextures=[];
  }
  standard(name,color,props={}){const mat=new THREE.MeshStandardMaterial({name,color,...props});this.all.push(mat);return mat;}
  texture(canvas){const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;this.textures.add(t);return t;}
  woodTexture(r){
    const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');
    x.fillStyle='#c1a47e';x.fillRect(0,0,512,512);
    for(let p=0;p<16;p++){x.fillStyle=`hsl(${r.int(31,37)} 28% ${r.int(55,68)}%)`;x.fillRect(p*32,0,31,512);x.fillStyle='#705a414a';x.fillRect(p*32,0,1,512);for(let i=0;i<20;i++){x.strokeStyle=`rgba(71,49,28,${r.range(.025,.09)})`;x.lineWidth=r.range(.5,1.2);let a=p*32+r.range(1,30);x.beginPath();x.moveTo(a,0);x.bezierCurveTo(a+5,150,a-4,350,a+2,512);x.stroke();}}
    const t=this.texture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,2);return t;
  }
  // Woven diamond tapestry in the ship's own livery colors, like a well-worn wheelhouse settee.
  fabricTexture(r,p){
    const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');
    const base=new THREE.Color(p.trim).lerp(new THREE.Color('#6a2e24'),.5),dark='#'+base.clone().multiplyScalar(.62).getHexString();
    x.fillStyle='#'+base.getHexString();x.fillRect(0,0,128,128);
    const cols=[p.accent,'#d7b46a',p.body];
    for(let j=0;j<4;j++)for(let i=0;i<5;i++){
      const cx=i*32+(j%2)*16,cy=j*32+16;
      x.fillStyle=cols[(i+j)%3];x.beginPath();x.moveTo(cx,cy-11);x.lineTo(cx+8,cy);x.lineTo(cx,cy+11);x.lineTo(cx-8,cy);x.closePath();x.fill();
      x.fillStyle=dark;x.beginPath();x.moveTo(cx,cy-5);x.lineTo(cx+3.5,cy);x.lineTo(cx,cy+5);x.lineTo(cx-3.5,cy);x.closePath();x.fill();
    }
    x.strokeStyle='rgba(0,0,0,.18)';for(let y=0;y<128;y+=2){x.beginPath();x.moveTo(0,y+.5);x.lineTo(128,y+.5);x.stroke();}
    for(let i=0;i<700;i++){x.fillStyle=`rgba(255,240,210,${r.range(.02,.07)})`;x.fillRect(r.int(0,127),r.int(0,127),1,1);}
    const t=this.texture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2.5,2.5);return t;
  }
  // A small oil painting of a fishing boat at sea, unique to each vessel.
  paintingTexture(r,p){
    const c=document.createElement('canvas');c.width=256;c.height=160;const x=c.getContext('2d');
    const sky=x.createLinearGradient(0,0,0,96);sky.addColorStop(0,r.pick(['#8fb3c9','#d9a777','#a9c3cf']));sky.addColorStop(1,'#efe2c4');
    x.fillStyle=sky;x.fillRect(0,0,256,96);
    x.fillStyle='rgba(255,246,220,.85)';x.beginPath();x.arc(r.range(40,210),r.range(30,60),r.range(9,15),0,TAU);x.fill();
    x.fillStyle='#7d8f88';x.beginPath();x.moveTo(0,96);for(let i=0;i<=8;i++)x.lineTo(i*32,88-Math.abs(Math.sin(i*1.3+r.next()*3))*18);x.lineTo(256,96);x.fill();
    const sea=x.createLinearGradient(0,96,0,160);sea.addColorStop(0,'#3f6d79');sea.addColorStop(1,'#1f3a45');x.fillStyle=sea;x.fillRect(0,96,256,64);
    for(let i=0;i<60;i++){x.strokeStyle=`rgba(230,240,235,${r.range(.15,.4)})`;const yy=r.range(100,158),xx=r.range(0,240);x.beginPath();x.moveTo(xx,yy);x.lineTo(xx+r.range(6,18),yy);x.stroke();}
    const bx=r.range(70,170);x.fillStyle=p.hull;x.beginPath();x.moveTo(bx-34,112);x.lineTo(bx+38,112);x.lineTo(bx+28,124);x.lineTo(bx-28,124);x.closePath();x.fill();
    x.fillStyle=p.body;x.fillRect(bx-6,98,20,14);x.fillStyle='#2b2b2b';x.fillRect(bx+3,84,2,14);
    const t=this.texture(c);return t;
  }
  label(text,fg='#e9edde',bg=null){
    const c=document.createElement('canvas');c.width=1024;c.height=128;const x=c.getContext('2d');
    if(bg){x.fillStyle=bg;x.fillRect(0,0,1024,128);}x.font='600 64px Arial';x.textAlign='center';x.textBaseline='middle';x.fillStyle=fg;x.fillText(text,512,68,970);
    const m=new THREE.MeshBasicMaterial({name:'Vessel lettering',map:this.texture(c),transparent:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,toneMapped:false});this.all.push(m);return m;
  }
  display(kind,aspect=4/3){
    const canvas=document.createElement('canvas');canvas.width=kind==='overhead'?1024:512;canvas.height=Math.max(32,Math.round(canvas.width/aspect));
    const texture=this.texture(canvas);const m=new THREE.MeshBasicMaterial({name:`${kind} display`,map:texture,toneMapped:false,side:THREE.DoubleSide});
    this.all.push(m);this.screenTextures.push({kind,canvas,texture,ctx:canvas.getContext('2d')});return m;
  }
}
