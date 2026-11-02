import test from 'node:test';
import assert from 'node:assert/strict';
import {DemoProvider} from '../public/assets/js/demo-provider.js';
import {validateRequest,overlap} from '../public/assets/js/domain.js';
import {HttpProvider} from '../public/assets/js/http-provider.js';
import {esc} from '../public/assets/js/ui.js';
const provider=()=>new DemoProvider({storage:null,delay:0});
const request=(extra={})=>({title:'Проверка сквозного сценария',description:'Вымышленная заявка для проверки.',type:'help',startsAt:'2026-11-16T10:00:00+11:00',endsAt:'2026-11-16T12:00:00+11:00',audience:'selected',groupIds:['g1'],limit:1,location:'Библиотека',...extra});

test('автор → куратор → студент → отчёт → лимит → отмена → добор',async()=>{
 const api=provider(),e=await api.createRequest(request());
 assert.equal(e.status,'awaiting_approvals');
 await api.setActor('s2');assert.equal((await api.getWorkspace()).invitations.some(i=>i.requestId===e.id),false);
 await api.setActor('t1');await api.decideGroup(`${e.id}-g1`,'approved');
 await api.setActor('s2');await api.respondInvitation(`${e.id}-s2`,'accept');await api.respondInvitation(`${e.id}-s2`,'accept');
 await api.setActor('s3');assert.equal((await api.getWorkspace()).invitations.find(i=>i.requestId===e.id).state,'full');
 await assert.rejects(api.respondInvitation(`${e.id}-s3`,'accept'),{code:'CAPACITY_FULL'});
 await api.setActor('t1');const report=await api.getRequest(e.id);assert.equal(report.request.participantCount,1);assert.equal(report.request.status,'full');assert.equal(report.request.lifecycle,'active');
 await api.setActor('s2');await api.respondInvitation(`${e.id}-s2`,'withdraw');
 await api.setActor('s3');await api.respondInvitation(`${e.id}-s3`,'accept');
 await api.setActor('t1');assert.equal((await api.getRequest(e.id)).request.participantCount,1);
});
test('только куратор при его наличии; отказ не передаётся старосте',async()=>{
 const api=provider(),e=await api.createRequest(request());await api.setActor('s3');
 await assert.rejects(api.decideGroup(`${e.id}-g1`,'approved'),{code:'FORBIDDEN'});
 await api.setActor('t1');await api.decideGroup(`${e.id}-g1`,'rejected');
 await api.setActor('s3');assert.equal((await api.getWorkspace()).approvals.some(a=>a.requestId===e.id),false);
 assert.equal((await api.getWorkspace()).invitations.some(i=>i.requestId===e.id),false);
});
test('староста без куратора совмещает оба кабинета',async()=>{
 const api=provider(),e=await api.createRequest(request({groupIds:['g3']}));await api.setActor('s1');
 await api.decideGroup(`${e.id}-g3`,'approved');const w=await api.getWorkspace();
 assert(w.viewer.roles.includes('student'));assert(w.viewer.roles.includes('leader'));assert(w.invitations.some(i=>i.requestId===e.id));
});
test('пересечения отклоняются, причины не раскрываются автору',async()=>{
 const api=provider(),a=await api.createRequest(request({limit:null})),b=await api.createRequest(request({limit:null}));
 await api.decideGroup(`${a.id}-g1`,'approved');await api.decideGroup(`${b.id}-g1`,'approved');
 await api.setActor('s2');await api.respondInvitation(`${a.id}-s2`,'accept');
 assert.equal((await api.getWorkspace()).invitations.find(i=>i.requestId===b.id).response,'declined');
 const c=await (async()=>{await api.setActor('t1');const c=await api.createRequest(request({limit:null}));await api.decideGroup(`${c.id}-g1`,'approved');return c;})();
 await api.setActor('s2');await assert.rejects(api.respondInvitation(`${c.id}-s2`,'accept'),{code:'TIME_CONFLICT'});
 await api.setActor('t1');const report=await api.getRequest(b.id);const row=report.responses.find(r=>r.userId==='s2');
 assert.deepEqual(Object.keys(row).sort(),['groupId','id','name','response','userId']);assert.equal(row.response,'declined');
});
test('валидирует даты, нулевой/дробный лимит, группы и расписание',async()=>{
 const api=provider();for(const input of [request({limit:0}),request({limit:1.5}),request({groupIds:[]}),request({endsAt:'2026-11-15T10:00:00+11:00'})])assert.throws(()=>validateRequest(input),{code:'VALIDATION_ERROR'});
 assert.equal(validateRequest(request({limit:null})).limit,null);
 await assert.rejects(api.createRequest(request({audience:'free'})),{code:'SCHEDULE_UNAVAILABLE'});
 assert.deepEqual((await api.createRequest(request({audience:'free',demoSchedule:true}))).groupIds,['g1','g3']);
 assert.equal(overlap(request(),request({startsAt:'2026-11-16T12:00:00+11:00',endsAt:'2026-11-16T13:00:00+11:00'})),false);
});
test('отменённая заявка блокирует новые ответы',async()=>{
 const api=provider();await api.setActor('s2');await assert.rejects(api.respondInvitation('e5-s2','accept'),{code:'STATE_CHANGED'});
});
test('администратор редактирует пользователей, роли и группы',async()=>{
 const api=provider();await api.setActor('a1');const group=await api.saveGroup({name:'ТЕСТ-26',faculty:'Демо',curatorId:null,leaderId:null});
 const u=await api.saveUser({name:'Тестовый Студент',email:'test@example.test',groupId:group.id,roles:['student','leader']});
 await api.saveGroup({...group,leaderId:u.id});
 await assert.rejects(api.saveUser({...u,roles:['leader']}),{code:'VALIDATION_ERROR'});
 await assert.rejects(api.saveUser({...u,groupId:null}),{code:'VALIDATION_ERROR'});
 assert.equal((await api.getWorkspace()).groups.find(g=>g.id===group.id).leaderId,u.id);
});
test('ошибка HTTP не заменяется демоданными',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>({ok:false,json:async()=>({error:{code:'CAPACITY_FULL',message:'Мест нет'}})});
 try{await assert.rejects(new HttpProvider('/api/v1').respondInvitation('1','accept'),{code:'CAPACITY_FULL'});}finally{globalThis.fetch=original;}
});
test('экраны пустых данных, ошибки и имитации гонки доступны явно',async()=>{
 const api=provider();await api.setScenario('empty');assert.equal((await api.getWorkspace()).requests.length,0);
 await api.setScenario('error');await assert.rejects(api.getWorkspace(),{code:'NETWORK_ERROR'});assert((await api.getWorkspace()).requests.length);
 await api.setActor('s2');await api.setScenario('last_place');await assert.rejects(api.respondInvitation('e1-s2','accept'),{code:'CAPACITY_FULL'});
 assert.equal((await api.getWorkspace()).invitations.find(i=>i.id==='e1-s2').response,'pending');
});
test('HTTP повтор после разрыва использует тот же ключ логической операции',async()=>{
 const original=globalThis.fetch,keys=[];let fail=true;
 globalThis.fetch=async(url,options)=>{keys.push(options.headers['Idempotency-Key']);if(fail){fail=false;throw Error('offline');}return {ok:true,status:200,json:async()=>({data:{id:'new'}})};};
 try{const api=new HttpProvider('/api/v1');await assert.rejects(api.createRequest(request()),{code:'NETWORK_ERROR'});await api.createRequest(request());assert.equal(keys[0],keys[1]);}finally{globalThis.fetch=original;}
});
test('пользовательская разметка экранируется как текст',()=>{
 assert.equal(esc('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});
