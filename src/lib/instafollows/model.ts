export const OWNER_UID = 'RI6D2h6ygab46uxxxZwVkYpWU6B2';
export const ROOT_COLLECTION = 'pulsecheck-restricted-questionnaire-submissions';
export const ROOT_DOCUMENT = 'instagram-review-v1';
export type Flag = 'reviewed' | 'dontUnfollow';
export type Mark = {value: boolean; revision: number; source: 'browser-import' | 'user'; operationId?: string};
export type Decision = Partial<Record<Flag, Mark>>;
export type Decisions = Record<string, Decision>;
export type Account = {username: string; full_name: string; hasPhoto?: boolean};
export const validUsername = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9._]{1,30}$/.test(v);
export const accountKey = (username: string) => Buffer.from(username.toLowerCase()).toString('base64url');
export class ReviewError extends Error { constructor(public status: number, message: string) { super(message); } }
export function validateAccounts(value: unknown): Account[] {
  if (!Array.isArray(value) || !value.length || value.length > 5000) throw new ReviewError(400, 'Invalid account list.');
  const seen = new Set<string>();
  return value.map(a => {
    if (!validUsername(a?.username) || typeof a.full_name !== 'string' || a.full_name.length > 200 || seen.has(a.username.toLowerCase())) throw new ReviewError(400, 'Invalid or duplicate account.');
    seen.add(a.username.toLowerCase());
    return {username:a.username,full_name:a.full_name,...(a.hasPhoto===true?{hasPhoto:true}:{})};
  });
}
export function parseSnapshot(value: any) {
  let sourceValid = false;
  try { const u = new URL(value?.source); sourceValid = u.origin === 'https://tremaine-instagram-review.tremaine.chatgpt.site' && !u.username && !u.password; } catch {}
  if (!sourceValid || typeof value.capturedAt !== 'string' || !Number.isFinite(Date.parse(value.capturedAt))) throw new ReviewError(400,'Invalid snapshot source or timestamp.');
  const arrays = {} as Record<Flag,string[]>;
  for (const flag of ['reviewed','dontUnfollow'] as const) {
    if (!Array.isArray(value[flag]) || value[flag].length>5000 || !value[flag].every(validUsername)) throw new ReviewError(400,'Invalid snapshot marks.');
    arrays[flag]=[...new Set<string>(value[flag].map((v:string)=>v.toLowerCase()))];
  }
  return {source:value.source,capturedAt:value.capturedAt,...arrays};
}
export function reconcileSnapshot(current: Decisions, previous: ReturnType<typeof parseSnapshot> | undefined, next: ReturnType<typeof parseSnapshot>) {
  if (previous && Date.parse(next.capturedAt)<=Date.parse(previous.capturedAt)) throw new ReviewError(409,'Snapshot is not newer than the imported snapshot.');
  const entries:Decisions=structuredClone(current);let applied=0,conflicts=0;
  for(const flag of ['reviewed','dontUnfollow'] as const){
    const before=new Set(previous?.[flag]||[]),after=new Set(next[flag]);
    for(const username of new Set([...before,...after])){
      if(previous&&before.has(username)===after.has(username))continue;
      const key=accountKey(username),mark=entries[key]?.[flag];
      if(mark?.source==='user'){if(mark.value!==after.has(username))conflicts++;continue;}
      entries[key]={...entries[key],[flag]:{value:after.has(username),revision:(mark?.revision||0)+1,source:'browser-import'}};applied++;
    }
  }
  return {entries,applied,conflicts};
}
export function changeMark(current: Decision, input: any): Decision {
  if(!input||!['reviewed','dontUnfollow'].includes(input.flag)||typeof input.value!=='boolean'||!Number.isInteger(input.expectedRevision)||input.expectedRevision<0||typeof input.operationId!=='string'||!/^[a-f0-9-]{36}$/i.test(input.operationId))throw new ReviewError(400,'Invalid change.');
  const flag=input.flag as Flag,old=current[flag];
  if(old&&old.operationId===input.operationId&&old.value===input.value)return current;
  if((old?.revision||0)!==input.expectedRevision)throw new ReviewError(409,'This mark changed in another session. Refresh and try again.');
  return {...current,[flag]:{value:input.value,revision:(old?.revision||0)+1,source:'user',operationId:input.operationId}};
}
