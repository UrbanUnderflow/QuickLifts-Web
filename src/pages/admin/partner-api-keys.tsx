import React,{useCallback} from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import PartnerApiKeysWorkspace from '../../components/developer/PartnerApiKeysWorkspace';
import {auth} from '../../api/firebase/config';
export default function PartnerApiKeysPage(){
 const request=useCallback(async(body?:Record<string,unknown>,query?:Record<string,string>)=>{const user=auth.currentUser;if(!user)throw new Error('Sign in as an administrator to manage API keys.');const response=await fetch('/api/admin/partner-api-keys'+(query?'?'+new URLSearchParams(query).toString():''),{method:body?'POST':'GET',headers:{Authorization:`Bearer ${await user.getIdToken()}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not complete the API access request.');return data;},[]);
 return <AdminRouteGuard><Head><title>Partner API keys | Pulse Admin</title></Head><PartnerApiKeysWorkspace request={request}/></AdminRouteGuard>;
}
