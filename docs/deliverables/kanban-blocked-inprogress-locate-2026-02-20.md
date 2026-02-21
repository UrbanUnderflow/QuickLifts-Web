# Kanban Blocked / In-Progress Locate — 2026-02-20

Step:

> Open the canonical kanban file `project/kanban/board.md` and locate all tickets with `STATUS: BLOCKED` or `STATUS: IN_PROGRESS` where the `UPDATED_AT` timestamp is older than 14 days.

## Canonical board

- File: `project/kanban/board.md`
- Source of truth: Firestore `kanbanTasks` (exported via `scripts/exportKanbanBoardToMarkdown.js`).

## Method 1 — Structured scanner

Using `scripts/scanKanbanBlockedAndStale.js`:

```bash
cd /Users/noraclawdbot/Documents/GitHub/QuickLifts-Web \
  && node scripts/scanKanbanBlockedAndStale.js
```

Output:

```text
KANBAN_SCAN_RESULT
BOARD: /Users/noraclawdbot/Documents/GitHub/QuickLifts-Web/project/kanban/board.md
CUTOFF_DAYS: 14
BLOCKED_COUNT: 0
STALE_IN_PROGRESS_COUNT: 0
```

Interpretation:

- `BLOCKED_COUNT: 0` → No `STATUS: BLOCKED` tickets exist in the board.
- `STALE_IN_PROGRESS_COUNT: 0` → No `STATUS: in-progress` tickets have `UPDATED_AT` older than 14 days.

## Method 2 — Direct text grep (defensive cross-check)

Additional checks directly on the markdown file:

```bash
# Any blocked tickets at all?
grep -ni "STATUS: BLOCKED" project/kanban/board.md || echo "NO_BLOCKED_FOUND"

# Any in-progress tickets with explicit UPDATED_AT older than 14 days (manual spot-check pattern)?
node -e "
const fs=require('fs'), path=require('path');
const board=path.join('project','kanban','board.md');
const txt=fs.readFileSync(board,'utf8');
const blocks=txt.split(/\n(?=### )/);
const cutoff=new Date('2026-02-06');
let matches=0;
for(const b of blocks){
  if(!b.includes('STATUS: in-progress')) continue;
  const m=b.match(/UPDATED_AT:\s*(\d{4}-\d{2}-\d{2})/);
  if(!m) continue;
  const d=new Date(m[1]);
  if(d<cutoff){ console.log('MATCH', b.split('\n')[0], 'UPDATED_AT', m[1]); matches++; }
}
console.log('MANUAL_STALE_IN_PROGRESS_COUNT', matches);
" 
```

Results:

```text
NO_BLOCKED_FOUND
MANUAL_STALE_IN_PROGRESS_COUNT 0
```

## Conclusion

Across both structured scanner and direct text checks on `project/kanban/board.md` as of 2026-02-20:

- There are **no** tickets with `STATUS: BLOCKED`.
- There are **no** tickets with `STATUS: IN_PROGRESS` (`STATUS: in-progress` in the markdown export) whose `UPDATED_AT` timestamp is older than 14 days.

Therefore, the step’s requirement to "locate all" such tickets yields an **empty set**; there are no matching tickets to list or to carry into subsequent edit steps.
