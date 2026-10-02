import {workspace} from '@/lib/server/workspace'
import {briefsEnabled} from '@/lib/server/briefs'
import {notFound} from 'next/navigation'
import WorkspaceShell from '@/app/components/WorkspaceShell'
import DeviceList from './DeviceList'
export default async function DeviceDraftPage({searchParams}){if(!briefsEnabled())notFound();const p=await searchParams,w=await workspace('/device-drafts',p.company);return <WorkspaceShell {...w}><h1>Device drafts</h1><p>Unfinished text in this browser. Access is checked before text or links are shown. Online sign-in is required; this is not an offline application or backup.</p>{w.company?<DeviceList actor={w.user.id} company={w.company.id}/>:<a href="/dashboard">Choose a company</a>}</WorkspaceShell>}
