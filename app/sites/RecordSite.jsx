import {briefsEnabled} from '@/lib/server/briefs'
import {siteLink} from '@/lib/server/sites'
import {databaseError} from '@/lib/server/workspace'
import SiteContext from './SiteContext'
import LinkRecord from './LinkRecord'
export default async function RecordSite({supabase,companyId,actor,id,kind,editable}){
 if(!briefsEnabled())return null
 const link=await siteLink(supabase,id,kind)
 if(link)return <SiteContext link={link}/>
 if(!editable)return null
 const r=await supabase.from('ts_sites').select('*').eq('company_id',companyId).eq('archived',false).order('updated_at',{ascending:false}).limit(100)
 if(r.error)throw databaseError(r.error)
 return <><LinkRecord sites={r.data} companyId={companyId} actor={actor} id={id} kind={kind}/>{r.data.length===100&&<p>Showing 100 recent active sites.</p>}</>
}
