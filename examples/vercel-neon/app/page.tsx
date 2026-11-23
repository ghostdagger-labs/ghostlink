import { getOrigin } from '../server/config';
import WalletApp from './wallet-app';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ network?: string }> }) {
  const network = (await searchParams).network === 'testnet-10' ? 'testnet-10' : 'testnet-11';
  return <WalletApp origin={getOrigin()} network={network} />;
}
