import type {Question} from '@/types/question';
import type {ScoreReport} from './scoring';

export type ExamInsight = {
  strongestDomain: string;
  priorityDomain: string;
  recommendedAction: string;
  estimatedPaceLabel: 'Fast'|'Balanced'|'Slow';
};

export function analyzeExam(questions: Question[], report: ScoreReport, elapsedSeconds: number): ExamInsight {
  const sorted = [...report.domainBreakdown].sort((a,b) => b.accuracy-a.accuracy);
  const averageSeconds = questions.length ? elapsedSeconds/questions.length : 0;
  return {
    strongestDomain: sorted[0]?.domain ?? '—',
    priorityDomain: sorted.at(-1)?.domain ?? '—',
    recommendedAction: sorted.at(-1)
      ? `Complete a focused 10-question set in ${sorted.at(-1)?.domain}, then review every explanation.`
      : 'Complete another mixed practice module.',
    estimatedPaceLabel: averageSeconds < 45 ? 'Fast' : averageSeconds > 90 ? 'Slow' : 'Balanced'
  };
}
