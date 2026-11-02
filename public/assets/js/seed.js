export function makeSeed() {
  const users = [
    {id:'t1',name:'Анна Миронова',email:'mironova@example.test',roles:['teacher','curator'],groupId:null},
    {id:'t2',name:'Денис Орлов',email:'orlov@example.test',roles:['curator'],groupId:null},
    {id:'s1',name:'Марк Соколов',email:'sokolov@example.test',roles:['student','leader'],groupId:'g3'},
    {id:'s2',name:'Алиса Белова',email:'belova@example.test',roles:['student'],groupId:'g1'},
    {id:'s3',name:'Илья Волков',email:'volkov@example.test',roles:['student'],groupId:'g1'},
    {id:'s4',name:'Софья Лебедева',email:'lebedeva@example.test',roles:['student'],groupId:'g2'},
    {id:'s5',name:'Егор Ким',email:'kim@example.test',roles:['student'],groupId:'g3'},
    {id:'a1',name:'Алексей Морозов',email:'admin@example.test',roles:['admin'],groupId:null},
  ];
  const groups = [
    {id:'g1',name:'ИВТ-24-1',faculty:'Информационные технологии',curatorId:'t1',leaderId:'s3'},
    {id:'g2',name:'ПИ-23-1',faculty:'Прикладная информатика',curatorId:'t2',leaderId:null},
    {id:'g3',name:'ЭК-24-1',faculty:'Экономика и управление',curatorId:null,leaderId:'s1'},
    {id:'g4',name:'ЮР-25-1',faculty:'Юриспруденция',curatorId:null,leaderId:null},
  ];
  users.find(u=>u.id==='s3').roles.push('leader');
  const event = (id,title,type,day,start,end,limit,extra={}) => ({id,title,type,description:'Приглашаем студентов присоединиться к университетской команде. Познакомимся с задачами, распределим роли и подготовимся вместе. Опыт не требуется — всему научим на месте.',location:'Главный корпус · аудитория 204',startsAt:`2026-11-${day}T${start}:00+11:00`,endsAt:`2026-11-${day}T${end}:00+11:00`,limit,authorId:'t1',lifecycle:'active',audience:'selected',groupIds:['g1','g2','g3'],needsRefill:false,...extra});
  const requests = [
    event('e1','День открытых дверей','event','05','10:00','14:00',12,{description:'Поможем будущим студентам познакомиться с университетом. Встречаем гостей, проводим экскурсии по корпусу и рассказываем о студенческой жизни.',location:'Главный корпус · холл первого этажа'}),
    event('e2','Подготовка лаборатории к практикуму','help','07','14:00','16:00',2,{groupIds:['g1'],location:'Корпус Б · лаборатория 312'}),
    event('e3','Научный квиз «За пределами учебника»','event','12','17:00','19:00',null),
    event('e4','Оцифровка университетского архива','help','09','12:00','15:00',4,{needsRefill:true,groupIds:['g1','g3'],location:'Научная библиотека'}),
    event('e5','Встреча студенческого клуба','event','14','16:00','18:00',null,{lifecycle:'cancelled',groupIds:['g1']}),
    event('e6','Команда осеннего форума','event','01','10:00','13:00',10,{lifecycle:'completed',startsAt:'2026-10-20T10:00:00+11:00',endsAt:'2026-10-20T13:00:00+11:00',groupIds:['g1']}),
  ];
  const approvals = [];
  for(const e of requests) for(const groupId of e.groupIds) {
    const decision = e.id==='e3' ? 'pending' : e.id==='e1' && groupId==='g2' ? 'pending' : e.id==='e1' && groupId==='g3' ? 'rejected' : 'approved';
    approvals.push({id:`${e.id}-${groupId}`,requestId:e.id,groupId,decision,decidedBy:decision==='pending'?null:(groups.find(g=>g.id===groupId).curatorId || groups.find(g=>g.id===groupId).leaderId)});
  }
  const invitations=[];
  for(const a of approvals.filter(a=>a.decision==='approved')) for(const u of users.filter(u=>u.groupId===a.groupId)) {
    const response = a.requestId==='e2' || a.requestId==='e6' || (a.requestId==='e1'&&u.id==='s3') || (a.requestId==='e4'&&u.id==='s1') ? 'accepted' : 'pending';
    invitations.push({id:`${a.requestId}-${u.id}`,requestId:a.requestId,userId:u.id,groupId:a.groupId,response});
  }
  return {version:1,users,groups,requests,approvals,invitations};
}
