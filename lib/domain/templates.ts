export type Trade = 'electrical' | 'plumbing' | 'roofing'
import type { Answer } from './inspection.ts'
type Section = { category: string; title: string; items: { id: string; label: string; marketingLabel: string }[] }
// Questions retained verbatim pending qualified review. Published IDs and versions must never be reassigned.
const TEMPLATES: Record<Trade, Section[]> = {
  "electrical": [
    {
      "category": "Permit & Licensing",
      "title": "PERMIT & LICENSING",
      "items": [
        {
          "id": "electrical-001",
          "label": "ESA permit number recorded",
          "marketingLabel": "ESA permit number recorded"
        },
        {
          "id": "electrical-002",
          "label": "LEC number verified",
          "marketingLabel": "Licensed Electrical Contractor (LEC) number verified with ECRA/ESA"
        },
        {
          "id": "electrical-003",
          "label": "College of Trades cert recorded",
          "marketingLabel": "Ontario College of Trades certificate number recorded"
        }
      ]
    },
    {
      "category": "GFCI Protection",
      "title": "GFCI PROTECTION",
      "items": [
        {
          "id": "electrical-004",
          "label": "Kitchen GFCI",
          "marketingLabel": "Kitchen receptacles GFCI-protected"
        },
        {
          "id": "electrical-005",
          "label": "Bathroom GFCI",
          "marketingLabel": "Bathroom receptacles GFCI-protected"
        },
        {
          "id": "electrical-006",
          "label": "Laundry GFCI",
          "marketingLabel": "Laundry area receptacles GFCI-protected"
        },
        {
          "id": "electrical-007",
          "label": "Exterior GFCI",
          "marketingLabel": "Exterior receptacles GFCI-protected"
        }
      ]
    },
    {
      "category": "AFCI Protection",
      "title": "AFCI PROTECTION",
      "items": [
        {
          "id": "electrical-008",
          "label": "AFCI on required circuits",
          "marketingLabel": "AFCI protection installed on all required circuits"
        },
        {
          "id": "electrical-009",
          "label": "Bedroom circuits AFCI",
          "marketingLabel": "Bedroom circuits AFCI-protected"
        }
      ]
    },
    {
      "category": "EV & Energy Storage",
      "title": "EV & ENERGY STORAGE",
      "items": [
        {
          "id": "electrical-010",
          "label": "EV charger readiness (new builds)",
          "marketingLabel": "EV charger readiness confirmed for new builds"
        },
        {
          "id": "electrical-011",
          "label": "Energy storage compliance (if applicable)",
          "marketingLabel": "Energy storage system compliance verified (if applicable)"
        }
      ]
    },
    {
      "category": "Panel & Wiring",
      "title": "PANEL & WIRING",
      "items": [
        {
          "id": "electrical-012",
          "label": "Panel upgrade docs",
          "marketingLabel": "Panel upgrade documentation complete"
        },
        {
          "id": "electrical-013",
          "label": "Panel labelling",
          "marketingLabel": "Panel labelling accurate and legible"
        },
        {
          "id": "electrical-014",
          "label": "Wire gauge correct",
          "marketingLabel": "Proper wire gauge for circuit amperage"
        },
        {
          "id": "electrical-015",
          "label": "Junction boxes accessible",
          "marketingLabel": "All junction boxes accessible and covered"
        },
        {
          "id": "electrical-016",
          "label": "Grounding/bonding verified",
          "marketingLabel": "Grounding and bonding verified"
        }
      ]
    },
    {
      "category": "Inspection",
      "title": "INSPECTION",
      "items": [
        {
          "id": "electrical-017",
          "label": "ESA inspection requested",
          "marketingLabel": "ESA inspection requested"
        },
        {
          "id": "electrical-018",
          "label": "ESA inspection sign-off received",
          "marketingLabel": "ESA inspection sign-off received"
        }
      ]
    }
  ],
  "plumbing": [
    {
      "category": "Permit & Licensing",
      "title": "PERMIT & LICENSING",
      "items": [
        {
          "id": "plumbing-001",
          "label": "OBC permit recorded",
          "marketingLabel": "OBC permit number recorded"
        },
        {
          "id": "plumbing-002",
          "label": "C of Q recorded",
          "marketingLabel": "Certificate of Qualification (C of Q) number recorded"
        },
        {
          "id": "plumbing-003",
          "label": "College of Trades cert recorded",
          "marketingLabel": "Ontario College of Trades certificate number recorded"
        }
      ]
    },
    {
      "category": "Drainage",
      "title": "DRAINAGE",
      "items": [
        {
          "id": "plumbing-004",
          "label": "Slope min 1:50 for 3\" or less",
          "marketingLabel": "Drainage slope verified — minimum 1 in 50 for pipes 3 inches or less"
        },
        {
          "id": "plumbing-005",
          "label": "Slope for pipes over 3\"",
          "marketingLabel": "Drainage slope verified for pipes over 3 inches"
        },
        {
          "id": "plumbing-006",
          "label": "Cleanout access",
          "marketingLabel": "Cleanout access points installed and accessible"
        }
      ]
    },
    {
      "category": "Backflow & Fixtures",
      "title": "BACKFLOW & FIXTURES",
      "items": [
        {
          "id": "plumbing-007",
          "label": "Backflow prevention installed",
          "marketingLabel": "Backflow prevention device installed and confirmed"
        },
        {
          "id": "plumbing-008",
          "label": "Toilets 4.8L/flush or less",
          "marketingLabel": "Low-flow toilet compliance — 4.8L per flush or less"
        },
        {
          "id": "plumbing-009",
          "label": "Low-flow faucets/showerheads",
          "marketingLabel": "Low-flow faucets and showerheads verified"
        }
      ]
    },
    {
      "category": "Materials",
      "title": "MATERIALS",
      "items": [
        {
          "id": "plumbing-010",
          "label": "PE-RT/PEX certification",
          "marketingLabel": "PE-RT or PEX material certification verified (where used)"
        },
        {
          "id": "plumbing-011",
          "label": "Pipe support compliant",
          "marketingLabel": "Pipe support and hanging compliant"
        }
      ]
    },
    {
      "category": "Venting",
      "title": "VENTING",
      "items": [
        {
          "id": "plumbing-012",
          "label": "Air admittance valve locations documented",
          "marketingLabel": "Air admittance valve locations documented"
        },
        {
          "id": "plumbing-013",
          "label": "Vent stack sizing verified",
          "marketingLabel": "Vent stack sizing and routing verified"
        }
      ]
    },
    {
      "category": "Inspection",
      "title": "INSPECTION",
      "items": [
        {
          "id": "plumbing-014",
          "label": "Municipal inspection requested",
          "marketingLabel": "Municipal inspection requested"
        },
        {
          "id": "plumbing-015",
          "label": "Inspection sign-off received",
          "marketingLabel": "Inspection sign-off received"
        }
      ]
    }
  ],
  "roofing": [
    {
      "category": "Permit & Certification",
      "title": "PERMIT & CERTIFICATION",
      "items": [
        {
          "id": "roofing-001",
          "label": "OBC building permit recorded",
          "marketingLabel": "OBC building permit number recorded"
        },
        {
          "id": "roofing-002",
          "label": "WAH cert number+expiry recorded",
          "marketingLabel": "Working at Heights certification number and expiry recorded"
        },
        {
          "id": "roofing-003",
          "label": "WSIB clearance recorded",
          "marketingLabel": "WSIB clearance certificate number recorded"
        },
        {
          "id": "roofing-004",
          "label": "Liability insurance confirmed",
          "marketingLabel": "Liability insurance policy confirmed"
        },
        {
          "id": "roofing-005",
          "label": "College of Trades cert recorded",
          "marketingLabel": "Ontario College of Trades certificate number recorded"
        }
      ]
    },
    {
      "category": "Structural Compliance",
      "title": "STRUCTURAL COMPLIANCE",
      "items": [
        {
          "id": "roofing-006",
          "label": "Snow/ice load compliance",
          "marketingLabel": "Snow and ice load compliance confirmed"
        },
        {
          "id": "roofing-007",
          "label": "Eave protection installed",
          "marketingLabel": "Eave protection installation confirmed"
        },
        {
          "id": "roofing-008",
          "label": "Roof drainage confirmed",
          "marketingLabel": "Roof drainage system confirmed"
        }
      ]
    },
    {
      "category": "Materials",
      "title": "MATERIALS",
      "items": [
        {
          "id": "roofing-009",
          "label": "Underlayment water resistance",
          "marketingLabel": "Underlayment material meets water resistance standard"
        },
        {
          "id": "roofing-010",
          "label": "Underlayment tear strength",
          "marketingLabel": "Underlayment material meets tear strength standard"
        },
        {
          "id": "roofing-011",
          "label": "Underlayment UV resistance",
          "marketingLabel": "Underlayment material meets UV resistance standard"
        }
      ]
    },
    {
      "category": "Safety",
      "title": "SAFETY",
      "items": [
        {
          "id": "roofing-012",
          "label": "Fall protection in place",
          "marketingLabel": "Fall protection system in place"
        },
        {
          "id": "roofing-013",
          "label": "Ladder safety met",
          "marketingLabel": "Ladder safety requirements met"
        },
        {
          "id": "roofing-014",
          "label": "Scaffolding requirements met",
          "marketingLabel": "Scaffolding requirements met (if applicable)"
        }
      ]
    },
    {
      "category": "Waste & Environment",
      "title": "WASTE & ENVIRONMENT",
      "items": [
        {
          "id": "roofing-015",
          "label": "Waste disposal compliant",
          "marketingLabel": "Waste disposal compliant with Ontario environmental guidelines"
        },
        {
          "id": "roofing-016",
          "label": "Debris containment measures",
          "marketingLabel": "Debris containment measures in place"
        }
      ]
    },
    {
      "category": "Inspection",
      "title": "INSPECTION",
      "items": [
        {
          "id": "roofing-017",
          "label": "Municipal inspection requested",
          "marketingLabel": "Municipal inspection requested"
        },
        {
          "id": "roofing-018",
          "label": "Inspection sign-off received",
          "marketingLabel": "Inspection sign-off received"
        }
      ]
    }
  ]
}
export const CHECKLISTS = Object.fromEntries(Object.entries(TEMPLATES).map(([trade, sections]) =>
  [trade, sections.map(section => ({ category: section.category, items: section.items.map(item => item.label) }))]
)) as Record<Trade, { category: string; items: string[] }[]>
export function isTrade(value: unknown): value is Trade {
  return value === 'electrical' || value === 'plumbing' || value === 'roofing'
}
export function marketingChecklist(trade: Trade) {
  return TEMPLATES[trade].map(section => ({ title: section.title, items: section.items.map(item => item.marketingLabel) }))
}
export const TEMPLATE_VERSION = '2026-09-unreviewed-v1'
export function getTemplate(trade: Trade) {
  return { id: trade + ':' + TEMPLATE_VERSION, trade, version: TEMPLATE_VERSION, reviewStatus: 'pending_qualified_review',
    items: TEMPLATES[trade].flatMap(section => section.items.map(item => ({ id: item.id, category: section.category, question: item.label }))) }
}
export function buildChecklistState(trade: string): Record<string,Answer> {
  if (!isTrade(trade)) return {}
  return Object.fromEntries(getTemplate(trade).items.map(item => [item.id, { state: 'unanswered', note: '', controls: '' }]))
}
