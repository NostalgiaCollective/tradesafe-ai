'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500)
    return () => clearTimeout(t)
  }, [onDismiss])

  const colours =
    type === 'success'
      ? 'bg-green-500/10 border-green-500/30 text-green-400'
      : 'bg-red-500/10 border-red-500/30 text-red-400'

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl border text-sm font-heading font-bold tracking-wide shadow-2xl ${colours}`}
    >
      <span>{type === 'success' ? '✓' : '✕'}</span>
      {message}
      <button onClick={onDismiss} className="ml-2 opacity-60 hover:opacity-100 text-xs">✕</button>
    </div>
  )
}

// ─── Input / Label helpers ─────────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

const inputCls =
  'w-full h-12 bg-[#0f0f0f] border border-white/10 rounded-xl px-4 text-white placeholder-gray-600 focus:outline-none focus:border-amber transition'

// ─── Section Card ──────────────────────────────────────────────────────────────

function SectionCard({ title, children }) {
  return (
    <div className="bg-[#1a1a1a] rounded-2xl p-6 border border-white/10">
      <h2 className="font-heading font-bold text-lg text-amber tracking-wider mb-5">{title}</h2>
      {children}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function SettingsClient() {
  const supabase = createClient()
  const router = useRouter()

  const [userId, setUserId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null) // { message, type }

  // Business Info
  const [businessName, setBusinessName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [address, setAddress] = useState('')

  // Trade Licenses
  const [cotCertNumber, setCotCertNumber] = useState('')
  const [ecraNumber, setEcraNumber] = useState('')
  const [coqNumber, setCoqNumber] = useState('')
  const [wahCertNumber, setWahCertNumber] = useState('')
  const [wahExpiry, setWahExpiry] = useState('')
  const [wsibNumber, setWsibNumber] = useState('')
  const [liabilityPolicyNumber, setLiabilityPolicyNumber] = useState('')

  // Billing
  const [plan, setPlan] = useState('per_report') // 'per_report' | 'crew_plan'

  // Crew Members
  const [crewMembers, setCrewMembers] = useState([])
  const [showAddCrew, setShowAddCrew] = useState(false)
  const [newCrew, setNewCrew] = useState({ name: '', role: '', trade: '', license_number: '' })
  const [addingCrew, setAddingCrew] = useState(false)

  // ── Load user + profile ────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        router.push('/auth/login?redirect=/settings')
        return
      }
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('contractor_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (profile) {
        setBusinessName(profile.business_name || '')
        setContactEmail(profile.contact_email || '')
        setContactPhone(profile.contact_phone || '')
        setAddress(profile.address || '')
        setCotCertNumber(profile.cot_cert_number || '')
        setEcraNumber(profile.ecra_number || '')
        setCoqNumber(profile.coq_number || '')
        setWahCertNumber(profile.wah_cert_number || '')
        setWahExpiry(profile.wah_expiry || '')
        setWsibNumber(profile.wsib_number || '')
        setLiabilityPolicyNumber(profile.liability_policy_number || '')
        setPlan(profile.plan || 'per_report')
      }

      const { data: crew } = await supabase
        .from('crew_members')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

      setCrewMembers(crew || [])
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save Profile ───────────────────────────────────────────────────────────

  async function handleSave() {
    if (!userId) return
    setSaving(true)

    const payload = {
      user_id: userId,
      business_name: businessName,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      address,
      cot_cert_number: cotCertNumber,
      ecra_number: ecraNumber,
      coq_number: coqNumber,
      wah_cert_number: wahCertNumber,
      wah_expiry: wahExpiry || null,
      wsib_number: wsibNumber,
      liability_policy_number: liabilityPolicyNumber,
      plan,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('contractor_profiles')
      .upsert(payload, { onConflict: 'user_id' })

    setSaving(false)

    if (error) {
      setToast({ message: 'Failed to save changes. Please try again.', type: 'error' })
    } else {
      setToast({ message: 'Settings saved successfully.', type: 'success' })
    }
  }

  // ── Crew: Add ──────────────────────────────────────────────────────────────

  async function handleAddCrew(e) {
    e.preventDefault()
    if (!newCrew.name.trim()) return
    setAddingCrew(true)

    const { data, error } = await supabase
      .from('crew_members')
      .insert({ ...newCrew, user_id: userId })
      .select()
      .single()

    setAddingCrew(false)

    if (error) {
      setToast({ message: 'Failed to add crew member.', type: 'error' })
    } else {
      setCrewMembers((prev) => [...prev, data])
      setNewCrew({ name: '', role: '', trade: '', license_number: '' })
      setShowAddCrew(false)
      setToast({ message: 'Crew member added.', type: 'success' })
    }
  }

  // ── Crew: Delete ───────────────────────────────────────────────────────────

  async function handleDeleteCrew(id) {
    const { error } = await supabase.from('crew_members').delete().eq('id', id)

    if (error) {
      setToast({ message: 'Failed to remove crew member.', type: 'error' })
    } else {
      setCrewMembers((prev) => prev.filter((m) => m.id !== id))
      setToast({ message: 'Crew member removed.', type: 'success' })
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="text-gray-500 font-heading tracking-widest text-sm">LOADING...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f]">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[#0f0f0f]/95 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-4xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <div className="w-8 h-8 bg-amber rounded-sm flex items-center justify-center">
              <span className="font-heading font-black text-sm text-black">TS</span>
            </div>
            <span className="font-heading font-black text-lg tracking-widest text-white">
              TRADESAFE AI
            </span>
          </Link>
          <Link
            href="/dashboard"
            className="font-heading font-bold text-sm tracking-wider text-gray-400 hover:text-amber transition-colors no-underline min-h-[48px] flex items-center gap-1.5"
          >
            ← BACK TO DASHBOARD
          </Link>
        </div>
      </header>

      {/* ── Page Body ──────────────────────────────────────────────────────── */}
      <main className="max-w-4xl mx-auto px-5 py-10 space-y-6">

        <div className="mb-8">
          <h1 className="font-heading font-black text-4xl text-white tracking-wide">SETTINGS</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your business profile, licences, and billing.</p>
        </div>

        {/* ── Business Information ──────────────────────────────────────────── */}
        <SectionCard title="BUSINESS INFORMATION">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Business Name">
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className={inputCls}
                placeholder="Acme Electrical Ltd."
              />
            </Field>
            <Field label="Contact Email">
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className={inputCls}
                placeholder="you@company.com"
              />
            </Field>
            <Field label="Contact Phone">
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className={inputCls}
                placeholder="416-555-0100"
              />
            </Field>
            <Field label="Address">
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={inputCls}
                placeholder="123 Main St, Toronto, ON"
              />
            </Field>
          </div>
        </SectionCard>

        {/* ── Trade Licenses ────────────────────────────────────────────────── */}
        <SectionCard title="TRADE LICENCES">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Ontario College of Trades Certificate No.">
              <input
                type="text"
                value={cotCertNumber}
                onChange={(e) => setCotCertNumber(e.target.value)}
                className={inputCls}
                placeholder="COT-123456"
              />
            </Field>
            <Field label="ECRA/ESA Electrical Contractor No. (LEC)">
              <input
                type="text"
                value={ecraNumber}
                onChange={(e) => setEcraNumber(e.target.value)}
                className={inputCls}
                placeholder="7012345"
              />
            </Field>
            <Field label="Certificate of Qualification No. (C of Q — Plumbing)">
              <input
                type="text"
                value={coqNumber}
                onChange={(e) => setCoqNumber(e.target.value)}
                className={inputCls}
                placeholder="306A-123456"
              />
            </Field>
            <Field label="Working at Heights Cert No. (Roofing)">
              <input
                type="text"
                value={wahCertNumber}
                onChange={(e) => setWahCertNumber(e.target.value)}
                className={inputCls}
                placeholder="WAH-654321"
              />
            </Field>
            <Field label="Working at Heights Expiry Date">
              <input
                type="date"
                value={wahExpiry}
                onChange={(e) => setWahExpiry(e.target.value)}
                className={`${inputCls} [color-scheme:dark]`}
              />
            </Field>
            <Field label="WSIB Clearance Certificate No.">
              <input
                type="text"
                value={wsibNumber}
                onChange={(e) => setWsibNumber(e.target.value)}
                className={inputCls}
                placeholder="WSIB-789012"
              />
            </Field>
            <Field label="Liability Insurance Policy No.">
              <input
                type="text"
                value={liabilityPolicyNumber}
                onChange={(e) => setLiabilityPolicyNumber(e.target.value)}
                className={inputCls}
                placeholder="INS-XXXXXX"
              />
            </Field>
          </div>
        </SectionCard>

        {/* ── Billing ───────────────────────────────────────────────────────── */}
        <SectionCard title="BILLING">
          <p className="text-gray-500 text-sm mb-4">Choose the plan that fits your business. Payment integration coming soon.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Per Report */}
            <button
              type="button"
              onClick={() => setPlan('per_report')}
              className={`relative text-left p-5 rounded-xl border transition-all min-h-[120px] flex flex-col justify-between ${
                plan === 'per_report'
                  ? 'border-amber bg-amber/5'
                  : 'border-white/10 bg-[#0f0f0f] hover:border-white/20'
              }`}
            >
              <div>
                <div className="font-heading font-black text-white text-xl tracking-wide">Per Report</div>
                <div className="text-gray-400 text-sm mt-1">Pay as you go. No commitment.</div>
              </div>
              <div className="flex items-end justify-between mt-4">
                <span className="font-heading font-black text-3xl text-amber">$10</span>
                <span className="text-gray-500 text-xs">per report</span>
              </div>
              {plan === 'per_report' && (
                <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-amber flex items-center justify-center">
                  <span className="text-black text-xs font-black">✓</span>
                </div>
              )}
            </button>

            {/* Crew Plan */}
            <button
              type="button"
              onClick={() => setPlan('crew_plan')}
              className={`relative text-left p-5 rounded-xl border transition-all min-h-[120px] flex flex-col justify-between ${
                plan === 'crew_plan'
                  ? 'border-amber bg-amber/5'
                  : 'border-white/10 bg-[#0f0f0f] hover:border-white/20'
              }`}
            >
              <div>
                <div className="font-heading font-black text-white text-xl tracking-wide">Crew Plan</div>
                <div className="text-gray-400 text-sm mt-1">Unlimited reports for your whole crew.</div>
              </div>
              <div className="flex items-end justify-between mt-4">
                <span className="font-heading font-black text-3xl text-amber">$99</span>
                <span className="text-gray-500 text-xs">/ month</span>
              </div>
              {plan === 'crew_plan' && (
                <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-amber flex items-center justify-center">
                  <span className="text-black text-xs font-black">✓</span>
                </div>
              )}
            </button>

          </div>
        </SectionCard>

        {/* ── Crew Members ──────────────────────────────────────────────────── */}
        <SectionCard title="CREW MEMBERS">
          {crewMembers.length === 0 && !showAddCrew && (
            <p className="text-gray-500 text-sm mb-4">No crew members added yet.</p>
          )}

          {crewMembers.length > 0 && (
            <div className="space-y-3 mb-4">
              {crewMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between bg-[#0f0f0f] border border-white/10 rounded-xl px-4 py-3 gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-heading font-bold text-white text-base leading-tight truncate">
                      {member.name}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      {member.role && (
                        <span className="text-gray-500 text-xs">{member.role}</span>
                      )}
                      {member.trade && (
                        <span className="text-amber text-xs">{member.trade}</span>
                      )}
                      {member.license_number && (
                        <span className="text-gray-600 text-xs font-mono">{member.license_number}</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteCrew(member.id)}
                    className="shrink-0 text-gray-600 hover:text-red-400 transition-colors text-sm font-heading font-bold tracking-wide min-h-[48px] px-3"
                  >
                    REMOVE
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add Crew Inline Form */}
          {showAddCrew && (
            <form onSubmit={handleAddCrew} className="bg-[#0f0f0f] border border-white/10 rounded-xl p-4 mb-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Full Name *">
                  <input
                    type="text"
                    required
                    value={newCrew.name}
                    onChange={(e) => setNewCrew((p) => ({ ...p, name: e.target.value }))}
                    className={inputCls}
                    placeholder="Jane Smith"
                  />
                </Field>
                <Field label="Role">
                  <input
                    type="text"
                    value={newCrew.role}
                    onChange={(e) => setNewCrew((p) => ({ ...p, role: e.target.value }))}
                    className={inputCls}
                    placeholder="Journeyperson"
                  />
                </Field>
                <Field label="Trade">
                  <input
                    type="text"
                    value={newCrew.trade}
                    onChange={(e) => setNewCrew((p) => ({ ...p, trade: e.target.value }))}
                    className={inputCls}
                    placeholder="Electrical"
                  />
                </Field>
                <Field label="Licence Number">
                  <input
                    type="text"
                    value={newCrew.license_number}
                    onChange={(e) => setNewCrew((p) => ({ ...p, license_number: e.target.value }))}
                    className={inputCls}
                    placeholder="306A-789012"
                  />
                </Field>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={addingCrew}
                  className="h-12 px-6 bg-amber hover:bg-amber-dark text-black font-heading font-bold text-sm tracking-wider rounded-xl transition disabled:opacity-50"
                >
                  {addingCrew ? 'ADDING...' : 'ADD MEMBER'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddCrew(false); setNewCrew({ name: '', role: '', trade: '', license_number: '' }) }}
                  className="h-12 px-6 bg-transparent border border-white/10 hover:border-white/30 text-gray-400 hover:text-white font-heading font-bold text-sm tracking-wider rounded-xl transition"
                >
                  CANCEL
                </button>
              </div>
            </form>
          )}

          {!showAddCrew && (
            <button
              type="button"
              onClick={() => setShowAddCrew(true)}
              className="h-12 px-6 bg-transparent border border-white/10 hover:border-amber/50 hover:text-amber text-gray-400 font-heading font-bold text-sm tracking-wider rounded-xl transition"
            >
              + ADD CREW MEMBER
            </button>
          )}
        </SectionCard>

        {/* ── Save Button ───────────────────────────────────────────────────── */}
        <div className="flex justify-end pt-2 pb-10">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="h-12 px-10 bg-amber hover:bg-amber-dark text-black font-heading font-black text-sm tracking-[2px] rounded-xl transition disabled:opacity-50 min-w-[160px]"
          >
            {saving ? 'SAVING...' : 'SAVE CHANGES'}
          </button>
        </div>

      </main>

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}

    </div>
  )
}
