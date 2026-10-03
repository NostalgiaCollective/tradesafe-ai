'use client'
export default function Error({reset}){return <main className="work-main"><h1>Help could not load</h1><p role="alert">No completion or empty result has been confirmed. Check your connection and retry. If access was removed, return to an available company.</p><button onClick={reset}>Retry Help</button><a href="/dashboard">Choose company</a></main>}
