import React, { useState } from 'react';
import { marked } from 'marked';
import { Download, FileCode2, FileText } from 'lucide-react';
import styles from './SnapshotArtifactReader.module.css';

export type SnapshotArtifact = { name: string; content: string };
const labels: Record<string, string> = {'README.md':'Integration guide','snapshot.schema.json':'JSON Schema','examples/snapshot.synthetic.json':'Snapshot example','examples/pull-request.synthetic.json':'Pull request','examples/pull-response.synthetic.json':'Pull response','examples/push-ack.synthetic.json':'Push receipt','emergency-handoff.schema.json':'Handoff schema','webhook.schema.json':'Webhook schema','examples/emergency-handoff.synthetic.json':'Handoff example','examples/case-receipt.synthetic.json':'Case receipt','examples/webhook.synthetic.json':'Webhook example'};
type Token = {type:string;text?:string;raw?:string;depth?:number;href?:string;ordered?:boolean;tokens?:Token[];items?:{tokens:Token[]}[];header?:{tokens:Token[]}[];rows?:{tokens:Token[]}[][]};
function SafeMarkdown({content,onSelect,names}:{content:string;onSelect:(name:string)=>void;names:string[]}) {
  const render=(tokens:Token[]):React.ReactNode=>tokens.map((token,index)=>{
    const child=token.tokens?render(token.tokens):token.text;
    switch(token.type){
      case 'space': return null;
      case 'heading': return token.depth===1?<h1 key={index}>{child}</h1>:token.depth===2?<h2 key={index}>{child}</h2>:<h3 key={index}>{child}</h3>;
      case 'paragraph': return <p key={index}>{child}</p>;
      case 'strong': return <strong key={index}>{child}</strong>;
      case 'em': return <em key={index}>{child}</em>;
      case 'code': return <pre key={index}><code>{token.text}</code></pre>;
      case 'codespan':return <code key={index}>{token.text}</code>;
      case 'list':return token.ordered?<ol key={index}>{token.items?.map((item,i)=><li key={i}>{render(item.tokens)}</li>)}</ol>:<ul key={index}>{token.items?.map((item,i)=><li key={i}>{render(item.tokens)}</li>)}</ul>;
      case 'link':return token.href&&names.includes(token.href)?<button key={index} className={styles.inlineLink} onClick={()=>onSelect(token.href!)}>{child}</button>:<span key={index}>{child}</span>;
      case 'table':return <div key={index} className={styles.tableWrap}><table><thead><tr>{token.header?.map((cell,i)=><th key={i} scope="col">{render(cell.tokens)}</th>)}</tr></thead><tbody>{token.rows?.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{render(cell.tokens)}</td>)}</tr>)}</tbody></table></div>;
      case 'br':return <br key={index}/>;
      default:return <React.Fragment key={index}>{child||token.raw}</React.Fragment>;
    }
  });
  return <div className={styles.prose}>{render(marked.lexer(content,{gfm:true}) as Token[])}</div>;
}
export default function SnapshotArtifactReader({artifacts,title='Athletic Mind snapshots',description='Daily exchange, authenticated requests, and the shared payload contract.',eyebrow='AuntEdna / Integration package',badge='Production disabled',onDownload}:{artifacts:SnapshotArtifact[];title?:string;description?:string;eyebrow?:string;badge?:string|null;onDownload?:(name:string)=>void}) {
  const [selected,setSelected]=useState('README.md');
  const current=artifacts.find(artifact=>artifact.name===selected)||artifacts[0];
  if(!current)return null;
  const download=()=>{
    if(onDownload){onDownload(current.name);return;}
    const href=URL.createObjectURL(new Blob([current.content],{type:current.name.endsWith('.json')?'application/json':'text/markdown'}));
    const link=document.createElement('a');link.href=href;link.download=current.name.split('/').pop()!;link.click();setTimeout(()=>URL.revokeObjectURL(href),1000);
  };
  return <article className={styles.reader}>
    <div className={styles.heading}><div><p className={styles.eyebrow}>{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{badge?<span className={styles.badge}>{badge}</span>:null}</div>
    <nav className={styles.tabs} aria-label="Integration artifacts">{artifacts.map(artifact=><button key={artifact.name} type="button" aria-current={artifact.name===current.name?'page':undefined} onClick={()=>setSelected(artifact.name)}>{artifact.name.endsWith('.md')?<FileText size={15}/>:<FileCode2 size={15}/>} {labels[artifact.name]||artifact.name}</button>)}</nav>
    <div className={styles.fileBar}><span>{current.name}</span><button type="button" onClick={download}><Download size={15}/> Download {current.name.endsWith('.json')?'JSON':'guide'}</button></div>
    <section aria-label={labels[current.name]||current.name}>{current.name.endsWith('.md')?<SafeMarkdown content={current.content} onSelect={setSelected} names={artifacts.map(artifact=>artifact.name)}/>:<pre className={styles.json}><code>{current.content}</code></pre>}</section>
  </article>;
}
