import {satReadingWritingModule1} from '@/data/sat/reading-writing/module-1';
import {buildExam} from '@/lib/engine/exam-builder';

export const activeExam = buildExam(satReadingWritingModule1, {
  exam:'SAT',
  section:'READING_WRITING',
  module:1,
  questionCount:5,
  durationSeconds:32*60,
  difficultyMix:{EASY:2,MEDIUM:2,HARD:1}
});

export const questions = activeExam.questions;
export const passage = questions[0]?.passage ?? '';
