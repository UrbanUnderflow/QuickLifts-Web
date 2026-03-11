import { auth } from '../firebase/config';
import type { CreateSystemOverviewShareLinkInput, SystemOverviewShareLink } from './types';

const getAdminAuthHeaders = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Authenticated admin session required.');
  }

  const idToken = await currentUser.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${idToken}`,
  };
};

export const systemOverviewShareService = {
  async list(sectionId: string): Promise<SystemOverviewShareLink[]> {
    const headers = await getAdminAuthHeaders();
    const response = await fetch(`/api/admin/system-overview/share-links?sectionId=${encodeURIComponent(sectionId)}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error('Failed to load share links.');
    }

    const payload = await response.json();
    return Array.isArray(payload.links) ? payload.links : [];
  },

  async create(input: CreateSystemOverviewShareLinkInput): Promise<SystemOverviewShareLink> {
    const headers = await getAdminAuthHeaders();
    const response = await fetch('/api/admin/system-overview/share-links', {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error('Failed to create share link.');
    }

    const payload = await response.json();
    return payload.link as SystemOverviewShareLink;
  },

  async revoke(token: string): Promise<void> {
    const headers = await getAdminAuthHeaders();
    const response = await fetch(`/api/admin/system-overview/share-links/${encodeURIComponent(token)}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      throw new Error('Failed to revoke share link.');
    }
  },
};
