import admin from 'firebase-admin';
import crypto from 'node:crypto';
function db(){if(!admin.apps.length){const credentials=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);console.info('Firebase project:',credentials.project_id||'(missing)');admin.initializeApp({credential:admin.credential.cert(credentials)})}return admin.firestore()}
function auth(req){const secret=process.env.SESSION_SECRET;if(!secret)return false;const token=(req.headers.cookie||'').match(/(?:^|; )g14_session=([^;]+)/)?.[1]||'';const [expiry,sig]=token.split('.');if(!expiry||!sig||!/^\d+$/.test(expiry)||Number(expiry)<Date.now())return false;const expected=crypto.createHmac('sha256',secret).update(expiry).digest('hex');return sig.length===expected.length&&crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected))}
const testQuestions=[
{id:'test1',question:'Hvor mange minutter er det i en time?',answers:['30','45','60','90'],correct:2},
{id:'test2',question:'Hvilken farge får du når du blander blått og gult?',answers:['Grønn','Rød','Lilla','Oransje'],correct:0},
{id:'test3',question:'Hvor mange spillere har et fotballag på banen i elleverfotball?',answers:['9','10','11','12'],correct:2},
{id:'test4',question:'Hva heter hovedstaden i Norge?',answers:['Bergen','Trondheim','Oslo','Stavanger'],correct:2},
{id:'test5',question:'Hva er 7 ganger 8?',answers:['54','56','64','48'],correct:1}
];
const questionRef=(store,slot)=>store.doc(slot==='2'?'settings/quiz2':'settings/quiz');
const getQuestions=async(store,slot)=>{const data=(await questionRef(store,slot).get()).data();return data?.questions||(slot==='2'?testQuestions:[])};
const LIMIT_MS=15000,READY_MS=0,COUNTDOWN_MS=0,ANSWER_DELAY_MS=1500;
const effectiveStage=s=>s.stage==='countdown'?(Date.now()>=startedMs(s)+READY_MS+COUNTDOWN_MS+LIMIT_MS+ANSWER_DELAY_MS?'answer':Date.now()>=startedMs(s)+READY_MS+COUNTDOWN_MS?'question':'countdown'):s.stage;
const startedMs=state=>state.startedAt?.toMillis?.()??(typeof state.startedAt==='number'?state.startedAt:0);
const validName=n=>typeof n==='string'&&n.trim().length>=2&&n.trim().length<=60;
function publicState(state,quizTitle){const startedAt=startedMs(state);const stage=state.stage||'waiting';const q=state.questionSnapshot;return {quizTitle:quizTitle||'DEN STORE LAGQUIZEN',sessionId:state.sessionId||'legacy',stage,index:state.index||0,round:state.round||0,total:state.totalQuestions||0,startedAt,readyEndsAt:startedAt+READY_MS,countdownEndsAt:startedAt+READY_MS+COUNTDOWN_MS,deadline:startedAt+READY_MS+COUNTDOWN_MS+LIMIT_MS,question:q?.question||null,options:q?.answers||null,revealAt:state.revealAt||null,...(stage==='answer'?{correct:q?.correct}:{}),...(stage==='finished'&&state.revealAt?{leaderboard:state.leaderboard||[]}:{} )};}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 try{
 const store=db(),session=store.doc('settings/quizLive'),answers=store.collection('quizAnswers'),history=store.collection('quizSessions'),publicCount=store.doc('quizPublic/live');
 const playerSummaries=store.collection('quizPlayerSummaries');const selection=store.doc('settings/quizSelection');const selectionData=(await selection.get()).data()||{};const activeSlot=selectionData.slot==='2'?'2':'1';const quizTitle=selectionData.titles?.[activeSlot]||(activeSlot==='2'?'TESTQUIZ':'DEN STORE LAGQUIZEN');
 if(req.method==='GET'&&req.query?.view==='history'){if(!auth(req))return res.status(401).json({error:'Kun administrator kan se historikk'});const snaps=await history.orderBy('finishedAt','desc').limit(50).get();return res.status(200).json({sessions:snaps.docs.map(d=>({id:d.id,...d.data(),finishedAt:d.data().finishedAt?.toMillis?.()||null}))})}
 if(req.method==='GET'){
 const state=(await session.get()).data()||{stage:'waiting',index:0,round:0};
 const questions=state.questionSnapshot?null:await getQuestions(store,activeSlot);
 const q=state.questionSnapshot||questions?.[state.index];
 const stage=effectiveStage(state);const startedAt=startedMs(state);const readyEndsAt=startedAt+READY_MS;const countdownEndsAt=readyEndsAt+COUNTDOWN_MS;const deadline=countdownEndsAt+LIMIT_MS;const expired=startedAt>0&&Date.now()>=deadline;
 let leaderboard=state.leaderboard||[];if(stage==='finished'&&!state.leaderboard){const all=await answers.get();const board=new Map();all.docs.forEach(doc=>{const v=doc.data();if((v.sessionId||'legacy')!==(state.sessionId||'legacy'))return;const key=v.playerKey||v.name;const prev=board.get(key)||{name:v.name,points:0,correct:0};prev.points+=v.points||0;prev.correct+=(v.points||0)>0?1:0;board.set(key,prev)});leaderboard=[...board.values()].sort((a,b)=>b.points-a.points||b.correct-a.correct||a.name.localeCompare(b.name,'nb')).map((v,i)=>({...v,rank:i+1}));}
 const payload={activeSlot,quizTitle,titles:auth(req)&&req.query?.view==='admin'?{1:selectionData.titles?.['1']||'DEN STORE LAGQUIZEN',2:selectionData.titles?.['2']||'TESTQUIZ'}:undefined,sessionId:state.sessionId||'legacy',revealAt:state.revealAt||null,leaderboard:stage==='finished'&&auth(req)&&req.query?.view==='admin'?leaderboard:undefined,serverNow:Date.now(),startedAt,deadline,readyEndsAt,countdownEndsAt,expired,stage,index:state.index,round:state.round||0,total:state.totalQuestions??questions?.length??0,question:stage==='question'||stage==='answer'?q?.question:null,options:stage==='question'||stage==='answer'?q?.answers:null,correct:stage==='answer'?q?.correct:null};
 const playerName=String(req.query?.name||'').trim();if(validName(playerName)){const key=crypto.createHash('sha256').update(playerName.toLocaleLowerCase('nb-NO')).digest('hex');if(state.summaryVersion===1){const summary=(await playerSummaries.doc((state.sessionId||'legacy')+'_'+key).get()).data()||{};payload.myAnswers=summary.myAnswers||[];payload.totalPoints=summary.totalPoints||0;}else{const mySnap=await answers.where('playerKey','==',key).get();payload.myAnswers=mySnap.docs.filter(d=>(d.data().sessionId||'legacy')===(state.sessionId||'legacy')).map(d=>({round:d.data().round,answer:d.data().answer,points:d.data().points||0}));payload.totalPoints=payload.myAnswers.reduce((n,a)=>n+a.points,0);}}
 if(auth(req)&&req.query?.view==='admin'){const snap=await answers.where('round','==',state.round||0).get();const current=snap.docs.filter(d=>(d.data().sessionId||'legacy')===(state.sessionId||'legacy'));payload.responses=current.length;payload.counts=[0,0,0,0];current.forEach(d=>{const n=d.data().answer;if(n>=0&&n<4)payload.counts[n]++})}
 if(!playerName&&!auth(req))res.setHeader('Cache-Control','public, s-maxage=3, stale-while-revalidate=2');return res.status(200).json(payload)
 }
 if(req.method!=='POST')return res.status(405).json({error:'Ugyldig metode'});
 if(req.body?.action==='rename-quiz'){
 if(!auth(req))return res.status(401).json({error:'Kun administrator kan endre quiznavn'});
 const slot=String(req.body.slot||''),title=String(req.body.title||'').trim();
 if(!['1','2'].includes(slot)||!title||title.length>70)return res.status(400).json({error:'Quiznavnet må være mellom 1 og 70 tegn'});
 await selection.set({titles:{[slot]:title}},{merge:true});if(slot===activeSlot)await publicCount.set({quizTitle:title},{merge:true});
 return res.status(200).json({ok:true,slot,title});
 }
 if(req.body?.action==='select-quiz'){
 if(!auth(req))return res.status(401).json({error:'Kun administrator kan velge quiz'});
 const slot=String(req.body.slot||'');
 if(!['1','2'].includes(slot))return res.status(400).json({error:'Ugyldig quizvalg'});
 const current=(await session.get()).data()||{};
 if(current.stage==='countdown'||current.stage==='question')return res.status(409).json({error:'Avslutt den pågående quizen før du bytter'});
 const sessionId=crypto.randomUUID();
 const state={stage:'intro',index:0,round:0,startedAt:0,revealAt:null,leaderboard:[],questionSnapshot:null,totalQuestions:0,sessionId,summaryVersion:1,updatedAt:admin.firestore.FieldValue.serverTimestamp()};
 const batch=store.batch();batch.set(selection,{slot},{merge:true});batch.set(session,state);batch.set(publicCount,{...publicState(state,selectionData.titles?.[slot]||(slot==='2'?'TESTQUIZ':'DEN STORE LAGQUIZEN')),responses:0,counts:[0,0,0,0]});await batch.commit();
 return res.status(200).json({ok:true,activeSlot:slot,stage:'intro',sessionId,round:0,index:0});
 }
 if(req.body?.action==='finish'){if(!auth(req))return res.status(401).json({error:'Kun administrator kan avslutte quizen'});const old=(await session.get()).data()||{};if(!['countdown','answer'].includes(old.stage)||(old.round||0)<1)return res.status(409).json({error:'Start quizen før du avslutter den'});const id=old.sessionId||'legacy';const all=await answers.where('sessionId','==',id).get();const players=new Set(all.docs.map(d=>d.data().playerKey));const board=new Map();for(const doc of all.docs){const v=doc.data(),key=v.playerKey||v.name,prev=board.get(key)||{name:v.name,points:0,correct:0};prev.points+=v.points||0;prev.correct+=(v.points||0)>0?1:0;board.set(key,prev)}const leaderboard=[...board.values()].sort((a,b)=>b.points-a.points||b.correct-a.correct||a.name.localeCompare(b.name,'nb')).map((v,i)=>({...v,rank:i+1}));await history.doc(id).set({quizNumber:activeSlot,quizName:quizTitle,finishedAt:admin.firestore.FieldValue.serverTimestamp(),playerCount:players.size,answerCount:all.size,roundCount:old.round||0});await session.set({stage:'finished',leaderboard,revealAt:null,sessionId:id,updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});await publicCount.set({...publicState({...old,stage:'finished',leaderboard,revealAt:null},quizTitle),responses:0,counts:[0,0,0,0]},{merge:true});return res.status(200).json({ok:true,stage:'finished'})}
 if(req.body?.action==='reveal'){if(!auth(req))return res.status(401).json({error:'Kun administrator kan avsløre vinnerne'});const snap=await session.get(),state=snap.data()||{};if(state.stage!=='finished')return res.status(409).json({error:'Avslutt quizen før du avslører vinnerne'});const revealAt=state.revealAt||Date.now();await session.set({revealAt,updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});await publicCount.set({revealAt,leaderboard:state.leaderboard||[]},{merge:true});return res.status(200).json({ok:true,revealAt})}
 if(req.body?.action==='new'){if(!auth(req))return res.status(401).json({error:'Kun administrator kan starte ny quiz'});const id=crypto.randomUUID();await session.set({stage:'intro',index:0,round:0,startedAt:0,revealAt:null,leaderboard:[],questionSnapshot:null,totalQuestions:0,sessionId:id,summaryVersion:1,updatedAt:admin.firestore.FieldValue.serverTimestamp()});await publicCount.set({...publicState({stage:'intro',sessionId:id,round:0,index:0},quizTitle),responses:0,counts:[0,0,0,0]});return res.status(200).json({ok:true,stage:'intro',index:0,round:0,sessionId:id})}
 if(req.body?.action==='delete'){if(!auth(req))return res.status(401).json({error:'Kun administrator kan slette quizresultater'});const id=String(req.body.id||'');if(!/^(legacy|[0-9a-f-]{36})$/.test(id))return res.status(400).json({error:'Ugyldig quiz-ID'});const current=(await session.get()).data()||{};if(current.sessionId===id&&current.stage!=='finished')return res.status(409).json({error:'Du kan ikke slette en pågående quiz'});const docs=await answers.where('sessionId','==',id).get();for(let i=0;i<docs.docs.length;i+=400){const batch=store.batch();docs.docs.slice(i,i+400).forEach(d=>batch.delete(d.ref));await batch.commit()}await history.doc(id).delete();if(current.sessionId===id){const sessionId=crypto.randomUUID();await session.set({stage:'waiting',index:0,round:0,startedAt:0,sessionId,updatedAt:admin.firestore.FieldValue.serverTimestamp()});await publicCount.set({...publicState({stage:'waiting',sessionId},quizTitle),responses:0,counts:[0,0,0,0]});}return res.status(200).json({ok:true,deleted:docs.size})}
 if(req.body?.action==='advance'){
 if(!auth(req))return res.status(401).json({error:'Kun administrator kan styre quizen'});
 const questions=await getQuestions(store,activeSlot);
 if(!questions.length)return res.status(409).json({error:'Ingen lagrede spørsmål'});
 try{const next=await store.runTransaction(async tx=>{const snap=await tx.get(session),old=snap.data()||{};if(!['intro','waiting','countdown','answer'].includes(old.stage))throw Error('Start en ny quiz først');if(old.stage==='countdown'&&Date.now()<startedMs(old)+READY_MS+COUNTDOWN_MS+LIMIT_MS+ANSWER_DELAY_MS)throw Error('Vent til svartiden er ute');const index=['countdown','answer'].includes(old.stage)?old.index+1:0;if(index>=questions.length)throw Error('Alle spørsmål er stilt – avslutt quizen');const state={stage:'countdown',questionSnapshot:questions[index],totalQuestions:questions.length,index,round:(old.round||0)+1,startedAt:Date.now(),sessionId:old.sessionId||crypto.randomUUID(),revealAt:null,updatedAt:admin.firestore.FieldValue.serverTimestamp()};tx.set(session,state);tx.set(publicCount,{...publicState(state,quizTitle),responses:0,counts:[0,0,0,0]});return state});return res.status(200).json({ok:true,stage:'countdown',index:next.index,round:next.round,startedAt:next.startedAt,readyEndsAt:next.startedAt+READY_MS,countdownEndsAt:next.startedAt+READY_MS+COUNTDOWN_MS,deadline:next.startedAt+READY_MS+COUNTDOWN_MS+LIMIT_MS})}catch(e){return res.status(409).json({error:e.message})}
 }
 if(req.body?.action==='show-answer'){
 if(!auth(req))return res.status(401).json({error:'Kun administrator kan vise svaret'});
 try{await store.runTransaction(async tx=>{const snap=await tx.get(session),old=snap.data()||{};if(old.stage!=='countdown'||Date.now()<startedMs(old)+READY_MS+COUNTDOWN_MS+LIMIT_MS)throw Error('Vent til svartiden er ute');tx.update(session,{stage:'answer',updatedAt:admin.firestore.FieldValue.serverTimestamp()});tx.update(publicCount,{stage:'answer',correct:old.questionSnapshot?.correct??null})});return res.status(200).json({ok:true,stage:'answer'})}catch(e){return res.status(409).json({error:e.message})}
 }
 if(req.body?.action==='stage'){
 if(!auth(req))return res.status(401).json({error:'Kun administrator kan styre quizen'});
 const stage=req.body.stage,index=Number(req.body.index);
 if(!['waiting','intro'].includes(stage)||!Number.isInteger(index)||index<0)return res.status(400).json({error:'Ugyldig visning'});
 const questions=await getQuestions(store,activeSlot);
 if(index>=questions.length)return res.status(400).json({error:'Spørsmålet finnes ikke'});
 const old=(await session.get()).data()||{};if(old.stage==='countdown')return res.status(409).json({error:'Quiz pågår'});const restarting=old.stage==='finished'&&stage==='intro';const sessionId=restarting?crypto.randomUUID():(old.sessionId||'legacy');
 const newRound=stage==='question'&&(old.stage!=='question'||old.index!==index);
 const round=restarting?0:newRound?(old.round||0)+1:(old.round||0);
 const startedAt=newRound?Date.now():startedMs(old);
 await session.set({stage,index,round,startedAt,revealAt:null,sessionId,updatedAt:admin.firestore.FieldValue.serverTimestamp()});await publicCount.set({...publicState({...old,stage,index,round,startedAt,sessionId,revealAt:null},quizTitle),responses:0,counts:[0,0,0,0]});
 return res.status(200).json({ok:true,stage,index,round,startedAt})
 }
 if(req.body?.action==='answer'){
 const name=String(req.body.name||'').trim(),answer=Number(req.body.answer),round=Number(req.body.round);
 if(!validName(name)||!Number.isInteger(answer)||answer<0||answer>3||!Number.isInteger(round))return res.status(400).json({error:'Skriv navn og velg et svar'});
 const key=crypto.createHash('sha256').update(name.toLocaleLowerCase('nb-NO')).digest('hex');
 try{
 const earnedPoints=await store.runTransaction(async tx=>{
 const snap=await tx.get(session),state=snap.data()||{};
 if(effectiveStage(state)!=='question'||state.round!==round)throw Error('Dette spørsmålet er stengt');
 const startedAt=startedMs(state);const elapsed=Date.now()-startedAt-READY_MS-COUNTDOWN_MS;
 if(!startedAt||elapsed<0||elapsed>=LIMIT_MS)throw Error('Tiden er ute! Du fikk 0 poeng.');
 const correct=state.questionSnapshot?.correct;
 const points=answer===correct?Math.max(0,Math.floor(1000*(LIMIT_MS-elapsed)/LIMIT_MS)):0;
 const ref=answers.doc((state.sessionId||'legacy')+'_'+round+'_'+key),prior=await tx.get(ref);const summaryRef=playerSummaries.doc((state.sessionId||'legacy')+'_'+key);const summarySnap=state.summaryVersion===1?await tx.get(summaryRef):null;const countSnap=await tx.get(publicCount);
 if(prior.exists)throw Error('Dette navnet har allerede svart på spørsmålet');
 tx.create(ref,{name,playerKey:key,sessionId:state.sessionId||'legacy',answer,round,points,quizNumber:activeSlot,quizName:quizTitle,questionNumber:(state.index||0)+1,questionText:state.questionSnapshot?.question||'',selectedAnswer:state.questionSnapshot?.answers?.[answer]||'',correctAnswer:state.questionSnapshot?.answers?.[correct]||'',isCorrect:answer===correct,createdAt:admin.firestore.FieldValue.serverTimestamp()});if(state.summaryVersion===1){const previous=summarySnap.data()||{};tx.set(summaryRef,{name,sessionId:state.sessionId,myAnswers:[...(previous.myAnswers||[]),{round,answer,points}],totalPoints:(previous.totalPoints||0)+points,updatedAt:admin.firestore.FieldValue.serverTimestamp()});}const countData=countSnap.data()||{};if(countData.sessionId===state.sessionId&&countData.round===round){const counts=Array.isArray(countData.counts)?[...countData.counts]:[0,0,0,0];counts[answer]=(counts[answer]||0)+1;tx.update(publicCount,{responses:admin.firestore.FieldValue.increment(1),counts});}
 return points;
 });
 return res.status(200).json({ok:true,points:earnedPoints,round,answer});
 }catch(e){return res.status(409).json({error:e.message})}
 }
 return res.status(400).json({error:'Ukjent handling'});
 }catch(e){console.error('quiz-live:',e.message);return res.status(500).json({error:'Kunne ikke kontakte quizen'})}
}