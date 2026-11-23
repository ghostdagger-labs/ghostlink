import type { ReactNode } from 'react';
import '@ghostdagger/ghostlink-core/styles.css';
import '@ghostdagger/ghostlink-core/fonts.css';
import './style.css';

export const metadata = { title: 'Ghostlink · Vercel + Neon', description: 'Kaspa wallet authentication with revocable Postgres sessions.' };

export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
