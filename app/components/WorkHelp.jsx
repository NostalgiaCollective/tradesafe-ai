const help={
 concern:['Concern or follow-up?','Save concern draft keeps an editable draft. Submit concern preserves your original observation and opens its follow-up in Actions. Later progress does not rewrite the original. Saving sends no notification.'],
 briefing:['Recording and acknowledgement','Record briefing version preserves this assessment. Included workers use My work to Acknowledge this version themselves. Entering attendance does not acknowledge for them. A revised version needs a new response.'],
 action:['Progress and verification','Save progress records an update. Request verification asks for supervisor review in the app; it sends no notification. Only a permitted supervisor can Verify and close. Closure does not certify safety or authorize work.'],
}
export default function WorkHelp({kind}){const [title,text]=help[kind];return <details className="no-print"><summary>{title}</summary><p>{text}</p></details>}
