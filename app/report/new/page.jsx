import { pageClient } from '@/lib/server/page-auth'
export const dynamic = 'force-dynamic'

import NewReportClient from './NewReportClient'

export default async function NewReportPage() {
  await pageClient('/report/new')
  return <NewReportClient />
}
