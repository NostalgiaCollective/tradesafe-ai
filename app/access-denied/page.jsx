import ServiceMessage from '@/app/components/ServiceMessage'
export default function AccessDenied(){return <ServiceMessage title="Company access unavailable" message="Your current account does not have access to this company. Choose a company you belong to, or ask an owner for an invitation." retry="/dashboard"/>}
