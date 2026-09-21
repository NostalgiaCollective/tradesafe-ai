export function applicablePrompts(content,document){
 const p=content?.payload
 return p&&document.jurisdiction===p.jurisdiction&&document.workplace===p.workplace&&document.promptTask===p.taskId?p.prompts:[]
}
export function contentStateLabel(content){
 if(!content)return 'Unknown content provenance'
 if(content.state==='reviewed')return 'Review decision recorded for this content version'
 if(content.state==='superseded')return 'Superseded content — retained for history'
 return 'Draft content — pending qualified review'
}
export function safeSourceUrl(value){
 try{const url=new URL(value);return url.protocol==='https:'&&['www.ontario.ca','www.ccohs.ca','www.ihsa.ca'].includes(url.hostname)?url.href:null}catch{return null}
}
