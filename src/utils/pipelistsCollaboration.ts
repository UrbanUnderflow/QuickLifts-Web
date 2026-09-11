export const pipeListSnapshotsEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => pipeListSnapshotsEqual(value, right[index]));
  }
  if (isRecord(left) && isRecord(right)) {
    const keys = Object.keys(left).filter((key) => left[key] !== undefined);
    return keys.length === Object.keys(right).filter((key) => right[key] !== undefined).length &&
      keys.every((key) => pipeListSnapshotsEqual(left[key], right[key]));
  }
  return false;
};
const valuesEqual = pipeListSnapshotsEqual;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isKeyedRecordArray = (value: unknown[]): value is Array<Record<string, unknown> & { id: string }> =>
  value.every((entry) => isRecord(entry) && typeof entry.id === 'string' && entry.id.length > 0);

function mergeKeyedArrays(base: unknown[], remote: unknown[], local: unknown[]): unknown[] {
  const baseEntries = new Map(
    (isKeyedRecordArray(base) ? base : []).map((entry) => [entry.id, entry] as const),
  );
  const remoteEntries = new Map(
    (isKeyedRecordArray(remote) ? remote : []).map((entry) => [entry.id, entry] as const),
  );
  const localEntries = new Map(
    (isKeyedRecordArray(local) ? local : []).map((entry) => [entry.id, entry] as const),
  );
  const order = Array.from(new Set([
    ...localEntries.keys(),
    ...remoteEntries.keys(),
    ...baseEntries.keys(),
  ]));

  return order.flatMap((id) => {
    const merged = mergeCollaborativeValue(
      baseEntries.get(id),
      remoteEntries.get(id),
      localEntries.get(id),
    );
    return merged === undefined ? [] : [merged];
  });
}

function mergeCollaborativeValue(base: unknown, remote: unknown, local: unknown): unknown {
  if (valuesEqual(local, base)) return remote;
  if (valuesEqual(remote, base)) return local;
  if (valuesEqual(remote, local)) return local;

  if (local === undefined) {
    return base === undefined || !valuesEqual(remote, base) ? remote : undefined;
  }
  if (remote === undefined) {
    return base === undefined || !valuesEqual(local, base) ? local : undefined;
  }

  if (Array.isArray(remote) && Array.isArray(local)) {
    const baseArray = Array.isArray(base) ? base : [];
    if (isKeyedRecordArray(remote) && isKeyedRecordArray(local) && isKeyedRecordArray(baseArray)) {
      return mergeKeyedArrays(baseArray, remote, local);
    }
    return local;
  }

  if (isRecord(remote) && isRecord(local)) {
    const baseRecord = isRecord(base) ? base : {};
    const keys = new Set([...Object.keys(baseRecord), ...Object.keys(remote), ...Object.keys(local)]);
    return Object.fromEntries(
      Array.from(keys).flatMap((key) => {
        const merged = mergeCollaborativeValue(baseRecord[key], remote[key], local[key]);
        return merged === undefined ? [] : [[key, merged]];
      }),
    );
  }

  return local;
}

export const mergePipeListSnapshotsThreeWay = <T,>(base: T, remote: T, local: T): T =>
  mergeCollaborativeValue(base, remote, local) as T;

export type PipeListAccessAdditionPlan = {
  addListIds: string[];
  alreadyAssignedListIds: string[];
  unavailableListIds: string[];
};

export type PipeListMemberAccessMerge = {
  added: boolean;
  viewerEmails: string[];
  editorEmails: string[];
};

const uniqueListIds = (listIds: readonly string[]) =>
  Array.from(new Set(listIds.map((listId) => listId.trim()).filter(Boolean)));

export const planPipeListAccessAdditions = ({
  selectedListIds,
  availableListIds,
  existingListIds,
}: {
  selectedListIds: readonly string[];
  availableListIds: readonly string[];
  existingListIds: readonly string[];
}): PipeListAccessAdditionPlan => {
  const availableIds = new Set(uniqueListIds(availableListIds));
  const existingIds = new Set(uniqueListIds(existingListIds));

  return uniqueListIds(selectedListIds).reduce<PipeListAccessAdditionPlan>(
    (plan, listId) => {
      if (existingIds.has(listId)) {
        plan.alreadyAssignedListIds.push(listId);
      } else if (!availableIds.has(listId)) {
        plan.unavailableListIds.push(listId);
      } else {
        plan.addListIds.push(listId);
      }
      return plan;
    },
    { addListIds: [], alreadyAssignedListIds: [], unavailableListIds: [] },
  );
};

const uniqueEmails = (emails: readonly string[]) =>
  Array.from(new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean)));

export const addPipeListMemberAccess = ({
  viewerEmails,
  editorEmails,
  memberEmail,
  access,
}: {
  viewerEmails: readonly string[];
  editorEmails: readonly string[];
  memberEmail: string;
  access: 'read' | 'edit';
}): PipeListMemberAccessMerge => {
  const normalizedViewerEmails = uniqueEmails(viewerEmails);
  const normalizedEditorEmails = uniqueEmails(editorEmails);
  const normalizedMemberEmail = memberEmail.trim().toLowerCase();

  if (
    !normalizedMemberEmail ||
    normalizedViewerEmails.includes(normalizedMemberEmail) ||
    normalizedEditorEmails.includes(normalizedMemberEmail)
  ) {
    return {
      added: false,
      viewerEmails: normalizedViewerEmails,
      editorEmails: normalizedEditorEmails,
    };
  }

  return {
    added: true,
    viewerEmails: access === 'read'
      ? [...normalizedViewerEmails, normalizedMemberEmail]
      : normalizedViewerEmails,
    editorEmails: access === 'edit'
      ? [...normalizedEditorEmails, normalizedMemberEmail]
      : normalizedEditorEmails,
  };
};
