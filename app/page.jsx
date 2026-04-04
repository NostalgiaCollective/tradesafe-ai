"use client";
import { useState } from "react";
import Link from "next/link";

// ─── SVG Icons ───────────────────────────────────────────────────────────────

function ShieldIcon({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7L12 2z" />
    </svg>
  );
}

function BoltIcon({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function DropletIcon({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
    </svg>
  );
}

function RoofIcon({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12L12 3l9 9" />
      <path d="M9 21V12h6v9" />
      <path d="M5 21h14" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6l12 12M6 18L18 6" />
    </svg>
  );
}

function CheckIcon({ className = "" }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ─── Data ────────────────────────────────────────────────────────────────────

const TRADES = [
  {
    name: "Electrical",
    href: "/electrical",
    icon: BoltIcon,
    body: "ESA / Ontario Electrical Safety Authority",
    items: [
      "Panel and service equipment inspection",
      "Grounding and bonding verification",
      "Arc fault and GFCI protection",
      "Wire gauge and load capacity checks",
    ],
  },
  {
    name: "Plumbing",
    href: "/plumbing",
    icon: DropletIcon,
    body: "OBC Part 7 / Ontario Building Code",
    items: [
      "Backflow prevention documentation",
      "Drain and venting compliance",
      "Pressure test records",
      "DWV system inspection",
    ],
  },
  {
    name: "Roofing",
    href: "/roofing",
    icon: RoofIcon,
    body: "OBC / MOL — Ministry of Labour",
    items: [
      "Fall protection plan on file",
      "Guardrail and anchor point checks",
      "Ladder safety and access records",
      "Material handling and load limits",
    ],
  },
];

const STEPS = [
  {
    num: "01",
    title: "Select Your Trade",
    desc: "Choose electrical, plumbing, or roofing. The right checklist loads automatically.",
  },
  {
    num: "02",
    title: "Fill the Checklist",
    desc: "Walk through every code requirement. Built for gloves — big tap targets, plain language.",
  },
  {
    num: "03",
    title: "Generate Report",
    desc: "One tap produces a print-ready PDF with Ontario code references attached.",
  },
  {
    num: "04",
    title: "Stay Compliant",
    desc: "Every report is stored and retrievable. Pull it up on your phone during any inspection.",
  },
];

const PRICING = [
  {
    name: "Per Report",
    price: "$10",
    sub: "per report",
    featured: false,
    features: [
      "Single compliance document",
      "All three trades supported",
      "Print-ready PDF format",
      "Ontario code references included",
    ],
  },
  {
    name: "Crew Plan",
    price: "$99",
    sub: "per month, per crew",
    featured: true,
    features: [
      "Unlimited reports",
      "Crew member management",
      "Priority support",
      "Compliance updates included",
    ],
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function Page() {
  const [mobileMenu, setMobileMenu] = useState(false);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0f0f0f] text-white">

      {/* ══════════════════════════════════════════════════
          HEADER — fixed, dark, amber CTA
      ══════════════════════════════════════════════════ */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0f0f0f]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <div className="w-8 h-8 bg-[#f59e0b] rounded flex items-center justify-center">
              <ShieldIcon className="w-5 h-5 text-black" />
            </div>
            <span className="font-heading font-black text-lg tracking-wide text-white">
              TradeSafe AI
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            {[
              { label: "Features", href: "#trades" },
              { label: "Pricing", href: "#pricing" },
            ].map(({ label, href }) => (
              <a
                key={label}
                href={href}
                className="font-heading font-semibold text-sm tracking-wider text-gray-400 hover:text-[#f59e0b] transition-colors no-underline"
              >
                {label}
              </a>
            ))}
            <Link
              href="/auth/login"
              className="font-heading font-black text-sm tracking-wider bg-[#f59e0b] text-black px-5 h-12 flex items-center rounded hover:bg-[#fbbf24] transition-colors no-underline"
            >
              Get Started
            </Link>
          </nav>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenu(!mobileMenu)}
            className="md:hidden w-12 h-12 flex items-center justify-center text-white bg-transparent border-none cursor-pointer"
            aria-label="Toggle menu"
          >
            {mobileMenu ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>

        {/* Mobile menu drawer */}
        {mobileMenu && (
          <div className="md:hidden bg-[#1a1a1a] border-t border-white/10 px-5 py-6 flex flex-col gap-5">
            {[
              { label: "Features", href: "#trades" },
              { label: "Pricing", href: "#pricing" },
            ].map(({ label, href }) => (
              <a
                key={label}
                href={href}
                onClick={() => setMobileMenu(false)}
                className="font-heading font-bold text-lg tracking-wide text-gray-300 no-underline"
              >
                {label}
              </a>
            ))}
            <Link
              href="/auth/login"
              onClick={() => setMobileMenu(false)}
              className="font-heading font-black text-lg tracking-wider bg-[#f59e0b] text-black px-5 h-12 flex items-center justify-center rounded no-underline hover:bg-[#fbbf24] transition-colors"
            >
              Get Started
            </Link>
          </div>
        )}
      </header>

      {/* ══════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
        {/* Subtle grid background */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
        {/* Amber vertical accent */}
        <div className="absolute top-0 bottom-0 right-[28%] w-px bg-[#f59e0b]/20 hidden md:block" />

        <div className="relative z-10 max-w-7xl mx-auto px-5 py-24 w-full">
          <div className="max-w-3xl">
            {/* Eyebrow */}
            <p className="font-heading text-xs tracking-[0.25em] text-[#f59e0b]/70 mb-6 uppercase">
              Ontario Compliance Platform
            </p>

            {/* Headline */}
            <h1 className="font-heading font-black leading-[0.9] tracking-tight text-white mb-8"
                style={{ fontSize: "clamp(52px, 10vw, 104px)" }}>
              Ontario Compliance<br />
              <span className="text-[#f59e0b]">Reports in Minutes</span>
            </h1>

            {/* Subheading */}
            <p className="font-heading text-xl md:text-2xl text-gray-400 mb-4 max-w-xl leading-relaxed">
              Generate code-compliant inspection documents for electrical, plumbing, and roofing contractors. Built for Ontario — ESA, OBC, and MOL ready.
            </p>

            {/* Tagline */}
            <p className="font-heading font-black text-base tracking-widest text-[#f59e0b] mb-10">
              Stay legal. Stay safe. Stay working.
            </p>

            {/* CTA */}
            <Link
              href="/auth/login"
              className="inline-flex items-center font-heading font-black text-base tracking-wider bg-[#f59e0b] text-black px-10 h-14 rounded hover:bg-[#fbbf24] transition-colors no-underline mb-12"
            >
              Get Started Free
            </Link>

            {/* Stats row */}
            <div className="flex flex-wrap gap-8">
              {[
                "2024 OESC Compliant",
                "OBC Part 7 Ready",
                "MOL Certified Process",
              ].map((stat) => (
                <div key={stat} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#f59e0b] shrink-0" />
                  <span className="font-heading font-semibold text-sm text-gray-300 tracking-wide">
                    {stat}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          TRADE CARDS
      ══════════════════════════════════════════════════ */}
      <section id="trades" className="py-24 px-5 bg-[#0f0f0f]">
        <div className="max-w-6xl mx-auto">
          <p className="font-heading text-xs tracking-[0.25em] text-[#f59e0b]/70 mb-4 uppercase">
            Select Your Trade
          </p>
          <h2
            className="font-heading font-black leading-[0.95] text-white mb-4"
            style={{ fontSize: "clamp(36px, 5vw, 60px)" }}
          >
            Built for Every<br />
            <span className="text-[#f59e0b]">Ontario Contractor</span>
          </h2>
          <p className="font-heading text-lg text-gray-500 mb-14 max-w-lg leading-relaxed">
            Each trade has its own checklist built from the exact codes your inspector checks.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TRADES.map((trade) => {
              const Icon = trade.icon;
              return (
                <Link
                  key={trade.name}
                  href={trade.href}
                  className="group block bg-[#1a1a1a] border border-white/10 rounded p-8 no-underline hover:border-[#f59e0b]/60 transition-all"
                >
                  {/* Icon */}
                  <div className="w-12 h-12 rounded bg-[#f59e0b]/10 flex items-center justify-center mb-6 group-hover:bg-[#f59e0b]/20 transition-colors">
                    <Icon className="w-6 h-6 text-[#f59e0b]" />
                  </div>

                  {/* Name */}
                  <h3 className="font-heading font-black text-2xl text-white mb-1">
                    {trade.name}
                  </h3>

                  {/* Governing body */}
                  <p className="font-heading text-xs tracking-wide text-[#f59e0b]/70 mb-5">
                    {trade.body}
                  </p>

                  {/* Compliance items */}
                  <ul className="space-y-2 mb-8">
                    {trade.items.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-gray-400 font-heading">
                        <CheckIcon className="text-[#f59e0b] mt-0.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>

                  <span className="font-heading font-black text-sm tracking-wider text-[#f59e0b] group-hover:translate-x-1 inline-block transition-transform">
                    Start report →
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════════════════ */}
      <section id="how-it-works" className="py-24 px-5 bg-[#1a1a1a]">
        <div className="max-w-6xl mx-auto">
          <p className="font-heading text-xs tracking-[0.25em] text-[#f59e0b]/70 mb-4 uppercase">
            How It Works
          </p>
          <h2
            className="font-heading font-black leading-[0.95] text-white mb-16"
            style={{ fontSize: "clamp(36px, 5vw, 60px)" }}
          >
            Four steps.<br />
            <span className="text-[#f59e0b]">Zero paperwork.</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {STEPS.map((step, i) => (
              <div key={i} className="relative">
                {/* Connector line (desktop only, not last item) */}
                {i < 3 && (
                  <div className="hidden lg:block absolute top-6 left-[calc(100%+16px)] w-8 h-px bg-white/10" />
                )}

                {/* Number */}
                <div className="font-heading font-black text-5xl text-[#f59e0b] leading-none mb-4">
                  {step.num}
                </div>

                <h3 className="font-heading font-black text-xl text-white mb-2">
                  {step.title}
                </h3>
                <p className="font-heading text-base text-gray-500 leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          PRICING
      ══════════════════════════════════════════════════ */}
      <section id="pricing" className="py-24 px-5 bg-[#0f0f0f]">
        <div className="max-w-3xl mx-auto">
          <p className="font-heading text-xs tracking-[0.25em] text-[#f59e0b]/70 mb-4 uppercase">
            Pricing
          </p>
          <h2
            className="font-heading font-black leading-[0.95] text-white mb-14"
            style={{ fontSize: "clamp(36px, 5vw, 60px)" }}
          >
            Simple pricing.<br />
            <span className="text-[#f59e0b]">Cheaper than one fine.</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {PRICING.map((plan) => (
              <div
                key={plan.name}
                className={`relative bg-[#1a1a1a] rounded p-10 border-2 ${
                  plan.featured ? "border-[#f59e0b]" : "border-white/10"
                }`}
              >
                {plan.featured && (
                  <div className="absolute -top-3 left-6 bg-[#f59e0b] text-black font-heading font-black text-xs tracking-wider px-3 py-1 rounded">
                    Most Popular
                  </div>
                )}

                <p className="font-heading text-xs tracking-wider text-gray-500 mb-2">
                  {plan.name}
                </p>
                <div className="font-heading font-black text-6xl text-white leading-none mb-1">
                  {plan.price}
                </div>
                <p className="font-heading text-sm text-gray-500 mb-8">{plan.sub}</p>

                <ul className="space-y-3 mb-10">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-3 font-heading text-sm text-gray-400">
                      <CheckIcon className="text-[#f59e0b] shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/auth/login"
                  className={`flex items-center justify-center font-heading font-black text-sm tracking-wider h-12 rounded no-underline transition-colors ${
                    plan.featured
                      ? "bg-[#f59e0b] text-black hover:bg-[#fbbf24]"
                      : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  Get Started
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          FINAL CTA
      ══════════════════════════════════════════════════ */}
      <section className="py-24 px-5 bg-[#1a1a1a] text-center">
        <div className="max-w-2xl mx-auto">
          <h2
            className="font-heading font-black text-white leading-tight mb-4"
            style={{ fontSize: "clamp(32px, 5vw, 56px)" }}
          >
            Ready to stay compliant?
          </h2>
          <p className="font-heading font-black tracking-widest text-[#f59e0b] mb-10 text-base">
            Stay legal. Stay safe. Stay working.
          </p>
          <Link
            href="/auth/login"
            className="inline-flex items-center font-heading font-black text-base tracking-wider bg-[#f59e0b] text-black px-12 h-14 rounded no-underline hover:bg-[#fbbf24] transition-colors"
          >
            Get Started Free
          </Link>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════ */}
      <footer className="bg-[#0f0f0f] border-t border-white/10 px-5 py-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          {/* Logo + tagline */}
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-7 h-7 bg-[#f59e0b] rounded flex items-center justify-center">
                <ShieldIcon className="w-4 h-4 text-black" />
              </div>
              <span className="font-heading font-black text-base tracking-wide text-white">
                TradeSafe AI
              </span>
            </div>
            <p className="font-heading text-sm text-gray-600">
              Stay legal. Stay safe. Stay working.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-8">
            {[
              { label: "Electrical", href: "/electrical" },
              { label: "Plumbing", href: "/plumbing" },
              { label: "Roofing", href: "/roofing" },
              { label: "Get Started", href: "/auth/login" },
            ].map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                className="font-heading text-sm text-gray-500 hover:text-[#f59e0b] no-underline transition-colors"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-white/5">
          <p className="font-heading text-xs text-gray-700">
            &copy; 2025 TradeSafe AI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
