import {createReadStream} from 'node:fs'
import {summarizeMeasurements} from '../../lib/operations/pilot-measurement.mjs'
try{
 const [mode,path,...extra]=process.argv.slice(2)
 if(!path||extra.length)throw Error('arguments')
 const result=await summarizeMeasurements(createReadStream(path,{encoding:'utf8',highWaterMark:16384}),mode)
 console.log(JSON.stringify(result,null,2))
}catch{
 // Do not print input, filenames, parser errors or a partial success report.
 console.error('Measurement failed. Use tasks or logs plus one local JSONL file; check the documented schema, limits and conflicting trial numbers. No report was produced.')
 process.exitCode=1
}
