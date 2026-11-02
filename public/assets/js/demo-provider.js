import {makeSeed} from './seed.js';
import {ApiError,validateRequest,overlap} from './domain.js';

const clone=x=>structuredClone(x);
const KEY='pokemon.demo.v1';
// Browser simulation only. These checks provide no production concurrency or security guarantees.
export class DemoProvider {
  constructor({storage=globalThis.localStorage,delay=160}={}) {
    this.storage=storage;this.delay=delay;this.actorId='t1';this.scenario='normal';
    const saved=storage?.getItem(KEY);
    try {this.state=saved?JSON.parse(saved):makeSeed();if(this.state.version!==1) throw Error();}
    catch {this.state=makeSeed();}
  }
  async pause(){if(this.delay) await new Promise(r=>setTimeout(r,this.delay));}
  save(){this.storage?.setItem(KEY,JSON.stringify(this.state));}
  actor(){return this.state.users.find(u=>u.id===this.actorId);}
  async setActor(id){if(!this.state.users.some(u=>u.id===id)) throw new ApiError('NOT_FOUND','Пользователь не найден.');this.actorId=id;}
  async getDemoActors(){return clone(this.state.users);}
  async reset(){this.state=makeSeed();this.actorId='t1';this.scenario='normal';this.save();}
  async setScenario(value){this.scenario=value;}
  responsible(group){return group.curatorId || group.leaderId;}
  request(id){const e=this.state.requests.find(e=>e.id===id);if(!e) throw new ApiError('NOT_FOUND','Заявка не найдена.');return e;}
  count(id){return this.state.invitations.filter(i=>i.requestId===id&&i.response==='accepted').length;}
  present(e){
    const approvals=this.state.approvals.filter(a=>a.requestId===e.id);
    const count=this.count(e.id);
    const full=e.limit!==null&&count>=e.limit;
    const recruitment=full?'full':e.needsRefill?'refill':approvals.some(a=>a.decision==='approved')?'open':'awaiting_approvals';
    const own=e.authorId===this.actorId;
    return {...clone(e),participantCount:count,recruitment,status:e.lifecycle==='active'?recruitment:e.lifecycle,
      approvalsCount:approvals.filter(a=>a.decision==='approved').length,groupsCount:approvals.length,
      allowedActions:own&&e.lifecycle==='active'?['edit','cancel','complete']:[],
    };
  }
  presentInvite(i){
    const e=this.present(this.request(i.requestId));
    const approved=this.state.approvals.some(a=>a.requestId===e.id&&a.groupId===i.groupId&&a.decision==='approved');
    const state=e.lifecycle!=='active'?e.lifecycle:i.response==='pending'&&e.recruitment==='full'?'full':i.response;
    let allowedActions=[];
    if(e.lifecycle==='active'&&approved) allowedActions=i.response==='accepted'?['withdraw']:i.response==='pending'?(e.recruitment==='full'?['decline']:['accept','decline']):[];
    return {...clone(i),state,request:e,allowedActions};
  }
  async getWorkspace(){
    await this.pause();
    if(this.scenario==='error'){this.scenario='normal';throw new ApiError('NETWORK_ERROR','Не удалось загрузить данные. Проверьте соединение и повторите попытку.');}
    const s=this.state,u=this.actor();
    const approvals=s.approvals.filter(a=>this.responsible(s.groups.find(g=>g.id===a.groupId))===u.id).map(a=>({...clone(a),request:this.present(this.request(a.requestId)),allowedActions:a.decision==='pending'&&this.request(a.requestId).lifecycle==='active'?['approve','reject']:[]}));
    return {viewer:clone(u),groups:clone(s.groups),users:u.roles.includes('admin')?clone(s.users):[],
      requests:this.scenario==='empty'?[]:s.requests.filter(e=>e.authorId===u.id).map(e=>this.present(e)),
      approvals:this.scenario==='empty'?[]:approvals,
      invitations:this.scenario==='empty'?[]:s.invitations.filter(i=>i.userId===u.id).map(i=>this.presentInvite(i)),
      schedule:{connected:false,demoAvailable:true},notifications:[{title:'Добро пожаловать в ПОКЕМОН',text:'Здесь преподаватели и студенты собирают команды для университетских дел.'},{title:'Демонстрационное пространство',text:'Все люди и ответы вымышлены. Письма не отправляются.'}],mode:'demo'};
  }
  async getRequest(id){
    await this.pause();const e=this.request(id),u=this.actor(),s=this.state;
    const representative=s.approvals.some(a=>a.requestId===id&&this.responsible(s.groups.find(g=>g.id===a.groupId))===u.id);
    const invited=s.invitations.some(i=>i.requestId===id&&i.userId===u.id);
    if(e.authorId!==u.id&&!representative&&!invited) throw new ApiError('FORBIDDEN','Нет доступа к заявке.');
    const result={request:this.present(e),author:s.users.find(u=>u.id===e.authorId)?.name,approvals:[],responses:[]};
    if(e.authorId===u.id){
      result.approvals=s.approvals.filter(a=>a.requestId===id).map(a=>({...clone(a),responsibleName:s.users.find(u=>u.id===this.responsible(s.groups.find(g=>g.id===a.groupId)))?.name||null}));
      result.responses=s.invitations.filter(i=>i.requestId===id).map(i=>({id:i.id,userId:i.userId,name:s.users.find(u=>u.id===i.userId)?.name,groupId:i.groupId,response:i.response==='withdrawn'?'declined':i.response}));
    }
    return result;
  }
  async createRequest(data){
    await this.pause();if(!this.actor().roles.includes('teacher')) throw new ApiError('FORBIDDEN','Раздел доступен преподавателю.');
    const valid=validateRequest(data);
    if(valid.audience==='free'&&!valid.demoSchedule) throw new ApiError('SCHEDULE_UNAVAILABLE','Расписание не подключено. Включите демонстрационный пример или выберите другой режим.');
    const id=globalThis.crypto.randomUUID();
    const groupIds=valid.audience==='all'?this.state.groups.map(g=>g.id):valid.audience==='free'?['g1','g3']:valid.groupIds;
    if(groupIds.some(id=>!this.state.groups.some(g=>g.id===id))) throw new ApiError('VALIDATION_ERROR','Группа не найдена.');
    const e={...valid,id,groupIds,authorId:this.actorId,lifecycle:'active',needsRefill:false};
    this.state.requests.unshift(e);
    for(const groupId of groupIds) this.state.approvals.push({id:`${id}-${groupId}`,requestId:id,groupId,decision:'pending',decidedBy:null});
    this.save();return this.present(e);
  }
  async updateRequest(id,data){
    await this.pause();const e=this.request(id);
    if(!this.present(e).allowedActions.includes('edit')) throw new ApiError('FORBIDDEN','Редактирование недоступно.');
    // Changing schedule/audience after publication is intentionally unresolved.
    const valid=validateRequest({...e,...data});
    if(valid.limit!==null&&valid.limit<this.count(id)) throw new ApiError('VALIDATION_ERROR','Лимит меньше числа подтверждённых участников.',{limit:'Увеличьте лимит.'});
    Object.assign(e,{title:valid.title,description:valid.description,location:valid.location,limit:valid.limit});
    this.save();return this.present(e);
  }
  async changeLifecycle(id,action){
    await this.pause();const e=this.request(id);
    if(!this.present(e).allowedActions.includes(action)) throw new ApiError('FORBIDDEN','Действие недоступно.');
    e.lifecycle=action==='cancel'?'cancelled':'completed';this.save();return this.present(e);
  }
  async decideGroup(id,decision){
    await this.pause();const a=this.state.approvals.find(a=>a.id===id);
    if(!a||this.responsible(this.state.groups.find(g=>g.id===a.groupId))!==this.actorId) throw new ApiError('FORBIDDEN','Решение принимает ответственный группы.');
    if(!['approved','rejected'].includes(decision)||a.decision!=='pending'||this.request(a.requestId).lifecycle!=='active') throw new ApiError('STATE_CHANGED','Решение уже принято или заявка закрыта.');
    a.decision=decision;a.decidedBy=this.actorId;
    if(decision==='approved') for(const u of this.state.users.filter(u=>u.groupId===a.groupId&&u.roles.includes('student'))) this.state.invitations.push({id:`${a.requestId}-${u.id}`,requestId:a.requestId,userId:u.id,groupId:a.groupId,response:'pending'});
    this.save();return clone(a);
  }
  async respondInvitation(id,action){
    await this.pause();const i=this.state.invitations.find(i=>i.id===id);
    if(!i||i.userId!==this.actorId) throw new ApiError('FORBIDDEN','Приглашение недоступно.');
    const e=this.request(i.requestId);
    if(action==='accept'&&this.scenario==='last_place'){this.scenario='normal';throw new ApiError('CAPACITY_FULL','Последнее место уже заняли. Обновите приглашения.');}
    if(action==='accept'&&this.scenario==='conflict'){this.scenario='normal';throw new ApiError('TIME_CONFLICT','В это время у вас уже подтверждено участие в другом мероприятии.');}
    if(action==='accept'&&i.response==='accepted') return this.presentInvite(i);
    if(action==='accept'&&e.limit!==null&&this.count(e.id)>=e.limit) throw new ApiError('CAPACITY_FULL','Свободных мест больше нет.');
    if(!this.presentInvite(i).allowedActions.includes(action)) throw new ApiError('STATE_CHANGED','Состояние приглашения изменилось. Обновите список.');
    if(action==='accept') {
      if(this.state.invitations.some(other=>other.userId===i.userId&&other.response==='accepted'&&this.request(other.requestId).lifecycle==='active'&&overlap(e,this.request(other.requestId)))) throw new ApiError('TIME_CONFLICT','У вас уже есть участие в это время.');
      i.response='accepted';
      for(const other of this.state.invitations) if(other.id!==i.id&&other.userId===i.userId&&other.response==='pending'&&this.request(other.requestId).lifecycle==='active'&&overlap(e,this.request(other.requestId))) other.response='declined';
      if(e.limit!==null&&this.count(e.id)>=e.limit) e.needsRefill=false;
    } else if(action==='withdraw'){i.response='withdrawn';e.needsRefill=e.limit!==null;}
    else i.response='declined';
    this.save();return this.presentInvite(i);
  }
  requireAdmin(){if(!this.actor().roles.includes('admin')) throw new ApiError('FORBIDDEN','Требуются права администратора.');}
  async saveUser(data){
    await this.pause();this.requireAdmin();
    if(!data.name.trim()||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)||!data.roles.length) throw new ApiError('VALIDATION_ERROR','Укажите имя, корректный email и хотя бы одну роль.');
    if(data.roles.some(r=>!['teacher','curator','leader','student','admin'].includes(r))) throw new ApiError('VALIDATION_ERROR','Неизвестная роль.');
    if(data.roles.includes('leader')&&!data.roles.includes('student')) throw new ApiError('VALIDATION_ERROR','Староста должен оставаться студентом.');
    if(data.groupId&&!this.state.groups.some(g=>g.id===data.groupId)) throw new ApiError('VALIDATION_ERROR','Группа не найдена.');
    if(this.state.users.some(u=>u.id!==data.id&&u.email.toLowerCase()===data.email.toLowerCase())) throw new ApiError('VALIDATION_ERROR','Этот email уже используется.');
    const existing=this.state.users.find(u=>u.id===data.id);
    if(existing&&this.state.groups.some(g=>(g.curatorId===existing.id&&!data.roles.includes('curator'))||(g.leaderId===existing.id&&(!data.roles.includes('leader')||data.groupId!==g.id)))) throw new ApiError('VALIDATION_ERROR','Сначала измените назначение ответственного в группе.');
    const value={...data,id:existing?.id||globalThis.crypto.randomUUID()};
    if(existing) Object.assign(existing,value);else this.state.users.push(value);this.save();return clone(value);
  }
  async saveGroup(data){
    await this.pause();this.requireAdmin();if(!data.name.trim()) throw new ApiError('VALIDATION_ERROR','Введите название группы.');
    if(this.state.groups.some(g=>g.id!==data.id&&g.name.toLowerCase()===data.name.toLowerCase())) throw new ApiError('VALIDATION_ERROR','Группа с таким названием уже есть.');
    if(data.curatorId&&!this.state.users.some(u=>u.id===data.curatorId&&u.roles.includes('curator'))) throw new ApiError('VALIDATION_ERROR','Выберите пользователя с ролью куратора.');
    if(data.leaderId&&!this.state.users.some(u=>u.id===data.leaderId&&u.roles.includes('leader')&&u.roles.includes('student')&&u.groupId===data.id)) throw new ApiError('VALIDATION_ERROR','Староста должен быть студентом этой группы с ролью старосты.');
    const existing=this.state.groups.find(g=>g.id===data.id),value={...data,id:existing?.id||globalThis.crypto.randomUUID()};
    if(existing) Object.assign(existing,value);else this.state.groups.push(value);this.save();return clone(value);
  }
}
