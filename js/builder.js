/* KEEL / VesselBuilder entry point: loads the core class and attaches every mixin. */

import { VesselBuilder } from './builder-core.js';
import './builder-bridge.js';
import './builder-topside.js';
import './builder-rig.js';
import './builder-outfit.js';

export { VesselBuilder };
