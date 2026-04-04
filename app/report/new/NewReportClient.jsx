'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// ─── Hardcoded checklists ────────────────────────────────────────────────────

const CHECKLISTS = {
  electrical: [
    {
      category: 'Permit & Licensing',
      items: [
        'ESA permit number recorded',
        'LEC number verified',
        'College of Trades cert recorded',
      ],
    },
    {
      category: 'GFCI Protection',
      items: [
        'Kitchen GFCI',
        'Bathroom GFCI',
        'Laundry GFCI',
        'Exterior GFCI',
      ],
    },
    {
      category: 'AFCI Protection',
      items: [
        'AFCI on required circuits',
        'Bedroom circuits AFCI',
      ],
    },
    {
      category: 'EV & Energy Storage',
      items: [
        'EV charger readiness (new builds)',
        'Energy storage compliance (if applicable)',
      ],
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
      items: [
        'ESA inspection requested',
        'ESA inspection sign-off received',
      ],
    },
  ],
  plumbing: [
    {
      category: 'Permit & Licensing',
      items: [
        'OBC permit recorded',
        'C of Q recorded',
        'College of Trades cert recorded',
      ],
    },
    {
      category: 'Drainage',
      items: [
        'Slope min 1:50 for 3" or less',
        'Slope for pipes over 3"',
        'Cleanout access',
      ],
    },
    {
      category: 'Backflow & Fixtures',
      items: [
        'Backflow prevention installed',
        'Toilets 4.8L/flush or less',
        'Low-flow faucets/showerheads',
      ],
    },
    {
      category: 'Materials',
      items: [
        'PE-RT/PEX certification',
        'Pipe support compliant',
      ],
    },
    {
      category: 'Venting',
      items: [
        'Air admittance valve locations documented',
        'Vent stack sizing verified',
      ],
    },
    {
      category: 'Inspection',
      items: [
        'Municipal inspection requested',
        'Inspection sign-off received',
      ],
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
      items: [
        'Snow/ice load compliance',
        'Eave protection installed',
        'Roof drainage confirmed',
      ],
    },
    {
      category: 'Materials',
      items: [
        'Underlayment water resistance',
        'Underlayment tear strength',
        'Underlayment UV resistance',
      ],
    },
    {
      category: 'Safety',
      items: [
        'Fall protection in place',
        'Ladder safety met',
        'Scaffolding requirements met',
      ],
    },
    {
      category: 'Waste & Environment',
      items: [
        'Waste disposal compliant',
        'Debris containment measures',
      ],
    },
    {
      category: 'Inspection',
      items: [
        'Municipal inspection requested',
        'Inspection sign-off received',
      ],
    },
  ],
}

const TRADES = [
  {
    id: 'electrical',
    name: 'Electrical',
    icon: '⚡',
    governingBody: 'Electrical Safety Authority (ESA)',
    description: 'ESA compliance, panel, GFCI/AFCI, permits',
  },
  {
    id: 'plumbing',
    name: 'Plumbing',
    icon: '🔧',
    governingBody: 'Ontario Building Code (OBC)',
    description: 'OBC compliance, drainage, fixtures, venting',
  },
  {
    id: 'roofing',
    name: 'Roofing',
    icon: '🏠',
    governingBody: 'Ontario Building Code (OBC) + MOL',
    description: 'OBC, WAH certification, WSIB, fall protection',
  },
]

// ─── Build initial checklist state from hardcoded data ───────────────────────

function buildChecklistState(trade) {
  const categories = CHECKLISTS[trade] || []
  const state = {}
  categories.forEach((cat) => {
    cat.items.forEach((item) => {
      state[`${cat.category}__${item}`] = { status: 'pass', notes: '' }
    })
  })
  return state
}

// ─── Progress indicator ──────────────────────────────────────────────────────

