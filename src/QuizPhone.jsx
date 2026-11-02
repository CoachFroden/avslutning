import React,{useEffect,useState} from 'react';
import {Zap,Trophy,Timer,CheckCircle2,XCircle,Clock3} from 'lucide-react';
import './quiz-phone.css';
import {watchQuizResponses,normalizePublicQuiz} from './firebaseQuiz.js';
const playerKey='g14_quiz_player';
export default function QuizPhone(){
 const [name,setName]=useState(()=>localStorage.getItem(playerKey)||'');
 const [draft,setDraft]=useState(name),[live,setLive]=useState(null),[choice,setChoice]=useState(null),[error,setError]=useState(''),[sending,setSending]=useState(false),[now,setNow]=useState(Date.now());
 useEffect(()=>watchQuizResponses(data=>{const d=normalizePublicQuiz(data);setLive(old=>({...d,myAnswers:old?.sessionId===d.sessionId?(old?.myAnswers||[]):[],totalPoints:old?.sessionId===d.sessionId?(old?.totalPoints||0):0}));setError('')},e=>setError('Kunne ikke motta quizstatus: '+e.message)),[]);
 useEffect(()=>{if(!name)return;let active=true;fetch('/api/quiz-live?name='+encodeURIComponent(name),{cache:'no-store'}).then(r=>r.json()).then(d=>{if(active&&d.myAnswers)setLive(old=>old?{...old,myAnswers:d.myAnswers,totalPoints:d.totalPoints,myRank:d.myRank}:old)}).catch(()=>{});return()=>{active=false}},[name]);
 useEffect(()=>{const t=setInterval(()=>{setNow(Date.now());setLive(old=>old?.stage==='countdown'&&Date.now()>=old.countdownEndsAt?{...old,stage:'question'}:old)},100);return()=>clearInterval(t)},[]);
 useEffect(()=>{setChoice(null);setError('')},[live?.round]);
 const history=live?.myAnswers||[];
 const own=history.find(a=>a.round===live?.round);
 const remaining=live?.deadline?Math.max(0,live.deadline-(now+(live.offset||0))):0;
 const seconds=Math.ceil(remaining/1000);
 const expired=!!live?.expired||!!live?.deadline&&remaining<=0;
 const pointsAvailable=Math.floor(1000*remaining/15000);
 const closed=live?.stage!=='question'||expired;
 const submit=async(selected)=>{if(selected===null||closed||own||sending)return;setSending(true);setError('');try{const r=await fetch('/api/quiz-live',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'answer',name,answer:selected,round:live.round})});const d=await r.json();if(!r.ok)throw Error(d.error||'Kunne ikke sende svar');setLive(old=>old?{...old,myAnswers:[...(old.myAnswers||[]).filter(a=>a.round!==d.round),{round:d.round,answer:d.answer,points:d.points}],totalPoints:(old.totalPoints||0)+d.points}:old)}catch(e){setError(e.message)}finally{setSending(false)}};
 const register=e=>{e.preventDefault();if(draft.trim().length<2)return;localStorage.setItem(playerKey,draft.trim());setName(draft.trim())};
 const stage=live?.stage,showQuestion=stage==='question'||stage==='answer';const countdown=stage==='countdown'?Math.min(5,Math.max(0,Math.ceil((live.countdownEndsAt-(now+(live.offset||0)))/1000))):0;const ready=stage==='countdown'&&now+(live.offset||0)<(live.readyEndsAt||0);
 const outcome=own?(own.points>0?'correct':'wrong'):(expired||stage==='answer'?'timeout':null);
 return <main className="quiz-phone"><div className="phone-sparkles" aria-hidden="true">{Array.from({length:17},(_,i)=><i key={i} style={{'--x':(i*37%100)+'%','--y':(i*29%100)+'%','--delay':(i*.31)+'s'}}/>)}</div><section className="phone-card">
 <div className="phone-kicker"><Zap size={15}/> SAMNANGER G14 · 2026</div><div className="phone-heading"><h1>LAG<span>QUIZEN</span></h1><span className="phone-bolt">⚡</span></div>
 {!name?<><p>Bli med og kjemp om poengene!</p><form onSubmit={register}><input maxLength={60} value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Navnet ditt" required minLength={2}/><button className="phone-submit">BLI MED!</button></form></>:<>
 <div className="phone-player"><span>SPILLER <strong>{name}</strong></span><button className="phone-link" onClick={()=>{setName('');setDraft('');localStorage.removeItem(playerKey)}}>Bytt navn</button></div>
 {stage==='countdown'&&countdown>0?<div className="phone-wait phone-pulse"><Zap size={28}/><strong>{ready?'GJØR DEG KLAR':`NESTE SPØRSMÅL OM ${countdown}`}</strong><span>Gjør deg klar!</span></div>:stage==='finished'?<div className="phone-final"><div className="phone-final-trophy">🏆</div><h2>QUIZEN ER AVSLUTTET!</h2><p>Du endte med</p><strong>{(live?.totalPoints||0).toLocaleString('nb-NO')} POENG</strong>{live?.revealAt&&live?.myRank&&<p>Din plassering: <b>#{live.myRank}</b></p>}{live?.revealAt?<div className="phone-final-board">{(live?.leaderboard||[]).slice(0,3).map((p,i)=><div key={i}><span>{['🥇','🥈','🥉'][i]} {p.name}</span><b>{p.points.toLocaleString('nb-NO')}</b></div>)}</div>:<p>Vinnerne avsløres snart på storskjermen …</p>}</div>:!showQuestion?<div className="phone-wait phone-pulse"><Zap size={28}/> <strong>GJØR DEG KLAR!</strong><span>Følg med på storskjermen. Neste spørsmål kommer snart.</span></div>:<div key={live.round} className="phone-question-enter">
 <div className="phone-round"><span>SPØRSMÅL {live.index+1} / {live.total}</span><span>MAKS 1000 POENG</span></div>
 <div className={'phone-clock '+(seconds<=5?'urgent':'')}><Timer size={22}/><strong>{expired?'⏱':String(seconds).padStart(2,'0')}</strong><span>{expired?'TIDEN ER UTE':'SEKUNDER'}</span><div className="phone-clock-points">{own?own.points:closed?0:pointsAvailable} <small>mulige poeng</small></div></div>
 <div className="phone-timer-track"><div style={{width:(remaining/150)+'%'}}/></div>
 <h2>{live.question}</h2>
 <div className="phone-answers">{(live.options||[]).map((a,i)=><button key={i} disabled={!!own||closed||sending} className={'phone-answer '+(choice===i?'selected ':'')+(stage==='answer'&&live.correct===i?'correct':'')} onClick={()=>{setChoice(i);submit(i)}}><b>{'ABCD'[i]}</b><span>{a}</span></button>)}</div>
 {outcome==='correct'?<div className="phone-result good"><CheckCircle2/> RIKTIG! +{own.points} POENG 🎉</div>:outcome==='wrong'?<div className="phone-result bad"><XCircle/> FEIL SVAR – 0 POENG</div>:(outcome==='timeout'||outcome==='missed')?<div className="phone-result bad"><Clock3/> {outcome==='missed'?'INGEN SVAR – 0 POENG':'TIDEN ER UTE – 0 POENG'}</div>:own?<div className="phone-result pending"><CheckCircle2/> Svaret er registrert!</div>:<div className="phone-answer-hint">{sending?'Sender svaret ditt …':'Trykk på ett svar – det registreres med én gang.'}</div>}
 {stage==='answer'&&<div className="phone-reveal">RIKTIG SVAR: <strong>{'ABCD'[live.correct]} · {live.options?.[live.correct]}</strong></div>}
 </div>}
 {error&&<div role="alert" className="phone-error">{error}</div>}
 <div className="phone-score"><div><Trophy size={23}/><span>DIN TOTALSCORE</span></div><strong>{(live?.totalPoints||0).toLocaleString('nb-NO')} <small>POENG</small></strong><p>{history.filter(a=>a.points>0).length} riktige svar · {history.length} besvarte</p></div>
 </>}</section></main>
}