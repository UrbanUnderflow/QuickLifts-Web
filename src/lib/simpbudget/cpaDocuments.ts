import type {User} from 'firebase/auth';

export type CPADocument={id:string;year:number;topicId:number;fileName:string;mimeType:string;size:number;sha256:string;attachedAt:string};
type DocumentResponse={documents?:CPADocument[];document?:CPADocument;dataBase64?:string};
export async function requestCPADocuments(user:User,body:unknown):Promise<DocumentResponse>{
 const token=await user.getIdToken();
 const response=await fetch('/.netlify/functions/simpbudget-cpa-document',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body),cache:'no-store'});
 const result=await response.json();
 if(!response.ok)throw Error(result.error||'Private documents are unavailable. Please retry.');
 return result;
}
export async function fileToBase64(file:File):Promise<string>{
 if(file.size>4*1024*1024)throw Error('Choose a document up to 4 MB.');
 const bytes=new Uint8Array(await file.arrayBuffer());let binary='';
 for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
 return btoa(binary);
}
export function documentBytes(encoded:string):Uint8Array{return Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));}
export async function readCPADocument(user:User,year:number,id:string){
 const result=await requestCPADocuments(user,{action:'read',year,documentId:id});
 if(!result.document||!result.dataBase64)throw Error('The document could not be retrieved.');
 const bytes=documentBytes(result.dataBase64);
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as BufferSource))).map(v=>v.toString(16).padStart(2,'0')).join('');
 if(result.document.id!==id||result.document.year!==year||bytes.length!==result.document.size||digest!==result.document.sha256)throw Error('Document integrity check failed.');
 return {document:result.document,bytes};
}
export async function downloadCPADocument(user:User,year:number,id:string){
 const {document:metadata,bytes}=await readCPADocument(user,year,id);
 const url=URL.createObjectURL(new Blob([bytes as BlobPart],{type:metadata.mimeType}));
 const link=document.createElement('a');link.href=url;link.download=metadata.fileName;link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
// This module never imports an AI client. PDF bytes/text stay in this browser.
// The PDF parser and worker are bundled on our own origin, with evaluation disabled.
export async function inspectLocalPDF(file:File):Promise<string>{
 if(file.size>4*1024*1024)throw Error('Choose a PDF up to 4 MB for local inspection.');
 const data=new Uint8Array(await file.arrayBuffer());
 if(new TextDecoder().decode(data.subarray(0,5))!=='%PDF-')throw Error('Local text inspection supports PDF files. Images and scanned PDFs need manual review.');
 const moduleUrl='/vendor/pdfjs-5.6.205/pdf.min.mjs';
 const pdfjs=await import(/* webpackIgnore: true */ moduleUrl);
 pdfjs.GlobalWorkerOptions.workerSrc='/vendor/pdfjs-5.6.205/pdf.worker.min.mjs';
 const task=pdfjs.getDocument({data,isEvalSupported:false,disableFontFace:true,useSystemFonts:false});
 try{
  const pdf=await task.promise;
  if(pdf.numPages>100)throw Error('Local inspection supports up to 100 pages.');
  let text='',characters=0;
  for(let p=1;p<=pdf.numPages;p++){
   const page=await pdf.getPage(p),content=await page.getTextContent();
   const pageText=content.items.map((item:{str?:string})=>item.str||'').join(' ');characters+=pageText.trim().length;
   text+=`Page ${p}\n`+pageText+'\n\n';
   if(text.length>100000)return text.slice(0,100000)+'\n[Preview limited to 100,000 characters.]';
  }
  if(!characters)throw Error('This PDF has no extractable text. Scanned pages need manual review; no cloud OCR was used.');
  return text;
 }finally{await task.destroy();}
}
