import type {Question} from '@/types/question';

const passage = `Urban trees are often valued for their beauty, but recent research shows that their benefits extend far beyond appearance. Trees can reduce surface temperatures, improve air quality, and help cities manage stormwater more effectively.\n\nIn one study, researchers compared neighborhoods with different levels of tree cover. Areas with more shade were measurably cooler during the hottest part of the day. The researchers concluded that strategic planting could make dense cities more comfortable and resilient.\n\nHowever, the study also emphasized that not all planting strategies produce equal results. Species selection, maintenance, and placement all influence whether a tree thrives and provides long-term value.`;

export const satReadingWritingModule1: Question[] = [
  {
    id:'SAT-RW-M1-0001',exam:'SAT',section:'READING_WRITING',module:1,
    domain:'Information and Ideas',skill:'Central Ideas and Details',difficulty:'MEDIUM',estimatedTimeSeconds:70,
    passageId:'URBAN-TREES-001',passage,
    prompt:'Which choice best states the main idea of the text?',
    choices:[
      {id:'A',text:'Urban trees are mainly decorative.'},
      {id:'B',text:'Urban trees provide meaningful benefits, but planning determines their long-term value.'},
      {id:'C',text:'All trees provide identical results.'},
      {id:'D',text:'Tree cover has no relationship to city temperature.'}
    ],
    correctChoiceId:'B',
    explanation:'The text presents several benefits and then qualifies that outcomes depend on selection, placement, and maintenance.',
    commonMistakes:['Choosing a detail rather than the central idea','Ignoring the qualification in the final paragraph'],
    tags:['main-idea','urban-environment']
  },
  {
    id:'SAT-RW-M1-0002',exam:'SAT',section:'READING_WRITING',module:1,
    domain:'Information and Ideas',skill:'Command of Evidence',difficulty:'EASY',estimatedTimeSeconds:55,
    passageId:'URBAN-TREES-001',passage,
    prompt:'Which finding most directly supports the claim that trees can improve urban comfort?',
    choices:[
      {id:'A',text:'Trees are valued for beauty.'},
      {id:'B',text:'Neighborhoods had different tree cover.'},
      {id:'C',text:'Areas with more shade were cooler during the hottest part of the day.'},
      {id:'D',text:'Some species need maintenance.'}
    ],
    correctChoiceId:'C',
    explanation:'The measured temperature difference directly supports the claim about urban comfort.',
    commonMistakes:['Selecting background information instead of direct evidence'],
    tags:['evidence','temperature']
  },
  {
    id:'SAT-RW-M1-0003',exam:'SAT',section:'READING_WRITING',module:1,
    domain:'Craft and Structure',skill:'Words in Context',difficulty:'EASY',estimatedTimeSeconds:50,
    passageId:'URBAN-TREES-001',passage,
    prompt:'As used in the text, “resilient” most nearly means',
    choices:[
      {id:'A',text:'expensive'},
      {id:'B',text:'able to adapt and recover'},
      {id:'C',text:'visually attractive'},
      {id:'D',text:'densely populated'}
    ],
    correctChoiceId:'B',
    explanation:'In context, resilient cities can better handle heat and environmental stress.',
    commonMistakes:['Choosing a word related to cities but not to the sentence meaning'],
    tags:['vocabulary','context']
  },
  {
    id:'SAT-RW-M1-0004',exam:'SAT',section:'READING_WRITING',module:1,
    domain:'Information and Ideas',skill:'Inferences',difficulty:'HARD',estimatedTimeSeconds:85,
    passageId:'URBAN-TREES-001',passage,
    prompt:'What can reasonably be inferred about poorly planned planting programs?',
    choices:[
      {id:'A',text:'They may fail to deliver expected long-term benefits.'},
      {id:'B',text:'They always increase flooding.'},
      {id:'C',text:'They cost less than strategic programs.'},
      {id:'D',text:'They require no maintenance.'}
    ],
    correctChoiceId:'A',
    explanation:'The final paragraph says outcomes depend on species, maintenance, and placement.',
    commonMistakes:['Making an extreme inference not supported by the text'],
    tags:['inference','planning']
  },
  {
    id:'SAT-RW-M1-0005',exam:'SAT',section:'READING_WRITING',module:1,
    domain:'Expression of Ideas',skill:'Transitions',difficulty:'MEDIUM',estimatedTimeSeconds:45,
    passageId:'URBAN-TREES-001',passage,
    prompt:'Which transition best introduces the final paragraph?',
    choices:[
      {id:'A',text:'Similarly,'},
      {id:'B',text:'However,'},
      {id:'C',text:'For example,'},
      {id:'D',text:'Therefore,'}
    ],
    correctChoiceId:'B',
    explanation:'The final paragraph qualifies the positive claims, so “However” is the logical transition.',
    commonMistakes:['Choosing a cause-and-effect transition instead of a contrast'],
    tags:['transitions','contrast']
  }
];
