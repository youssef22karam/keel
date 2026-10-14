/* KEEL / Shared UI state object, viewport element, raycaster and pointer. */
import * as THREE from 'three';
import { $, V } from './utils.js';

export const state={mode:'exterior',sea:false,wireframe:false,dimensions:false,roofOpen:false,autoRotate:false,time:.4,weather:.12,yaw:0,pitch:-.095,eye:V(),keys:new Set(),drag:null,cameraTween:null,exteriorPose:null,tourView:0,rig:true,upgrades:{},briefKey:null};

export const viewport=$('viewport'),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
