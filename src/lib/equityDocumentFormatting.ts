const closeActiveList = (processedLines: string[], listType: 'ul' | 'ol' | null) => {
  if (!listType) return;
  processedLines.push(listType === 'ol' ? '</ol>' : '</ul>');
};

const isLegalHeadingTitle = (title: string) => {
  const trimmedTitle = title.trim();
  return (
    trimmedTitle.length > 0 &&
    trimmedTitle.length <= 100 &&
    /^[A-Z]/.test(trimmedTitle) &&
    !/[.!?]$/.test(trimmedTitle)
  );
};

const renderWithClosedList = (
  processedLines: string[],
  listState: { inList: boolean; listType: 'ul' | 'ol' | null },
  renderedLine: string,
) => {
  if (listState.inList) {
    closeActiveList(processedLines, listState.listType);
    listState.inList = false;
    listState.listType = null;
  }
  processedLines.push(renderedLine);
};

// Shared formatter for equity/legal document previews and browser-generated PDFs.
// It intentionally preserves legal section numbers like "10. General Provisions"
// as headings instead of converting them into one-item ordered lists that render as "1.".
export const formatEquityContentForPdf = (content: string): string => {
  let result = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  result = result.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  result = result.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  result = result.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  result = result.replace(/^# (.+)$/gm, '<h2>$1</h2>');

  result = result.replace(/^---+$/gm, '<hr>');

  const lines = result.split('\n');
  const processedLines: string[] = [];
  const listState: { inList: boolean; listType: 'ul' | 'ol' | null } = {
    inList: false,
    listType: null,
  };

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      if (listState.inList) {
        closeActiveList(processedLines, listState.listType);
        listState.inList = false;
        listState.listType = null;
      }
      processedLines.push('');
      continue;
    }

    const legalSectionHeading = trimmedLine.match(/^([1-9]\d?)\.\s+(.+)$/);
    if (legalSectionHeading && isLegalHeadingTitle(legalSectionHeading[2])) {
      renderWithClosedList(
        processedLines,
        listState,
        `<h2>${legalSectionHeading[1]}. ${legalSectionHeading[2]}</h2>`,
      );
      continue;
    }

    const legalSubsectionHeading = trimmedLine.match(/^([1-9]\d?\.\d+(?:\.\d+)*)\s+(.+)$/);
    if (legalSubsectionHeading && isLegalHeadingTitle(legalSubsectionHeading[2])) {
      renderWithClosedList(
        processedLines,
        listState,
        `<h3>${legalSubsectionHeading[1]} ${legalSubsectionHeading[2]}</h3>`,
      );
      continue;
    }

    const bulletMatch = trimmedLine.match(/^([-•*]|–|—)\s*(.+)$/);
    if (bulletMatch) {
      if (!listState.inList || listState.listType !== 'ul') {
        if (listState.inList) closeActiveList(processedLines, listState.listType);
        processedLines.push('<ul>');
        listState.inList = true;
        listState.listType = 'ul';
      }
      processedLines.push(`<li>${bulletMatch[2]}</li>`);
      continue;
    }

    const numberedMatch = trimmedLine.match(/^([0-9]+|[a-z]|[ivxlc]+)[\.)]\s+(.+)$/i);
    if (numberedMatch) {
      if (!listState.inList || listState.listType !== 'ol') {
        if (listState.inList) closeActiveList(processedLines, listState.listType);
        const startAttr = /^\d+$/.test(numberedMatch[1]) ? ` start="${numberedMatch[1]}"` : '';
        processedLines.push(`<ol${startAttr}>`);
        listState.inList = true;
        listState.listType = 'ol';
      }
      processedLines.push(`<li>${numberedMatch[2]}</li>`);
      continue;
    }

    if (trimmedLine.startsWith('<h') || trimmedLine === '<hr>') {
      renderWithClosedList(processedLines, listState, trimmedLine);
      continue;
    }

    renderWithClosedList(processedLines, listState, `<p>${trimmedLine}</p>`);
  }

  if (listState.inList) {
    closeActiveList(processedLines, listState.listType);
  }

  result = processedLines.join('\n');
  result = result.replace(/<p><\/p>/g, '');
  result = result.replace(/\n{3,}/g, '\n\n');

  return result;
};
