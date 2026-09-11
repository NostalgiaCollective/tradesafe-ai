import ServiceMessage from './components/ServiceMessage'
export default function NotFound() {
  return <ServiceMessage title="Page or report not found" message="It may have been removed, or it may not be available to your account." retry="/dashboard" />
}
