import type {Question} from '@/types/question';

export function validateQuestion(question: Question): string[] {
  const errors: string[] = [];
  if (!question.id.trim()) errors.push('Question id is required');
  if (!question.prompt.trim()) errors.push(`${question.id}: prompt is required`);
  if (question.choices.length !== 4) errors.push(`${question.id}: SAT questions must have four choices`);
  if (!question.choices.some(choice => choice.id === question.correctChoiceId)) {
    errors.push(`${question.id}: correctChoiceId does not match a choice`);
  }
  if (question.estimatedTimeSeconds <= 0) errors.push(`${question.id}: estimated time must be positive`);
  return errors;
}

export function validateQuestionBank(questions: Question[]): string[] {
  const ids = new Set<string>();
  const errors = questions.flatMap(validateQuestion);
  for (const question of questions) {
    if (ids.has(question.id)) errors.push(`Duplicate question id: ${question.id}`);
    ids.add(question.id);
  }
  return errors;
}

export function getQuestionChoiceIndex(question: Question, choiceId: string): number {
  return question.choices.findIndex(choice => choice.id === choiceId);
}

export function getCorrectChoiceIndex(question: Question): number {
  return getQuestionChoiceIndex(question, question.correctChoiceId);
}
