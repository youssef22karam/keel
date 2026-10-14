/* KEEL / Entry point: exposes window.keel and starts the app. */
import { $ } from './utils.js';
import { fatal } from './stage.js';
import { generate, vessel } from './generate.js';
import { start } from './loop.js';
import { runSelfTests, validateDNA, validateGeometry } from './selftest.js';

window.keel={version:1,validateDNA,runSelfTests,inspect:()=>vessel?validateGeometry(vessel):null,getBlueprint:()=>vessel?{cost:vessel.dna.cost,seed:vessel.dna.seed,fingerprint:vessel.dna.id,tier:vessel.dna.tier}:null,generate:async(cost,seed)=>{$('vessel-cost').value=String(cost);$('vessel-seed').value=String(seed);return generate();}};

start().catch(fatal);
