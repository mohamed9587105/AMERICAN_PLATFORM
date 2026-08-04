'use client';
import {createContext,useContext,useEffect,useMemo,useState} from 'react';
import {activeExam,questions} from '@/lib/exam-config';
type ExamState={answers:(number|null)[];flags:boolean[];eliminated:number[][];notes:string[];timeLeft:number};
type Ctx=ExamState&{setAnswer:(i:number,v:number)=>void;toggleFlag:(i:number)=>void;toggleEliminate:(i:number,v:number)=>void;setNote:(i:number,v:string)=>void;reset:()=>void;tick:()=>void};
const makeInitial=():ExamState=>({answers:Array(questions.length).fill(null),flags:Array(questions.length).fill(false),eliminated:Array.from({length:questions.length},()=>[]),notes:Array(questions.length).fill(''),timeLeft:activeExam.blueprint.durationSeconds});
const ExamContext=createContext<Ctx|null>(null);
export function ExamProvider({children}:{children:React.ReactNode}){
 const [state,setState]=useState<ExamState>(makeInitial());
 useEffect(()=>{const raw=localStorage.getItem('american-platform-exam-v6');if(raw)try{setState({...makeInitial(),...JSON.parse(raw)})}catch{}},[]);
 useEffect(()=>{localStorage.setItem('american-platform-exam-v6',JSON.stringify(state))},[state]);
 const value=useMemo<Ctx>(()=>({...state,
  setAnswer:(i,v)=>setState(s=>({...s,answers:s.answers.map((a,x)=>x===i?v:a)})),
  toggleFlag:(i)=>setState(s=>({...s,flags:s.flags.map((f,x)=>x===i?!f:f)})),
  toggleEliminate:(i,v)=>setState(s=>({...s,eliminated:s.eliminated.map((arr,x)=>x===i?(arr.includes(v)?arr.filter(n=>n!==v):[...arr,v]):arr)})),
  setNote:(i,v)=>setState(s=>({...s,notes:s.notes.map((n,x)=>x===i?v:n)})),
  reset:()=>setState(makeInitial()),tick:()=>setState(s=>({...s,timeLeft:Math.max(0,s.timeLeft-1)}))}),[state]);
 return <ExamContext.Provider value={value}>{children}</ExamContext.Provider>
}
export function useExam(){const c=useContext(ExamContext);if(!c)throw new Error('ExamProvider missing');return c}
