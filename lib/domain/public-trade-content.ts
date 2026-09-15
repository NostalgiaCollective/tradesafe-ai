import type { Trade } from './templates.ts'

// Public topic descriptions are not the published observation template or a full code checklist.
const common = 'Examples for recording observations. Checklist content is pending qualified review; these topics are not a complete code checklist or certification.'
export const publicTradeContent = {
  electrical: {
    code: '2024 OESC (29th edition)', enforcedBy: 'Electrical Safety Authority; trade qualifications have separate requirements',
    description: `${common} The 2024 OESC took effect May 1, 2025. Applicable requirements depend on notification and plan-review history, amendments, orders and project scope.`,
    topics: ['Notification and contractor references', 'Receptacle and circuit protection observations', 'EV and energy-storage scope', 'Panel and wiring observations', 'Grounding and bonding evidence', 'ESA inspection and acceptance records'],
    regulations: [
      { code: 'EDITION', title: '2024 Ontario Electrical Safety Code', desc: '2024 is the edition name. Notification dates, plan submissions and expiration can affect the applicable edition.', url: 'https://esasafe.com/assets/files/esasafe/pdf/About_ESA/2024-OESC-FAQs.pdf' },
      { code: 'AMENDMENTS', title: 'Ontario amendments and orders', desc: 'A Director’s Order effective July 6, 2026 changes a plan-review threshold. It does not establish compliance with installation requirements.', url: 'https://esasafe.com/role/oesc/' },
      { code: 'SCOPE', title: 'Project-specific review', desc: 'Notification exceptions and technical requirements need qualified review. These examples do not assert universal EV-readiness or permit requirements.', url: 'https://esasafe.com/assets/files/esasafe/pdf/amendments/2024/2024-Ontario-Amendments-Final.pdf' },
    ],
  },
  plumbing: {
    code: '2024 Ontario Building Code — plumbing topics', enforcedBy: 'Building authority; Skilled Trades Ontario for trade qualifications',
    description: `${common} The 2024 Building Code took effect January 1, 2025 and has later amendments. Permit, design and construction history affect applicability.`,
    topics: ['Permit and trade qualification records', 'Drainage measurements and access', 'Backflow and fixture documentation', 'Pipe material and support observations', 'Venting observations', 'Authority inspection records'],
    regulations: [
      { code: 'EDITION', title: 'Building Code and transition', desc: 'The current regulation incorporates Ontario amendments dated July 17, 2026. Transitional projects may use earlier requirements; verify the project record.', url: 'https://www.ontario.ca/laws/regulation/240163' },
      { code: 'TRADE', title: 'Trade qualifications', desc: 'Check the applicable qualification or apprenticeship status with Skilled Trades Ontario. A recorded number alone does not verify authority to perform work.', url: 'https://www.ontario.ca/page/compulsory-trades-and-enforcement' },
      { code: 'SCOPE', title: 'Technical provisions pending review', desc: 'Drain slopes, fixture flow limits, product standards and exceptions require verification against the applicable code. No universal numerical limits are asserted here.' },
    ],
  },
  roofing: {
    code: 'Building installation and workplace safety — separate requirements', enforcedBy: 'Building authority; Ministry of Labour, Immigration, Training and Skills Development; WSIB',
    description: `${common} Roof installation, workplace fall protection, insurance and waste handling have different sources and applicability conditions.`,
    topics: ['Permit and credential records', 'Structural design and roof assembly references', 'Materials and manufacturer documentation', 'Workplace fall protection and access observations', 'Waste handling records', 'Authority inspection records'],
    regulations: [
      { code: 'INSTALLATION', title: '2024 Building Code', desc: 'Applicable roof design and assembly requirements depend on project scope, edition, amendments and transition provisions.', url: 'https://www.ontario.ca/laws/regulation/240163' },
      { code: 'WORKPLACE', title: 'Working at heights', desc: 'Construction training obligations depend on the fall-protection methods used. A training record does not establish that the site or system is safe.', url: 'https://www.ontario.ca/laws/regulation/130297' },
      { code: 'COVERAGE', title: 'WSIB clearance', desc: 'Clearance obligations have scope and exemption conditions, including specific home-renovation arrangements.', url: 'https://www.wsib.ca/en/operational-policy-manual/clearance-certificate-construction' },
      { code: 'TRADE', title: 'Roofer qualifications', desc: 'Roofer is a non-compulsory trade in Ontario. Voluntary credentials and contract requirements are distinct from mandatory workplace safety duties.', url: 'https://www.skilledtradesontario.ca/trade-information/roofer/' },
    ],
  },
}
export function publicTrade(trade: Trade) {
  const content = publicTradeContent[trade]
  return { ...content, checklistTitle: 'OBSERVATION\nTOPICS.', checklist: [{ title: 'EXAMPLES — PENDING QUALIFIED REVIEW', items: content.topics }] }
}
