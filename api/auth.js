import crypto from 'node:crypto';
const cookie='g14_session';
const secret=()=>process.env.SESSION_SECRET;
const sign=(v)=>crypto.createHmac('sha256',secret()).update(v).digest('hex');
const parse=(req)=>{const m=(req.headers.cookie||'').match(/(?:^|; )g14_session=([^;]+)/);return m?.[1]||''};
const valid=(req)=>{if(!secret())return false;const [expiry,sig]=parse(req).split('.');if(!expiry||!sig||!/^\d+$/.test(expiry)||Number(expiry)<Date.now())return false;const expected=sign(expiry);return sig.length===expected.length&&crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected))};
const attempts=new Map();
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method==='GET')return res.status(200).json({authenticated:valid(req),configured:!!(process.env.ADMIN_PIN&&secret())});
 if(req.method==='DELETE'){res.setHeader('Set-Cookie',cookie+'=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');return res.status(200).json({ok:true})}
 if(req.method!=='POST')return res.status(405).json({error:'Metoden støttes ikke'});
 if(!process.env.ADMIN_PIN||!secret())return res.status(503).json({error:'Administratorinnlogging er ikke konfigurert'});
 const ip=(req.headers['x-forwarded-for']||'unknown').split(',')[0].trim();
 const now=Date.now();const state=attempts.get(ip)||{count:0,until:now+900000};if(now>state.until){state.count=0;state.until=now+900000}
 if(state.count>=8)return res.status(429).json({error:'For mange forsøk. Prøv igjen senere.'});
 const pin=String(req.body?.pin||'');const a=Buffer.from(pin),b=Buffer.from(process.env.ADMIN_PIN);
 if(a.length!==b.length||!crypto.timingSafeEqual(a,b)){state.count++;attempts.set(ip,state);return res.status(401).json({error:'Feil kode'})}
 attempts.delete(ip);const expiry=String(now+8*60*60*1000);
 res.setHeader('Set-Cookie',cookie+'='+expiry+'.'+sign(expiry)+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800');
 return res.status(200).json({ok:true});
}