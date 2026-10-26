import {test} from 'node:test';
import assert from 'node:assert/strict';
import {connectionError,ModelError} from '../model.mjs';

test('network failures report actionable categories without revealing provider or credential details',()=>{
 const access=connectionError({message:'secret value',cause:{code:'EACCES',message:'private details'}});
 assert.ok(access instanceof ModelError);assert.match(access.message,/网络权限拦截/);assert.doesNotMatch(access.message,/secret|private/);
 assert.match(connectionError({cause:{errors:[{code:'ENOTFOUND'}]}}).message,/解析/);
 assert.match(connectionError({name:'TimeoutError'}).message,/超时/);
 assert.match(connectionError({cause:{code:'ECONNREFUSED'}}).message,/无法连接/);
 const aborted=new Error('stopped');aborted.name='AbortError';assert.equal(connectionError(aborted),aborted);
});
