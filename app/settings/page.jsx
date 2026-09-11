import { pageClient } from '@/lib/server/page-auth'
export const dynamic = 'force-dynamic'

import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  await pageClient('/settings')
  return <SettingsClient />
}
