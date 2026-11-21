import assert from 'node:assert/strict';
import {allowedOrigin,AuthLimiter} from '../lan/auth-policy.mjs';
const origins=new Set(['https://exam.example.test']);
assert.equal(allowedOrigin('https://exam.example.test','https://exam.example.test:8443',origins),true);
assert.equal(allowedOrigin('https://exam.example.test:8443','https://exam.example.test',new Set(['https://exam.example.test:8443'])),true);
assert.equal(allowedOrigin('https://other.test','https://exam.example.test:8443',origins),false);
assert.equal(allowedOrigin('https://exam.example.test','https://other.test',origins),false);
assert.equal(allowedOrigin('https://exam.example.test:9000','https://exam.example.test:8443',origins),false);
assert.equal(allowedOrigin('http://exam.example.test','https://exam.example.test',origins),false);
assert.equal(allowedOrigin(null,'https://exam.example.test',origins),false);
assert.equal(allowedOrigin('https://exam.example.test/path','https://exam.example.test',origins),false);
let now=0;const limiter=new AuthLimiter(()=>now);
for(let i=0;i<30;i++){assert.equal(limiter.login('shared-router','person'+i),true);limiter.success('shared-router','person'+i);}
for(let i=0;i<8;i++){assert.equal(limiter.login('shared-router','bad'),true);limiter.failed('shared-router','bad');}
assert.equal(limiter.login('shared-router','bad'),false);
assert.equal(limiter.login('shared-router','other'),true);
now=300001;assert.equal(limiter.login('shared-router','bad'),true);
for(let i=0;i<12;i++)assert.equal(limiter.register('shared-router'),true);
assert.equal(limiter.register('shared-router'),false);
assert.equal(limiter.login('shared-router','new'),true);
console.log('PASS: explicit proxy origins, cross-site rejection, shared-router sign-ins, scoped failed-login limit, expiry and separate registration limit.');

