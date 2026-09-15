import { publicTrade } from '@/lib/domain/public-trade-content';
import TradeDetailPage from '../components/TradeDetailPage';

export const metadata = { title: 'Electrical Observation Records — Ontario | TradeSafe AI', description: 'Record electrical job observations and supporting evidence. Content pending qualified review; no compliance certification.' };
const trade = { name: 'Electrical', icon: '\u26A1', totalChecks: 18, samplePermit: 'SYNTHETIC-EXAMPLE', ...publicTrade('electrical') };
export default function Page() { return <TradeDetailPage trade={trade} />; }
