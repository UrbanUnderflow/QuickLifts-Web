import { getFirebaseModeRequestHeaders } from '../config';
export function publicProfileApiUrl(path: string): string {
  if (typeof window !== 'undefined') return path;
  const origin = process.env.NEXT_PUBLIC_SITE_URL || process.env.URL || 'https://fitwithpulse.ai';
  return new URL(path, origin).toString();
}
export async function fetchPublicProfile(userId: string): Promise<Record<string, any> | null> {
  const response = await fetch(publicProfileApiUrl(`/api/profiles/public?userId=${encodeURIComponent(userId)}`), { headers: getFirebaseModeRequestHeaders() });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Could not load profile');
  return (await response.json()).profile;
}
export async function fetchPublicDirectory(kind: 'username' | 'search' | 'directory' | 'featured', value?: string, cursor?: string): Promise<{profiles: Record<string, any>[]; nextCursor: string | null}> {
  const query = new URLSearchParams({kind});
  if(value !== undefined) query.set('value',value);
  if(cursor) query.set('cursor',cursor);
  const response = await fetch(publicProfileApiUrl(`/api/profiles/directory?${query}`), {headers:getFirebaseModeRequestHeaders()});
  if(!response.ok) throw new Error('Could not load profiles');
  return response.json();
}

export async function fetchPublicWorkoutCounts(userIds: string[]): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (let index = 0; index < userIds.length; index += 30) {
    const response = await fetch(publicProfileApiUrl('/api/profiles/workout-counts'), {method:'POST',headers:{...getFirebaseModeRequestHeaders(),'Content-Type':'application/json'},body:JSON.stringify({userIds:userIds.slice(index,index+30)})});
    if (!response.ok) throw new Error('Could not load workout counts');
    for (const profile of (await response.json()).profiles) if (typeof profile.workoutCount === 'number') counts[profile.id] = profile.workoutCount;
  }
  return counts;
}
