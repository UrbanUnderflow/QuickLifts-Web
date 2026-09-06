import React from 'react';
import { marked, type Token } from 'marked';
// Render a small Markdown vocabulary as React elements. Raw HTML stays text.
export default function ChatMarkdown({content}:{content:string}) {
 const render=(tokens:Token[]):React.ReactNode=>tokens.map((token,i)=>{
  const t=token as Token & {tokens?:Token[];text?:string;items?:Array<{tokens:Token[]}>;ordered?:boolean};
  const children=t.tokens?render(t.tokens):t.text;
  switch(t.type){
   case 'space':return null;
   case 'strong':return <strong key={i}>{children}</strong>;
   case 'em':return <em key={i}>{children}</em>;
   case 'del':return <del key={i}>{children}</del>;
   case 'heading':return <h4 key={i}>{children}</h4>;
   case 'paragraph':return <p key={i}>{children}</p>;
   case 'blockquote':return <blockquote key={i}>{children}</blockquote>;
   case 'list':return t.ordered?<ol key={i}>{t.items?.map((item,j)=><li key={j}>{render(item.tokens)}</li>)}</ol>:<ul key={i}>{t.items?.map((item,j)=><li key={j}>{render(item.tokens)}</li>)}</ul>;
   case 'code':return <pre key={i}><code>{t.text}</code></pre>;
   case 'codespan':return <code key={i}>{t.text}</code>;
   case 'br':return <br key={i}/>;
   case 'hr':return <hr key={i}/>;
   case 'link':return <span key={i}>{children}</span>;
   case 'image':return <span key={i}>{t.text}</span>;
   default:return <React.Fragment key={i}>{children || t.raw}</React.Fragment>;
  }
 });
 return <div>{render(marked.lexer(content,{gfm:true,breaks:true}))}</div>;
}
