import { publicTrade } from '@/lib/domain/public-trade-content';
import TradeDetailPage from '../components/TradeDetailPage';

export const metadata = { title: 'Roofing Observation Records — Ontario | TradeSafe AI', description: 'Record roofing job observations and supporting evidence. Content pending qualified review; no compliance certification.' };
const trade = { name: 'Roofing', icon: '\uD83C\uDFE0', totalChecks: 18, samplePermit: 'SYNTHETIC-EXAMPLE', ...publicTrade('roofing') };
export default function Page() { return <TradeDetailPage trade={trade} />; }
