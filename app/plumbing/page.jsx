import TradeDetailPage from "../components/TradeDetailPage";

export const metadata = {
  title: "Plumbing Compliance — Ontario | TradeSafe AI",
  description: "Ontario Building Code Part 7 plumbing compliance checklists. Drainage slope, backflow prevention, low-flow fixtures, and OBC inspections.",
};

const PLUMBING = {
  name: "Plumbing",
  icon: "\uD83D\uDD27",
  code: "ONTARIO BUILDING CODE \u2014 PART 7 PLUMBING",
  enforcedBy: "Ontario Building Code / Ontario College of Trades",
  description: "Complete Ontario plumbing compliance documentation covering Part 7 of the Ontario Building Code (OBC), updated 2025. Drainage slope verification, backflow prevention, low-flow fixture compliance, approved materials, and mandatory municipal inspections.",
  checklistTitle: "FULL OBC PART 7\nCHECKLIST.",
  totalChecks: 15,
  samplePermit: "OBC-PLM-2025-XXXX",
  checklist: [
    {
      title: "PERMIT & LICENSING",
      items: [
        "OBC permit number recorded",
        "Certificate of Qualification (C of Q) number recorded",
        "Ontario College of Trades certificate number recorded",
      ],
    },
    {
      title: "DRAINAGE",
      items: [
        "Drainage slope verified \u2014 minimum 1 in 50 for pipes 3 inches or less",
        "Drainage slope verified for pipes over 3 inches",
        "Cleanout access points installed and accessible",
      ],
    },
    {
      title: "BACKFLOW & FIXTURES",
      items: [
        "Backflow prevention device installed and confirmed",
        "Low-flow toilet compliance \u2014 4.8L per flush or less",
        "Low-flow faucets and showerheads verified",
      ],
    },
    {
      title: "MATERIALS",
      items: [
        "PE-RT or PEX material certification verified (where used)",
        "Pipe support and hanging compliant",
      ],
    },
    {
      title: "VENTING",
      items: [
        "Air admittance valve locations documented",
        "Vent stack sizing and routing verified",
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
    { code: "OBC PART 7", title: "Ontario Building Code — Plumbing", desc: "The provincial plumbing code governing all plumbing installations in Ontario, updated 2025." },
    { code: "C OF Q", title: "Certificate of Qualification", desc: "Plumbers must hold a C of Q from the Ontario College of Trades or be a registered apprentice." },
    { code: "OBC DRAINAGE", title: "Drainage Slope Requirements", desc: "Minimum 1 in 50 slope for drain pipes 3 inches or less in diameter." },
    { code: "OBC BACKFLOW", title: "Backflow Prevention", desc: "Backflow prevention devices required to protect potable water supply from contamination." },
    { code: "OBC WATER EFF.", title: "Water Efficiency", desc: "Toilets must not exceed 4.8L per flush. Low-flow fixtures required throughout." },
    { code: "OBC MATERIALS", title: "Approved Materials", desc: "PE-RT and PEX piping must carry proper material certification for Ontario installations." },
  ],
};

export default function PlumbingPage() {
  return <TradeDetailPage trade={PLUMBING} />;
}
