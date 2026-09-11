export type Trade = 'electrical' | 'plumbing' | 'roofing'
type Section = { category: string; title: string; items: { label: string; marketingLabel: string }[] }
// Legacy labels and order are deliberately preserved. Regulatory review and versioning are deferred.
const TEMPLATES: Record<Trade, Section[]> = {
  "electrical": [
    {
      "category": "Permit & Licensing",
      "title": "PERMIT & LICENSING",
      "items": [
        {
          "label": "ESA permit number recorded",
          "marketingLabel": "ESA permit number recorded"
        },
        {
          "label": "LEC number verified",
          "marketingLabel": "Licensed Electrical Contractor (LEC) number verified with ECRA/ESA"
        },
        {
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
          "label": "Kitchen GFCI",
          "marketingLabel": "Kitchen receptacles GFCI-protected"
        },
        {
          "label": "Bathroom GFCI",
          "marketingLabel": "Bathroom receptacles GFCI-protected"
        },
        {
          "label": "Laundry GFCI",
          "marketingLabel": "Laundry area receptacles GFCI-protected"
        },
        {
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
          "label": "AFCI on required circuits",
          "marketingLabel": "AFCI protection installed on all required circuits"
        },
        {
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
          "label": "EV charger readiness (new builds)",
          "marketingLabel": "EV charger readiness confirmed for new builds"
        },
        {
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
          "label": "Panel upgrade docs",
          "marketingLabel": "Panel upgrade documentation complete"
        },
        {
          "label": "Panel labelling",
          "marketingLabel": "Panel labelling accurate and legible"
        },
        {
          "label": "Wire gauge correct",
          "marketingLabel": "Proper wire gauge for circuit amperage"
        },
        {
          "label": "Junction boxes accessible",
          "marketingLabel": "All junction boxes accessible and covered"
        },
        {
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
          "label": "ESA inspection requested",
          "marketingLabel": "ESA inspection requested"
        },
        {
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
          "label": "OBC permit recorded",
          "marketingLabel": "OBC permit number recorded"
        },
        {
          "label": "C of Q recorded",
          "marketingLabel": "Certificate of Qualification (C of Q) number recorded"
        },
        {
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
          "label": "Slope min 1:50 for 3\" or less",
          "marketingLabel": "Drainage slope verified — minimum 1 in 50 for pipes 3 inches or less"
        },
        {
          "label": "Slope for pipes over 3\"",
          "marketingLabel": "Drainage slope verified for pipes over 3 inches"
        },
        {
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
          "label": "Backflow prevention installed",
          "marketingLabel": "Backflow prevention device installed and confirmed"
        },
        {
          "label": "Toilets 4.8L/flush or less",
          "marketingLabel": "Low-flow toilet compliance — 4.8L per flush or less"
        },
        {
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
          "label": "PE-RT/PEX certification",
          "marketingLabel": "PE-RT or PEX material certification verified (where used)"
        },
        {
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
          "label": "Air admittance valve locations documented",
          "marketingLabel": "Air admittance valve locations documented"
        },
        {
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
          "label": "Municipal inspection requested",
          "marketingLabel": "Municipal inspection requested"
        },
        {
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
          "label": "OBC building permit recorded",
          "marketingLabel": "OBC building permit number recorded"
        },
        {
          "label": "WAH cert number+expiry recorded",
          "marketingLabel": "Working at Heights certification number and expiry recorded"
        },
        {
          "label": "WSIB clearance recorded",
          "marketingLabel": "WSIB clearance certificate number recorded"
        },
        {
          "label": "Liability insurance confirmed",
          "marketingLabel": "Liability insurance policy confirmed"
        },
        {
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
          "label": "Snow/ice load compliance",
          "marketingLabel": "Snow and ice load compliance confirmed"
        },
        {
          "label": "Eave protection installed",
          "marketingLabel": "Eave protection installation confirmed"
        },
        {
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
          "label": "Underlayment water resistance",
          "marketingLabel": "Underlayment material meets water resistance standard"
        },
        {
          "label": "Underlayment tear strength",
          "marketingLabel": "Underlayment material meets tear strength standard"
        },
        {
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
          "label": "Fall protection in place",
          "marketingLabel": "Fall protection system in place"
        },
        {
          "label": "Ladder safety met",
          "marketingLabel": "Ladder safety requirements met"
        },
        {
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
          "label": "Waste disposal compliant",
          "marketingLabel": "Waste disposal compliant with Ontario environmental guidelines"
        },
        {
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
          "label": "Municipal inspection requested",
          "marketingLabel": "Municipal inspection requested"
        },
        {
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
export function buildChecklistState(trade: string) {
  const state: Record<string, { status: 'pass' | 'fail' | 'na'; notes: string }> = {}
  if (!isTrade(trade)) return state
  for (const section of CHECKLISTS[trade]) for (const item of section.items) {
    state[section.category + '__' + item] = { status: 'pass', notes: '' }
  }
  return state
}
