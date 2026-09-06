import type {NextApiRequest,NextApiResponse} from 'next';
import {localTestingApp,requireLocalTester,LOCAL_TESTER_UID} from '../../../../../lib/nora-red-team/localTesting';
import {Meal} from '../../../../../api/firebase/meal/types';
export const config={api:{bodyParser:{sizeLimit:'600kb'}}};
export default async function handler(req:NextApiRequest,res:NextApiResponse){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'||!(await requireLocalTester(req)))return res.status(403).json({error:'Local synthetic tester required.'});
 const b=req.body;
 if(!/^[a-zA-Z0-9-]{10,80}$/.test(b?.id||''))return res.status(400).json({error:'Valid meal reference required.'});
 const ref=localTestingApp().firestore().doc(`users/${LOCAL_TESTER_UID}/mealLogs/${b.id}`);
 if(b.operation==='read'){const snap=await ref.get();return res.json({meal:snap.exists?snap.data():null});}
 if(b.confirmed!==true||typeof b.name!=='string'||!b.name.trim()||b.name.length>500||typeof b.servingSize!=='string'||!b.servingSize.trim()||b.servingSize.length>200||!['calories','protein','fat','carbs'].every(k=>typeof b[k]==='number'&&Number.isFinite(b[k])&&b[k]>=0&&b[k]<=20000))return res.status(400).json({error:'Confirm meal, portions and nutrition values before saving.'});
 if(typeof b.image!=='string'||b.image.length>450000||(b.image&&!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(b.image)))return res.status(400).json({error:'Choose a JPEG, PNG or WebP photo under 300 KB.'});
 try{await ref.firestore.runTransaction(async tx=>{const old=await tx.get(ref);const meal=new Meal({id:b.id,name:b.name.trim(),servingSize:b.servingSize.trim(),categories:[],ingredients:[],caption:'Synthetic Nora chat meal',calories:b.calories,protein:b.protein,fat:b.fat,carbs:b.carbs,image:b.image,entryMethod:'text',createdAt:old.data()?.createdAt||new Date(),updatedAt:new Date()});tx.set(ref,{...meal.toDictionary(),nutritionSource:b.nutritionSource==='ai_estimate'?'ai_estimate':'user_entered',nutritionAssumptions:typeof b.nutritionAssumptions==='string'?b.nutritionAssumptions.slice(0,600):'',synthetic:true,photoSource:b.image?'user_upload':'none'});});const saved=await ref.get();return res.json({meal:saved.data(),status:'logged'});}catch{return res.status(500).json({error:'Meal was not confirmed saved. Try again.'});}
}
