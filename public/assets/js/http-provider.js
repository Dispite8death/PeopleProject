import {ApiError} from './domain.js';
export class HttpProvider {
  constructor(base){this.base=base.replace(/\/$/,'');this.pendingKeys=new Map();}
  async call(path,method='GET',body){
    let response;
    const serialized=body?JSON.stringify(body):undefined,signature=`${method} ${path} ${serialized||''}`;
    if(body&&!this.pendingKeys.has(signature))this.pendingKeys.set(signature,crypto.randomUUID());
    try {response=await fetch(this.base+path,{method,credentials:'same-origin',headers:{Accept:'application/json',...(body?{'Content-Type':'application/json','Idempotency-Key':this.pendingKeys.get(signature)}:{} )},body:serialized,signal:AbortSignal.timeout(15000)});}
    catch {throw new ApiError('NETWORK_ERROR','Сервер недоступен. Изменения не подтверждены. Повторите попытку.');}
    let payload;try{payload=await response.json();}catch{throw new ApiError('INVALID_RESPONSE','Сервер вернул некорректный ответ.');}
    if(response.ok||response.status<500)this.pendingKeys.delete(signature);
    if(!response.ok) throw new ApiError(payload.error?.code||'HTTP_ERROR',payload.error?.message||'Не удалось выполнить запрос.',payload.error?.fields||{});
    return payload.data;
  }
  getWorkspace(){return this.call('/workspace');}
  getRequest(id){return this.call(`/requests/${encodeURIComponent(id)}`);}
  createRequest(data){const {demoSchedule,...payload}=data;return this.call('/requests','POST',payload);}
  updateRequest(id,data){return this.call(`/requests/${encodeURIComponent(id)}`,'PATCH',data);}
  changeLifecycle(id,action){return this.call(`/requests/${encodeURIComponent(id)}/${action}`,'POST',{});}
  decideGroup(id,decision){return this.call(`/group-approvals/${encodeURIComponent(id)}/decision`,'POST',{decision});}
  respondInvitation(id,action){return this.call(`/invitations/${encodeURIComponent(id)}/response`,'POST',{action});}
  saveUser(data){return this.call(`/admin/users${data.id?'/'+encodeURIComponent(data.id):''}`,data.id?'PATCH':'POST',data);}
  saveGroup(data){return this.call(`/admin/groups${data.id?'/'+encodeURIComponent(data.id):''}`,data.id?'PATCH':'POST',data);}
}
