import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

const require=createRequire(import.meta.url);
const root=path.resolve(process.argv[2] || '../pokemon-review/source');
const output=path.resolve(process.argv[3] || './POKEMON_Sharp_Screenshots');
let chromium;
try { ({chromium}=await import('playwright')); }
catch { ({chromium}=await import(pathToFileURL(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright/index.mjs')).href)); }
const launch={headless:true};
if(process.env.POKEMON_CHROMIUM){
 launch.executablePath=process.env.POKEMON_CHROMIUM;
 launch.args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'];
}
await fs.mkdir(path.join(output,'details'),{recursive:true});
await fs.mkdir(path.join(output,'full'),{recursive:true});
const template=await fs.readFile(path.join(root,'templates/layout.php'),'utf8');
const settings=JSON.stringify({mode:'demo',apiBase:'/api/v1',timezone:'Asia/Magadan'}).replaceAll('"','&quot;');
const html=template.replace(/<\?=\s*htmlspecialchars\([\s\S]*?\?>/,settings);
const mime={'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;}
  const file=path.resolve(root,'public','.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(path.join(root,'public')+path.sep)){res.writeHead(403).end();return;}
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
  res.end(await fs.readFile(file));
 }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch(launch);
const context=await browser.newContext({viewport:{width:1280,height:1000},deviceScaleFactor:3,locale:'ru-RU',timezoneId:'Asia/Magadan',reducedMotion:'reduce'});
const page=await context.newPage();
page.setDefaultTimeout(12000);
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
const manifest={createdAt:new Date().toISOString(),method:'Re-rendered original HTML/CSS/JS in isolated demo browser; native PNG capture, no image upscaling or AI retouch.',deviceScaleFactor:3,shots:[]};
const title='День науки: команда организаторов';
const description='Поможем провести День науки: встретим гостей, подготовим стенды и сопроводим участников. Опыт не нужен — перед началом проведём инструктаж.';
let id;

async function stable(){
 await page.evaluate(()=>document.fonts.ready);
 await page.locator('#toast').waitFor({state:'hidden',timeout:6000});
 await page.mouse.move(0,0);
}
async function save(name,options={}){
 await stable();
 const file=path.join(output,name);
 const bytes=await page.screenshot({path:file,type:'png',scale:'device',animations:'disabled',caret:'hide',...options});
 const size={width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
 manifest.shots.push({file:name,viewport:page.viewportSize(),pixels:size,clip:options.clip||null});
 console.log(name,`${size.width}x${size.height}`);
}
async function box(selector){return await page.locator(selector).boundingBox();}
async function range(name,startSelector,endSelector){
 await page.evaluate(()=>scrollTo(0,0));
 const a=await box(startSelector),b=await box(endSelector);
 assert(a&&b,`Missing capture elements: ${name}`);
 const main=await box('#main');
 const x=Math.max(0,Math.floor(Math.min(a.x,b.x)-14));
 const y=Math.max(0,Math.floor(a.y-14));
 const right=Math.min(page.viewportSize().width,Math.ceil(Math.max(a.x+a.width,b.x+b.width)+14));
 const bottom=Math.ceil(b.y+b.height+14);
 await save(name,{clip:{x,y,width:right-x,height:bottom-y}});
}
async function full(name){await save('full/'+name);}
async function actor(user){
 await page.locator('[data-action="demo-settings"]').click();
 await page.locator('#demo-actor').selectOption(user);
 await page.locator('[data-action="apply-demo"]').click();
 await page.locator('#modal').waitFor({state:'hidden'});
 await page.waitForFunction(user=>{
  const names={t1:'Анна Миронова',t2:'Денис Орлов',s1:'Марк Соколов',s2:'Алиса Белова',s3:'Илья Волков',s4:'Софья Лебедева'};
  return document.querySelector('.profile-button')?.textContent.includes(names[user]);
 },user);
}
async function groupDecision(user,group,decision){
 await actor(user);
 await page.locator('[data-page="approvals"]').click();
 const action=decision==='approved'?'approve':'reject';
 await page.locator(`[data-action="${action}"][data-id="${id}-${group}"]`).click();
 if(decision==='rejected')await page.locator('[data-action="confirm-reject"]').click();
 await page.waitForFunction(({id,group,decision})=>JSON.parse(localStorage.getItem('pokemon.demo.v1')).approvals.some(x=>x.requestId===id&&x.groupId===group&&x.decision===decision),{id,group,decision});
 await page.locator(`[data-action="${action}"][data-id="${id}-${group}"]`).waitFor({state:'hidden'});
}
async function response(user,action){
 await actor(user);
 await page.locator('[data-page="invitations"]').click();
 await page.locator(`[data-action="${action}"][data-id="${id}-${user}"]`).click();
 await page.waitForFunction(({id,user,action})=>JSON.parse(localStorage.getItem('pokemon.demo.v1')).invitations.some(x=>x.requestId===id&&x.userId===user&&x.response===(action==='accept'?'accepted':'declined')),{id,user,action});
 await page.locator(`[data-action="${action}"][data-id="${id}-${user}"]`).waitFor({state:'hidden'});
}

try{
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.locator('[data-action="create"]').first().waitFor();
 await page.locator('[data-action="create"]').first().click();
 for(const [name,value] of Object.entries({title,description,location:'Главный корпус · актовый зал',startsAt:'2026-11-18T10:00',endsAt:'2026-11-18T13:00',limit:'4'}))await page.locator(`[name="${name}"]`).fill(value);
 for(const group of ['g1','g2','g3'])await page.locator(`[name="groupIds"][value="${group}"]`).check();
 await page.locator('#modal').evaluate(e=>e.scrollTop=0);
 const modal=await box('#modal');
 const dates=await page.locator('#request-form .form-columns').nth(1).boundingBox();
 await save('02-create-details.png',{clip:{x:Math.floor(modal.x+12),y:Math.floor(modal.y+12),width:Math.ceil(modal.width-24),height:Math.ceil(dates.y+dates.height+14-modal.y-12)}});
 await full('02-create-details.png');
 await page.locator('#modal').evaluate(e=>e.scrollTop=e.scrollHeight);
 const fieldset=await box('#request-form fieldset'),footer=await box('#request-form .form-footer');
 await save('03-create-audience.png',{clip:{x:Math.floor(modal.x+12),y:Math.floor(fieldset.y-12),width:Math.ceil(modal.width-24),height:Math.ceil(footer.y+footer.height+14-fieldset.y+12)}});
 await full('03-create-audience.png');
 await page.locator('#request-form [type="submit"]').click();
 await page.locator('[data-action="edit"]').waitFor();
 id=await page.locator('[data-action="edit"]').getAttribute('data-id');
 assert(id);
 await stable();
 await page.setViewportSize({width:930,height:1000});
 await actor('t2');
 const card=page.locator('.approval-card').filter({hasText:title});
 await card.scrollIntoViewIfNeeded();
 await stable();
 const cardBytes=await card.screenshot({path:path.join(output,'04-curator-decision.png'),type:'png',scale:'device',animations:'disabled'});
 manifest.shots.push({file:'04-curator-decision.png',viewport:page.viewportSize(),pixels:{width:cardBytes.readUInt32BE(16),height:cardBytes.readUInt32BE(20)}});
 console.log('04-curator-decision.png saved');
 await full('04-curator-decision.png');
 await page.locator(`[data-action="approve"][data-id="${id}-g2"]`).click();
 await page.waitForFunction(id=>JSON.parse(localStorage.getItem('pokemon.demo.v1')).approvals.some(x=>x.id===id+'-g2'&&x.decision==='approved'),id);
 await page.locator(`[data-action="approve"][data-id="${id}-g2"]`).waitFor({state:'hidden'});
 await actor('s4');
 await range('05-student-invitation.png','.page-heading','.student-grid');
 await full('05-student-invitation.png');
 await page.locator(`[data-action="accept"][data-id="${id}-s4"]`).click();
 await page.locator(`[data-action="withdraw"][data-id="${id}-s4"]`).waitFor();
 await range('06-student-confirmed.png','.page-heading','.student-grid');
 await full('06-student-confirmed.png');
 await groupDecision('t1','g1','approved');
 await response('s2','accept');
 await response('s3','decline');
 await groupDecision('s1','g3','rejected');
 await actor('t1');
 await page.setViewportSize({width:1280,height:1000});
 await range('01-teacher-workspace.png','.page-heading','.request-card:nth-child(2)');
 await full('01-teacher-workspace.png');
 await page.setViewportSize({width:930,height:1000});
 await page.locator(`[data-detail="${id}"]`).first().click();
 await page.locator('[data-detail-tab="groups"]').click();
 await range('07-teacher-group-decisions.png','.page-heading','#main > .panel');
 await full('07-teacher-group-decisions.png');
 await range('details/07-group-decisions-table.png','#main > .panel','#main > .panel');
 await page.locator('[data-detail-tab="responses"]').click();
 await range('08-teacher-student-responses.png','.page-heading','#main > .panel');
 await full('08-teacher-student-responses.png');
 await range('details/08-student-responses-table.png','#main > .panel','#main > .panel');
 assert.equal(await page.locator('#main tbody tr').count(),3);
 assert.equal(await page.locator('#main tbody .badge.accepted').count(),2);
 assert.equal(await page.locator('#main tbody .badge.declined').count(),1);
 await actor('s4');
 await page.setViewportSize({width:390,height:900});
 await page.evaluate(()=>scrollTo(0,0));
 await save('09-mobile-student.png');
 await fs.writeFile(path.join(output,'demo-state.json'),await page.evaluate(()=>localStorage.getItem('pokemon.demo.v1')));
 assert.deepEqual(errors,[],'No JavaScript errors expected');
 manifest.browserVersion=await browser.version();
 manifest.validation={javascriptErrors:errors,studentResponses:3,accepted:2,declined:1};
 await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2));
 console.log('All screenshots saved. Scenario and browser errors checked.');
}finally{
 await browser.close();
 await new Promise(r=>server.close(r));
}
