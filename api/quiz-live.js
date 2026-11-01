import admin from 'firebase-admin';
import crypto from 'node:crypto';
function db(){if(!admin.apps.length){admin.initializeApp({credential:admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))})}return admin.firestore()}
function auth(req){const secret=process.env.SESSION_SECRET;if(!secret)return false;const token=(req.headers.cookie||'').match(/(?:^|; )g14_session=([^;]+)/)?.[1]||'';const [expiry,sig]=token.split('.');if(!expiry||!sig||!/^\d+$/.test(expiry)||Number(expiry)<Date.now())return false;const expected=crypto.createHmac('sha256',secret).update(expiry).digest('hex');return sig.length===expected.length&&crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected))}
const LIMIT_MS=15000;
const startedMs=state=>state.startedAt?.toMillis?.()??(typeof state.startedAt==='number'?state.startedAt:0);
const validName=n=>typeof n==='string'&&n.trim().length>=2&&n.trim().length<=60;
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 try{
 const store=db(),session=store.doc('settings/quizLive'),answers=store.collection('quizAnswers');
 if(req.method==='GET'){
 const state=(await session.get()).data()||{stage:'waiting',index:0,round:0};
 const questions=(await store.doc('settings/quiz').get()).data()?.questions||[];
 const q=questions[state.index];
 const startedAt=startedMs(state);const deadline=startedAt+LIMIT_MS;const expired=state.stage==='question'&&startedAt>0&&Date.now()>=deadline;
 let leaderboard=[];if(state.stage==='finished'){const all=await answers.get();const board=new Map();all.docs.forEach(doc=>{const v=doc.data();if((v.sessionId||'legacy')!==(state.sessionId||'legacy'))return;const key=v.playerKey||v.name;const prev=board.get(key)||{name:v.name,points:0,correct:0};prev.points+=v.points||0;prev.correct+=(v.points||0)>0?1:0;board.set(key,prev)});leaderboard=[...board.values()].sort((a,b)=>b.points-a.points||b.correct-a.correct||a.name.localeCompare(b.name,'nb')).map((v,i)=>({...v,rank:i+1}));}
 const payload={leaderboard:state.stage==='finished'?leaderboard:undefined,serverNow:Date.now(),startedAt,deadline,expired,stage:state.stage,index:state.index,round:state.round||0,total:questions.length,question:state.stage==='question'||state.stage==='answer'?q?.question:null,options:state.stage==='question'||state.stage==='answer'?q?.answers:null,correct:state.stage==='answer'?q?.correct:null};
 const playerName=String(req.query?.name||'').trim();if(validName(playerName)){const key=crypto.createHash('sha256').update(playerName.toLocaleLowerCase('nb-NO')).digest('hex');const mySnap=await answers.where('playerKey','==',key).get();payload.myAnswers=mySnap.docs.filter(d=>(d.data().sessionId||'legacy')===(state.sessionId||'legacy')).map(d=>({round:d.data().round,answer:d.data().answer,points:d.data().points||0}));payload.totalPoints=payload.myAnswers.reduce((n,a)=>n+a.points,0);if(state.stage==='finished')payload.myRank=leaderboard.find(v=>v.name.toLocaleLowerCase('nb-NO')===playerName.toLocaleLowerCase('nb-NO'))?.rank||null}
 if(auth(req)){const snap=await answers.where('round','==',state.round||0).get();const current=snap.docs.filter(d=>(d.data().sessionId||'legacy')===(state.sessionId||'legacy'));payload.responses=current.length;payload.counts=[0,0,0,0];current.forEach(d=>{const n=d.data().answer;if(n>=0&&n<4)payload.counts[n]++})}
 return res.status(200).json(payload)
 }
 if(req.method!=='POST')return res.status(405).json({error:'Ugyldig metode'});
 if(req.body?.action==='finish'){if(!auth(req))return res.status(401).json({error:'Kun administrator kan avslutte quizen'});await session.set({stage:'finished',updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});return res.status(200).json({ok:true,stage:'finished'})}
 if(req.body?.action==='stage'){
 if(!auth(req))return res.status(401).json({error:'Kun administrator kan styre quizen'});
 const stage=req.body.stage,index=Number(req.body.index);
 if(!['waiting','intro','question','answer'].includes(stage)||!Number.isInteger(index)||index<0)return res.status(400).json({error:'Ugyldig visning'});
 const snap=await store.doc('settings/quiz').get(),questions=snap.data()?.questions||[];
 if(index>=questions.length)return res.status(400).json({error:'Spørsmålet finnes ikke'});
 const old=(await session.get()).data()||{};const restarting=old.stage==='finished'&&stage==='intro';const sessionId=restarting?crypto.randomUUID():(old.sessionId||'legacy');
 const newRound=stage==='question'&&(old.stage!=='question'||old.index!==index);
 const round=restarting?0:newRound?(old.round||0)+1:(old.round||0);
 const startedAt=newRound?Date.now():startedMs(old);
 await session.set({stage,index,round,startedAt,sessionId,updatedAt:admin.firestore.FieldValue.serverTimestamp()});
 return res.status(200).json({ok:true,stage,index,round,startedAt})
 }
 if(req.body?.action==='answer'){
 const name=String(req.body.name||'').trim(),answer=Number(req.body.answer),round=Number(req.body.round);
 if(!validName(name)||!Number.isInteger(answer)||answer<0||answer>3||!Number.isInteger(round))return res.status(400).json({error:'Skriv navn og velg et svar'});
 const key=crypto.createHash('sha256').update(name.toLocaleLowerCase('nb-NO')).digest('hex');
 try{
 await store.runTransaction(async tx=>{
 const snap=await tx.get(session),state=snap.data()||{};
 if(state.stage!=='question'||state.round!==round)throw Error('Dette spørsmålet er stengt');
 const startedAt=startedMs(state);const elapsed=Date.now()-startedAt;
 if(!startedAt||elapsed>=LIMIT_MS)throw Error('Tiden er ute! Du fikk 0 poeng.');
 const questionSnap=await tx.get(store.doc('settings/quiz'));const correct=questionSnap.data()?.questions?.[state.index]?.correct;
 const points=answer===correct?Math.max(0,Math.floor(1000*(LIMIT_MS-elapsed)/LIMIT_MS)):0;
 const ref=answers.doc((state.sessionId||'legacy')+'_'+round+'_'+key),prior=await tx.get(ref);
 if(prior.exists)throw Error('Dette navnet har allerede svart på spørsmålet');
 tx.create(ref,{name,playerKey:key,sessionId:state.sessionId||'legacy',answer,round,points,createdAt:admin.firestore.FieldValue.serverTimestamp()});
 });
 return res.status(200).json({ok:true});
 }catch(e){return res.status(409).json({error:e.message})}
 }
 return res.status(400).json({error:'Ukjent handling'});
 }catch(e){console.error('quiz-live:',e.message);return res.status(500).json({error:'Kunne ikke kontakte quizen'})}
}