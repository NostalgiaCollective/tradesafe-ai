"use client";
import Link from "next/link";

export default function TradeDetailPage({ trade }) {
  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0f0f0f]/95 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <div className="w-8 h-8 bg-amber rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="font-heading font-bold text-lg text-white">
              TradeSafe AI
            </span>
          </Link>
          <Link
            href="/"
            className="font-heading font-bold text-sm tracking-wider text-gray-400 hover:text-amber transition-colors no-underline min-h-[48px] flex items-center"
          >
            &larr; BACK TO HOME
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-28 pb-20 px-5 relative overflow-hidden">
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="font-mono text-xs tracking-[3px] text-amber/70 mb-4">
            // {trade.code}
          </div>
          <div className="flex items-start gap-5 mb-6">
            <span className="text-5xl">{trade.icon}</span>
            <div>
              <h1 className="font-heading font-black text-[clamp(40px,8vw,72px)] leading-[0.9] text-white">
                {trade.name.toUpperCase()}<br />
                <span className="text-amber">COMPLIANCE</span>
              </h1>
            </div>
          </div>
          <p className="font-body text-xl text-gray-400 max-w-2xl leading-relaxed mb-4">
            {trade.description}
          </p>
          <p className="font-mono text-sm text-amber/60 mb-8">
            Enforced by: {trade.enforcedBy}
          </p>
          <Link
            href="/auth/login"
            className="inline-flex items-center justify-center font-heading font-black text-sm tracking-[3px] bg-amber text-black px-8 py-4 rounded-lg no-underline hover:bg-amber-light transition-all min-h-[48px]"
          >
            GENERATE REPORT
          </Link>
        </div>
      </section>

      {/* Checklist Items */}
      <section className="py-20 px-5 bg-[#1a1a1a]">
        <div className="max-w-5xl mx-auto">
          <div className="font-mono text-xs tracking-[3px] text-amber/70 mb-4">// ONTARIO CHECKLIST</div>
          <h2 className="font-heading font-black text-[clamp(28px,5vw,44px)] leading-[0.95] text-white mb-12">
            {trade.checklistTitle}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {trade.checklist.map((section, i) => (
              <div key={i} className="bg-[#0f0f0f] border border-white/10 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-amber/10 border border-amber/30 rounded-lg flex items-center justify-center text-amber font-heading font-black text-sm">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3 className="font-heading font-bold text-lg tracking-wider text-white">
                    {section.title}
                  </h3>
                </div>
                <ul className="list-none">
                  {section.items.map((item, j) => (
                    <li key={j} className="py-2 border-b border-white/5 last:border-b-0 flex gap-3 font-body text-sm text-gray-400">
                      <span className="text-amber shrink-0">&#10003;</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Regulations */}
      <section className="py-20 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="font-mono text-xs tracking-[3px] text-amber/70 mb-4">// REGULATIONS COVERED</div>
          <h2 className="font-heading font-black text-[clamp(28px,5vw,44px)] leading-[0.95] text-white mb-12">
            BUILT FROM<br /><span className="text-amber">ONTARIO LAW.</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {trade.regulations.map((reg, i) => (
              <div key={i} className="bg-[#1a1a1a] border border-white/10 rounded-xl p-5">
                <div className="font-mono text-[11px] tracking-[2px] text-amber mb-2">{reg.code}</div>
                <div className="font-heading font-bold text-base text-white mb-1">{reg.title}</div>
                <p className="font-body text-sm text-gray-500 leading-relaxed">{reg.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sample Report Preview */}
      <section className="py-20 px-5 bg-[#1a1a1a]">
        <div className="max-w-3xl mx-auto text-center">
          <div className="font-mono text-xs tracking-[3px] text-amber/70 mb-4">// SAMPLE OUTPUT</div>
          <h2 className="font-heading font-black text-[clamp(28px,5vw,44px)] leading-[0.95] text-white mb-6">
            YOUR REPORT<br /><span className="text-amber">LOOKS LIKE THIS.</span>
          </h2>
          <p className="font-body text-lg text-gray-500 mb-10">
            Professional, print-ready Ontario compliance documentation.
          </p>

          {/* Mock report */}
          <div className="bg-[#0f0f0f] border border-white/10 rounded-xl p-8 text-left max-w-md mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="font-heading font-bold text-lg text-white tracking-wider">
                ONTARIO COMPLIANCE REPORT
              </div>
              <div className="font-mono text-[10px] text-amber tracking-wider">PDF</div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="font-mono text-xs text-gray-600">TRADE</span>
                <span className="font-heading font-bold text-sm text-white">{trade.name}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="font-mono text-xs text-gray-600">PERMIT</span>
                <span className="font-heading font-bold text-sm text-white">{trade.samplePermit}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="font-mono text-xs text-gray-600">ITEMS CHECKED</span>
                <span className="font-heading font-bold text-sm text-amber">{trade.totalChecks} / {trade.totalChecks}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="font-mono text-xs text-gray-600">JURISDICTION</span>
                <span className="font-heading font-bold text-sm text-white">Ontario</span>
              </div>
              <div className="flex justify-between">
                <span className="font-mono text-xs text-gray-600">STATUS</span>
                <span className="font-heading font-bold text-sm text-success">COMPLIANT</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-5 text-center">
        <h2 className="font-heading font-black text-[clamp(24px,4vw,40px)] text-white leading-tight mb-4">
          START YOUR {trade.name.toUpperCase()} COMPLIANCE REPORT<br />
          <span className="text-amber">IN MINUTES.</span>
        </h2>
        <p className="font-body text-lg text-gray-500 mb-8">
          Stay legal. Stay safe. Stay working.
        </p>
        <Link
          href="/auth/login"
          className="inline-flex items-center justify-center font-heading font-black text-lg tracking-[3px] bg-amber text-black px-12 py-5 rounded-lg no-underline hover:bg-amber-light transition-all min-h-[48px]"
        >
          GET STARTED
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-5 py-6 flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 bg-amber rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <span className="font-heading font-bold text-sm tracking-widest text-gray-600">TRADESAFE AI</span>
        </div>
        <span className="font-mono text-[11px] text-gray-700">
          &copy; 2025 TradeSafe AI. Built in Toronto.
        </span>
      </footer>
    </div>
  );
}
