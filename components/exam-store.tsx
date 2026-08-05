'use client';
import {createContext,useContext,useEffect,useMemo,useState} from 'react';
import type {BuiltExam} from '@/types/question';
export type QuestionTelemetry={timeSeconds:number;visits:number;answerChanges:number};
type ExamState={answers:(number|null)[];flags:boolean[];eliminated:number[][];notes:string[];timeLeft:number;activeQuestion:number;telemetry:QuestionTelemetry[]};
type Ctx=ExamState&{exam:BuiltExam;questions:BuiltExam['questions'];setAnswer:(i:number,v:number)=>void;toggleFlag:(i:number)=>void;toggleEliminate:(i:number,v:number)=>void;setNote:(i:number,v:string)=>void;setActiveQuestion:(i:number)=>void;reset:()=>void;tick:()=>void};
const ExamContext=createContext<Ctx|null>(null);
export function ExamProvider({children,exam}:{children:React.ReactNode;exam:BuiltExam}){
 const key=`mastery-exam-${exam.id}`;
 const makeInitial=():ExamState=>({answers:Array(exam.questions.length).fill(null),flags:Array(exam.questions.length).fill(false),eliminated:Array.from({length:exam.questions.length},()=>[]),notes:Array(exam.questions.length).fill(''),timeLeft:exam.blueprint.durationSeconds,activeQuestion:0,telemetry:Array.from({length:exam.questions.length},()=>({timeSeconds:0,visits:0,answerChanges:0}))});
 const [state,setState]=useState<ExamState>(makeInitial);
 useEffect(()=>{const raw=localStorage.getItem(key);if(raw)try{const saved=JSON.parse(raw) as Partial<ExamState>;setState({...makeInitial(),...saved,telemetry:saved.telemetry?.length===exam.questions.length?saved.telemetry:makeInitial().telemetry})}catch{}},[key]);
 useEffect(()=>{localStorage.setItem(key,JSON.stringify(state))},[key,state]);
 const value=useMemo<Ctx>(()=>({...state,exam,questions:exam.questions,
  setAnswer:(i,v)=>setState(s=>({...s,answers:s.answers.map((a,x)=>x===i?v:a),telemetry:s.telemetry.map((t,x)=>x===i?({...t,answerChanges:t.answerChanges+(s.answers[i]!==null&&s.answers[i]!==v?1:0)}):t)})),
  toggleFlag:i=>setState(s=>({...s,flags:s.flags.map((f,x)=>x===i?!f:f)})),
  toggleEliminate:(i,v)=>setState(s=>({...s,eliminated:s.eliminated.map((arr,x)=>x===i?(arr.includes(v)?arr.filter(n=>n!==v):[...arr,v]):arr)})),
  setNote:(i,v)=>setState(s=>({...s,notes:s.notes.map((n,x)=>x===i?v:n)})),
  setActiveQuestion:i=>setState(s=>i===s.activeQuestion?s:{...s,activeQuestion:i,telemetry:s.telemetry.map((t,x)=>x===i?({...t,visits:t.visits+1}):t)}),
  reset:()=>{localStorage.removeItem(key);setState(makeInitial())},
  tick:()=>setState(s=>({...s,timeLeft:Math.max(0,s.timeLeft-1),telemetry:s.telemetry.map((t,x)=>x===s.activeQuestion?({...t,timeSeconds:t.timeSeconds+1}):t)}))
 }),[state,exam,key]);
 return <ExamContext.Provider value={value}>{children}</ExamContext.Provider>
}
export function useExam(){const c=useContext(ExamContext);if(!c)throw new Error('ExamProvider missing');return c}
