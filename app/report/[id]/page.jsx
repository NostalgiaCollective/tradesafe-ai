export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PrintButton from './PrintButton'
import PaymentVerifier from './PaymentVerifier'

// ─── Status badge helper ─────────────────────────────────────────────────────

function StatusBadge({ status }) {
  if (status === 'pass') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded font-heading font-bold text-xs tracking-wider bg-success/15 text-success print:bg-transparent print:text-green-700 print:border print:border-green-600">
        PASS
      </span>
    )
  }
  if (status === 'fail') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded font-heading font-bold text-xs tracking-wider bg-danger/15 text-danger print:bg-transparent print:text-red-700 print:border print:border-red-600">
        FAIL
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded font-heading font-bold text-xs tracking-wider bg-white/10 text-gray-400 print:bg-transparent print:text-gray-500 print:border print:border-gray-400">
      N/A
    </span>
  )
}

// ─── Checklist definitions (same as form — source of truth) ─────────────────

const CHECKLIST_CATEGORIES = {
  electrical: [
    {
      category: 'Permit & Licensing',
      items: ['ESA permit number recorded', 'LEC number verified', 'College of Trades cert recorded'],
    },
    {
      category: 'GFCI Protection',
      items: ['Kitchen GFCI', 'Bathroom GFCI', 'Laundry GFCI', 'Exterior GFCI'],
    },
    {
      category: 'AFCI Protection',
      items: ['AFCI on required circuits', 'Bedroom circuits AFCI'],
    },
    {
      category: 'EV & Energy Storage',
      items: ['EV charger readiness (new builds)', 'Energy storage compliance (if applicable)'],
    },
    {
      category: 'Panel & Wiring',
      items: [
        'Panel upgrade docs',
        'Panel labelling',
        'Wire gauge correct',
        'Junction boxes accessible',
        'Grounding/bonding verified',
      ],
    },
    {
      category: 'Inspection',
      items: ['ESA inspection requested', 'ESA inspection sign-off received'],
    },
  ],
  plumbing: [
    {
      category: 'Permit & Licensing',
      items: ['OBC permit recorded', 'C of Q recorded', 'College of Trades cert recorded'],
    },
    {
      category: 'Drainage',
      items: ['Slope min 1:50 for 3" or less', 'Slope for pipes over 3"', 'Cleanout access'],
    },
    {
      category: 'Backflow & Fixtures',
      items: ['Backflow prevention installed', 'Toilets 4.8L/flush or less', 'Low-flow faucets/showerheads'],
    },
    {
      category: 'Materials',
      items: ['PE-RT/PEX certification', 'Pipe support compliant'],
    },
    {
      category: 'Venting',
      items: ['Air admittance valve locations documented', 'Vent stack sizing verified'],
    },
    {
      category: 'Inspection',
      items: ['Municipal inspection requested', 'Inspection sign-off received'],
    },
  ],
  roofing: [
    {
      category: 'Permit & Certification',
      items: [
        'OBC building permit recorded',
        'WAH cert number+expiry recorded',
        'WSIB clearance recorded',
        'Liability insurance confirmed',
        'College of Trades cert recorded',
      ],
    },
    {
      category: 'Structural Compliance',
      items: ['Snow/ice load compliance', 'Eave protection installed', 'Roof drainage confirmed'],
    },
    {
      category: 'Materials',
      items: ['Underlayment water resistance', 'Underlayment tear strength', 'Underlayment UV resistance'],
    },
    {
      category: 'Safety',
      items: ['Fall protection in place', 'Ladder safety met', 'Scaffolding requirements met'],
    },
    {
      category: 'Waste & Environment',
      items: ['Waste disposal compliant', 'Debris containment measures'],
    },
    {
      category: 'Inspection',
      items: ['Municipal inspection requested', 'Inspection sign-off received'],
    },
  ],
}

const TRADE_LABELS = {
  electrical: 'Electrical',
  plumbing: 'Plumbing',
  roofing: 'Roofing',
}

