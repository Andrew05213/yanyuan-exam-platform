import assert from 'node:assert/strict';
import {validateReview,validateStudyPayload,WRITING_DIMENSIONS,textHash} from '../lib/study-contracts.ts';
const text='Students needs practice. Careful feedback helps them improve.';
const review={summary:'QA fixture, not a student grade',dimensions:WRITING_DIMENSIONS.map(d=>({...d,score:d.max,reason:'Test fixture'})),total:100,priorities:['a','b','c'],sentences:text.split(/(?<=\.) /).map(original=>({original,languageIssue:'Test',logicIssue:'Test',minimalEdit:original,matureExpression:original})),paragraphs:[],vocabulary:[],optimizedText:text};
validateReview(review,text);
assert.throws(()=>validateReview({...review,sentences:review.sentences.slice(0,1)},text),/覆盖/);
assert.throws(()=>validateReview({...review,total:99},text),/总分/);
assert.throws(()=>validateReview({...review,sentences:review.sentences.map(s=>({...s,original:s.original.replace('needs','need')}))},text),/覆盖/);
const original={originalText:text,images:[],textConfirmed:true,firstReview:review,latestReview:review};
validateStudyPayload('essay',original,original);
assert.throws(()=>validateStudyPayload('essay',{...original,originalText:'Changed.'},original),/首次/);
assert.throws(()=>validateStudyPayload('essay',{...original,firstReview:{...review,summary:'overwritten'}},original),/首次/);
const partial={...review,dimensions:review.dimensions.map((d,i)=>({...d,score:i===0?null:d.score})),total:null};
validateReview(partial,text);
assert.equal((await textHash(text)).length,64);
console.log('PASS: every original sentence, score totals, incomplete grading, original locking, first-review preservation and source fingerprints.');

const unconfirmed={originalText:text,images:[],textConfirmed:false,firstReview:partial,latestReview:partial,reviews:[partial]};
const {reviseUnverifiedTranscription}=await import('../lib/study-contracts.ts');
const corrected=reviseUnverifiedTranscription(unconfirmed,{...unconfirmed,originalText:'Students need practice.',textConfirmed:false});
validateStudyPayload('essay',corrected,unconfirmed);
assert.equal(corrected.transcriptionHistory[0].originalText,text);
assert.deepEqual(corrected.transcriptionHistory[0].firstReview,partial);
assert.throws(()=>validateStudyPayload('essay',{...corrected,transcriptionHistory:[]},unconfirmed),/历史/);
assert.throws(()=>validateStudyPayload('essay',{...original,textConfirmed:false},original),/尚未核对/);
console.log('PASS: provisional OCR correction preserves old review and rejects lost history or unverified full score.');

