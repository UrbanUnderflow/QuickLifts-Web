import React from 'react';
import { marked, type Token } from 'marked';
import { type InAppMessageContent, safeInAppMessageURL } from '../../utils/inAppMessages';

export function AppMessageMarkdown({content}:{content:string}) {
  function render(tokens:Token[]):React.ReactNode {return tokens.map((raw,index)=>{
    const token=raw as Token & {tokens?:Token[];text?:string;depth?:number;href?:string;items?:Array<{tokens:Token[]}>;ordered?:boolean};
    const children=token.tokens?render(token.tokens):token.text;
    switch(token.type) {
      case 'heading': return token.depth===1?<h2 key={index} className="mt-5 mb-3 font-serif text-3xl leading-tight text-[#f6f2e8]">{children}</h2>:<h3 key={index} className="mt-5 mb-2 text-xl font-semibold text-[#f6f2e8]">{children}</h3>;
      case 'paragraph': return <p key={index} className="my-3 leading-7 text-[#c7c7bc]">{children}</p>;
      case 'list': return token.ordered?<ol key={index} className="my-3 ml-5 list-decimal space-y-2">{token.items?.map((item,i)=><li key={i}>{render(item.tokens)}</li>)}</ol>:<ul key={index} className="my-3 ml-5 list-disc space-y-2">{token.items?.map((item,i)=><li key={i}>{render(item.tokens)}</li>)}</ul>;
      case 'strong': return <strong key={index} className="font-semibold text-[#f6f2e8]">{children}</strong>;
      case 'em': return <em key={index}>{children}</em>;
      case 'del': return <del key={index}>{children}</del>;
      case 'codespan': return <code key={index} className="rounded bg-white/10 px-1.5 py-0.5 text-sm text-[#e5edc6]">{token.text}</code>;
      case 'code': return <pre key={index} className="my-4 overflow-x-auto rounded-xl bg-black/30 p-4 text-sm"><code>{token.text}</code></pre>;
      case 'blockquote': return <blockquote key={index} className="my-4 border-l-2 border-[#d5e575] pl-4 italic">{children}</blockquote>;
      case 'link': {const href=safeInAppMessageURL(token.href);return href?<a key={index} href={href} target="_blank" rel="noreferrer noopener" className="text-[#d5e575] underline underline-offset-4">{children}</a>:<span key={index}>{children}</span>;}
      case 'image': {const src=safeInAppMessageURL(token.href);return src?<img key={index} src={src} alt={token.text||''} referrerPolicy="no-referrer" className="my-4 max-h-64 w-full rounded-2xl object-cover"/>:<span key={index}>{token.text}</span>;}
      case 'hr': return <hr key={index} className="my-5 border-white/15"/>;
      case 'br': return <br key={index}/>;
      case 'html': return <span key={index}>{(token as unknown as {raw:string}).raw}</span>;
      case 'space': return null;
      default:return <React.Fragment key={index}>{children || (token as unknown as {raw?:string}).raw}</React.Fragment>;
    }
  });}
  return <div className="text-[15px] text-[#c7c7bc]">{render(marked.lexer(content,{gfm:true,breaks:true}))}</div>;
}

export function AppMessagePreview({value,eyebrow='FROM YOUR APP'}:{value:InAppMessageContent;eyebrow?:string}) {
  return <div className="overflow-hidden rounded-[28px] border border-[#d5e575]/20 bg-[#171d1a] text-[#f6f2e8] shadow-2xl">
    <div className="h-1 bg-[#d5e575]"/>
    <div className="p-7">
      <p className="mb-6 text-[10px] font-bold tracking-[0.25em] text-[#d5e575]">{eyebrow}</p>
      <h2 className="mb-5 font-serif text-4xl leading-tight">{value.title || 'Your message title'}</h2>
      <AppMessageMarkdown content={value.markdown || 'Your **Markdown message** will appear here.'}/>
      {value.actionURL && value.actionLabel && <div className="mt-7 rounded-2xl bg-[#d5e575] px-5 py-4 text-center font-semibold text-[#20271c]">{value.actionLabel} <span aria-hidden>↗</span></div>}
      <div className="mt-4 text-center text-xs text-[#a5a99f]">{value.actionURL ? 'Button preview' : 'Continue'}</div>
    </div>
  </div>;
}

export default function AppMessageEditor({value,onChange,label,eyebrow,showEnabled=true}:{value:InAppMessageContent;onChange:(next:InAppMessageContent)=>void;label:string;eyebrow?:string;showEnabled?:boolean}) {
  const set=(key:keyof InAppMessageContent,next:string|boolean)=>onChange({...value,[key]:next});
  return <div className="grid gap-7 lg:grid-cols-2">
    <div className="space-y-4">
      {showEnabled && <label className="flex items-center gap-3 text-sm text-zinc-200"><input type="checkbox" checked={value.isEnabled} onChange={e=>set('isEnabled',e.target.checked)} className="h-4 w-4"/>{label}</label>}
      <label className="block text-sm text-zinc-300">Title<input maxLength={120} value={value.title} onChange={e=>set('title',e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-600 bg-[#11171b] p-3 text-white"/></label>
      <label className="block text-sm text-zinc-300">Markdown message<textarea rows={10} maxLength={20000} value={value.markdown} onChange={e=>set('markdown',e.target.value)} placeholder={'## One clear starting point\n\nTake your baseline before your first session.\n\n- Save your progress\n- Continue on web or in the app'} className="mt-2 w-full rounded-xl border border-zinc-600 bg-[#11171b] p-3 font-mono text-sm text-white"/></label>
      <p className="text-xs leading-5 text-zinc-400">Use headings, paragraphs, bold, lists, quotes, images and links. The app applies its own type, spacing and colors. HTML and scripts are shown as text.</p>
      <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm text-zinc-300">Button label<input maxLength={60} value={value.actionLabel} onChange={e=>set('actionLabel',e.target.value)} placeholder="Take your baseline" className="mt-2 w-full rounded-xl border border-zinc-600 bg-[#11171b] p-3 text-white"/></label><label className="block text-sm text-zinc-300">Button link<input maxLength={2048} value={value.actionURL} onChange={e=>set('actionURL',e.target.value)} placeholder="/PulseCheck/baseline" className="mt-2 w-full rounded-xl border border-zinc-600 bg-[#11171b] p-3 text-white"/></label></div>
    </div>
    <div><p className="mb-3 text-xs font-medium uppercase tracking-widest text-zinc-400">App preview</p><AppMessagePreview value={value} eyebrow={eyebrow}/></div>
  </div>;
}
