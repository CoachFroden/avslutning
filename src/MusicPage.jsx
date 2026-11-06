import React,{useEffect,useRef,useState} from 'react';
import {ArrowLeft,Music2,Play,Pause,Volume2,VolumeX,RotateCcw} from 'lucide-react';
import './music.css';
const SONG='/Uovervinnelige.mp3';
const fmt=t=>Number.isFinite(t)?Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0'):'0:00';
export default function MusicPage({onBack,display=false}){
 const audio=useRef(null),[playing,setPlaying]=useState(false),[duration,setDuration]=useState(0),[time,setTime]=useState(0),[volume,setVolume]=useState(.8),[error,setError]=useState('');
 useEffect(()=>{if(display)return;const a=audio.current;if(a)a.volume=volume;return()=>{if(a){a.pause();a.currentTime=0}}},[display]);
 useEffect(()=>{if(!display)return;const sync=()=>{try{const d=JSON.parse(localStorage.getItem('g14_music_state')||'{}');setTime(d.time||0);setDuration(d.duration||0);setPlaying(!!d.playing)}catch{}};sync();const timer=setInterval(sync,250);window.addEventListener('storage',sync);return()=>{clearInterval(timer);window.removeEventListener('storage',sync)}},[display]);
 function publish(a){if(display||!a)return;localStorage.setItem('g14_music_state',JSON.stringify({time:a.currentTime||0,duration:Number.isFinite(a.duration)?a.duration:0,playing:!a.paused}));}
 async function toggle(){const a=audio.current;if(!a)return;if(!a.paused){a.pause();return}setError('');try{await a.play()}catch{setError('Kunne ikke starte sangen. Kontroller at lydfilen er tilgjengelig.')}}
 function seek(e){const a=audio.current;if(!a||!Number.isFinite(a.duration))return;const t=Number(e.target.value);a.currentTime=t;setTime(t)}
 const remaining=duration-time;const finale=duration>35&&remaining<=25&&time>0;const finaleMessage=duration>35&&remaining<=16&&time>0;
 function restart(){const a=audio.current;if(!a)return;a.currentTime=0;setTime(0);setError('');a.play().catch(()=>setError('Kunne ikke starte sangen.'))}
 function changeVolume(e){const v=Number(e.target.value);setVolume(v);if(audio.current)audio.current.volume=v}
 return <section className={"music-admin "+(display?"music-public":"")}>
 {!display&&<button className="ghost" onClick={onBack}><ArrowLeft size={17}/> Tilbake til admin</button>}
 {!display&&<div className="music-public-actions"><button className="primary" onClick={()=>{localStorage.removeItem("g14_reveal");localStorage.setItem("g14_screen","music");try{const c=new BroadcastChannel('g14-display');c.postMessage({type:'screen',mode:'music'});c.close()}catch{}try{window.__g14DisplayWindow?.postMessage({type:'g14-display-sync',mode:'music',reveal:null},location.origin)}catch{}}}>Vis musikk på storskjermen</button><button className="outline" onClick={()=>{localStorage.setItem("g14_screen","welcome");try{const c=new BroadcastChannel('g14-display');c.postMessage({type:'screen',mode:'welcome'});c.close()}catch{}try{window.__g14DisplayWindow?.postMessage({type:'g14-display-sync',mode:'welcome',reveal:null},location.origin)}catch{}}}>Vis velkomstbildet</button></div>}
 <div className={"music-stage "+(finale?"music-finale-active":"")}>
 <div className="music-ambient music-ambient-one"/><div className="music-ambient music-ambient-two"/>
 <div className="music-player-visual"><div className="music-stage-top"><span className="music-live-dot"/> SAMNANGER G14 <span className="music-stage-year">SESONGAVSLUTNING 2026</span></div>
 <div className="music-artwork"><div className="music-art-ring music-art-ring-one"/><div className="music-art-ring music-art-ring-two"/><div className="music-art-center"><Music2 size={57} strokeWidth={1.35}/></div></div>
 <div className="music-kicker">VÅR SANG · VÅRT LAG</div>
 <h2><em>Uovervinnelige!</em></h2>
 <p className="music-subtitle">Samhold, respekt og lagånd – Samnanger G14.</p>
 <div className={'music-bars '+(playing?'is-playing':'')}>{Array.from({length:45},(_,i)=><span key={i} style={{'--bar':i,'--height':(12+((i*17+23)%52))+'px','--delay':-((i*13)%29)/10+'s'}}/>)}</div>
 {!display&&<div className="music-controls"><div className="music-track-head"><span>Uovervinnelige</span><span>MP3 · Samnanger G14</span></div>
 <div className="music-progress"><input aria-label="Spol i sangen" type="range" min="0" max={duration||1} step=".1" value={Math.min(time,duration||1)} onChange={seek} style={{'--progress':((time/(duration||1))*100)+'%'}}/><div className="music-times"><span>{fmt(time)}</span><span>{duration?fmt(duration):'–:––'}</span></div></div>
 <div className="music-transport"><button className="music-restart" title="Start sangen fra begynnelsen" onClick={()=>{if(audio.current){audio.current.currentTime=0;setTime(0)}}}><RotateCcw size={22}/></button><button className="music-play" onClick={toggle} aria-label={playing?'Pause':'Spill av'}>{playing?<Pause size={31} fill="currentColor"/>:<Play size={31} fill="currentColor"/>}</button><div className="music-volume"><button title={volume===0?'Lyd av':'Lyd på'} onClick={()=>{const v=volume===0?.8:0;setVolume(v);if(audio.current)audio.current.volume=v}}>{volume===0?<VolumeX size={21}/>:<Volume2 size={21}/>}</button><input type="range" aria-label="Volum" min="0" max="1" step=".01" value={volume} onChange={changeVolume}/></div></div>
 {error&&<p className="music-error" role="alert">{error}</p>}</div>}</div><div className={"music-finale "+(finale?"is-visible":"")+(finaleMessage?" show-message":"")} aria-hidden={!finale}><div className="music-fog music-fog-one"/><div className="music-fog music-fog-two"/><div className="music-fog music-fog-three"/><div className="music-finale-copy"><div className="music-finale-rule"/><h2>Takk for en fantastisk sesong, <em>gutter!</em></h2><p>SAMNANGER G14 · 2026</p></div></div>{finale&&!display&&<button className="music-finale-replay" onClick={restart}><RotateCcw size={17}/> Spill sangen på nytt</button>}
 <div className="music-stage-bottom">LYDEN SPILLES PÅ DENNE PC-EN · KOBLE PC-EN TIL LYDANLEGGET</div>
 </div>
 {!display&&<audio ref={audio} src={SONG} preload="metadata" onLoadedMetadata={e=>{setDuration(e.currentTarget.duration);publish(e.currentTarget)}} onTimeUpdate={e=>{setTime(e.currentTarget.currentTime);publish(e.currentTarget)}} onPlay={e=>{setPlaying(true);publish(e.currentTarget)}} onPause={e=>{setPlaying(false);publish(e.currentTarget)}} onEnded={e=>{setPlaying(false);setTime(e.currentTarget.duration);publish(e.currentTarget)}} onError={()=>setError('Fant ikke lydfilen. Kontroller at MP3-filen ligger i public i GitHub.')}/>}
 </section>
}