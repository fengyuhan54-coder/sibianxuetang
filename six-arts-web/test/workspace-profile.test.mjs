import {test} from 'node:test';
import assert from 'node:assert/strict';
import {conversationRecords,latestConversationAssessment,storeConversationAssessment} from '../public/studio.js';

test('profile evidence uses only the supplied conversation, excludes failed and unfinished turns and navigation',()=>{
 const current={id:'current',messages:[{role:'user',content:'我认为需要检验证据。'},{role:'assistant',content:'为什么？'},{role:'user',content:'一次失败的回答'},{role:'assistant',error:'network'},{role:'user',content:'正在等待回复'},{role:'assistant',pending:true},{role:'user',content:'进入下一环节：论证分析'},{role:'assistant',content:'欢迎'},{role:'user',content:'理由需要与结论相关。'},{role:'assistant',content:'好的'}]};
 assert.deepEqual(conversationRecords(current),['我认为需要检验证据。','理由需要与结论相关。']);
 assert.deepEqual(conversationRecords(null),[]);
 assert.equal(conversationRecords({messages:Array.from({length:30},(_,i)=>({role:'user',content:'当前会话发言'+i}))}).length,20);
});
test('empty/new conversation never displays any historical or unscoped profile',()=>{
 const rows=[{id:'old',session:'old',kind:'profile',time:9},{id:'legacy',kind:'profile',time:10},{id:'baseline',session:'current',kind:'profile',baseline:true,time:11}];
 assert.equal(latestConversationAssessment(rows,null),null);assert.equal(latestConversationAssessment(rows,'current'),null);
 rows.push({id:'new',session:'current',kind:'profile',time:1},{id:'six',session:'current',kind:'socratic',time:2});
 assert.equal(latestConversationAssessment(rows,'current').id,'new');assert.equal(latestConversationAssessment(rows,'current','socratic').id,'six');
});
test('refresh replaces the current profile using a stable id while retaining other conversations, baselines, and six-dimensional feedback',()=>{
 const rows=[{id:'old',session:'old',kind:'profile',time:99},{id:'initial',session:'current',kind:'profile',baseline:true,time:0},{id:'profile',session:'current',kind:'profile',time:1},{id:'six',session:'current',kind:'socratic',time:2}];
 const result=storeConversationAssessment(rows,{id:'temporary',session:'current',kind:'profile',time:3,records:['当前发言']});
 assert.equal(result.id,'profile');assert.equal(rows.length,4);assert.deepEqual(rows.find(r=>r.id==='profile').records,['当前发言']);assert.equal(rows[0].session,'old');assert.equal(rows[1].baseline,true);assert.equal(rows[3].kind,'socratic');
 storeConversationAssessment(rows,{id:'again',session:'current',kind:'profile',time:4});assert.equal(rows.length,4);assert.equal(latestConversationAssessment(rows,'current').id,'profile');
});