const PERMIT_LABELS = {
  electrical: 'ESA Permit Number',
  plumbing: 'OBC Permit Number',
  roofing: 'OBC Permit Number',
}

// ─── Section wrapper ─────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div className="mb-6 card-base card-accent print:bg-white print:border print:border-gray-200 overflow-hidden">
      <div className="px-6 py-3.5 bg-amber/10 print:bg-gray-100 border-b border-amber/20 print:border-gray-200">
        <h2 className="text-section tracking-widest text-amber print:text-black uppercase">
          {title}
        </h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

// ─── Info row ────────────────────────────────────────────────────────────────

function InfoRow({ label, value }) {
  if (!value) return null
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4 py-2 border-b border-white/5 print:border-gray-100 last:border-0">
      <dt className="text-xs font-heading tracking-widest text-gray-400 print:text-gray-500 uppercase w-48 shrink-0">
        {label}
      </dt>
      <dd className="text-base text-white print:text-black mt-0.5 sm:mt-0">{value}</dd>
    </div>
  )
}

// ─── Main page (server component) ───────────────────────────────────────────

export default async function ReportPage({ params }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: report } = await supabase
    .from('reports')
    .select('*')
    .eq('id', id)
    .single()

  if (!report || report.user_id !== user.id) {
    redirect('/dashboard')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const categories = CHECKLIST_CATEGORIES[report.trade] || []
  const checklist = report.checklist || {}

  const generatedDate = new Date(report.created_at).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const tradeLabel = TRADE_LABELS[report.trade] || report.trade
  const permitLabel = PERMIT_LABELS[report.trade] || 'Permit Number'
  const isPaid = report.status === 'completed'

  // Overall pass/fail counts
  const allItems = categories.flatMap((cat) =>
    cat.items.map((item) => checklist[`${cat.category}__${item}`]?.status || 'pass')
  )
  const totalPass = allItems.filter((s) => s === 'pass').length
  const totalFail = allItems.filter((s) => s === 'fail').length
  const totalNa = allItems.filter((s) => s === 'na').length

  return (
    <div className="min-h-screen bg-[#0f0f0f] print:bg-white">
      {/* Screen header */}
      <header className="no-print sticky top-0 z-50 bg-[#0f0f0f]/95 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <div className="w-8 h-8 bg-amber rounded-sm flex items-center justify-center">
              <span className="text-black font-heading font-black text-sm">TS</span>
            </div>
            <span className="font-heading font-black text-lg tracking-widest text-white">
              TRADESAFE<span className="text-amber"> AI</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-xs font-heading tracking-widest text-gray-400 hover:text-white transition min-h-[64px] flex items-center no-underline"
            >
              ← DASHBOARD
            </Link>
            <PrintButton reportId={id} isPaid={isPaid} />
          </div>
        </div>
      </header>

      <PaymentVerifier reportId={id} />

      <main className="max-w-4xl mx-auto px-4 py-10 print:px-8 print:py-6">
        {/* ── Report Header ──────────────────────────────────────────────── */}
        <div className="mb-10 pb-8 border-b border-white/10 print:border-gray-300">
          {/* Print-only logo row */}
          <div className="hidden print:flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-black rounded-sm flex items-center justify-center">
              <span className="text-white font-heading font-black text-sm">TS</span>
            </div>
            <span className="font-heading font-black text-xl tracking-widest text-black">
              TRADESAFE AI
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
            <div>
              <div className="text-xs font-heading tracking-[4px] text-gray-500 print:text-gray-400 uppercase mb-3">
                Ontario Compliance Report
              </div>
              <h1 className="text-display md:text-[3rem] text-white print:text-black tracking-wide leading-none">
                {tradeLabel.toUpperCase()} COMPLIANCE
              </h1>
              <div className="flex items-center gap-3 mt-4">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-heading font-bold tracking-widest uppercase ${
                    report.trade === 'electrical'
                      ? 'bg-amber/15 text-amber print:bg-amber/20 print:text-yellow-700'
                      : report.trade === 'plumbing'
                      ? 'bg-blue-500/15 text-blue-400 print:text-blue-700'
                      : 'bg-green-500/15 text-green-400 print:text-green-700'
                  }`}
                >
                  {tradeLabel}
                </span>
                <span className="text-sm text-gray-500 print:text-gray-400 font-heading tracking-wide">
                  {totalFail > 0 ? (
                    <span className="text-danger print:text-red-600">{totalFail} ITEM{totalFail !== 1 ? 'S' : ''} REQUIRE ATTENTION</span>
                  ) : (
                    <span className="text-success print:text-green-600">ALL ITEMS PASS</span>
                  )}
                </span>
              </div>
            </div>
            <div className="text-right print:text-right">
              <div className="text-xs font-heading tracking-widest text-gray-500 print:text-gray-400 uppercase mb-1">Report ID</div>
              <div className="font-mono text-xs text-gray-400 print:text-gray-600 break-all max-w-[200px] ml-auto">{id}</div>
              <div className="text-xs font-heading tracking-widest text-gray-500 print:text-gray-400 uppercase mt-4 mb-1">Generated</div>
              <div className="text-base text-white print:text-black font-heading">{generatedDate}</div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-4 mt-8">
            <div className="bg-success/10 print:bg-green-50 print:border print:border-green-200 rounded-xl p-4 text-center">
              <div className="text-display text-success print:text-green-700">{totalPass}</div>
              <div className="text-xs font-heading tracking-wider text-success/70 print:text-green-600 uppercase">Pass</div>
            </div>
            <div className={`${totalFail > 0 ? 'bg-danger/10 print:bg-red-50 print:border print:border-red-200' : 'bg-white/5 print:bg-gray-50'} rounded-xl p-4 text-center`}>
              <div className={`text-display ${totalFail > 0 ? 'text-danger print:text-red-700' : 'text-gray-600'}`}>{totalFail}</div>
              <div className={`text-xs font-heading tracking-wider uppercase ${totalFail > 0 ? 'text-danger/70 print:text-red-600' : 'text-gray-600'}`}>Fail</div>
            </div>
            <div className="bg-white/5 print:bg-gray-50 print:border print:border-gray-200 rounded-xl p-4 text-center">
              <div className="text-display text-gray-400 print:text-gray-600">{totalNa}</div>
              <div className="text-xs font-heading tracking-wider text-gray-500 uppercase">N/A</div>
            </div>
          </div>
        </div>

        {/* ── Contractor Information ──────────────────────────────────────── */}
        <Section title="Contractor Information">
          <dl>
            <InfoRow label="Business Name" value={report.business_name} />
            <InfoRow
              label={
                report.trade === 'electrical'
                  ? 'Electrical License (LEC)'
                  : report.trade === 'plumbing'
                  ? 'Master Plumber License'
                  : 'Roofing License'
              }
              value={report.license_number}
            />
            <InfoRow label="Ontario College of Trades Cert" value={report.cot_cert_number} />
            {profile?.email && <InfoRow label="Contact Email" value={profile.email} />}
          </dl>
        </Section>

        <div className="section-divider print:hidden" />

        {/* ── Job Site Information ────────────────────────────────────────── */}
        <Section title="Job Site Information">
          <dl>
            <InfoRow label="Municipal Address" value={report.job_address} />
            <InfoRow label="Homeowner / Client" value={report.homeowner_name} />
            <InfoRow label="Date of Work" value={report.date_of_work} />
            <InfoRow label="Supervising Journeyperson" value={report.supervising_journeyperson} />
            <InfoRow label={permitLabel} value={report.permit_number} />
          </dl>
        </Section>

        {/* ── Trade-Specific Info (roofing) ───────────────────────────────── */}
        {report.trade === 'roofing' && (report.wah_cert_number || report.wsib_clearance_number) && (
          <Section title="Roofing Certifications">
            <dl>
              <InfoRow label="Working at Heights Cert #" value={report.wah_cert_number} />
              <InfoRow label="WAH Certificate Expiry" value={report.wah_cert_expiry} />
              <InfoRow label="WSIB Clearance Number" value={report.wsib_clearance_number} />
            </dl>
          </Section>
        )}

        <div className="section-divider print:hidden" />

        {/* ── Checklist Results ───────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="text-xs font-heading tracking-widest text-gray-400 print:text-gray-500 uppercase mb-4">
            Checklist Results
          </div>
          <div className="space-y-5">
            {categories.map((cat) => {
              const catItems = cat.items
              const catPass = catItems.filter((item) => (checklist[`${cat.category}__${item}`]?.status) === 'pass').length
              const catFail = catItems.filter((item) => (checklist[`${cat.category}__${item}`]?.status) === 'fail').length
              const catNa = catItems.filter((item) => (checklist[`${cat.category}__${item}`]?.status) === 'na').length
              return (
                <div
                  key={cat.category}
                  className="card-base card-accent print:bg-white print:border print:border-gray-200 overflow-hidden"
                >
                  {/* Category header */}
                  <div className="px-6 py-3.5 bg-white/5 print:bg-gray-50 border-b border-white/10 print:border-gray-200 flex items-center justify-between">
                    <h3 className="text-section tracking-widest text-white print:text-black uppercase">
                      {cat.category}
                    </h3>
                    <div className="flex gap-3 text-xs font-heading font-bold">
                      <span className="text-success print:text-green-700">{catPass} Pass</span>
                      {catFail > 0 && <span className="text-danger print:text-red-700">{catFail} Fail</span>}
                      {catNa > 0 && <span className="text-gray-500">{catNa} N/A</span>}
                    </div>
                  </div>
                  {/* Items */}
                  <div className="divide-y divide-white/5 print:divide-gray-100">
                    {catItems.map((item) => {
                      const key = `${cat.category}__${item}`
                      const val = checklist[key] || { status: 'pass', notes: '' }
                      return (
                        <div key={item} className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-start gap-2">
                          <span className="flex-1 text-base text-gray-300 print:text-gray-800">{item}</span>
                          <div className="flex items-center gap-3 shrink-0">
                            {val.notes && (
                              <span className="text-xs text-gray-500 print:text-gray-600 italic max-w-xs text-right">
                                {val.notes}
                              </span>
                            )}
                            <StatusBadge status={val.status} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="section-divider print:hidden" />

        {/* ── Declaration ─────────────────────────────────────────────────── */}
        <div className="mb-8 card-base card-accent print:bg-white print:border print:border-gray-300 p-6">
          <div className="text-xs font-heading tracking-widest text-amber print:text-gray-500 uppercase mb-3">
            Declaration
          </div>
          <p className="text-base text-gray-300 print:text-gray-700 leading-relaxed mb-5">
            I hereby declare that the work described in this report was completed in compliance with
            all applicable Ontario codes and regulations.
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-white/10 print:border-gray-200">
            <div>
              <div className="text-xs font-heading tracking-widest text-gray-500 uppercase mb-1">Declared By</div>
              <div className="text-base font-heading font-bold text-white print:text-black">
                {report.business_name || profile?.full_name || 'Contractor'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-heading tracking-widest text-gray-500 uppercase mb-1">Date</div>
              <div className="text-base font-heading text-white print:text-black">{generatedDate}</div>
            </div>
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="border-t border-white/10 print:border-gray-300 pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="text-section tracking-widest text-gray-500 print:text-gray-600 uppercase">
              Generated by TradeSafe AI
            </div>
            <div className="text-sm text-gray-600 print:text-gray-500 mt-1">
              This document reflects compliance with applicable Ontario codes and regulations.
            </div>
          </div>
          <div className="no-print">
            <PrintButton variant="secondary" reportId={id} isPaid={isPaid} />
          </div>
        </div>
      </main>
    </div>
  )
}
