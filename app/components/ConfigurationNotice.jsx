'use client'
import { publicServicesReady } from '@/lib/domain/config'

export default function ConfigurationNotice() {
  if (publicServicesReady()) return null
  return <p role="status" className="my-4 p-4 border border-amber/40 rounded-lg text-base text-gray-200">
    Account access is not configured yet. You can browse TradeSafe while setup is completed.
  </p>
}
