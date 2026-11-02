import {HttpProvider} from './http-provider.js';
export async function createDataSource(config){
  if(config.mode==='demo') {const {DemoProvider}=await import('./demo-provider.js');return new DemoProvider();}
  if(config.mode==='http') return new HttpProvider(config.apiBase);
  throw new Error('Неизвестный источник данных. Проверьте конфигурацию.');
}
