import {testProfile} from './environments.mjs';
import {environmentHandler,environmentWorker} from './environment-worker.mjs';

export const stagingHandler=(env,request)=>environmentHandler(testProfile,env,request);
export default environmentWorker(testProfile);
