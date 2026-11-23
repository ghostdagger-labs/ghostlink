// Test-only local WebSocket bridge. Import Nitro's traced copy of the driver.
import { neonConfig } from '../../website/.output/server/node_modules/@neondatabase/serverless/index.mjs';
import { WebSocket } from 'ws';
if (!/^127\.0\.0\.1:\d+$/.test(process.env.GHOSTLINK_TEST_WS_PROXY ?? '')) throw new Error('Expected the local test proxy.');
neonConfig.wsProxy = () => process.env.GHOSTLINK_TEST_WS_PROXY;
neonConfig.useSecureWebSocket = false;
neonConfig.webSocketConstructor = WebSocket;
neonConfig.pipelineConnect = false;
