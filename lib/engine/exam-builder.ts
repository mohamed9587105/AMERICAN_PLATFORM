import type {BuiltExam, ExamBlueprint, Question} from '@/types/question';
import {validateQuestionBank} from './question-engine';

function deterministicShuffle<T>(items: T[]): T[] {
  return [...items].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

export function buildExam(questionBank: Question[], blueprint: ExamBlueprint): BuiltExam {
  const errors = validateQuestionBank(questionBank);
  if (errors.length) throw new Error(`Invalid question bank:\n${errors.join('\n')}`);

  let pool = questionBank.filter(q =>
    q.exam === blueprint.exam && q.section === blueprint.section && q.module === blueprint.module
  );

  if (blueprint.domains?.length) {
    pool = pool.filter(q => blueprint.domains?.includes(q.domain));
  }

  if (blueprint.difficultyMix) {
    const selected: Question[] = [];
    for (const difficulty of ['EASY','MEDIUM','HARD'] as const) {
      const requested = blueprint.difficultyMix[difficulty] ?? 0;
      selected.push(...deterministicShuffle(pool.filter(q => q.difficulty === difficulty)).slice(0, requested));
    }
    const remaining = deterministicShuffle(pool.filter(q => !selected.some(s => s.id === q.id)));
    pool = [...selected, ...remaining];
  } else {
    pool = deterministicShuffle(pool);
  }

  const questions = pool.slice(0, blueprint.questionCount);
  if (questions.length < blueprint.questionCount) {
    throw new Error(`Not enough questions for blueprint. Requested ${blueprint.questionCount}, found ${questions.length}.`);
  }

  return {
    id: `${blueprint.exam}-${blueprint.section}-M${blueprint.module}`,
    title: `${blueprint.exam} ${blueprint.section.replace('_',' & ')} — Module ${blueprint.module}`,
    blueprint,
    questions
  };
}
