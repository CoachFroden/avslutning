#!/usr/bin/env node
// Controlled load test for Quiz 2 only. Node 18+.
// Usage: node scripts/load-test-quiz.mjs https://avslutning.vercel.app
// Start Quiz 2 in admin, advance to an active question, then run this script within its 15-second answer window.
// Test players are prefixed LOADTEST_. Do not run during a real event.
const base=(process.argv[2]||'').replace(/\/$/,'');
if(!/^https:\/\//.test(base))throw Error('Provide HTTPS base URL');
const status=await (await fetch(base+'/api/quiz-live',{cache:'no-store'})).json();
if(status.activeSlot!=='2')throw Error('Aborted: active quiz is not Quiz 2');
if(status.stage!=='question'||status.expired)throw Error('Aborted: start an active question in Quiz 2 first');
const round=status.round,sessionId=status.sessionId;
const started=Date.now();
const results=await Promise.all(Array.from({length:25},async(_,i)=>{
 const name='LOADTEST_'+String(i+1).padStart(2,'0');
 try{
  const response=await fetch(base+'/api/quiz-live',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'answer',name,answer:i%4,round})});
  const body=await response.json();return {name,status:response.status,ok:response.ok,points:body.points??null,error:body.error??null};
 }catch(e){return {name,status:0,ok:false,error:String(e)}}
}));
const success=results.filter(x=>x.ok).length;
console.log(JSON.stringify({sessionId,round,elapsedMs:Date.now()-started,success,failed:25-success,results},null,2));
if(success!==25)process.exitCode=1;
