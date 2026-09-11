'use client'
import { publicServicesReady } from '@/lib/domain/config'

export default function ConfigurationNotice() {
  return <p role="status" className="my-4 p-4 border border-amber/40 rounded-lg text-base text-gray-200">
    {!publicServicesReady()&&'Account access is not configured yet. '}
    TradeSafe is in controlled development. Payments are unavailable. Checklist content is pending qualified review; reports record observations and do not certify compliance or authorize work.
  </p>
}
