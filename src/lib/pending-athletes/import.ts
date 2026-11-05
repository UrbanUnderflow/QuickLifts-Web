export type Entry = { teamId: string; input: { sourceReference: string; displayName: string; phoneNumber: string; role: 'athlete'; rosterVerified: true; identityReview: 'reviewed' | 'review-required'; accountMatch: 'none-found' | 'existing' | 'ambiguous'; expectedUserId?: string | null } };
const keys = new Set(['sourceReference','displayName','phoneNumber','role','rosterVerified','identityReview','accountMatch','expectedUserId']);
export function parsePreparationFile(text: string, teamId: string): Entry[] {
 const data: unknown = JSON.parse(text);
 if (!Array.isArray(data) || !data.length || data.length > 25) throw Error('Choose a reviewed roster file containing 1 to 25 entries.');
 for (const row of data) {
  const p = row?.input;
  if (!row || Object.keys(row).some(k => !['teamId','input'].includes(k)) || typeof row.teamId !== 'string' || !p || typeof p !== 'object' || Array.isArray(p) || Object.keys(p).some(k=>!keys.has(k)) ||
   typeof p.sourceReference !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(p.sourceReference) || typeof p.displayName !== 'string' || !p.displayName.trim() || p.displayName.length>100 || /[\x00-\x1f<>]/.test(p.displayName) ||
   typeof p.phoneNumber !== 'string' || !/^\+[1-9]\d{9,14}$/.test(p.phoneNumber) || p.role!=='athlete' || p.rosterVerified!==true || !['reviewed','review-required'].includes(p.identityReview) || !['none-found','existing','ambiguous'].includes(p.accountMatch) ||
   p.expectedUserId!=null && (typeof p.expectedUserId!=='string' || !/^[A-Za-z0-9_-]{1,128}$/.test(p.expectedUserId)) || p.accountMatch==='existing' && !p.expectedUserId || p.accountMatch==='none-found' && p.expectedUserId!=null) throw Error('The file must contain reviewed roster identity fields only.');
 }
 const selected = data.filter(row=>row.teamId===teamId) as Entry[];
 if (!selected.length) throw Error('This file has no entries for the selected team.');
 if (new Set(selected.map(row=>row.input.sourceReference)).size!==selected.length) throw Error('The file contains a repeated source reference.');
 return selected;
}
