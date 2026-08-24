export const filterBySelectedTeamIds = <T>(
  items: T[],
  selectedTeamIds: string[],
  getTeamIds: (item: T) => Iterable<string>
): T[] => {
  if (selectedTeamIds.length === 0) return items;

  const selectedTeamIdSet = new Set(selectedTeamIds);
  return items.filter((item) => {
    for (const teamId of getTeamIds(item)) {
      if (selectedTeamIdSet.has(teamId)) return true;
    }
    return false;
  });
};
