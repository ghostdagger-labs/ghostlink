import { getAuthService } from '../utils/auth';
export default defineEventHandler(() => { getAuthService(); return { status: 'ok' }; });
