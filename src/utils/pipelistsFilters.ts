export const toggleFilterSelection = <T extends string>(
  current: readonly T[],
  value: T,
): T[] =>
  current.includes(value)
    ? current.filter((candidate) => candidate !== value)
    : [...current, value];

export const matchesPipelineFilters = <TStage extends string, TPriority extends string>(
  item: { stage: TStage; priority: TPriority },
  stageFilters: readonly TStage[],
  priorityFilters: readonly TPriority[],
) =>
  (stageFilters.length === 0 || stageFilters.includes(item.stage)) &&
  (priorityFilters.length === 0 || priorityFilters.includes(item.priority));
