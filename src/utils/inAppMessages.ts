export type InAppMessageAudience = 'all' | 'athletes' | 'coaches';
export interface InAppMessageContent {
  isEnabled: boolean;
  title: string;
  markdown: string;
  actionLabel: string;
  actionURL: string;
}
export interface InAppAnnouncement extends InAppMessageContent {
  id: string;
  revision: string;
  audience: InAppMessageAudience;
}
export const emptyInAppMessage = (): InAppMessageContent => ({isEnabled:false,title:'',markdown:'',actionLabel:'',actionURL:''});
export function safeInAppMessageURL(value: unknown): string | null {
  if(typeof value !== 'string') return null;
  const url=value.trim();
  if(!url || /[\\\u0000-\u001f\u007f]/.test(url)) return null;
  if(url.startsWith('/') && !url.startsWith('//')) return url;
  try {const parsed=new URL(url);return parsed.protocol==='https:' && parsed.hostname && !parsed.username && !parsed.password ? parsed.href : null;} catch {return null;}
}
export function normalizeInAppMessage(value: unknown): InAppMessageContent | null {
  if(!value || typeof value!=='object') return null;
  const data=value as Record<string,unknown>;
  const text=(key:string)=>typeof data[key]==='string'?(data[key] as string).trim():'';
  return {isEnabled:data.isEnabled===true,title:text('title').slice(0,120),markdown:text('markdown').slice(0,20000),actionLabel:text('actionLabel').slice(0,60),actionURL:safeInAppMessageURL(data.actionURL)||''};
}
export function validateInAppMessage(value: InAppMessageContent): InAppMessageContent {
  if (!value.isEnabled) return emptyInAppMessage();
  if(value.title.length>120 || value.markdown.length>20000 || value.actionLabel.length>60 || value.actionURL.length>2048) throw Error('Keep the title under 120 characters, message under 20,000, button label under 60, and link under 2,048.');
  if(value.isEnabled && (!value.title.trim() || !value.markdown.trim())) throw Error('Add a title and Markdown message before publishing.');
  if(value.actionURL.trim() && !safeInAppMessageURL(value.actionURL)) throw Error('Use an HTTPS link or an internal app path beginning with one slash.');
  if(value.actionURL.trim() && !value.actionLabel.trim()) throw Error('Add a label for the message button.');
  return normalizeInAppMessage(value)!;
}
export function normalizeInAppAnnouncement(value: unknown): InAppAnnouncement | null {
  const content=normalizeInAppMessage(value); if(!content)return null;
  const data=value as Record<string,unknown>;
  return {...content,id:typeof data.id==='string'?data.id:'',revision:typeof data.revision==='string'?data.revision:'',audience:data.audience==='athletes'||data.audience==='coaches'?data.audience:'all'};
}

// Turning a published message off never uploads a local draft.
export const inAppAnnouncementDisablePatch = () => ({ isEnabled: false });
