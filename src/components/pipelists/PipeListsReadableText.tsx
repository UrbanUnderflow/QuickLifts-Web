import React from 'react';

// Keep authored line breaks, blank lines, and indentation identical to the editor.
export default function PipeListsReadableText({ text }: { text: string }) {
  return (
    <div className="max-w-[70ch] whitespace-pre-wrap text-base leading-7 text-stone-900 [overflow-wrap:anywhere]">
      {text.split(/(https?:\/\/[^\s<>]+)/g).map((part, partIndex) => {
        if (!/^https?:\/\//.test(part)) return part;
        const url = part.replace(/[.,;:!?]+$/, '');
        return (
          <React.Fragment key={partIndex}>
            <a href={url} target="_blank" rel="noopener noreferrer" className="underline decoration-stone-400 underline-offset-4 hover:decoration-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{url}</a>
            {part.slice(url.length)}
          </React.Fragment>
        );
      })}
    </div>
  );
}
