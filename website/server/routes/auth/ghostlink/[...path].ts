import { getAuthService } from '../../../utils/auth';
export default defineEventHandler(async event => {
  await getAuthService().handler(event.node.req, event.node.res);
});
