import 'server-only';

export function getOrigin(): string {
  const origin = process.env.GHOSTLINK_ORIGIN;
  if (!origin) throw new Error('Configure GHOSTLINK_ORIGIN as the exact public application origin.');
  const parsed = new URL(origin);
  if (parsed.origin !== origin) throw new Error('GHOSTLINK_ORIGIN must be an exact origin without a trailing slash.');
  return origin;
}
