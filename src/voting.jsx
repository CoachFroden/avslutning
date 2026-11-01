import './voting.css';
import React,{useEffect,useState} from 'react';
import {Trophy,CheckCircle2,ArrowLeft,RefreshCw,Trash2,Copy,MonitorPlay,Lock,Unlock} from 'lucide-react';
export function VoteBackground({children}){return <div className="vote-scene"><div className="vote-lights"/><div className="vote-grid"/><div className="vote-orb orb-one"/><div className="vote-orb orb-two"/><div className="vote-content">{children}</div></div>}
async function request(method='GET',body){const res=await fetch('/api/votes',{method,headers:{'Content-Type':'application/json'},credentials:'include',...(body?{body:JSON.stringify(body)}:{})});const data=await res.json();if(!res.ok)throw Error(data.error||'Noe gikk galt');return data}
export function Ballot(){
 const [data,setData]=useState(null);
 const [voter,setVoter]=useState('');
 const [candidate,setCandidate]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [done,setDone]=useState(false);
 const refresh=()=>request().then(setData).catch(e=>setError(e.message));
 useEffect(()=>{refresh()},[]);
 async function submit(e){
  e.preventDefault();
  if(!window.confirm('Bekreft at du vil stemme på '+candidate+' som årets spiller?'))return;
  setBusy(true);setError('');
  try{await request('POST',{voter,candidate});setDone(true)}
  catch(e){setError(e.message);refresh()}
  finally{setBusy(false)}
 }
 return (
  <main className="ballot-page">
   <VoteBackground>
    <div className="vote-crown"><Trophy size={42}/></div>
    <div className="vote-kicker">SAMNANGER G14 · 2026</div>
    <h1>ÅRETS<br/><em>SPILLER</em></h1>
    {done ? (
     <div className="ballot-card"><CheckCircle2 size={45}/><h2>Takk for stemmen!</h2><p>Stemmen din er registrert. Vi avslører vinneren på avslutningen!</p></div>
    ) : (
     <form className="ballot-card" onSubmit={submit}>
      <p>Hvem mener du har vært lagets beste spiller denne sesongen?</p>
      {!data ? <p>Laster spillerlisten …</p> : !data.open ? <h2>Avstemningen er stengt</h2> : (
       <>
        <label htmlFor="voter">Hvem er du?</label>
        <select id="voter" required value={voter} onChange={e=>{setVoter(e.target.value);setCandidate('')}}>
         <option value="">Velg ditt navn</option>
         {data.players.map(n=><option key={n} disabled={data.voted.includes(n)} value={n}>{n}{data.voted.includes(n)?' – har stemt':''}</option>)}
        </select>
        <label htmlFor="candidate">Hvem stemmer du på?</label>
        <select id="candidate" required value={candidate} onChange={e=>setCandidate(e.target.value)}>
         <option value="">Velg årets spiller</option>
         {data.players.filter(n=>n!==voter).map(n=><option key={n} value={n}>{n}</option>)}
        </select>
        <button className="primary" disabled={busy||!voter||!candidate}>{busy?'Sender …':'Send min stemme'}</button>
       </>
      )}
      {error&&<div className="error">{error}</div>}
      <small>Du kan stemme én gang. Ta kontakt med treneren dersom du velger feil.</small>
     </form>
    )}
   </VoteBackground>
  </main>
 );
}
export function VoteAdmin({onBack,onShow,onWelcome}){const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[playersText,setPlayersText]=useState(''),[edit,setEdit]=useState(false),[topscorer,setTopscorer]=useState(()=>localStorage.getItem('g14_topscorer')||'');const load=()=>request().then(d=>{setData(d);if(!edit)setPlayersText(d.players.join('\n'))}).catch(e=>setError(e.message));useEffect(()=>{load();const timer=setInterval(()=>{request().then(setData).catch(()=>{})},5000);return()=>clearInterval(timer)},[]);async function change(method,body){setBusy(true);setError('');try{await request(method,body);await load()}catch(e){setError(e.message)}finally{setBusy(false)}}const counts={};(data?.votes||[]).forEach(v=>counts[v.candidate]=(counts[v.candidate]||0)+1);const ranking=Object.entries(counts).sort((a,b)=>b[1]-a[1]);return <section className="vote-admin"><button className="ghost" onClick={onBack}><ArrowLeft size={17}/> Tilbake til admin</button><div className="vote-admin-preview"><VoteBackground><div className="vote-crown"><Trophy size={46}/></div><div className="vote-kicker">SAMNANGER G14 · 2026</div><h1>ÅRETS<br/><em>SPILLER</em></h1><p>Hvem har vært best denne sesongen?</p></VoteBackground></div><div className="vote-admin-actions"><button className="primary" onClick={onShow}><MonitorPlay size={18}/> Vis på storskjerm</button><button className="outline" onClick={onWelcome}>Tilbake til velkomstbildet</button></div><div className="vote-management"><h2>Prisutdeling på storskjerm</h2><p>Årets toppscorer legger du inn selv. Årets spiller hentes automatisk fra stemmene i Firebase når du trykker på knappen.</p><div className="award-fields"><label>Årets toppscorer<input value={topscorer} placeholder="Skriv spillerens navn" onChange={e=>{setTopscorer(e.target.value);localStorage.setItem('g14_topscorer',e.target.value)}}/></label><button className="primary" disabled={!topscorer.trim()} onClick={()=>localStorage.setItem('g14_reveal',JSON.stringify({award:'scorer',name:topscorer.trim(),id:Date.now()}))}>🏆 Avslør årets toppscorer</button><button className="primary" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const latest=await request();setData(latest);const tally={};(latest.votes||[]).forEach(v=>{tally[v.candidate]=(tally[v.candidate]||0)+1});const max=Math.max(0,...Object.values(tally));const leaders=Object.keys(tally).filter(n=>tally[n]===max);if(max===0)throw Error('Ingen stemmer er registrert ennå.');if(leaders.length!==1)throw Error('Det er stemmelikhet mellom '+leaders.join(' og ')+'. Avklar vinneren før avsløring.');localStorage.setItem('g14_reveal',JSON.stringify({award:'player',name:leaders[0],id:Date.now()}))}catch(e){setError(e.message)}finally{setBusy(false)}}}>🏆 Avslør årets spiller (fra stemmene)</button></div></div><div className="vote-management"><h2>Avstemning på forhånd</h2><p>Del denne lenken med guttene. De velger sitt eget navn og hvem de stemmer på.</p><div className="share-vote"><input readOnly value={location.origin+'/stemme'}/><button className="outline" onClick={()=>navigator.clipboard.writeText(location.origin+'/stemme')}><Copy size={17}/> Kopier lenke</button></div>{error&&<div className="error">{error}</div>}{data&&<><div className="vote-summary"><strong>{data.voted.length} av {data.players.length}</strong> har stemt <button className="outline" onClick={load}><RefreshCw size={16}/> Oppdater</button><button className="outline" disabled={busy} onClick={()=>change('PATCH',{open:!data.open})}>{data.open?<Lock size={16}/>:<Unlock size={16}/>} {data.open?'Steng avstemning':'Åpne avstemning'}</button></div><h3>Hvem har stemt?</h3><div className="vote-voters">{data.players.map(n=><div className="vote-voter" key={n}><span>{n}</span><span>{data.voted.includes(n)?'✓ Har stemt':'Ikke stemt'}</span>{data.voted.includes(n)&&<button className="ghost" disabled={busy} onClick={()=>{if(window.confirm('Slette stemmen til '+n+'? Da kan navnet brukes på nytt.'))change('DELETE',{voter:n})}}><Trash2 size={15}/> Slett stemme</button>}</div>)}</div><details className="vote-results"><summary>Se stemmetall (kun admin)</summary>{ranking.length?ranking.map(([name,count])=><p key={name}>{name}: <strong>{count}</strong></p>):<p>Ingen stemmer registrert ennå.</p>}</details><details className="vote-results" open={edit} onToggle={e=>setEdit(e.currentTarget.open)}><summary>Rediger spillerliste</summary><p>Én spiller per linje. Kontroller navnene før du deler lenken.</p><textarea rows="12" value={playersText} onChange={e=>setPlayersText(e.target.value)}/><button className="primary" disabled={busy} onClick={()=>change('PATCH',{players:playersText.split('\n').map(x=>x.trim()).filter(Boolean)})}>Lagre spillerliste</button></details></>}</div></section>}
