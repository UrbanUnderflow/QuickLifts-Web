/** Serialize the safe rendered runbook back to its stored Markdown format. */
export function runbookElementToMarkdown(root: HTMLElement): string {
  const escapeText = (text: string) => text.replace(/\\/g, '\\\\').replace(/([*_`\[\]])/g, '\\$1').replace(/\u00a0/g, ' ');
  const children = (node: Node): string => Array.from(node.childNodes).map(walk).join('');
  function walk(node: Node): string {
    if (node.nodeType === 3) return escapeText(node.textContent || '');
    if (node.nodeType !== 1) return '';
    const element = node as HTMLElement;
    const tag = element.tagName.toLowerCase();
    const text = children(element);
    if (/^h[1-6]$/.test(tag)) return `${'#'.repeat(Number(tag[1]))} ${text.trim()}\n\n`;
    if (tag === 'strong' || tag === 'b') return `**${text}**`;
    if (tag === 'em' || tag === 'i') return `*${text}*`;
    if (tag === 'del' || tag === 's' || tag === 'strike') return `~~${text}~~`;
    if (tag === 'br') return '  \n';
    if (tag === 'a') {
      const href = element.getAttribute('href') || '';
      return `[${text}](${href.replace(/\)/g, '%29')})`;
    }
    if (tag === 'pre') {
      const raw = element.textContent || '';
      const fence = '`'.repeat(Math.max(3, ...Array.from(raw.matchAll(/`+/g), (match) => match[0].length + 1)));
      return `${fence}\n${raw}\n${fence}\n\n`;
    }
    if (tag === 'code') return '`' + (element.textContent || '').replace(/`/g, '\\`') + '`';
    if (tag === 'blockquote') return text.trim().split('\n').map((line) => `> ${line}`).join('\n') + '\n\n';
    if (tag === 'ul' || tag === 'ol') {
      const start = Number(element.getAttribute('start') || 1);
      return Array.from(element.children).filter((child) => child.tagName === 'LI').map((child, index) => {
        const value = children(child).trim();
        const marker = tag === 'ol' ? `${start + index}. ` : '- ';
        return marker + value.replace(/\n/g, '\n' + ' '.repeat(marker.length));
      }).join('\n') + '\n\n';
    }
    if (tag === 'input') return `[${(element as HTMLInputElement).checked ? 'x' : ' '}] `;
    if (tag === 'table') {
      const rows = Array.from(element.querySelectorAll('tr')).map((row) => Array.from(row.children).map((cell) => children(cell).trim().replace(/\n+/g, ' ').replace(/\|/g, '\\|')));
      if (!rows.length) return '';
      const line = (cells: string[]) => '| ' + cells.join(' | ') + ' |';
      return [line(rows[0]), line(rows[0].map(() => '---')), ...rows.slice(1).map(line)].join('\n') + '\n\n';
    }
    if (tag === 'hr') return '---\n\n';
    if (tag === 'p' || tag === 'div') return text + (text.endsWith('\n\n') ? '' : '\n\n');
    return text;
  }
  return children(root).trimEnd() + '\n';
}
