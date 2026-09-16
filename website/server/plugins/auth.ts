import { closeAuthService } from '../utils/auth';
export default defineNitroPlugin(nitro => { nitro.hooks.hook('close', closeAuthService); });
