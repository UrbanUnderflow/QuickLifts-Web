export function mayReuseAdministrativeEntry(payload:any,uid:string,membershipId:string,documents:any[]){
 if(payload?.skipEntry!==true||payload.baselineComplete!==true||payload.healthSharingAllowed!==false||payload.reuseType!=='administrative-entry-routing-only'||payload.userId!==uid||payload.membershipId!==membershipId||!Array.isArray(payload.documents)||!documents.length||payload.documents.length!==documents.length)return false;
 return documents.every(d=>{const found=payload.documents.filter((x:any)=>x.id===d.id);return found.length===1&&['id','title','body','version'].every(k=>found[0][k]===d[k])&&found[0].category===(d.category||(d.id.includes('research')?'research':'participation'))&&found[0].studySpecific===(d.studySpecific===true);});
}
