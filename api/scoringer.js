import crypto from 'node:crypto';
const BASE='https://scoringer-video.frode-2b7.workers.dev';
function authenticated(req){const secret=process.env.SESSION_SECRET;if(!secret)return false;const m=(req.headers.cookie||'').match(/(?:^|; )g14_session=([^;]+)/);const [expiry,sig]=(m?.[1]||'').split('.');if(!expiry||!sig||!/^\d+$/.test(expiry)||Number(expiry)<Date.now())return false;const expected=crypto.createHmac('sha256',secret).update(expiry).digest('hex');return sig.length===expected.length&&crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected))}
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 if(req.method!=='GET')return res.status(405).json({error:'Metoden støttes ikke'});
 if(!authenticated(req))return res.status(401).json({error:'Logg inn som administrator først'});
 const token=process.env.SCORINGER_ACCESS_TOKEN;
 if(!token)return res.status(503).json({error:'SCORINGER_ACCESS_TOKEN mangler i Vercel'});
 const key=typeof req.query.key==='string'?req.query.key:'';
 if(key.length>1000)return res.status(400).json({error:'Ugyldig filnavn'});
 const target=key?BASE+'/api/video/'+key.split('/').map(encodeURIComponent).join('/'):BASE+'/api/videos';
 try{
  const headers={Authorization:'Bearer '+token};
  if(key&&req.headers.range)headers.Range=req.headers.range;
  const upstream=await fetch(target,{headers});
  if(!upstream.ok){return res.status(upstream.status).json({error:upstream.status===401?'Ugyldig tilgang til Cloudflare':'Kunne ikke hente målvideo ('+upstream.status+')'})}
  if(!key){const data=await upstream.json();return res.status(200).json(data)}
  res.status(upstream.status);
  for(const name of ['content-type','content-length','content-range','accept-ranges']){const value=upstream.headers.get(name);if(value)res.setHeader(name,value)}
  if(!upstream.body)return res.end();
  const {Readable}=await import('node:stream');
  Readable.fromWeb(upstream.body).on('error',()=>res.destroy()).pipe(res);
 }catch(e){return res.status(502).json({error:'Cloudflare er utilgjengelig'})}
}