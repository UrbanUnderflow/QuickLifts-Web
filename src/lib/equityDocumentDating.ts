/** Date a new, unsigned signing snapshot. Callers must preserve existing requests. */
const writtenDate = '(?:January|February|March|April|May|June|July|August|September|October|November|December) \\d{1,2}, \\d{4}';
const dateValue = `(?:${writtenDate}|\\d{4}-\\d{2}-\\d{2}|\\[(?:DOCUMENT_DATE|PACKAGE_DATE|Certification Date)\\])`;

export function equityDocumentDate(now: Date) {
  if (!Number.isFinite(now.getTime())) throw new Error('A valid preparation date is required.');
  const parts = new Intl.DateTimeFormat('en-US', {timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(now);
  const value = (type: string) => parts.find(part => part.type === type)!.value;
  return {
    iso: `${value('year')}-${value('month')}-${value('day')}`,
    label: new Intl.DateTimeFormat('en-US', {timeZone: 'America/New_York', year: 'numeric', month: 'long', day: 'numeric'}).format(now),
  };
}

/** Only current-instrument date fields change; historical references and vesting do not. */
export function dateUnsignedEquityDocument<T extends {title?: string; content?: string; documentType?: string}>(document: T, now: Date): T & {documentDate: string} {
  const date = equityDocumentDate(now);
  let content = document.content || '';
  content = content.replace(/\[(?:DOCUMENT_DATE|PACKAGE_DATE)\]/g, date.label);
  content = content.replace(new RegExp(`^(Document date:\\s*)${dateValue}`, 'gmi'), `$1${date.label}`);
  if (!/^Document date:/mi.test(content)) {
    const boundary = content.indexOf('\n');
    content = boundary < 0 ? `${content}\n\nDocument date: ${date.label}` : `${content.slice(0, boundary)}\n\nDocument date: ${date.label}${content.slice(boundary)}`;
  }
  content = content.replace(new RegExp(`^(Prepared(?: on|:)?\\s+|Date:\\s*)${dateValue}`, 'gmi'), `$1${date.label}`);
  content = content.replace(new RegExp(`((?:This|THIS) [^\\n.]{0,180}?\\b(?:is dated|is issued as of|is issued and effective as of)) ${dateValue}`, 'g'), `$1 ${date.label}`);
  if (/capitalization/i.test(document.documentType || '')) {
    const signatureDate = "the date recorded with the undersigned's electronic signature";
    content = content.replace(/as\s+of\s+_{3,}\s*,\s*20_{2,}\s*\(the\s*["“]Certification Date,?["”],?\s*being the date this Certificate is signed\)/gi, `as of ${signatureDate} (the "Certification Date")`);
    content = content.replace(/\[Certification Date\]/g, signatureDate);
    content = content.replace(/by\s+written\s+consent\s+of\s+the\s+Company's\s+sole\s+director\s+dated\s+_{3,}/g, "by written consent of the Company's sole director, dated as recorded with the sole director's electronic signature on that consent");
  }
  const title = document.title?.replace(new RegExp(`( - | \\| )${writtenDate}$`), `$1${date.label}`);
  return {...document, ...(title === undefined ? {} : {title}), content, documentDate: date.iso};
}
