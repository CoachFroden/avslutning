import admin from 'firebase-admin';
import crypto from 'node:crypto';
function db(){if(!admin.apps.length){const raw=process.env.FIREBASE_SERVICE_ACCOUNT;if(!raw)throw Error('Firebase er ikke konfigurert');const credentials=JSON.parse(raw);console.info('Firebase project:',credentials.project_id||'(missing)');admin.initializeApp({credential:admin.credential.cert(credentials)})}return admin.firestore()}
function authorized(req){const secret=process.env.SESSION_SECRET;if(!secret)return false;const token=(req.headers.cookie||'').match(/(?:^|; )g14_session=([^;]+)/)?.[1]||'';const [expiry,sig]=token.split('.');if(!expiry||!sig||!/^\d+$/.test(expiry)||Number(expiry)<Date.now())return false;const expected=crypto.createHmac('sha256',secret).update(expiry).digest('hex');return sig.length===expected.length&&crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected))}
const fallback=[{id:'test-formation',question:'Hvilken formasjon har Samnanger G14 brukt denne sesongen?',answers:['4–4–2','4–3–3','3–5–2','4–2–3–1'],correct:1}];
const testQuestions=[
{id:'test1',question:'Hvor mange minutter er det i en time?',answers:['30','45','60','90'],correct:2},
{id:'test2',question:'Hvilken farge får du når du blander blått og gult?',answers:['Grønn','Rød','Lilla','Oransje'],correct:0},
{id:'test3',question:'Hvor mange spillere har et fotballag på banen i elleverfotball?',answers:['9','10','11','12'],correct:2},
{id:'test4',question:'Hva heter hovedstaden i Norge?',answers:['Bergen','Trondheim','Oslo','Stavanger'],correct:2},
{id:'test5',question:'Hva er 7 ganger 8?',answers:['54','56','64','48'],correct:1}
];
const clean=x=>String(x??'').trim();
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 try{
 const slot=String(req.method==='GET'?req.query?.slot||'1':req.body?.slot||'1');
 if(!['1','2'].includes(slot))return res.status(400).json({error:'Ugyldig quizvalg'});
 const ref=db().doc(slot==='1'?'settings/quiz':'settings/quiz2');
 if(req.method==='GET'){const snap=await ref.get();return res.status(200).json({questions:snap.exists?(snap.data()?.questions||[]):slot==='2'?testQuestions:fallback,storage:{document:slot==='2'?'settings/quiz2':'settings/quiz',exists:snap.exists,count:snap.exists?(snap.data()?.questions||[]).length:0}})}
 if(!authorized(req))return res.status(401).json({error:'Du må være logget inn som administrator'});
 if(req.method!=='PUT')return res.status(405).json({error:'Metoden støttes ikke'});
 const input=req.body?.questions;
 if(!Array.isArray(input)||input.length===0||input.length>100)return res.status(400).json({error:'Kan ikke lagre en tom spørsmålsliste. Eksisterende spørsmål er beskyttet.'});
 const ids=new Set(),questions=[];
 for(const q of input){
 const question=clean(q.question),answers=Array.isArray(q.answers)?q.answers.map(clean):[],correct=Number(q.correct);
 if(!question||question.length>300||answers.length!==4||answers.some(a=>!a||a.length>160)||!Number.isInteger(correct)||correct<0||correct>3)return res.status(400).json({error:'Alle spørsmål må ha tekst, fire svar og ett riktig alternativ'});
 const id=clean(q.id);
 if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id)||ids.has(id))return res.status(400).json({error:'Ugyldig eller duplisert spørsmåls-ID'});
 ids.add(id);questions.push({id,question,answers,correct});
 }
 await ref.set({questions,updatedAt:admin.firestore.FieldValue.serverTimestamp()});
 return res.status(200).json({ok:true,questions});
 }catch(e){console.error('Quiz API:',e.message);const exhausted=e.code===8||String(e.message||'').includes('RESOURCE_EXHAUSTED');return res.status(exhausted?503:500).json({error:exhausted?'Firebase-kvoten er oppbrukt. Spørsmålene er ikke slettet. Vent til kvoten er tilgjengelig igjen.':'Kunne ikke behandle quizspørsmålene'})}
}
