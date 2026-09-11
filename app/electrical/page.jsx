import { marketingChecklist } from '@/lib/domain/templates';
import TradeDetailPage from "../components/TradeDetailPage";

export const metadata = {
  title: "Electrical Compliance — Ontario | TradeSafe AI",
  description: "2024 Ontario Electrical Safety Code (OESC) compliance checklists. ESA permits, GFCI/AFCI protection, EV readiness, and panel inspections.",
};

const ELECTRICAL = {
  name: "Electrical",
  icon: "\u26A1",
  code: "2024 OESC \u2014 ELECTRICAL SAFETY AUTHORITY",
  enforcedBy: "Electrical Safety Authority (ESA) / ECRA",
  description: "Complete Ontario electrical compliance documentation covering the 2024 Ontario Electrical Safety Code (OESC), in effect since May 1, 2025. ESA permits, GFCI and AFCI protection, EV charger readiness, panel upgrades, and mandatory inspections.",
  checklistTitle: "FULL 2024 OESC\nCHECKLIST.",
  totalChecks: 18,
  samplePermit: "ESA-2025-XXXXX",
  checklist: marketingChecklist('electrical'),
  regulations: [
    { code: "2024 OESC", title: "Ontario Electrical Safety Code", desc: "The provincial electrical code governing all electrical installations in Ontario, effective May 1, 2025." },
    { code: "ECRA/ESA", title: "Contractor Registration", desc: "All electrical contractors must be Licensed Electrical Contractors registered with ECRA/ESA." },
    { code: "OESC S.26", title: "GFCI Protection", desc: "Ground fault circuit interrupter requirements for kitchens, bathrooms, laundry, and exterior locations." },
    { code: "OESC AFCI", title: "Arc Fault Protection", desc: "Arc fault circuit interrupter requirements for bedrooms and other designated circuits." },
    { code: "OESC EV", title: "EV Charger Readiness", desc: "New construction must include provisions for electric vehicle charging infrastructure." },
    { code: "ESA PERMIT", title: "Mandatory Permits & Inspection", desc: "Every electrical project requires an ESA permit and must pass ESA inspection before energization." },
  ],
};

export default function ElectricalPage() {
  return <TradeDetailPage trade={ELECTRICAL} />;
}
