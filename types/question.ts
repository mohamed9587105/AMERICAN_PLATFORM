export type ExamCode = 'SAT' | 'EST' | 'ACT';
export type SectionCode = 'READING_WRITING' | 'MATH';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

export type QuestionChoice = {
  id: string;
  text: string;
};

export type Question = {
  id: string;
  exam: ExamCode;
  section: SectionCode;
  module: number;
  domain: string;
  skill: string;
  difficulty: Difficulty;
  estimatedTimeSeconds: number;
  passageId?: string;
  passage?: string;
  prompt: string;
  choices: QuestionChoice[];
  correctChoiceId: string;
  explanation: string;
  commonMistakes: string[];
  tags: string[];
};

export type ExamBlueprint = {
  exam: ExamCode;
  section: SectionCode;
  module: number;
  questionCount: number;
  durationSeconds: number;
  difficultyMix?: Partial<Record<Difficulty, number>>;
  domains?: string[];
};

export type BuiltExam = {
  id: string;
  title: string;
  blueprint: ExamBlueprint;
  questions: Question[];
};
