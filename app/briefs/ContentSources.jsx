import {contentStateLabel,safeSourceUrl} from '@/lib/domain/brief-content.mjs'
export function SourceReference({source:s}){
 const url=safeSourceUrl(s.url)
 return <li><strong>{s.kind}</strong><p>{s.authority}. {url?<a href={url} target="_blank" rel="noopener noreferrer">{s.title} (opens new tab)</a>:s.title} — {s.section}</p><p>{s.jurisdiction}</p><p>{s.consolidationFrom?`Consolidation from ${s.consolidationFrom}; e-Laws currency through ${s.currencyThrough}. `:''}{s.published?`Published ${s.published}. `:''}{s.revised?`Revised ${s.revised}. `:''}{s.confirmedCurrent?`Publisher confirmed current ${s.confirmedCurrent}. `:''}Retrieved {s.retrieved}.</p><p>{s.verification}</p></li>
}
export default function ContentSources({content,prompts}){
 if(!content)return <p>Unknown content provenance. No historical source or review metadata has been inferred.</p>
 const p=content.payload
 return <div className="brief-content"><p>{contentStateLabel(content)} · {content.version}</p>{content.decision&&<p>Decision by {content.decision.reviewer_name} at {content.decision.recorded_at}. Scope: {content.decision.qualification_scope}. Decision reference: {content.decision.decision_ref}.</p>}{prompts.map(prompt=><section key={prompt.id}><h3>{prompt.title}</h3><p>{prompt.wording}</p><details><summary>Why this matters / Source — {prompt.title}</summary><p>Prompt {prompt.id} · version {prompt.version}. {contentStateLabel(content)}.</p><p><strong>Applies when:</strong> {prompt.applicability}</p><p><strong>Why:</strong> {prompt.rationale}</p><p><strong>Limits:</strong> {prompt.limits}</p><ul>{prompt.sourceIds.map(id=><SourceReference key={id} source={p.sources.find(s=>s.id===id)}/>)}</ul></details></section>)}</div>
}
