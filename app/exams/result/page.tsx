'use client';
import Link from 'next/link';
import {activeExam,questions} from '@/lib/exam-config';
import {scoreExam} from '@/lib/engine/scoring';
import {analyzeExam} from '@/lib/engine/analytics';
import {getCorrectChoiceIndex} from '@/lib/engine/question-engine';
import {ExamProvider,useExam} from '@/components/exam-store';

function Result(){
  const {answers,timeLeft,reset}=useExam();
  const report=scoreExam(questions,answers);
  const elapsed=activeExam.blueprint.durationSeconds-timeLeft;
  const answeredCount=answers.filter(x=>x!==null).length;
  const avg=answeredCount?Math.round(elapsed/answeredCount):0;
  const insight=analyzeExam(questions,report,elapsed);

  return <main className="result-page v5-result">
    <section className="score-hero v5-score-hero">
      <span className="eyebrow">SAT practice result</span>
      <div className="score-ring" style={{'--score':`${report.accuracy*3.6}deg`} as Record<string,string>}><div><strong>{report.accuracy}%</strong><span>Accuracy</span></div></div>
      <h2>{report.accuracy>=80?'Strong performance':report.accuracy>=60?'Good foundation':'Room to grow'}</h2>
      <p>{report.correct} correct out of {report.total} questions</p>
      <div className="score-band v5-score-band">
        <div><b>{report.estimatedSectionScore}</b><span>Estimated R&W</span></div>
        <div><b>{avg}s</b><span>Avg. per question</span></div>
        <div><b>{Math.floor(elapsed/60)}m {elapsed%60}s</b><span>Time used</span></div>
        <div><b>{report.total-report.correct}</b><span>Questions to review</span></div>
      </div>
    </section>

    <section className="analysis-card v5-insight-card">
      <div className="insight-heading"><div><span className="eyebrow">Performance intelligence</span><h2>Your module insights</h2></div><span className="ai-badge">Engine-generated analysis</span></div>
      <div className="insight-grid">
        <article className="insight strong"><span>Strongest domain</span><b>{insight.strongestDomain}</b><p>Maintain this strength with mixed timed practice.</p></article>
        <article className="insight weak"><span>Priority domain</span><b>{insight.priorityDomain}</b><p>Review missed questions and focus on the reasoning pattern behind each error.</p></article>
        <article className="insight plan"><span>Recommended next step</span><b>{insight.estimatedPaceLabel} pace</b><p>{insight.recommendedAction}</p></article>
      </div>
      <h2 className="analysis-title">Domain breakdown</h2>
      <div className="skill-breakdown">{report.domainBreakdown.map(item=><article key={item.domain}><div><b>{item.domain}</b><span>{item.correct}/{item.total} correct</span></div><div className="skill-bar"><i style={{width:`${item.accuracy}%`}}/></div><strong>{item.accuracy}%</strong></article>)}</div>
    </section>

    <section className="analysis-card"><h2>Question analysis</h2>{questions.map((q,i)=>{
      const isCorrect=answers[i]===getCorrectChoiceIndex(q);
      return <article key={q.id} className={isCorrect?'analysis-row correct':'analysis-row wrong'}><div><b>Question {i+1} · {q.skill}</b><p>{q.explanation}</p><small>{q.difficulty} · Target time {q.estimatedTimeSeconds}s</small></div><span>{isCorrect?'Correct':'Review'}</span></article>
    })}<div className="actions"><button className="secondary" onClick={()=>{reset();location.href='/exams/start'}}>New attempt</button><Link className="primary" href="/exams/start">Back to exams</Link></div></section>
  </main>
}
export default function Page(){return <ExamProvider><Result/></ExamProvider>}
