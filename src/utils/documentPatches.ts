export type DocumentPatch =
  | {
      type: 'replace_exact';
      old_text: string;
      new_text: string;
    }
  | {
      type: 'replace_between';
      start_anchor: string;
      end_anchor: string;
      new_text: string;
      // If true, keep anchors and replace only content between them (default true).
      keep_anchors?: boolean;
    }
  | {
      type: 'insert_after';
      after_anchor: string;
      insert_text: string;
    }
  | {
      type: 'delete_between';
      start_anchor: string;
      end_anchor: string;
      // If true, keep anchors and delete only content between them (default true).
      keep_anchors?: boolean;
    };

export type PatchApplyFailure = {
  patchIndex: number;
  patch: DocumentPatch;
  reason: string;
};

export type ApplyPatchesResult = {
  text: string;
  appliedCount: number;
  failures: PatchApplyFailure[];
};

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let idx = 0;
  while (true) {
    const next = haystack.indexOf(needle, idx);
    if (next === -1) break;
    count += 1;
    idx = next + needle.length;
  }
  return count;
}

function findUniqueIndex(haystack: string, needle: string): { index: number; reason?: string } {
  if (!needle) return { index: -1, reason: 'Empty anchor/text' };
  const first = haystack.indexOf(needle);
  if (first === -1) return { index: -1, reason: 'Anchor/text not found' };
  const second = haystack.indexOf(needle, first + needle.length);
  if (second !== -1) return { index: -1, reason: 'Anchor/text is not unique' };
  return { index: first };
}

export function applyDocumentPatches(fullText: string, patches: DocumentPatch[]): ApplyPatchesResult {
  let text = String(fullText ?? '');
  const failures: PatchApplyFailure[] = [];
  let appliedCount = 0;

  patches.forEach((patch, patchIndex) => {
    try {
      if (patch.type === 'replace_exact') {
        const oldText = patch.old_text ?? '';
        const newText = patch.new_text ?? '';
        const occ = countOccurrences(text, oldText);
        if (occ !== 1) {
          throw new Error(occ === 0 ? 'old_text not found' : 'old_text not unique');
        }
        const idx = text.indexOf(oldText);
        text = text.slice(0, idx) + newText + text.slice(idx + oldText.length);
        appliedCount += 1;
        return;
      }

      if (patch.type === 'insert_after') {
        const anchor = patch.after_anchor ?? '';
        const insertText = patch.insert_text ?? '';
        const found = findUniqueIndex(text, anchor);
        if (found.index < 0) throw new Error(found.reason || 'after_anchor not found');
        const insertAt = found.index + anchor.length;
        text = text.slice(0, insertAt) + insertText + text.slice(insertAt);
        appliedCount += 1;
        return;
      }

      if (patch.type === 'replace_between') {
        const start = patch.start_anchor ?? '';
        const end = patch.end_anchor ?? '';
        const newText = patch.new_text ?? '';
        const keepAnchors = patch.keep_anchors !== false;

        const startFound = findUniqueIndex(text, start);
        if (startFound.index < 0) throw new Error(`start_anchor: ${startFound.reason || 'not found'}`);
        const endFound = findUniqueIndex(text, end);
        if (endFound.index < 0) throw new Error(`end_anchor: ${endFound.reason || 'not found'}`);

        const startEnd = startFound.index + start.length;
        const endStart = endFound.index;
        if (endStart < startEnd) throw new Error('end_anchor occurs before start_anchor');

        if (keepAnchors) {
          text = text.slice(0, startEnd) + newText + text.slice(endStart);
        } else {
          text = text.slice(0, startFound.index) + newText + text.slice(endFound.index + end.length);
        }
        appliedCount += 1;
        return;
      }

      if (patch.type === 'delete_between') {
        const start = patch.start_anchor ?? '';
        const end = patch.end_anchor ?? '';
        const keepAnchors = patch.keep_anchors !== false;

        const startFound = findUniqueIndex(text, start);
        if (startFound.index < 0) throw new Error(`start_anchor: ${startFound.reason || 'not found'}`);
        const endFound = findUniqueIndex(text, end);
        if (endFound.index < 0) throw new Error(`end_anchor: ${endFound.reason || 'not found'}`);

        const startEnd = startFound.index + start.length;
        const endStart = endFound.index;
        if (endStart < startEnd) throw new Error('end_anchor occurs before start_anchor');

        if (keepAnchors) {
          text = text.slice(0, startEnd) + text.slice(endStart);
        } else {
          text = text.slice(0, startFound.index) + text.slice(endFound.index + end.length);
        }
        appliedCount += 1;
        return;
      }

      // Exhaustiveness check
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _never: never = patch;
    } catch (e: any) {
      failures.push({
        patchIndex,
        patch,
        reason: e?.message || String(e),
      });
    }
  });

  return { text, appliedCount, failures };
}

