const {getFirebaseAdminApp,headers}=require('./config/firebase');
const {runtimeHelpers:{verifyPulseCheckCaller}}=require('./pulsecheck-chat');
const {assessNoraStorage}=require('./utils/noraStoragePolicy');
const {estimateMeal}=require('./utils/noraMealEstimate');
exports.handler=async event=>{
 if(event.httpMethod==='OPTIONS')return {statusCode:200,headers,body:''};
 if(event.httpMethod!=='POST')return {statusCode:405,headers,body:'{}'};
 try{
  await verifyPulseCheckCaller(getFirebaseAdminApp({headers:event.headers||{}}),event);
  const {description,portion=''}=JSON.parse(event.body||'{}');
  if(typeof description!=='string'||!description.trim()||description.length>2000||typeof portion!=='string'||portion.length>300)return {statusCode:400,headers,body:JSON.stringify({error:'Add a meal description.'})};
  const input=description+'\nPortions: '+portion;
  if((await assessNoraStorage(input)).restricted)return {statusCode:422,headers,body:JSON.stringify({error:'Use a description of the food and portions for this estimate.'})};
  return {statusCode:200,headers,body:JSON.stringify({estimate:await estimateMeal(input)})};
 }catch(e){return {statusCode:e.statusCode||503,headers,body:JSON.stringify({error:'The meal estimate is unavailable. Please try again.',code:['Invalid estimate','Invalid ingredient','Empty estimate','Invalid total','Unavailable','Incomplete'].includes(e.message)?e.message:'Estimate failed'})};}
};
