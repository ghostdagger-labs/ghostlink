// Test runner only: the deployed example always uses Neon's normal TLS defaults.
import { neonConfig } from '@neondatabase/serverless';
import { WebSocket } from 'ws';
if (!/^127\.0\.0\.1:\d+$/.test(process.env.GHOSTLINK_TEST_WS_PROXY ?? '')) throw new Error('Expected the local test proxy.');
neonConfig.wsProxy = () => process.env.GHOSTLINK_TEST_WS_PROXY;
neonConfig.useSecureWebSocket = false;
neonConfig.webSocketConstructor = WebSocket;
neonConfig.pipelineConnect = false;
