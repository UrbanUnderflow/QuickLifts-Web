import test from 'node:test';
import assert from 'node:assert/strict';
import {dateUnsignedEquityDocument, equityDocumentDate} from '../../src/lib/equityDocumentDating';

test('uses the New York calendar date across midnight and daylight saving time', () => {
  assert.equal(equityDocumentDate(new Date('2026-09-24T02:30:00Z')).iso, '2026-09-23');
  assert.equal(equityDocumentDate(new Date('2026-01-02T04:30:00Z')).iso, '2026-01-01');
  assert.equal(equityDocumentDate(new Date('2026-09-24T04:30:00Z')).label, 'September 24, 2026');
});

test('dates current instrument fields while preserving historical agreements, vesting and execution blanks', () => {
  const original = {
    title: 'PIL Warrant - September 23, 2026', documentType: 'strategic_warrant_pil',
    content: 'PIL WARRANT\n\nDocument date: September 23, 2026\n\nTHIS STRATEGIC PARTNERSHIP WARRANT (this “Warrant”) is dated September 23, 2026 and issued only upon satisfaction of its closing conditions.\nExecution Date. This Warrant is dated September 23, 2026. Its Issue Date is the actual coordinated closing date.\nSide Letter dated September 9, 2026.\nPartnership Agreement dated September 11, 2026.\nVesting Commencement Date: September 11, 2026\nCliff: September 11, 2027\nDate of Execution: __________________',
  };
  const revised = dateUnsignedEquityDocument(original, new Date('2026-10-01T15:00:00Z'));
  assert.equal(revised.title, 'PIL Warrant - October 1, 2026');
  assert.equal(revised.documentDate, '2026-10-01');
  assert.equal((revised.content!.match(/is dated October 1, 2026/g) || []).length, 2);
  for (const unchanged of ['Side Letter dated September 9, 2026.', 'Partnership Agreement dated September 11, 2026.', 'Vesting Commencement Date: September 11, 2026', 'Cliff: September 11, 2027', 'Its Issue Date is the actual coordinated closing date.', 'Date of Execution: __________________']) assert.ok(revised.content!.includes(unchanged));
  assert.equal(dateUnsignedEquityDocument(revised, new Date('2026-10-01T15:00:00Z')).content, revised.content);
  assert.ok(original.content.includes('Document date: September 23, 2026'));
});

test('fills certification fields and preparation date without pre-recording approval or signature', () => {
  const certificate = dateUnsignedEquityDocument({documentType: 'strategic_capitalization_certificate', content: 'CERTIFICATE\nPrepared September 23, 2026.\nThe director certifies to EDNA as of [Certification Date].\nDetermination Date: the date of electronic approval.\nDate: __________________'}, new Date('2026-10-01T15:00:00Z'));
  assert.match(certificate.content!, /Prepared October 1, 2026\./);
  assert.match(certificate.content!, /as of the date recorded with the undersigned's electronic signature\./);
  assert.match(certificate.content!, /Determination Date: the date of electronic approval\./);
  assert.match(certificate.content!, /Date: __________________/);
  assert.equal(Object.hasOwn(certificate, 'signedAt'), false);
});

test('certification tied to signature is not predated and grant dates remain unchanged', () => {
  const original = {documentType: 'strategic_capitalization_certificate', content: 'CERTIFICATE\nThe undersigned certifies to EDNA as of ______________, 20___ (the "Certification Date," being the date this Certificate is signed).\nThe grant-reference date is September 23, 2026.\nGrant-reference date: September 23, 2026.\nBoard consent dated ______________.'};
  const result = dateUnsignedEquityDocument(original, new Date('2026-10-01T15:00:00Z'));
  assert.match(result.content!, /as of the date recorded with the undersigned's electronic signature \(the "Certification Date"\)/);
  assert.match(result.content!, /The grant-reference date is September 23, 2026/);
  assert.match(result.content!, /Grant-reference date: September 23, 2026/);
  assert.match(result.content!, /Board consent dated ______________/);
});

test('references the actual board signature date without certifying an invented date', () => {
 const result = dateUnsignedEquityDocument({documentType:'strategic_capitalization_certificate',content:"CERTIFICATE\nThe reserve was approved by written consent of the Company's sole director dated ______________.\nDate of Execution: __________________"},new Date('2026-10-01T15:00:00Z'));
 assert.match(result.content!,/by written consent of the Company's sole director, dated as recorded with the sole director's electronic signature on that consent/);
 assert.match(result.content!,/Date of Execution: __________________/);
});
