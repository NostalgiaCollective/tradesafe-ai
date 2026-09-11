'use client'
import Link from 'next/link'
export default function ErrorPage({ reset }) {
  return <main className="min-h-screen flex items-center justify-center p-6">
    <section className="card-base p-8 max-w-lg">
      <h1 className="text-title mb-4">We could not load this page</h1>
      <p role="alert" className="text-gray-300 mb-6">Your records could not be loaded. This is a service error, not an empty account. Please try again.</p>
      <button onClick={reset} className="min-h-[48px] bg-amber text-black rounded-lg px-5 mr-4">Try again</button>
      <Link href="/" className="underline">Back to home</Link>
    </section>
  </main>
}
