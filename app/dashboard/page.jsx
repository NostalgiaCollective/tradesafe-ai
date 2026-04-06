import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

// Maps each trade type to a badge color
const TRADE_BADGE = {
  electrical: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
  plumbing:   'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  roofing:    'bg-orange-500/15 text-orange-400 border border-orange-500/30',
}

const STATUS_BADGE = {
  completed: 'bg-green-500/15 text-green-400 border border-green-500/30',
  draft:     'bg-white/5 text-gray-400 border border-white/10',
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function Badge({ value, map }) {
  const cls = map[value?.toLowerCase()] ?? 'bg-white/5 text-gray-400 border border-white/10'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-heading font-bold tracking-wider capitalize ${cls}`}>
      {value ?? 'Unknown'}
    </span>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Fetch contractor profile and recent reports in parallel
  const [{ data: profile }, { data: reports }] = await Promise.all([
    supabase
      .from('contractor_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('reports')
      .select('id, trade, job_address, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const totalReports = reports?.length ?? 0
  const completedReports = reports?.filter((r) => r.status === 'completed').length ?? 0
  const draftReports = reports?.filter((r) => r.status === 'draft').length ?? 0
  const businessName = profile?.business_name ?? 'Contractor'

  return (
    <div className="max-w-5xl mx-auto">
      {/* ── Header row ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <p className="text-xs font-mono tracking-[3px] text-amber/70 mb-1">// DASHBOARD</p>
          <h1 className="text-display md:text-[2.75rem] tracking-tight text-white">
            Welcome back, {businessName}
          </h1>
        </div>
        <Link
          href="/report/new"
          className="inline-flex items-center justify-center gap-2 min-h-[64px] px-6 bg-amber hover:bg-amber-light text-black font-heading font-black text-sm tracking-[2px] rounded-xl transition-colors no-underline shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          NEW REPORT
        </Link>
      </div>

      {/* ── Stats row — amber gradient cards ── */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total Reports', value: totalReports, icon: (
            <svg className="w-5 h-5 text-amber/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          )},
          { label: 'Completed', value: completedReports, icon: (
            <svg className="w-5 h-5 text-amber/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )},
          { label: 'Drafts', value: draftReports, icon: (
            <svg className="w-5 h-5 text-amber/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
          )},
        ].map((stat) => (
          <div
            key={stat.label}
            className="stat-card-gradient card-accent px-5 py-5"
          >
            <div className="flex items-center justify-between mb-2">
              {stat.icon}
            </div>
            <p className="text-2xl md:text-3xl font-heading font-black text-white leading-none mb-1">
              {stat.value}
            </p>
            <p className="text-xs font-mono tracking-[2px] text-gray-500">{stat.label.toUpperCase()}</p>
          </div>
        ))}
      </div>

      <div className="section-divider" />

      {/* ── Recent Reports ── */}
      <div className="card-base card-accent overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-section tracking-wider text-white">Recent Reports</h2>
          {totalReports > 0 && (
            <Link
              href="/reports"
              className="text-xs font-mono text-amber hover:text-amber-light transition-colors no-underline tracking-wider"
            >
              View all →
            </Link>
          )}
        </div>

        {totalReports === 0 ? (
          /* ── Empty state ── */
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber/10 flex items-center justify-center mb-5">
              <svg className="w-8 h-8 text-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <h3 className="text-title text-white mb-2">No reports yet</h3>
            <p className="text-gray-500 text-base mb-6 max-w-sm leading-relaxed">
              Generate your first compliance report in under 60 seconds. Pick a trade, complete the checklist, get a signed PDF.
            </p>
            <Link
              href="/report/new"
              className="inline-flex items-center justify-center gap-2 min-h-[64px] px-8 bg-amber hover:bg-amber-light text-black font-heading font-black text-sm tracking-[2px] rounded-xl transition-colors no-underline"
            >
              Generate your first compliance report
            </Link>
          </div>
        ) : (
          /* ── Reports list ── */
          <div>
            {/* Desktop table header */}
            <div className="hidden md:grid grid-cols-[1fr_2fr_1fr_1fr_auto] gap-4 px-6 py-3 border-b border-white/5">
              {['Trade', 'Job Site', 'Date', 'Status', ''].map((h) => (
                <span key={h} className="text-xs font-mono tracking-[2px] text-gray-600 uppercase">{h}</span>
              ))}
            </div>

            {reports.map((report, i) => (
              <div
                key={report.id}
                className={`flex flex-col md:grid md:grid-cols-[1fr_2fr_1fr_1fr_auto] gap-2 md:gap-4 px-6 py-4 items-start md:items-center ${
                  i < reports.length - 1 ? 'border-b border-white/5' : ''
                } hover:bg-white/[0.02] transition-colors`}
              >
                <div>
                  <Badge value={report.trade} map={TRADE_BADGE} />
                </div>
                <p className="text-base text-gray-300 font-body truncate">
                  {report.job_address ?? '—'}
                </p>
                <p className="text-xs text-gray-500 font-mono">{formatDate(report.created_at)}</p>
                <div>
                  <Badge value={report.status} map={STATUS_BADGE} />
                </div>
                <Link
                  href={`/report/${report.id}`}
                  className="text-xs font-mono text-amber hover:text-amber-light transition-colors no-underline tracking-wider shrink-0 min-h-[48px] flex items-center"
                >
                  View →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
