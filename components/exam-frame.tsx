'use client';
import {useEffect,useRef,useState} from 'react';
import {useExam} from './exam-store';
export default function ExamFrame({children}:{children:React.ReactNode}){
 const {timeLeft,tick}=useExam();const [hidden,setHidden]=useState(false);const alerted=useRef(new Set<number>());
 useEffect(()=>{const id=setInterval(tick,1000);return()=>clearInterval(id)},[tick]);
 useEffect(()=>{[600,300,60].forEach(t=>{if(timeLeft===t&&!alerted.current.has(t)){alerted.current.add(t);window.dispatchEvent(new CustomEvent('exam-time-warning',{detail:t}))}})},[timeLeft]);
 const m=String(Math.floor(timeLeft/60)).padStart(2,'0'),s=String(timeLeft%60).padStart(2,'0');
 const urgent=timeLeft<=300;
 return <div className="exam-shell premium-shell"><header className="exam-top premium-top"><div className="exam-brand"><span className="exam-logo">A</span><div className="exam-title"><b>SAT Practice Test 1</b><span>Reading and Writing · Module 1</span></div></div><div className="top-status"><span className="autosave"><i/>Saved</span><div className="module-chip">Module 1</div><button className={`timer-button ${urgent?'urgent':''}`} onClick={()=>setHidden(v=>!v)} aria-label="Show or hide timer"><small>Time left</small><strong>{hidden?'Hidden':`${m}:${s}`}</strong></button></div></header>{children}</div>
}
