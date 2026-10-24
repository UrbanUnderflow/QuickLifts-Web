/** Draft contact planning only. Activation requires verified responders and delivery setup. */
export type ClinicalContact = { name: string; email: string; phone: string };
export type DesignatedClinicalStaff = {
  primary: ClinicalContact;
  backup: ClinicalContact | null;
  timeZone: string;
  coverage: { mode: 'scheduled' | 'always'; days: number[]; start: string; end: string };
  acknowledgmentMinutes: number;
};
export type SavedClinicalStaff = DesignatedClinicalStaff & { status: 'draft'; revision: number };
export const emptyClinicalStaff = (): DesignatedClinicalStaff => ({
  primary: { name: '', email: '', phone: '' }, backup: null, timeZone: 'America/New_York',
  coverage: { mode: 'scheduled', days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' }, acknowledgmentMinutes: 5,
});
export function validateClinicalStaff(value: unknown): DesignatedClinicalStaff {
  const v = value as DesignatedClinicalStaff;
  if (!v || typeof v !== 'object') throw new Error('Clinical staff settings are required.');
  const allowed = ['primary', 'backup', 'timeZone', 'coverage', 'acknowledgmentMinutes'];
  if (Object.keys(v).some(k => !allowed.includes(k))) throw new Error('Unsupported clinical staff setting.');
  const contact = (person: ClinicalContact, label: string): ClinicalContact => {
    if (!person || Object.keys(person).some(k => !['name', 'email', 'phone'].includes(k))) throw new Error(`${label} contact is required.`);
    const name = typeof person.name === 'string' ? person.name.trim() : '';
    const email = typeof person.email === 'string' ? person.email.trim().toLowerCase() : '';
    const phone = typeof person.phone === 'string' ? person.phone.trim().replace(/[\s().-]/g, '') : '';
    if (!name || name.length > 100) throw new Error(`Enter ${label.toLowerCase()}'s name.`);
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`Enter ${label.toLowerCase()}'s valid email.`);
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error(`Enter ${label.toLowerCase()}'s phone with country code, such as +1 410 555 0123.`);
    return { name, email, phone };
  };
  const primary = contact(v.primary, 'Primary');
  const backup = v.backup === null ? null : contact(v.backup, 'Backup');
  if (backup && (backup.email === primary.email || backup.phone === primary.phone)) throw new Error('Choose a different person and phone for backup coverage.');
  if (typeof v.timeZone !== 'string' || v.timeZone.length > 100) throw new Error('Choose a valid time zone.');
  try { new Intl.DateTimeFormat('en-US', { timeZone: v.timeZone }).format(); } catch { throw new Error('Choose a valid time zone.'); }
  const c = v.coverage;
  if (!c || !['scheduled', 'always'].includes(c.mode) || !Array.isArray(c.days) || c.days.some(d => !Number.isInteger(d) || d < 0 || d > 6)) throw new Error('Choose valid coverage days.');
  const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (!time.test(c.start) || !time.test(c.end) || (c.mode === 'scheduled' && (!c.days.length || c.start >= c.end))) throw new Error('Choose coverage hours ending after the start time. Overnight shifts need separate coverage planning.');
  if (!Number.isInteger(v.acknowledgmentMinutes) || v.acknowledgmentMinutes < 1 || v.acknowledgmentMinutes > 30) throw new Error('Choose an acknowledgment window from 1 to 30 minutes.');
  return { primary, backup, timeZone: v.timeZone, coverage: { mode: c.mode, days: [...new Set(c.days)].sort(), start: c.start, end: c.end }, acknowledgmentMinutes: v.acknowledgmentMinutes };
}
