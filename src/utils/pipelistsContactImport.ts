import { normalizeLeadTags } from './pipelistsTags';

export type ImportedContact = {
  title: string;
  tags: string[];
  organization: string;
  description: string;
  notes: string;
  nextStep: string;
  sourceUrl: string;
  imageUrl: string;
  linkedinUrl: string;
  contactEmails: string[];
  contactPhone: string;
  photo?: { name: string; contentType: string; dataUrl: string };
};

const text = (value: unknown, max = 30000): string => {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' || value.length > max) throw new Error('A contact field is invalid or too long.');
  return value.trim();
};
const url = (value: unknown): string => {
  const result = text(value, 4000);
  if (result && !/^https?:\/\//i.test(result)) throw new Error('Source and LinkedIn links must use http or https.');
  if (result) new URL(result);
  return result;
};

export function parseContactImport(input: unknown): ImportedContact[] {
  const rows = (input as { contacts?: unknown })?.contacts;
  if (!Array.isArray(rows) || !rows.length || rows.length > 100) throw new Error('Choose a contact file containing 1 to 100 contacts.');
  return rows.map((row, index) => {
    if (!row || typeof row !== 'object') throw new Error(`Contact ${index + 1} is invalid.`);
    const title = text(row.title, 200);
    if (!title) throw new Error(`Contact ${index + 1} needs a name.`);
    const contactEmails = row.contactEmails ?? [];
    if (!Array.isArray(contactEmails) || contactEmails.length > 20 || contactEmails.some((email) => typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error(`Check the email addresses for ${title}.`);
    let photo: ImportedContact['photo'];
    if (row.photo) {
      const contentType = text(row.photo.contentType, 50);
      const dataUrl = text(row.photo.dataUrl, 8 * 1024 * 1024);
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType) || !dataUrl.startsWith(`data:${contentType};base64,`) || !/^[A-Za-z0-9+/]+={0,2}$/.test(dataUrl.split(',')[1] || '')) throw new Error(`Use a JPEG, PNG or WebP photo for ${title}.`);
      photo = { name: text(row.photo.name, 200) || 'portrait.jpg', contentType, dataUrl };
    }
    return { title, tags: normalizeLeadTags(row.tags), organization: text(row.organization, 1000), description: text(row.description), notes: text(row.notes), nextStep: text(row.nextStep), sourceUrl: url(row.sourceUrl), imageUrl: url(row.imageUrl), linkedinUrl: url(row.linkedinUrl), contactEmails: contactEmails.map((email: string) => email.trim().toLowerCase()), contactPhone: text(row.contactPhone, 100), ...(photo ? { photo } : {}) };
  });
}

export function selectNewContacts<T extends Pick<ImportedContact, 'title' | 'organization' | 'contactEmails'>>(rows: T[], existing: Pick<ImportedContact, 'title' | 'organization' | 'contactEmails'>[]): T[] {
  const names = new Set<string>();
  const emails = new Set<string>();
  const key = (row: Pick<ImportedContact, 'title' | 'organization'>) => `${row.title.trim().toLowerCase()}|${row.organization.trim().toLowerCase()}`;
  const remember = (row: Pick<ImportedContact, 'title' | 'organization' | 'contactEmails'>) => { names.add(key(row)); row.contactEmails.forEach((email) => emails.add(email.toLowerCase())); };
  existing.forEach(remember);
  return rows.filter((row) => {
    if (names.has(key(row)) || row.contactEmails.some((email) => emails.has(email.toLowerCase()))) return false;
    remember(row);
    return true;
  });
}
