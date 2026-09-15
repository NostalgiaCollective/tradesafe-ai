import { publicTrade } from '@/lib/domain/public-trade-content';
import TradeDetailPage from '../components/TradeDetailPage';

export const metadata = { title: 'Plumbing Observation Records — Ontario | TradeSafe AI', description: 'Record plumbing job observations and supporting evidence. Content pending qualified review; no compliance certification.' };
const trade = { name: 'Plumbing', icon: '\uD83D\uDD27', totalChecks: 15, samplePermit: 'SYNTHETIC-EXAMPLE', ...publicTrade('plumbing') };
export default function Page() { return <TradeDetailPage trade={trade} />; }
