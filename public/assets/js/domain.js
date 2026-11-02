export class ApiError extends Error {
  constructor(code,message,fields={}) {super(message);this.code=code;this.fields=fields;}
}
export const overlap = (a,b) => new Date(a.startsAt)<new Date(b.endsAt)&&new Date(b.startsAt)<new Date(a.endsAt);
export function validateRequest(input) {
  const fields={};
  if(!input.title?.trim() || input.title.trim().length>160) fields.title='Введите название от 1 до 160 символов.';
  if(!input.description?.trim() || input.description.length>5000) fields.description='Добавьте описание до 5000 символов.';
  if(!['help','event'].includes(input.type)) fields.type='Выберите тип заявки.';
  if(!['all','selected','free'].includes(input.audience)) fields.audience='Выберите аудиторию.';
  if(input.audience==='selected' && !input.groupIds?.length) fields.groupIds='Выберите хотя бы одну группу.';
  if(!Number.isFinite(Date.parse(input.startsAt)) || !Number.isFinite(Date.parse(input.endsAt)) || Date.parse(input.endsAt)<=Date.parse(input.startsAt)) fields.endsAt='Окончание должно быть позже начала.';
  if(input.limit!==null && (!Number.isInteger(input.limit)||input.limit<=0)) fields.limit='Укажите целое положительное число или оставьте поле пустым.';
  if(Object.keys(fields).length) throw new ApiError('VALIDATION_ERROR','Проверьте поля формы.',fields);
  return {...input,title:input.title.trim(),description:input.description.trim()};
}
export const roleNames={teacher:'Преподаватель',curator:'Куратор',leader:'Староста',student:'Студент',admin:'Администратор'};
export const statusNames={awaiting_approvals:'Ожидает согласований',open:'Идёт набор',full:'Места заполнены',refill:'Нужен добор',cancelled:'Отменено',completed:'Завершено'};
export const responseNames={pending:'Ожидает ответа',accepted:'Участие подтверждено',declined:'Отказ',withdrawn:'Участие отменено',full:'Мест больше нет',cancelled:'Мероприятие отменено',completed:'Мероприятие завершено'};
