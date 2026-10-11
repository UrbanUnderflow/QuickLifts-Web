type LinkableLead = { id: string; linkedLeadIds?: string[]; deletedAt?: string; movedToListId?: string; updatedAt: string };

export function normalizeLinkedLeadIds(value: unknown, selfId: string): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((id): id is string => typeof id === 'string' && Boolean(id.trim()) && id !== selfId))]
    : [];
}

export function getLinkedLeads<T extends LinkableLead>(items: T[], leadId: string): T[] {
  const lead = items.find(item => item.id === leadId);
  if (!lead || lead.deletedAt || lead.movedToListId) return [];
  return items.filter(item => item.id !== leadId && !item.deletedAt && !item.movedToListId &&
    (lead.linkedLeadIds?.includes(item.id) || item.linkedLeadIds?.includes(leadId)));
}

export function setLeadLink<T extends LinkableLead>(items: T[], leadId: string, targetId: string, linked: boolean, updatedAt: string): T[] {
  if (leadId === targetId || ![leadId, targetId].every(id => items.some(item => item.id === id && !item.deletedAt && !item.movedToListId))) return items;
  return items.map(item => {
    if (item.id !== leadId && item.id !== targetId) return item;
    const otherId = item.id === leadId ? targetId : leadId;
    const ids = normalizeLinkedLeadIds(item.linkedLeadIds, item.id).filter(id => id !== otherId);
    return { ...item, linkedLeadIds: linked ? [...ids, otherId] : ids, updatedAt };
  });
}
