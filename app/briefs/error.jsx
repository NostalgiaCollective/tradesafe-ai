'use client'
export default function BriefError({reset}){return <section className="work-panel"><h1>Daily brief unavailable</h1><p role="alert">We could not load this brief. Check your connection and company access, then retry.</p><button onClick={reset}>Retry loading brief</button></section>}
