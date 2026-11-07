import React,{useEffect,useRef,useState} from 'react';
import type {User} from 'firebase/auth';
import {requestCPADocuments,fileToBase64,downloadCPADocument,inspectLocalPDF,type CPADocument} from '../../lib/simpbudget/cpaDocuments';
import styles from './CPATopicDocuments.module.css';
type Props={user:User;year:number;topicId:number;disabled?:boolean;onBusyChange?:(busy:boolean)=>void};
const allowed=new Set(['application/pdf','image/png','image/jpeg','image/webp']);
const limit=4*1024*1024;
export default function CPATopicDocuments({user,year,topicId,disabled=false,onBusyChange}:Props){
 const [documents,setDocuments]=useState<CPADocument[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[localText,setLocalText]=useState(''),[localName,setLocalName]=useState('');
 const uploadRef=useRef<HTMLInputElement>(null),inspectRef=useRef<HTMLInputElement>(null),generation=useRef(0),locked=useRef(false),busyCallback=useRef(onBusyChange),identity=useRef(user);
 busyCallback.current=onBusyChange;identity.current=user;
 const context=`${user.uid}|${year}|${topicId}`;
 useEffect(()=>{const sequence=++generation.current;setDocuments([]);setLoading(true);setError('');setNotice('');setLocalText('');setLocalName('');locked.current=false;setBusy(false);busyCallback.current?.(false);
  void requestCPADocuments(identity.current,{action:'list',year,topicId}).then(result=>{if(sequence===generation.current)setDocuments(result.documents||[]);}).catch(e=>{if(sequence===generation.current)setError(e instanceof Error?e.message:'Attachments could not be loaded.');}).finally(()=>{if(sequence===generation.current)setLoading(false);});
  return()=>{generation.current++;busyCallback.current?.(false);};
 },[context,year,topicId]);
 const run=async(operation:(sequence:number)=>Promise<void>)=>{if(disabled||locked.current)return;locked.current=true;const sequence=generation.current;setBusy(true);setError('');setNotice('');busyCallback.current?.(true);try{await operation(sequence);}catch(e){if(sequence===generation.current)setError(e instanceof Error?e.message:'The document could not be processed.');}finally{if(sequence===generation.current){locked.current=false;setBusy(false);busyCallback.current?.(false);}}};
 const attach=(file:File)=>void run(async sequence=>{
  if(!allowed.has(file.type)||!file.size||file.size>limit)throw Error('Choose a nonempty PDF, PNG, JPEG or WebP file up to 4 MB.');
  const dataBase64=await fileToBase64(file);if(sequence!==generation.current)return;
  const result=await requestCPADocuments(identity.current,{action:'attach',year,topicId,fileName:file.name,mimeType:file.type,dataBase64});
  if(sequence!==generation.current)return;if(!result.document)throw Error('The upload response did not confirm a saved document.');const saved=result.document;
  setDocuments(current=>[saved,...current.filter(doc=>doc.id!==saved.id)]);setNotice(`${saved.fileName} is saved privately for ${year}.`);
 });
 const inspect=(file:File)=>void run(async sequence=>{
  if(file.type!=='application/pdf'||!file.size||file.size>limit)throw Error('Choose a nonempty PDF up to 4 MB for local inspection.');
  setLocalText('');setLocalName('');const text=await inspectLocalPDF(file);if(sequence!==generation.current)return;
  setLocalName(file.name);setLocalText(text);setNotice(text.trim()?'Text extracted on this device. It has not been uploaded or added to your answers.':'This PDF has no readable text layer. Scanned pages need manual review; local OCR is not available.');
 });
 return <section aria-label="Topic documents"className={styles.section}>
  <div className={styles.heading}><div><p className={styles.eyebrow}>Supporting documents</p><h3 className={styles.title}>Keep the source close.</h3></div><span className={styles.privacy}>Private attachment · Never sent to AI</span></div>
  <p className={styles.description}>Attach a tax form, receipt or statement to this answer. Files are stored privately in your SimpBudget account for {year}.</p>
  <div className={styles.actions}><button type="button"disabled={disabled||busy||loading}onClick={()=>uploadRef.current?.click()}className={styles.primary}>{busy?'Working…':'Attach document'}<span aria-hidden="true">↑</span></button><button type="button"disabled={disabled||busy}onClick={()=>inspectRef.current?.click()}className={styles.secondary}>Inspect PDF locally</button><span className={styles.hint}>PDF, PNG, JPEG, WebP · Up to 4 MB</span></div>
  <input ref={uploadRef}type="file"accept="application/pdf,image/png,image/jpeg,image/webp"className={styles.hidden}aria-label="Choose private attachment"disabled={disabled||busy}onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)attach(file);}}/>
  <input ref={inspectRef}type="file"accept="application/pdf"className={styles.hidden}aria-label="Choose PDF for local inspection"disabled={disabled||busy}onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)inspect(file);}}/>
  <p className={styles.hint}>Local inspection reads the PDF text on your device. Nothing is attached or saved until you choose Attach document.</p>
  {error&&<p role="alert"className={styles.error}>{error}</p>}{notice&&<p role="status"className={styles.notice}>{notice}</p>}
  {loading?<p className={styles.empty}>Loading private attachments…</p>:documents.length?<ul className={styles.list}>{documents.map(document=><li key={document.id}className={styles.document}><div className={styles.fileIcon}aria-hidden="true">↗</div><div className={styles.fileInfo}><p className={styles.fileName}>{document.fileName}</p><p className={styles.hint}>{Math.max(1,Math.round(document.size/1024))} KB · Saved to your private account{document.attachedAt?` · ${document.attachedAt.slice(0,10)}`:''}</p></div><button type="button"className={styles.textButton}disabled={disabled||busy}onClick={()=>void run(async sequence=>{await downloadCPADocument(identity.current,year,document.id);if(sequence===generation.current)setNotice(`Download prepared: ${document.fileName}`);})}>Download<span className="sr-only"> {document.fileName}</span></button></li>)}</ul>:<p className={styles.empty}>No documents attached to this topic yet.</p>}
  {localName&&<details open className={styles.local}><summary>Local preview · {localName}</summary><p className={styles.hint}>Temporary text only. Closing this topic clears it; it is never copied into your answers automatically.</p>{localText?<pre className={styles.preview}>{localText}</pre>:<p className={styles.empty}>No readable text found.</p>}<button type="button"onClick={()=>{setLocalText('');setLocalName('');setNotice('Local preview cleared.');}}className={styles.textButton}>Clear local preview</button></details>}
 </section>;
}