function ProgressBar({ step }) {
  const steps = ['Select Trade', 'Job Details', 'Checklist', 'Review & Submit']
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((label, i) => {
        const num = i + 1
        const isActive = num === step
        const isDone = num < step
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold font-heading transition-all ${
                  isDone
                    ? 'bg-amber text-black'
                    : isActive
                    ? 'bg-amber text-black ring-4 ring-amber/30'
                    : 'bg-white/10 text-gray-500'
                }`}
              >
                {isDone ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  num
                )}
              </div>
              <span
                className={`text-xs font-heading tracking-wide hidden sm:block ${
                  isActive ? 'text-amber' : isDone ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                {label.toUpperCase()}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-px mx-2 mb-5 transition-all ${
                  isDone ? 'bg-amber' : 'bg-white/10'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function NewReportClient() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState(1)
  const [selectedTrade, setSelectedTrade] = useState(null)
  const [profile, setProfile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Step 2 form fields
  const today = new Date().toISOString().split('T')[0]
  const [jobDetails, setJobDetails] = useState({
    businessName: '',
    licenseNumber: '',
    cotCertNumber: '',
    jobAddress: '',
    homeownerName: '',
    dateOfWork: today,
    supervisingJourneyperson: '',
    permitNumber: '',
    // Roofing-specific
    wahCertNumber: '',
    wahCertExpiry: '',
    wsibClearanceNumber: '',
  })

  // Step 3 checklist state: { "Category__Item": { status: 'pass'|'fail'|'na', notes: '' } }
  const [checklist, setChecklist] = useState({})

  // Step 4
  const [declared, setDeclared] = useState(false)

  // Load profile on mount
  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login?redirect=/report/new')
        return
      }
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (data) {
        setProfile(data)
      }
    }
    loadProfile()
  }, [])

  // Pre-fill job details when trade is selected
  useEffect(() => {
    if (!selectedTrade || !profile) return
    const licenseMap = {
      electrical: profile.electrical_license || '',
      plumbing: profile.plumbing_license || '',
      roofing: profile.roofing_license || '',
    }
    setJobDetails((prev) => ({
      ...prev,
      businessName: profile.business_name || '',
      licenseNumber: licenseMap[selectedTrade] || '',
      cotCertNumber: profile.cot_cert_number || '',
    }))
    setChecklist(buildChecklistState(selectedTrade))
  }, [selectedTrade, profile])

  // ── Step 1: trade selection ──────────────────────────────────────────────

  function handleSelectTrade(tradeId) {
    setSelectedTrade(tradeId)
    setStep(2)
  }

  // ── Step 2: job details ──────────────────────────────────────────────────

  function handleJobField(field, value) {
    setJobDetails((prev) => ({ ...prev, [field]: value }))
  }

  function handleJobDetailsNext(e) {
    e.preventDefault()
    setStep(3)
  }

  // ── Step 3: checklist ────────────────────────────────────────────────────

  function handleChecklistItem(category, item, field, value) {
    const key = `${category}__${item}`
    setChecklist((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }))
  }

  // ── Step 4: submit ───────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!declared) return
    setSubmitting(true)
    setSubmitError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('reports')
        .insert({
          user_id: user.id,
          trade: selectedTrade,
          business_name: jobDetails.businessName,
          license_number: jobDetails.licenseNumber,
          cot_cert_number: jobDetails.cotCertNumber,
          job_address: jobDetails.jobAddress,
          homeowner_name: jobDetails.homeownerName,
          date_of_work: jobDetails.dateOfWork,
          supervising_journeyperson: jobDetails.supervisingJourneyperson,
          permit_number: jobDetails.permitNumber,
          wah_cert_number: selectedTrade === 'roofing' ? jobDetails.wahCertNumber : null,
          wah_cert_expiry: selectedTrade === 'roofing' ? jobDetails.wahCertExpiry : null,
          wsib_clearance_number: selectedTrade === 'roofing' ? jobDetails.wsibClearanceNumber : null,
          checklist: checklist,
          declared: true,
          created_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) throw error
      router.push(`/report/${data.id}`)
    } catch (err) {
      setSubmitError(err.message || 'Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  // ── Shared input class ───────────────────────────────────────────────────

  const inputClass =
    'w-full min-h-[48px] bg-[#0f0f0f] border border-white/10 rounded-xl px-4 text-white placeholder-gray-600 focus:outline-none focus:border-amber focus:ring-2 focus:ring-amber/20 transition text-sm'

  const labelClass = 'block text-xs font-heading tracking-widest text-gray-400 mb-1.5 uppercase'

  // ── Permit label by trade ────────────────────────────────────────────────

  const permitLabel =
    selectedTrade === 'electrical' ? 'ESA Permit Number' : 'OBC Permit Number'

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0f0f0f]/95 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <div className="w-8 h-8 bg-amber rounded-sm flex items-center justify-center">
              <span className="text-black font-heading font-black text-sm">TS</span>
            </div>
            <span className="font-heading font-black text-lg tracking-widest text-white">
              TRADESAFE<span className="text-amber"> AI</span>
            </span>
          </Link>
          <Link
            href="/dashboard"
            className="text-xs font-heading tracking-widest text-gray-400 hover:text-white transition min-h-[48px] flex items-center no-underline"
          >
            CANCEL
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-6">
          <h1 className="font-heading font-black text-3xl text-white tracking-wide">
            NEW COMPLIANCE REPORT
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Ontario code-compliant documentation in minutes.
          </p>
        </div>

        <ProgressBar step={step} />

        {/* ── STEP 1: Select Trade ──────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <h2 className="font-heading font-bold text-xl text-white tracking-wide mb-1">
              SELECT TRADE
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              Choose the trade for this compliance report.
            </p>
            <div className="grid gap-4">
              {TRADES.map((trade) => (
                <button
                  key={trade.id}
                  onClick={() => handleSelectTrade(trade.id)}
                  className="group w-full bg-[#1a1a1a] hover:bg-[#242424] border border-white/10 hover:border-amber/50 rounded-2xl p-6 text-left transition-all cursor-pointer min-h-[96px]"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-amber/10 group-hover:bg-amber/20 rounded-xl flex items-center justify-center text-3xl transition-all shrink-0">
                      {trade.icon}
                    </div>
                    <div className="flex-1">
                      <div className="font-heading font-black text-2xl text-white tracking-wide group-hover:text-amber transition-colors">
                        {trade.name.toUpperCase()}
                      </div>
                      <div className="text-xs font-heading tracking-widest text-amber/70 mt-0.5">
                        {trade.governingBody}
                      </div>
                      <div className="text-sm text-gray-400 mt-1">
                        {trade.description}
                      </div>
                    </div>
                    <svg
                      className="w-5 h-5 text-gray-600 group-hover:text-amber transition-colors shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 2: Job Details ───────────────────────────────────────── */}
        {step === 2 && selectedTrade && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={() => setStep(1)}
                className="text-gray-400 hover:text-white transition min-h-[48px] flex items-center gap-1 text-sm font-heading tracking-wide cursor-pointer bg-transparent border-none"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                BACK
              </button>
              <span className="text-gray-600">|</span>
              <h2 className="font-heading font-bold text-xl text-white tracking-wide">
                JOB DETAILS
              </h2>
            </div>

            <form onSubmit={handleJobDetailsNext} className="space-y-5">
              {/* Contractor section */}
              <div className="bg-[#1a1a1a] rounded-2xl p-6 border border-white/10">
                <h3 className="font-heading font-bold text-sm tracking-widest text-amber mb-4 uppercase">
                  Contractor Information
                </h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Contractor Business Name</label>
                    <input
                      type="text"
                      required
                      value={jobDetails.businessName}
                      onChange={(e) => handleJobField('businessName', e.target.value)}
                      className={inputClass}
                      placeholder="Smith Electrical Inc."
                    />
                  </div>
                  <div>
                    <label className={labelClass}>
                      {selectedTrade === 'electrical'
                        ? 'Electrical License (LEC) Number'
                        : selectedTrade === 'plumbing'
                        ? 'Master Plumber License Number'
                        : 'Roofing License Number'}
                    </label>
                    <input
                      type="text"
                      value={jobDetails.licenseNumber}
                      onChange={(e) => handleJobField('licenseNumber', e.target.value)}
                      className={inputClass}
                      placeholder="e.g. 7700123"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Ontario College of Trades Certificate Number</label>
                    <input
                      type="text"
                      value={jobDetails.cotCertNumber}
                      onChange={(e) => handleJobField('cotCertNumber', e.target.value)}
                      className={inputClass}
                      placeholder="e.g. COT-123456"
                    />
                  </div>
                </div>
              </div>

              {/* Job site section */}
              <div className="bg-[#1a1a1a] rounded-2xl p-6 border border-white/10">
                <h3 className="font-heading font-bold text-sm tracking-widest text-amber mb-4 uppercase">
                  Job Site
                </h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Job Site Municipal Address</label>
                    <input
                      type="text"
                      required
                      value={jobDetails.jobAddress}
                      onChange={(e) => handleJobField('jobAddress', e.target.value)}
                      className={inputClass}
                      placeholder="123 Main St, Toronto, ON M6R 1A1"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Homeowner / Client Name</label>
                    <input
                      type="text"
                      required
                      value={jobDetails.homeownerName}
                      onChange={(e) => handleJobField('homeownerName', e.target.value)}
                      className={inputClass}
                      placeholder="Jane Smith"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Date of Work</label>
                    <input
                      type="date"
                      required
                      value={jobDetails.dateOfWork}
                      onChange={(e) => handleJobField('dateOfWork', e.target.value)}
                      className={`${inputClass} [color-scheme:dark]`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Supervising Journeyperson Name</label>
                    <input
                      type="text"
                      required
                      value={jobDetails.supervisingJourneyperson}
                      onChange={(e) => handleJobField('supervisingJourneyperson', e.target.value)}
                      className={inputClass}
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{permitLabel}</label>
                    <input
                      type="text"
                      value={jobDetails.permitNumber}
                      onChange={(e) => handleJobField('permitNumber', e.target.value)}
                      className={inputClass}
                      placeholder={selectedTrade === 'electrical' ? 'ESA-XXXXXXX' : 'OBC-XXXXXXX'}
                    />
                  </div>
                </div>
              </div>

              {/* Roofing-specific */}
              {selectedTrade === 'roofing' && (
                <div className="bg-[#1a1a1a] rounded-2xl p-6 border border-white/10">
                  <h3 className="font-heading font-bold text-sm tracking-widest text-amber mb-4 uppercase">
                    Roofing Certifications
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Working at Heights Cert Number</label>
                      <input
                        type="text"
                        value={jobDetails.wahCertNumber}
                        onChange={(e) => handleJobField('wahCertNumber', e.target.value)}
                        className={inputClass}
                        placeholder="WAH-XXXXXX"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>WAH Certificate Expiry</label>
                      <input
                        type="date"
                        value={jobDetails.wahCertExpiry}
                        onChange={(e) => handleJobField('wahCertExpiry', e.target.value)}
                        className={`${inputClass} [color-scheme:dark]`}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelClass}>WSIB Clearance Number</label>
                      <input
                        type="text"
                        value={jobDetails.wsibClearanceNumber}
                        onChange={(e) => handleJobField('wsibClearanceNumber', e.target.value)}
                        className={inputClass}
                        placeholder="WSIB-XXXXXXXX"
                      />
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full min-h-[48px] bg-amber hover:bg-amber-dark text-black font-heading font-bold text-sm tracking-widest rounded-xl transition"
              >
                NEXT: CHECKLIST →
              </button>
            </form>
          </div>
        )}

        {/* ── STEP 3: Checklist ─────────────────────────────────────────── */}
        {step === 3 && selectedTrade && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={() => setStep(2)}
                className="text-gray-400 hover:text-white transition min-h-[48px] flex items-center gap-1 text-sm font-heading tracking-wide cursor-pointer bg-transparent border-none"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                BACK
              </button>
              <span className="text-gray-600">|</span>
              <h2 className="font-heading font-bold text-xl text-white tracking-wide">
                COMPLIANCE CHECKLIST
              </h2>
            </div>

            <p className="text-gray-400 text-sm mb-6">
              Mark each item as Pass, Fail, or N/A. Add notes where relevant.
            </p>

            <div className="space-y-4">
              {(CHECKLISTS[selectedTrade] || []).map((cat) => (
                <div key={cat.category} className="bg-[#1a1a1a] rounded-2xl border border-white/10 overflow-hidden">
                  <div className="px-5 py-3 bg-white/5 border-b border-white/10">
                    <h3 className="font-heading font-bold text-sm tracking-widest text-amber uppercase">
                      {cat.category}
                    </h3>
                  </div>
                  <div className="divide-y divide-white/5">
                    {cat.items.map((item) => {
                      const key = `${cat.category}__${item}`
                      const val = checklist[key] || { status: 'pass', notes: '' }
                      return (
                        <div key={item} className="px-5 py-4">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <span className="flex-1 text-sm text-white">{item}</span>
                            {/* Toggle buttons */}
                            <div className="flex gap-1 shrink-0">
                              {[
                                { value: 'pass', label: 'PASS', activeClass: 'bg-success text-white' },
                                { value: 'fail', label: 'FAIL', activeClass: 'bg-danger text-white' },
                                { value: 'na', label: 'N/A', activeClass: 'bg-white/20 text-white' },
                              ].map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => handleChecklistItem(cat.category, item, 'status', opt.value)}
                                  className={`min-h-[36px] px-3 rounded-lg text-xs font-heading font-bold tracking-wider transition cursor-pointer ${
                                    val.status === opt.value
                                      ? opt.activeClass
                                      : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-300'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          {/* Notes field */}
                          <div className="mt-2">
                            <input
                              type="text"
                              value={val.notes}
                              onChange={(e) => handleChecklistItem(cat.category, item, 'notes', e.target.value)}
                              className="w-full min-h-[36px] bg-[#0f0f0f] border border-white/5 rounded-lg px-3 text-xs text-gray-300 placeholder-gray-700 focus:outline-none focus:border-amber/50 transition"
                              placeholder="Notes (optional)"
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setStep(4)}
              className="w-full mt-6 min-h-[48px] bg-amber hover:bg-amber-dark text-black font-heading font-bold text-sm tracking-widest rounded-xl transition"
            >
              NEXT: REVIEW & SUBMIT →
            </button>
          </div>
        )}

        {/* ── STEP 4: Review & Submit ───────────────────────────────────── */}
        {step === 4 && selectedTrade && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={() => setStep(3)}
                className="text-gray-400 hover:text-white transition min-h-[48px] flex items-center gap-1 text-sm font-heading tracking-wide cursor-pointer bg-transparent border-none"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                BACK
              </button>
              <span className="text-gray-600">|</span>
              <h2 className="font-heading font-bold text-xl text-white tracking-wide">
                REVIEW & SUBMIT
              </h2>
            </div>

            {/* Summary cards */}
            <div className="space-y-4 mb-6">
              {/* Trade */}
              <div className="bg-[#1a1a1a] rounded-2xl p-5 border border-white/10">
                <div className="text-xs font-heading tracking-widest text-gray-500 uppercase mb-1">Trade</div>
                <div className="font-heading font-black text-xl text-amber tracking-wide">
                  {selectedTrade.toUpperCase()}
                </div>
              </div>

              {/* Contractor */}
              <div className="bg-[#1a1a1a] rounded-2xl p-5 border border-white/10">
                <div className="text-xs font-heading tracking-widest text-amber mb-3 uppercase">Contractor</div>
                <div className="grid sm:grid-cols-2 gap-2 text-sm">
                  <SummaryRow label="Business" value={jobDetails.businessName} />
                  <SummaryRow label="License" value={jobDetails.licenseNumber} />
                  <SummaryRow label="COT Cert" value={jobDetails.cotCertNumber} />
                </div>
              </div>

              {/* Job Site */}
              <div className="bg-[#1a1a1a] rounded-2xl p-5 border border-white/10">
                <div className="text-xs font-heading tracking-widest text-amber mb-3 uppercase">Job Site</div>
                <div className="grid sm:grid-cols-2 gap-2 text-sm">
                  <SummaryRow label="Address" value={jobDetails.jobAddress} />
                  <SummaryRow label="Homeowner" value={jobDetails.homeownerName} />
                  <SummaryRow label="Date of Work" value={jobDetails.dateOfWork} />
                  <SummaryRow label="Journeyperson" value={jobDetails.supervisingJourneyperson} />
                  <SummaryRow label={permitLabel} value={jobDetails.permitNumber} />
                </div>
              </div>

              {/* Roofing extras */}
              {selectedTrade === 'roofing' && (
                <div className="bg-[#1a1a1a] rounded-2xl p-5 border border-white/10">
                  <div className="text-xs font-heading tracking-widest text-amber mb-3 uppercase">Roofing Certifications</div>
                  <div className="grid sm:grid-cols-2 gap-2 text-sm">
                    <SummaryRow label="WAH Cert #" value={jobDetails.wahCertNumber} />
                    <SummaryRow label="WAH Expiry" value={jobDetails.wahCertExpiry} />
                    <SummaryRow label="WSIB Clearance" value={jobDetails.wsibClearanceNumber} />
                  </div>
                </div>
              )}

              {/* Checklist summary */}
              <div className="bg-[#1a1a1a] rounded-2xl p-5 border border-white/10">
                <div className="text-xs font-heading tracking-widest text-amber mb-3 uppercase">Checklist Summary</div>
                {(CHECKLISTS[selectedTrade] || []).map((cat) => {
                  const items = cat.items
                  const passed = items.filter((item) => (checklist[`${cat.category}__${item}`]?.status) === 'pass').length
                  const failed = items.filter((item) => (checklist[`${cat.category}__${item}`]?.status) === 'fail').length
                  const na = items.filter((item) => (checklist[`${cat.category}__${item}`]?.status) === 'na').length
                  return (
                    <div key={cat.category} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <span className="text-sm text-gray-300 font-heading">{cat.category}</span>
                      <div className="flex gap-3 text-xs font-heading font-bold">
                        <span className="text-success">{passed} PASS</span>
                        {failed > 0 && <span className="text-danger">{failed} FAIL</span>}
                        {na > 0 && <span className="text-gray-500">{na} N/A</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Declaration */}
            <div className="bg-[#1a1a1a] rounded-2xl p-5 border border-amber/20 mb-6">
              <label className="flex gap-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={declared}
                  onChange={(e) => setDeclared(e.target.checked)}
                  className="mt-0.5 w-5 h-5 accent-amber shrink-0"
                />
                <span className="text-sm text-gray-300 leading-relaxed">
                  I hereby declare that the work described in this report was completed in compliance
                  with all applicable Ontario codes and regulations.
                </span>
              </label>
            </div>

            {submitError && (
              <div className="mb-4 p-4 bg-danger/10 border border-danger/30 rounded-xl text-danger text-sm">
                {submitError}
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!declared || submitting}
              className="w-full min-h-[48px] bg-amber hover:bg-amber-dark disabled:opacity-40 disabled:cursor-not-allowed text-black font-heading font-bold text-sm tracking-widest rounded-xl transition"
            >
              {submitting ? 'SUBMITTING...' : 'SUBMIT REPORT'}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

// ── Small helper for review summary rows ─────────────────────────────────────

function SummaryRow({ label, value }) {
  return (
    <div>
      <span className="text-xs font-heading tracking-wider text-gray-500 uppercase block">{label}</span>
      <span className="text-white">{value || <span className="text-gray-600 italic">Not provided</span>}</span>
    </div>
  )
}
