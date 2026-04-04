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
  checklist: [
    {
      title: "PERMIT & LICENSING",
      items: [
        "ESA permit number recorded",
        "Licensed Electrical Contractor (LEC) number verified with ECRA/ESA",
        "Ontario College of Trades certificate number recorded",
      ],
    },
    {
      title: "GFCI PROTECTION",
      items: [
        "Kitchen receptacles GFCI-protected",
        "Bathroom receptacles GFCI-protected",
        "Laundry area receptacles GFCI-protected",
        "Exterior receptacles GFCI-protected",
      ],
    },
    {
      title: "AFCI PROTECTION",
      items: [
        "AFCI protection installed on all required circuits",
        "Bedroom circuits AFCI-protected",
      ],
    },
    {
      title: "EV & ENERGY STORAGE",
      items: [
        "EV charger readiness confirmed for new builds",
        "Energy storage system compliance verified (if applicable)",
      ],
    },
    {
      title: "PANEL & WIRING",
      items: [
        "Panel upgrade documentation complete",
        "Panel labelling accurate and legible",
        "Proper wire gauge for circuit amperage",
        "All junction boxes accessible and covered",
        "Grounding and bonding verified",
      ],
    },
    {
      title: "INSPECTION",
      items: [
        "ESA inspection requested",
        "ESA inspection sign-off received",
      ],
    },
  ],
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
