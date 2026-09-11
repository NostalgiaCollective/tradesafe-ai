import Link from 'next/link'

export default function ServiceMessage({ title = 'Service temporarily unavailable', message = 'We could not load this page. Please try again.', retry = '/' }) {
  return <main className="min-h-screen flex items-center justify-center p-6">
    <section className="max-w-lg w-full card-base p-8" aria-labelledby="service-title">
      <p className="text-amber mb-3">TradeSafe AI</p>
      <h1 id="service-title" className="text-title mb-4">{title}</h1>
      <p role="alert" className="text-gray-300 mb-6">{message}</p>
      <a href={retry} className="inline-flex min-h-[48px] items-center bg-amber text-black rounded-lg px-5 mr-4">Try again</a>
      <Link href="/" className="inline-flex min-h-[48px] items-center underline">Back to home</Link>
    </section>
  </main>
}
