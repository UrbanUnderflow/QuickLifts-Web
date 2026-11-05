import {auth,getFirebaseModeRequestHeaders} from '../../api/firebase/config';
export async function readAdministrativeEntry(teamId:string){
 const user=auth.currentUser;if(!user)throw Error('Sign in to verify your existing setup.');
 const response=await fetch('/api/pulsecheck/administrative-onboarding?teamId='+encodeURIComponent(teamId),{cache:'no-store',headers:{Authorization:'Bearer '+await user.getIdToken(),...getFirebaseModeRequestHeaders()}});
 if(!response.ok)throw Error('Your existing setup could not be verified. Please retry.');const body=await response.json();if(auth.currentUser?.uid!==user.uid)throw Error('Your account changed. Sign in again.');return body;
}
