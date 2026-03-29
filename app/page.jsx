"use client";
import { useState, useEffect, useRef } from "react";

const STEPS = [
  { num: "01", title: "OPEN", desc: "Pick your trade. Roofing or electrical." },
  { num: "02", title: "TAP", desc: "Glove-friendly checklist. OSHA and NFPA." },
  { num: "03", title: "SNAP", desc: "Photo proof with GPS timestamp." },
  { num: "04", title: "DONE", desc: "PDF report generated in seconds." },
];

const STATS = [
  { value: 60, suffix: "s", label: "REPORT TIME" },
  { value: 13653, prefix: "$", suffix: "", label: "AVG OSHA FINE" },
  { value: 98, suffix: "%", label: "ADOPTION RATE" },
];

function Counter({ value, prefix = "", suffix = "" }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const duration = 1800;
          const start = Date.now();
          const tick = () => {
            const p = Math.min((Date.now() - start) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            setCount(Math.floor(eased * value));
            if (p < 1) requestAnimationFrame(tick);
          };
          tick();
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value]);

  const formatted = value > 999 ? count.toLocaleString() : count;
  return <span ref={ref}>{prefix}{formatted}{suffix}</span>;
}

export default function Page() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [spark, setSpark] = useState(false);

  const submitEmail = async () => {
    if (!email.includes("@")) return;
    setSpark(true);
    try {
      await fetch("https://formspree.io/f/mbdpgjvq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch (e) {}
    setTimeout(() => { setSent(true); setSpark(false); }, 600);
  };

  const navItems = ["SERVICES", "PROJECTS", "TEAM", "CONTACTS"];

  return (
    <div style={{ fontFamily: "sans-serif", color: "#1a1a1a", background: "#EDECEB", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=DM+Mono:wght@400;500&family=Barlow+Condensed:wght@400;600;700;800;900&display=swap');

        * { margin: 0; padding: 0; box-sizing: border-box; }

        .grid-bg {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background-image:
            linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none;
          z-index: 0;
        }

        .nav-item {
          font-family: 'Barlow Condensed', sans-serif;
          font-weight: 700;
          font-size: 15px;
          letter-spacing: 2px;
          color: #1a1a1a;
          padding: 8px 0;
          cursor: pointer;
          background: none;
          border: none;
          text-align: left;
          transition: all 0.2s;
        }
        .nav-item:hover { color: #E8302A; }
        .nav-item.active {
          background: #FFE500;
          padding: 8px 20px;
          color: #E8302A;
        }

        .hero-title {
          font-family: 'Anton', sans-serif;
          font-size: clamp(90px, 15vw, 200px);
          line-height: 0.85;
          color: #1a1a1a;
          letter-spacing: -3px;
          text-shadow: 2px 2px 0 rgba(255,229,0,0.15);
        }
        .hero-title .red { color: #E8302A; }

        .section-label {
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          letter-spacing: 3px;
          color: #999;
        }

        .section-heading {
          font-family: 'Anton', sans-serif;
          font-size: clamp(36px, 6vw, 72px);
          line-height: 0.95;
          color: #1a1a1a;
          letter-spacing: -1px;
        }
        .section-heading .red { color: #E8302A; }

        .body-text {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 17px;
          line-height: 1.6;
          color: #555;
        }

        .mono-text {
          font-family: 'DM Mono', monospace;
          font-size: 13px;
          color: #999;
        }

        .stat-number {
          font-family: 'Anton', sans-serif;
          font-size: clamp(48px, 7vw, 80px);
          line-height: 1;
          letter-spacing: -1px;
        }

        .cta-btn {
          font-family: 'Barlow Condensed', sans-serif;
          font-weight: 800;
          font-size: 15px;
          letter-spacing: 3px;
          padding: 16px 40px;
          border: none;
          cursor: pointer;
          transition: all 0.25s ease;
          position: relative;
          overflow: visible;
        }
        .cta-btn.primary {
          background: #E8302A;
          color: #fff;
          border-radius: 40px;
          padding: 18px 44px;
          box-shadow: 0 4px 20px rgba(232,48,42,0.35);
        }
        .cta-btn.primary:hover {
          background: #ff3b33;
          box-shadow: 0 6px 28px rgba(232,48,42,0.5);
          transform: translateY(-1px);
        }
        .cta-btn.secondary { background: #1a1a1a; color: #FFE500; border-radius: 40px; }

        @keyframes boltFlash {
          0% { opacity: 1; transform: scale(1) translateY(0); }
          30% { opacity: 1; transform: scale(1.1) translateY(-4px); }
          100% { opacity: 0; transform: scale(1.3) translateY(-20px); }
        }
        .lightning-bolt {
          position: absolute;
          top: -38px;
          left: 50%;
          transform: translateX(-50%);
          pointer-events: none;
          animation: boltFlash 0.6s ease-out forwards;
        }

        .email-input {
          font-family: 'DM Mono', monospace;
          font-size: 14px;
          padding: 18px 24px;
          border: 2px solid #1a1a1a;
          background: #fff;
          color: #1a1a1a;
          outline: none;
          width: 280px;
          border-radius: 40px;
        }
        .email-input::placeholder { color: #bbb; }

        .price-card {
          background: #fff;
          border: 2px solid #1a1a1a;
          padding: 40px 32px;
          position: relative;
        }
        .price-card.featured { border-color: #E8302A; }
        .price-card.featured::before {
          content: 'POPULAR';
          position: absolute;
          top: -13px; left: 24px;
          background: #FFE500;
          color: #1a1a1a;
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 2px;
          padding: 4px 14px;
        }

        .feature-line {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 15px;
          color: #555;
          padding: 8px 0;
          border-bottom: 1px solid #f0f0f0;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .testimonial-card {
          border-left: 3px solid #FFE500;
          padding: 24px 28px;
          background: #fff;
        }

        @media (max-width: 768px) {
          .hero-title { font-size: 72px !important; }
          .section-heading { font-size: 36px !important; }
          .email-input { width: 100% !important; }
          .hero-left-nav { display: none !important; }
          .hero-tagline { left: 24px !important; max-width: 90% !important; }
          .hero-big-type { right: 16px !important; }
        }
      `}</style>

      {/* ═══ HERO ═══ */}
      <section style={{
        position: "relative",
        minHeight: "100vh",
        background: "#EDECEB",
        overflow: "hidden",
      }}>
        <div className="grid-bg" />

        {/* Yellow stripe */}
        <div style={{
          position: "absolute", top: 0, bottom: 0, right: "32%",
          width: 80, background: "#FFE500", opacity: 0.9, zIndex: 0,
        }} />

        {/* Diagonal lines */}
        <div style={{ position: "absolute", top: "15%", left: "10%", width: "70%", height: 1, background: "#1a1a1a", opacity: 0.15, transform: "rotate(-25deg)", transformOrigin: "left center" }} />
        <div style={{ position: "absolute", bottom: "20%", left: "5%", width: "90%", height: 1, background: "#1a1a1a", opacity: 0.15, transform: "rotate(-25deg)", transformOrigin: "left center" }} />

        {/* Decorative marks */}
        <div style={{ position: "absolute", top: "12%", right: "25%", color: "#999", fontFamily: "'DM Mono', monospace", fontSize: 18 }}>+</div>
        <div style={{ position: "absolute", top: "18%", right: "15%", color: "#999", fontFamily: "'DM Mono', monospace", fontSize: 18 }}>+</div>
        <div style={{ position: "absolute", top: "14%", right: "8%", width: 60, borderTop: "2px dashed #ccc" }} />
        <div style={{ position: "absolute", bottom: "25%", left: "35%", width: 10, height: 10, borderRadius: "50%", background: "#E8302A" }} />
        <div style={{ position: "absolute", top: "15%", right: "10%", width: 18, height: 18, borderRadius: "50%", border: "2px solid #E8302A" }} />
        <div style={{ position: "absolute", top: "70%", right: "18%", width: 10, height: 10, borderRadius: "50%", background: "#E8302A" }} />
        <div style={{ position: "absolute", top: "13%", right: "7%", width: 30, height: 1, background: "#E8302A" }} />

        {/* Tesla Laboratory Illustration */}
        <img
          src="/tesla-bg.png"
          alt=""
          style={{
            position: "absolute", top: 0, left: 0,
            width: "100%", height: "100%",
            objectFit: "cover", objectPosition: "center 30%",
            opacity: 0.09, zIndex: 1, pointerEvents: "none",
          }}
        />

        {/* Left nav */}
        <div className="hero-left-nav" style={{
          position: "absolute", left: 40, top: 0, bottom: 0,
          display: "flex", flexDirection: "column", justifyContent: "center",
          gap: 8, zIndex: 10, width: 200,
        }}>
          <div style={{ marginBottom: 40, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, background: "#E8302A",
              clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ color: "#fff", fontSize: 10, fontWeight: 800, marginTop: 8 }}>TS</span>
            </div>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 20, letterSpacing: 2, color: "#1a1a1a" }}>
              TRADESAFE
            </span>
          </div>
          {navItems.map((item, i) => (
            <button key={i} className={`nav-item ${i === 0 ? "active" : ""}`}>{item}</button>
          ))}
        </div>

        {/* Tagline - center left */}
        <div className="hero-tagline" style={{
          position: "absolute", top: "50%", left: 280,
          transform: "translateY(-50%)", zIndex: 5, maxWidth: 340,
        }}>
          <div className="section-label" style={{ marginBottom: 16 }}>// COMPLIANCE PLATFORM</div>
          <p className="body-text" style={{ fontSize: 24, color: "#1a1a1a", marginBottom: 24, fontWeight: 700, lineHeight: 1.35 }}>
            60-second safety reports for roofing and electrical crews. OSHA and NFPA ready.
          </p>
          <div className="mono-text" style={{ marginBottom: 20 }}>
            NO PAPER. NO CLIPBOARD. NO EXCUSES.
          </div>
          {!sent ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input
                className="email-input"
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") submitEmail();
                }}
                style={{ borderRadius: 40 }}
              />
              <button
                className="cta-btn primary"
                style={{ position: "relative" }}
                onClick={submitEmail}
              >
                {spark && (
                  <svg className="lightning-bolt" width="28" height="36" viewBox="0 0 28 36" fill="none">
                    <path d="M16 0L0 20h10L8 36l20-22H17L22 0H16z" fill="#FFE500" stroke="#1a1a1a" strokeWidth="0.5" />
                  </svg>
                )}
                START TRIAL
              </button>
            </div>
          ) : (
            <div style={{
              background: "#FFE500", padding: "14px 24px",
              fontFamily: "'DM Mono', monospace", fontSize: 13,
              fontWeight: 500, color: "#1a1a1a", letterSpacing: 1,
            }}>
              YOU ARE IN. CHECK YOUR EMAIL.
            </div>
          )}
          <p className="mono-text" style={{ marginTop: 12, fontSize: 11 }}>
            7 DAYS FREE. NO CREDIT CARD.
          </p>
        </div>

        {/* Big type - bottom right */}
        <div className="hero-big-type" style={{
          position: "absolute", bottom: "8%", right: "5%", zIndex: 5, textAlign: "right",
        }}>
          <div className="hero-title">
            TRADE<br /><span className="red">SAFE</span><br />AI
          </div>
        </div>
      </section>

      {/* ═══ STATS ═══ */}
      <section style={{ background: "#1a1a1a", padding: "60px 40px" }}>
        <div style={{
          maxWidth: 1080, margin: "0 auto",
          display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 40,
        }}>
          {STATS.map((s, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div className="stat-number" style={{ color: "#FFE500" }}>
                <Counter value={s.value} prefix={s.prefix || ""} suffix={s.suffix} />
              </div>
              <div className="mono-text" style={{ color: "#666", marginTop: 8, letterSpacing: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section style={{ background: "#EDECEB", padding: "100px 40px", position: "relative", overflow: "hidden" }}>
        <div className="grid-bg" />
        <div style={{ position: "absolute", top: "30%", left: 0, width: "100%", height: 1, background: "#1a1a1a", opacity: 0.15, transform: "rotate(-8deg)" }} />

        <div style={{ maxWidth: 1080, margin: "0 auto", position: "relative", zIndex: 2 }}>
          <div className="section-label" style={{ marginBottom: 16 }}>// 001 HOW IT WORKS</div>
          <h2 className="section-heading" style={{ marginBottom: 60 }}>
            FOUR TAPS.<br /><span className="red">ZERO LIABILITY.</span>
          </h2>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 0,
          }}>
            {STEPS.map((step, i) => (
              <div key={i} style={{
                padding: "32px 28px",
                borderLeft: i > 0 ? "1px solid rgba(0,0,0,0.08)" : "none",
                position: "relative",
              }}>
                <div style={{
                  fontFamily: "'Anton', sans-serif", fontSize: 64,
                  color: "#ddd", lineHeight: 1, letterSpacing: -2,
                }}>{step.num}</div>
                <div style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
                  fontSize: 22, letterSpacing: 3, color: "#1a1a1a", marginTop: 8,
                }}>{step.title}</div>
                <p className="body-text" style={{ marginTop: 10, fontSize: 15 }}>{step.desc}</p>
                {i < 3 && (
                  <div style={{
                    position: "absolute", right: -6, top: "50%",
                    color: "#E8302A", fontSize: 16, fontWeight: 700,
                  }}>→</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PROBLEM / SOLUTION ═══ */}
      <section style={{ background: "#1a1a1a", padding: "100px 40px", position: "relative" }}>
        <div style={{
          position: "absolute", top: 0, bottom: 0, left: "15%",
          width: 80, background: "#FFE500", opacity: 0.04,
        }} />
        <div style={{ maxWidth: 1080, margin: "0 auto", position: "relative", zIndex: 2 }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 60,
          }}>
            <div>
              <div className="section-label" style={{ color: "#E8302A", marginBottom: 16 }}>// THE PROBLEM</div>
              <h3 style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
                fontSize: 28, color: "#fff", letterSpacing: 1, marginBottom: 28,
              }}>PAPER FORMS COST YOU MONEY.</h3>
              {[
                "Workers skip check-ins when rushed.",
                "Paper gets lost, wet, or never filed.",
                "One OSHA fine costs more than a year of TradeSafe.",
                "No proof means no defense in court.",
              ].map((item, i) => (
                <div key={i} style={{
                  padding: "12px 0", borderBottom: "1px solid #333",
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16,
                  color: "#999", display: "flex", gap: 12,
                }}>
                  <span style={{ color: "#E8302A", fontWeight: 700 }}>✕</span> {item}
                </div>
              ))}
            </div>
            <div>
              <div className="section-label" style={{ color: "#FFE500", marginBottom: 16 }}>// THE SOLUTION</div>
              <h3 style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
                fontSize: 28, color: "#fff", letterSpacing: 1, marginBottom: 28,
              }}>DIGITAL PROOF IN 60 SECONDS.</h3>
              {[
                "Mobile checklist takes under one minute.",
                "Photo proof with GPS and timestamp.",
                "PDF reports stored in the cloud forever.",
                "Pull up any report during an inspection.",
              ].map((item, i) => (
                <div key={i} style={{
                  padding: "12px 0", borderBottom: "1px solid #333",
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16,
                  color: "#ccc", display: "flex", gap: 12,
                }}>
                  <span style={{ color: "#FFE500", fontWeight: 700 }}>✓</span> {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ TESTIMONIALS ═══ */}
      <section style={{ background: "#EDECEB", padding: "100px 40px", position: "relative", overflow: "hidden" }}>
        <div className="grid-bg" />
        <div style={{ position: "absolute", top: "20%", right: "12%", width: 10, height: 10, borderRadius: "50%", background: "#E8302A" }} />
        <div style={{ position: "absolute", bottom: "15%", left: "8%", color: "#999", fontFamily: "'DM Mono', monospace", fontSize: 18 }}>+</div>

        <div style={{ maxWidth: 1080, margin: "0 auto", position: "relative", zIndex: 2 }}>
          <div className="section-label" style={{ marginBottom: 16 }}>// 002 FROM THE FIELD</div>
          <h2 className="section-heading" style={{ marginBottom: 50 }}>CREWS WHO<br /><span className="red">SWITCHED.</span></h2>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 24,
          }}>
            {[
              { quote: "We lost 20 minutes every morning on paper. Now it takes one minute. The guys actually do it.", name: "MARCO S.", role: "Foreman, Summit Roofing" },
              { quote: "Inspector showed up unannounced. I pulled six months of reports on my phone in ten seconds.", name: "JASON K.", role: "Owner, JayTech Electrical" },
              { quote: "These PDFs look better than what our old safety consultant charged $500 a month for.", name: "GINO S.", role: "Operations, Lakeshore Contractors" },
            ].map((t, i) => (
              <div key={i} className="testimonial-card">
                <p style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17,
                  color: "#333", lineHeight: 1.6, fontStyle: "italic", marginBottom: 20,
                }}>"{t.quote}"</p>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, background: "#1a1a1a", color: "#FFE500",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 15,
                  }}>{t.name.charAt(0)}</div>
                  <div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 14, letterSpacing: 1, color: "#1a1a1a" }}>{t.name}</div>
                    <div className="mono-text" style={{ fontSize: 11 }}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section style={{ background: "#EDECEB", padding: "0 40px 100px", position: "relative" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div className="section-label" style={{ marginBottom: 16 }}>// 003 PRICING</div>
          <h2 className="section-heading" style={{ marginBottom: 50 }}>CHEAPER THAN<br /><span className="red">ONE FINE.</span></h2>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 24,
          }}>
            <div className="price-card">
              <div className="mono-text" style={{ marginBottom: 8, letterSpacing: 2 }}>PER REPORT</div>
              <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 56, color: "#1a1a1a", lineHeight: 1, letterSpacing: -1 }}>$10</div>
              <div className="mono-text" style={{ marginBottom: 24 }}>per report filed</div>
              {["Unlimited users", "Roofing + Electrical", "Timestamped PDFs", "Photo proof", "7-day free trial"].map((f, i) => (
                <div key={i} className="feature-line">
                  <span style={{ color: "#E8302A", fontWeight: 700 }}>+</span> {f}
                </div>
              ))}
              <button className="cta-btn secondary" style={{ width: "100%", marginTop: 28 }}>START TRIAL</button>
            </div>

            <div className="price-card featured">
              <div className="mono-text" style={{ marginBottom: 8, letterSpacing: 2 }}>CREW PLAN</div>
              <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 56, color: "#1a1a1a", lineHeight: 1, letterSpacing: -1 }}>$99</div>
              <div className="mono-text" style={{ marginBottom: 24 }}>per month</div>
              {["Everything in Per Report", "Unlimited reports", "Team roles + permissions", "Project management", "Priority support", "CSV export"].map((f, i) => (
                <div key={i} className="feature-line">
                  <span style={{ color: "#E8302A", fontWeight: 700 }}>+</span> {f}
                </div>
              ))}
              <button className="cta-btn primary" style={{ width: "100%", marginTop: 28 }}>START TRIAL</button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section style={{ background: "#1a1a1a", padding: "100px 40px", textAlign: "center", position: "relative" }}>
        <div style={{
          position: "absolute", top: 0, bottom: 0, left: "50%",
          width: 80, background: "#FFE500", opacity: 0.04, transform: "translateX(-50%)",
        }} />
        <div style={{ position: "relative", zIndex: 2 }}>
          <h2 style={{
            fontFamily: "'Anton', sans-serif",
            fontSize: "clamp(32px, 5vw, 56px)",
            color: "#fff", lineHeight: 1, marginBottom: 16, letterSpacing: -1,
          }}>
            YOUR CREW DESERVES BETTER<br />
            <span style={{ color: "#E8302A" }}>THAN A CLIPBOARD.</span>
          </h2>
          <p className="mono-text" style={{ color: "#666", marginBottom: 32, letterSpacing: 2 }}>
            7 DAYS FREE. NO CREDIT CARD. CANCEL ANYTIME.
          </p>
          <button className="cta-btn primary" style={{ fontSize: 18, padding: "20px 60px" }}>
            GET STARTED NOW
          </button>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer style={{
        background: "#111", padding: "24px 40px",
        display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 24, height: 24, background: "#E8302A",
            clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
          }} />
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800,
            fontSize: 14, letterSpacing: 2, color: "#666",
          }}>TRADESAFE AI</span>
        </div>
        <span className="mono-text" style={{ fontSize: 11, color: "#444" }}>
          2026 TRADESAFE AI. BUILT IN TORONTO.
        </span>
      </footer>
    </div>
  );
}
