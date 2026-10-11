import React, {useCallback, useEffect, useState} from 'react';
import {Copy, RefreshCw, ShieldCheck} from 'lucide-react';
import styles from './PartnerApiKeysWorkspace.module.css';

type Grant = {organizationId: string; teamIds: string[]};
type AccessRequest = {id?: string; requestId?: string; organizationName: string; contactName: string; contactEmail: string; intendedUse: string; status: string};
type PartnerKey = {keyId: string; prefix?: string; partnerId?: string; partnerName?: string; scopeMode?: 'explicit' | 'all-athleticmind'; grants?: Grant[]; organizationId?: string; teamIds?: string[]; scopes: string[]; environment: string; expiresAt: string; status: string; revokedAt?: string | null};
type PageKind = 'requests' | 'keys' | 'organizations' | 'teams';
type ScopeOptions = {organizations: {id: string; name: string}[]; teams: {id: string; name: string; organizationId: string}[]; apis: string[]; environments: string[]};
type Registry = {pagination?: Partial<Record<PageKind, {hasMore: boolean; cursor: string | null}>>; requests: AccessRequest[]; keys: PartnerKey[]; scopeOptions: ScopeOptions};
export type PartnerKeyTransport = (body?: Record<string, unknown>, query?: Record<string, string>) => Promise<any>;
const initialApproval = () => ({partnerId: '', partnerName: '', scopeMode: 'explicit' as 'explicit' | 'all-athleticmind', grants: [] as Grant[], scopes: [] as string[], environment: '', expiresAt: '', maxRequestsPerMinute: 30});
const keyGrants = (key: PartnerKey): Grant[] => Array.isArray(key.grants) ? key.grants : key.organizationId ? [{organizationId: key.organizationId, teamIds: key.teamIds || []}] : [];

