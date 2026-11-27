import {productionProfile} from './environments.mjs';
import {environmentWorker} from './environment-worker.mjs';

export default environmentWorker(productionProfile);
