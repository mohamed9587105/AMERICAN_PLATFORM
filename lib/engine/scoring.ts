import type {Question} from '@/types/question';
import {getCorrectChoiceIndex} from './question-engine';

export type ScoreReport = {
  correct: number;
  total: number;
  accuracy: number;
  estimatedSectionScore: number;
  domainBreakdown: Array<{domain:string;correct:number;total:number;accuracy:number}>;
};

export function scoreExam(questions: Question[], answers: Array<number|null>): ScoreReport {
  const correct = questions.reduce((sum, question, index) =>
    sum + (answers[index] === getCorrectChoiceIndex(question) ? 1 : 0), 0
  );
  const total = questions.length;
  const accuracy = total ? Math.round((correct / total) * 100) : 0;
  const domains = new Map<string,{correct:number;total:number}>();

  questions.forEach((question,index) => {
    const value = domains.get(question.domain) ?? {correct:0,total:0};
    value.total += 1;
    if (answers[index] === getCorrectChoiceIndex(question)) value.correct += 1;
    domains.set(question.domain,value);
  });

  return {
    correct,total,accuracy,
    estimatedSectionScore: Math.round(200 + 600 * (accuracy / 100)),
    domainBreakdown:[...domains.entries()].map(([domain,value]) => ({
      domain,
      correct:value.correct,
      total:value.total,
      accuracy:Math.round((value.correct/value.total)*100)
    }))
  };
}
