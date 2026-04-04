import TradeDetailPage from "../components/TradeDetailPage";

export const metadata = {
  title: "Roofing Compliance — Ontario | TradeSafe AI",
  description: "Ontario Building Code roofing compliance checklists. Working at Heights, WSIB, snow loads, underlayment standards, and waste disposal.",
};

const ROOFING = {
  name: "Roofing",
  icon: "\uD83C\uDFE0",
  code: "ONTARIO BUILDING CODE \u2014 ROOFING / MOL",
  enforcedBy: "Ontario Building Code / Ministry of Labour / WSIB",
  description: "Complete Ontario roofing compliance documentation covering the Ontario Building Code (OBC), Ministry of Labour Working at Heights requirements, WSIB coverage, liability insurance, and environmental waste disposal guidelines.",
  checklistTitle: "FULL OBC ROOFING\nCHECKLIST.",
  totalChecks: 18,
  samplePermit: "OBC-ROOF-2025-XXXX",
  checklist: [
    {
      title: "PERMIT & CERTIFICATION",
      items: [
        "OBC building permit number recorded",
        "Working at Heights certification number and expiry recorded",
        "WSIB clearance certificate number recorded",
        "Liability insurance policy confirmed",
        "Ontario College of Trades certificate number recorded",
      ],
    },
    {
      title: "STRUCTURAL COMPLIANCE",
      items: [
        "Snow and ice load compliance confirmed",
        "Eave protection installation confirmed",
        "Roof drainage system confirmed",
      ],
    },
    {
      title: "MATERIALS",
      items: [
        "Underlayment material meets water resistance standard",
        "Underlayment material meets tear strength standard",
        "Underlayment material meets UV resistance standard",
      ],
    },
    {
      title: "SAFETY",
      items: [
        "Fall protection system in place",
        "Ladder safety requirements met",
        "Scaffolding requirements met (if applicable)",
      ],
    },
    {
      title: "WASTE & ENVIRONMENT",
      items: [
        "Waste disposal compliant with Ontario environmental guidelines",
        "Debris containment measures in place",
      ],
    },
    {
      title: "INSPECTION",
      items: [
        "Municipal inspection requested",
        "Inspection sign-off received",
      ],
    },
  ],
  regulations: [
    { code: "OBC", title: "Ontario Building Code — Roofing", desc: "Provincial code governing roofing installations, structural requirements, and building permits." },
    { code: "MOL WAH", title: "Working at Heights", desc: "Ministry of Labour certification required for all workers performing roofing at height." },
    { code: "WSIB", title: "WSIB Coverage", desc: "Workplace Safety and Insurance Board clearance certificate required for all roofing contractors." },
    { code: "OBC STRUCT.", title: "Snow & Ice Loads", desc: "Structural compliance with Ontario snow and ice load requirements for roof design." },
    { code: "OBC MAT.", title: "Underlayment Standards", desc: "Water resistance, tear strength, and UV resistance standards for roofing underlayment materials." },
    { code: "EPA ONTARIO", title: "Waste Disposal", desc: "Compliance with Ontario Environmental Protection Act for roofing waste and debris disposal." },
  ],
};

export default function RoofingPage() {
  return <TradeDetailPage trade={ROOFING} />;
}
