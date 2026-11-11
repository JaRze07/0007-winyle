#!/usr/bin/env node
/* engine.js says it is lifted verbatim from index.html. This holds it to that:
   every function the two share is pulled out of both files and compared, so a
   fix made to the app's import engine cannot quietly leave the terminal twin
   behind (or the other way round). No dependencies - `node check-engine.js`. */
const fs=require('fs'),path=require('path');
const app=fs.readFileSync(path.join(__dirname,'..','..','index.html'),'utf8');
const eng=fs.readFileSync(path.join(__dirname,'engine.js'),'utf8');
const SHARED=['exifFromBuffer','seqFromName','byCaptureOrder','frameStats','classifyFrame','groupIntoCases',
  'positionsFor','sigFrom','coverDist','trimSquare','resizeSquare','normTxt','simTxt'];
function body(src,name){
  const at=src.search(new RegExp('^function '+name+'\\(','m'));
  if(at<0) return null;
  let i=src.indexOf('{',at),depth=0;
  for(;i<src.length;i++){
    if(src[i]==='{') depth++;
    else if(src[i]==='}'&&--depth===0) break;
  }
  return src.slice(at,i+1).replace(/\s+/g,' ');
}
let bad=0;
for(const name of SHARED){
  const a=body(app,name),e=body(eng,name);
  const ok=a&&e&&a===e;
  if(!ok) bad++;
  console.log((ok?'ok   ':'DRIFT')+' '+name+(a?'':' (not in index.html)')+(e?'':' (not in engine.js)'));
}
const line=s=>(s.match(/^const NOISE=.*$/m)||[''])[0];
const noise=line(app)&&line(app)===line(eng);
if(!noise) bad++;
console.log((noise?'ok   ':'DRIFT')+' NOISE');
console.log(bad?`\n${bad} of ${SHARED.length+1} differ`:`\n${SHARED.length+1}/${SHARED.length+1} identical`);
process.exit(bad?1:0);
