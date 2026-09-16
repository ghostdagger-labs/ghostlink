import { spawn } from 'node:child_process';
const children = [spawn('pnpm', ['exec', 'tsx', 'watch', 'server/index.ts'], { stdio: 'inherit', env: { ...process.env, PORT: '5174', GHOSTLINK_ORIGIN: 'http://127.0.0.1:5173' } }), spawn('pnpm', ['exec', 'vite'], { stdio: 'inherit' })];
let ending = false;
function end(code = 0) { if (ending) return; ending = true; for (const p of children) p.kill('SIGTERM'); process.exitCode = code; }
for (const p of children) { p.on('exit', code => end(code ?? 0)); p.on('error', () => end(1)); }
process.on('SIGINT', () => end()); process.on('SIGTERM', () => end());