function GrantEditor({value, onChange, options, more}: {value: Grant[]; onChange: (grants: Grant[]) => void; options: ScopeOptions; more: (kind: PageKind) => React.ReactNode}) {
  const [organizationId, setOrganizationId] = useState('');
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const teams = options.teams.filter(team => team.organizationId === organizationId);
  const add = () => {
    if (!organizationId || !teamIds.length) return;
    const existing = value.find(grant => grant.organizationId === organizationId);
    onChange(existing ? value.map(grant => grant.organizationId === organizationId ? {...grant, teamIds: Array.from(new Set([...grant.teamIds, ...teamIds]))} : grant) : [...value, {organizationId, teamIds}]);
    setOrganizationId(''); setTeamIds([]);
  };
  return <div className={styles.grantEditor}>
    <h3>Program and team access</h3>
    <p className={styles.notice}>A credential with no grants cannot read athlete data. Add only the saved programs and teams this partner is authorized to access.</p>
    {!value.length && <p className={styles.zeroAccess}>No access grants — no athlete data access.</p>}
    {value.map(grant => <div className={styles.grant} key={grant.organizationId}>
      <strong>{options.organizations.find(org => org.id === grant.organizationId)?.name || grant.organizationId}</strong>
      <div className={styles.checks}>{grant.teamIds.map(teamId => <button type="button" className={styles.button} key={teamId} onClick={() => onChange(value.flatMap(item => item.organizationId !== grant.organizationId ? [item] : item.teamIds.length === 1 ? [] : [{...item, teamIds: item.teamIds.filter(id => id !== teamId)}]))}>Remove {options.teams.find(team => team.id === teamId)?.name || teamId}</button>)}</div>
      <button type="button" className={styles.button} onClick={() => onChange(value.filter(item => item.organizationId !== grant.organizationId))}>Remove program grant</button>
    </div>)}
    <label>Program to add<select aria-label="Program to add" value={organizationId} onChange={event => {setOrganizationId(event.target.value); setTeamIds([]);}}><option value="">Choose a saved program</option>{options.organizations.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label>
    {more('organizations')}
    {organizationId && <fieldset><legend>Teams to add</legend><div className={styles.checks}>{teams.map(team => <label key={team.id}><input type="checkbox" checked={teamIds.includes(team.id)} onChange={event => setTeamIds(event.target.checked ? [...teamIds, team.id] : teamIds.filter(id => id !== team.id))}/>{team.name}</label>)}</div>{!teams.length && <p className={styles.notice}>No eligible teams are loaded for this program.</p>}</fieldset>}
    {more('teams')}
    <button type="button" className={styles.button} disabled={!organizationId || !teamIds.length} onClick={add}>Add selected grant</button>
  </div>;
}

export default function PartnerApiKeysWorkspace({request}: {request: PartnerKeyTransport}) {
  const [data, setData] = useState<Registry | null>(null);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [oneTime, setOneTime] = useState<{keyId: string; secret: string} | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeConfirm, setRevokeConfirm] = useState<string | null>(null);
  const [overlap, setOverlap] = useState(0);
  const [approval, setApproval] = useState(initialApproval);
  const [editing, setEditing] = useState<{keyId: string; scopeMode: 'explicit' | 'all-athleticmind'; grants: Grant[]} | null>(null);
  const refresh = useCallback(async () => {try {setData(await request());} catch (failure) {setError(failure instanceof Error ? failure.message : 'Could not load API access.');}}, [request]);
  useEffect(() => {void refresh();}, [refresh]);
  useEffect(() => {
    if (!oneTime) return;
    const clear = () => setOneTime(null); window.addEventListener('pagehide', clear);
    const timer = window.setTimeout(clear, 300000);
    return () => {window.removeEventListener('pagehide', clear); window.clearTimeout(timer);};
  }, [oneTime]);
  const loadMore = async (kind: PageKind) => {
    const cursor = data?.pagination?.[kind]?.cursor; if (!cursor) return;
    setBusy(true);
    try {const next = await request(undefined, {[kind + 'Cursor']: cursor}); setData(previous => previous ? {...previous, pagination: {...previous.pagination, [kind]: next.pagination?.[kind]}, ...(kind === 'requests' || kind === 'keys' ? {[kind]: [...previous[kind], ...next[kind]]} : {scopeOptions: {...previous.scopeOptions, [kind]: [...previous.scopeOptions[kind], ...next.scopeOptions[kind]]}})} : next);}
    catch (failure) {setError(failure instanceof Error ? failure.message : 'Could not load more results.');} finally {setBusy(false);}
  };
  const more = (kind: PageKind) => data?.pagination?.[kind]?.hasMore ? <button type="button" className={styles.button} disabled={busy} onClick={() => void loadMore(kind)}>Load more {kind}</button> : null;
  const current = data?.requests.find(item => (item.requestId || item.id) === selected);
  const mutate = async (body: Record<string, unknown>) => {
    setBusy(true); setError(''); setOneTime(null); setCopied(false);
    try {
      const result = await request(body);
      if (typeof result.secret === 'string' && result.key?.keyId) setOneTime({keyId: result.key.keyId, secret: result.secret});
      setRevokeConfirm(null); setEditing(null);
      if (body.action === 'approve') {setSelected(''); setApproval(initialApproval());}
      await refresh();
    } catch (failure) {setError(failure instanceof Error ? failure.message : 'The key action could not be completed.');} finally {setBusy(false);}
  };
  const approve = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !approval.partnerId.trim() || !approval.partnerName.trim() || !approval.scopes.length || !approval.environment || !approval.expiresAt) {setError('Choose the partner identity, API permission, environment, and expiry. Program grants may be empty.'); return;}
    void mutate({action: 'approve', requestId: selected, ...approval, expiresAt: new Date(approval.expiresAt).toISOString()});
  };
  return <div className={styles.root}><div className={styles.inner}>
    <header className={styles.header}><div><div className={styles.eyebrow}>Administration / Developer access</div><h1>Partner API keys</h1><p>Issue partner credentials, manage explicit program grants, and control credential lifetimes.</p></div><button type="button" className={styles.button} onClick={() => {setOneTime(null); void refresh();}} disabled={busy}><RefreshCw size={15}/>Refresh</button></header>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {oneTime && <section className={styles.secret} aria-label="One-time API secret"><h2>Save this secret now.</h2><p>This secret is shown once. Store it in your approved secrets manager and share it through the agreed secure channel. It clears after five minutes, on refresh, or when you leave.</p><p>Key ID: <strong>{oneTime.keyId}</strong></p><code>{oneTime.secret}</code><div className={styles.keyActions}><button type="button" className={styles.button} onClick={async () => {try {await navigator.clipboard.writeText(oneTime.secret); setCopied(true);} catch {setError('Could not copy. Save the displayed secret before dismissing it.');}}}><Copy size={14}/>{copied ? 'Copied' : 'Copy secret'}</button><button type="button" className={styles.button} onClick={() => setOneTime(null)}>I saved it. Dismiss</button></div></section>}
    {!data ? <p role="status">Loading partner access…</p> : <>
      <div className={styles.grid}><aside className={styles.panel}><h2>Pending requests</h2><div className={styles.requests}>{data.requests.filter(item => item.status === 'pending').map(item => {const id = item.requestId || item.id || ''; return <button type="button" key={id} className={styles.request} aria-current={selected === id ? 'true' : undefined} onClick={() => {setSelected(id); setApproval(initialApproval());}}><strong>{item.organizationName}</strong><small>{item.contactName}</small><small>{item.contactEmail}</small></button>;})}</div>{more('requests')}{!data.requests.some(item => item.status === 'pending') && <p className={styles.empty}>No pending requests.</p>}</aside>
      <section className={styles.panel}><h2>{current ? 'Issue a partner credential' : 'Review a request'}</h2>{current ? <><div className={styles.purpose}><strong>{current.contactName} · {current.contactEmail}</strong><p>{current.intendedUse}</p></div><form className={styles.form} onSubmit={approve}>
        <label>Partner ID<input required maxLength={128} pattern="[A-Za-z0-9._-]+" value={approval.partnerId} onChange={event => setApproval({...approval, partnerId: event.target.value})}/><small>Stable identity, such as aunt-edna.</small></label>
        <label>Partner name<input required maxLength={200} value={approval.partnerName} onChange={event => setApproval({...approval, partnerName: event.target.value})}/></label>
        <label>Environment<select aria-label="Environment" required value={approval.environment} onChange={event => setApproval({...approval, environment: event.target.value})}><option value="">Choose an environment</option>{data.scopeOptions.environments.map(environment => <option key={environment} value={environment}>{environment === 'production' ? 'Production' : 'Test'}</option>)}</select></label>
        <label>Expires at (your local time)<input type="datetime-local" required value={approval.expiresAt} onChange={event => setApproval({...approval, expiresAt: event.target.value})}/></label>
        <fieldset className={styles.wide}><legend className={styles.notice}>API permissions</legend><div className={styles.checks}>{data.scopeOptions.apis.map(scope => <label key={scope}><input type="checkbox" checked={approval.scopes.includes(scope)} onChange={event => setApproval({...approval, scopes: event.target.checked ? [...approval.scopes, scope] : approval.scopes.filter(item => item !== scope)})}/>{scope}</label>)}</div></fieldset>
        <label className={styles.wide}>Program access<select aria-label="Program access" value={approval.scopeMode} onChange={event => setApproval({...approval, scopeMode: event.target.value as 'explicit' | 'all-athleticmind', grants: []})}><option value="explicit">Selected program and team grants</option><option value="all-athleticmind">All Athletic Mind programs</option></select></label>
        {approval.scopeMode === 'all-athleticmind' ? <p className={`${styles.zeroAccess} ${styles.wide}`}>Access covers all current and future active programs explicitly configured as Athletic Mind. PulseCheck and programs without that configuration are excluded. Athlete eligibility and consent are checked on every request.</p> : <div className={styles.wide}><GrantEditor value={approval.grants} onChange={grants => setApproval({...approval, grants})} options={data.scopeOptions} more={more}/></div>}
        <label>Requests per minute<input type="number" min={1} max={300} required value={approval.maxRequestsPerMinute} onChange={event => setApproval({...approval, maxRequestsPerMinute: Number(event.target.value)})}/></label>
        <p className={`${styles.summary} ${styles.wide}`}>{approval.scopeMode === 'all-athleticmind' ? 'All Athletic Mind access will be saved, including future eligible programs. No current program is required to issue this credential.' : approval.grants.length ? `${approval.grants.length} explicit program grant(s) will be saved.` : 'This credential will be issued with no athlete data access.'} Grants can be added or removed later. Test grants require synthetic program and team records. Expiry must be within one year. No credentials are emailed automatically.</p>
        <button className={styles.button} disabled={busy} type="submit"><ShieldCheck size={15}/>{busy ? 'Issuing…' : approval.scopeMode === 'all-athleticmind' || approval.grants.length ? 'Approve and issue key' : 'Issue key with no data access'}</button>
      </form></> : <p className={styles.empty}>Select a request to confirm the partner identity and credential settings. A program grant is not required to issue a key.</p>}</section></div>
      <section className={`${styles.panel} ${styles.keys}`}><h2>Issued keys</h2><p className={styles.notice}>Each credential belongs to a partner. Program grants control data access independently. Existing keys retain their exact saved grants. Secrets are never returned in this list.</p>
        {!data.keys.length && <p className={styles.empty}>No keys have been issued.</p>}
        {data.keys.map(key => <div key={key.keyId} className={styles.keyBlock}><div className={styles.keyRow}><div><strong>{key.partnerName || 'Existing partner credential'}</strong><br/><code>{key.prefix || `${key.keyId.slice(0, 12)}…`}</code><p>{key.partnerId || 'Legacy identity'} · {key.environment} · {key.status}</p><p>Permissions: {key.scopes.join(', ')}<br/>Expires: {key.expiresAt}</p>{key.scopeMode === 'all-athleticmind' ? <p className={styles.zeroAccess}>All Athletic Mind programs · current and future eligible programs</p> : !keyGrants(key).length ? <p className={styles.zeroAccess}>No grants — no athlete data access.</p> : keyGrants(key).map(grant => <p key={grant.organizationId}>{data.scopeOptions.organizations.find(org => org.id === grant.organizationId)?.name || grant.organizationId}<br/>Teams: {grant.teamIds.map(id => data.scopeOptions.teams.find(team => team.id === id)?.name || id).join(', ')}</p>)}</div>
          {key.status !== 'revoked' && !key.revokedAt && <div className={styles.keyActions}><button type="button" className={styles.button} disabled={busy || key.status !== 'active'} onClick={() => setEditing({keyId: key.keyId, scopeMode: key.scopeMode || 'explicit', grants: keyGrants(key).map(grant => ({...grant, teamIds: [...grant.teamIds]}))})}>Edit grants</button><label>Overlap (minutes)<input type="number" min={0} max={60} value={overlap} onChange={event => setOverlap(Number(event.target.value))}/></label><button type="button" className={styles.button} disabled={busy || key.status !== 'active' || overlap < 0 || overlap > 60} onClick={() => void mutate({action: 'rotate', keyId: key.keyId, overlapMinutes: overlap})}>Rotate</button><button type="button" className={styles.button} disabled={busy} onClick={() => revokeConfirm === key.keyId ? void mutate({action: 'revoke', keyId: key.keyId}) : setRevokeConfirm(key.keyId)}>{revokeConfirm === key.keyId ? 'Confirm revoke' : 'Revoke'}</button></div>}</div>
          {editing?.keyId === key.keyId && <section className={styles.grantEdit} aria-label="Edit partner grants"><label>Program access<select aria-label="Edit program access" value={editing.scopeMode} onChange={event => setEditing({...editing, scopeMode: event.target.value as 'explicit' | 'all-athleticmind', grants: []})}><option value="explicit">Selected program and team grants</option><option value="all-athleticmind">All Athletic Mind programs</option></select></label>{editing.scopeMode === 'all-athleticmind' ? <p className={styles.notice}>Includes current and future active programs explicitly configured as Athletic Mind. PulseCheck and programs without that configuration are excluded. Eligibility and consent are checked on every request.</p> : <GrantEditor value={editing.grants} onChange={grants => setEditing({...editing, grants})} options={data.scopeOptions} more={more}/>}<p className={styles.notice}>Saving replaces this key’s access scope. An empty selected-grants list stops athlete data access. The partner credential stays the same.</p><div className={styles.keyActions}><button type="button" className={styles.button} disabled={busy} onClick={() => void mutate({action: 'update-grants', keyId: key.keyId, scopeMode: editing.scopeMode, grants: editing.grants})}>Save grants</button><button type="button" className={styles.button} disabled={busy} onClick={() => setEditing(null)}>Cancel</button></div></section>}
        </div>)}{more('keys')}
      </section>
    </>}
  </div></div>;
}
