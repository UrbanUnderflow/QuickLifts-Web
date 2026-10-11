/** Template upgrades add defaults without deleting stages saved by another version. */
export function reconcilePipeListStages<T extends { id: string }>(saved: T[], defaults: T[]): T[] {
  const savedById = new Map(saved.map(stage => [stage.id, stage]));
  const defaultIds = new Set(defaults.map(stage => stage.id));
  return [
    ...defaults.map(stage => savedById.get(stage.id) || stage),
    ...saved.filter(stage => !defaultIds.has(stage.id)),
  ];
}
