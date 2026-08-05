import type {BuiltExam, ExamCode, Question, SectionCode} from '@/types/question';

export type ExamSectionProfile={code:SectionCode;name:string;modules:number;durationMinutes:number;questionCount:number;description:string};
export type ExamProfile={code:ExamCode;name:string;shortName:string;description:string;accent:string;sections:ExamSectionProfile[]};

export const examProfiles:ExamProfile[]=[
 {code:'SAT',name:'Digital SAT',shortName:'SAT',description:'Adaptive college admission practice with official-style modules.',accent:'#2563eb',sections:[
  {code:'READING_WRITING',name:'Reading & Writing',modules:2,durationMinutes:32,questionCount:5,description:'Craft, structure, information and expression of ideas.'},
  {code:'MATH',name:'Math',modules:2,durationMinutes:35,questionCount:5,description:'Algebra, advanced math, problem solving and geometry.'}]},
 {code:'EST',name:'Egyptian Scholastic Test',shortName:'EST',description:'Focused EST preparation across language and mathematics.',accent:'#0f766e',sections:[
  {code:'READING',name:'Reading',modules:1,durationMinutes:30,questionCount:5,description:'Comprehension, inference and evidence.'},
  {code:'WRITING',name:'Writing',modules:1,durationMinutes:30,questionCount:5,description:'Grammar, usage and rhetorical skills.'},
  {code:'MATH',name:'Math',modules:1,durationMinutes:35,questionCount:5,description:'Core and advanced mathematical reasoning.'}]},
 {code:'ACT',name:'ACT',shortName:'ACT',description:'Complete ACT practice across four core test areas.',accent:'#7c3aed',sections:[
  {code:'ENGLISH',name:'English',modules:1,durationMinutes:35,questionCount:5,description:'Conventions and production of writing.'},
  {code:'MATH',name:'Math',modules:1,durationMinutes:50,questionCount:5,description:'Mathematical skills and modeling.'},
  {code:'READING',name:'Reading',modules:1,durationMinutes:40,questionCount:5,description:'Key ideas, craft and integration.'},
  {code:'SCIENCE',name:'Science',modules:1,durationMinutes:40,questionCount:5,description:'Data interpretation and scientific investigation.'}]},
 {code:'BEGINNERS',name:'Beginners',shortName:'Beginners',description:'Friendly level-based assessments for foundation students.',accent:'#f59e0b',sections:[
  {code:'GRAMMAR',name:'Grammar',modules:1,durationMinutes:20,questionCount:5,description:'Essential sentence structure and usage.'},
  {code:'VOCABULARY',name:'Vocabulary',modules:1,durationMinutes:15,questionCount:5,description:'Core words, context and meaning.'},
  {code:'READING',name:'Reading',modules:1,durationMinutes:20,questionCount:5,description:'Short passages and comprehension.'},
  {code:'WRITING',name:'Writing',modules:1,durationMinutes:20,questionCount:5,description:'Simple composition and editing.'}]}
];

const passage='Learning improves when students practice consistently, review mistakes, and connect new ideas to what they already know. A focused plan makes progress easier to measure and repeat.';
const sectionPrompt:Record<SectionCode,string>={
 READING_WRITING:'Which choice best states the main idea of the passage?',READING:'Which statement is best supported by the passage?',WRITING:'Which choice completes the sentence according to standard English conventions?',MATH:'If 3x + 5 = 20, what is the value of x?',ENGLISH:'Which revision makes the sentence most clear and concise?',SCIENCE:'Which conclusion is most strongly supported by the data described?',GRAMMAR:'Choose the sentence with correct grammar.',VOCABULARY:'Which word is closest in meaning to “consistent”?'
};
const answers:Record<SectionCode,string[]>={
 READING_WRITING:['Progress is strengthened by regular, reflective practice.','Learning never requires review.','Only new ideas matter.','Plans make learning harder.'],
 READING:['A focused study plan helps students track progress.','Students should avoid mistakes.','Practice has no effect on learning.','Prior knowledge prevents improvement.'],
 WRITING:['Students improve when they practice consistently.','Students improves when they practice consistently.','Students improving when they practice consistently.','Students improve when they practices consistently.'],
 MATH:['5','3','15','25'],ENGLISH:['Consistent practice helps students improve.','Practice, which is consistent, it helps students improve.','Students, practicing, improvement happens.','Consistent practice and students improve it.'],
 SCIENCE:['Repeated observations make a conclusion more reliable.','One observation always proves a theory.','Data should be ignored when unexpected.','Experiments never need replication.'],
 GRAMMAR:['She studies every day.','She study every day.','She studying every day.','She studies every days.'],
 VOCABULARY:['steady','rare','confusing','temporary']
};
function makeQuestions(exam:ExamCode,section:SectionCode,module:number,count:number):Question[]{
 return Array.from({length:count},(_,i)=>({id:`${exam}-${section}-M${module}-Q${i+1}`,exam,section,module,domain:section.replaceAll('_',' '),skill:`${section.replaceAll('_',' ')} Skill ${i+1}`,difficulty:i<2?'EASY':i<4?'MEDIUM':'HARD',estimatedTimeSeconds:60+i*10,passage:section==='MATH'||section==='GRAMMAR'||section==='VOCABULARY'?'':passage,prompt:sectionPrompt[section],choices:answers[section].map((text,x)=>({id:String.fromCharCode(65+x),text})),correctChoiceId:'A',explanation:'Choice A matches the tested skill and follows the information or rule given.',commonMistakes:[],tags:[exam,section]}));
}
export function getProfile(code:string|null|undefined){return examProfiles.find(p=>p.code===code)||examProfiles[0]}
export function buildProfileExam(examCode:string|null|undefined,sectionCode:string|null|undefined,moduleValue:string|null|undefined):BuiltExam{
 const profile=getProfile(examCode);const section=profile.sections.find(s=>s.code===sectionCode)||profile.sections[0];const module=Math.min(Math.max(Number(moduleValue)||1,1),section.modules);
 return {id:`${profile.code}-${section.code}-M${module}`,title:`${profile.shortName} · ${section.name}`,blueprint:{exam:profile.code,section:section.code,module,questionCount:section.questionCount,durationSeconds:section.durationMinutes*60},questions:makeQuestions(profile.code,section.code,module,section.questionCount)};
}
export function examHref(path:string,exam:BuiltExam){const p=new URLSearchParams({exam:exam.blueprint.exam,section:exam.blueprint.section,module:String(exam.blueprint.module)});return `${path}?${p}`}
