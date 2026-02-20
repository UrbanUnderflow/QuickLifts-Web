# Kanban Stale In-Progress Scan (Markdown Board) — 2026-02-20

Task step:

> For any `STATUS: IN_PROGRESS` ticket in `project/kanban/board.md` with `UPDATED_AT` older than 14 days and not touching partnership-related artifacts, change its status to `STATUS: BACKLOG` and prepend a `DEFERRED_REASON: Not aligned with Partnership-Led Community Growth push` line.

## 1. Board format and cutoff

Shared board file (exported from Firestore `kanbanTasks`):

- `project/kanban/board.md`

Each ticket block includes an `UPDATED_AT: YYYY-MM-DD` line. For this scan, tickets are considered **stale** if:

- `STATUS: in-progress` (case-sensitive, matching the markdown export), and
- `UPDATED_AT < 2026-02-06` (14 days before 2026-02-20).

## 2. Scan performed

A Node script was run ad-hoc to inspect the markdown blocks:

```bash
cd /Users/noraclawdbot/Documents/GitHub/QuickLifts-Web && node -e "
const fs=require('fs');
const path=require('path');
const boardPath=path.join('project','kanban','board.md');
const txt=fs.readFileSync(boardPath,'utf8');
const blocks=txt.split(/\n(?=### )/);
const cutoff=new Date('2026-02-06');
const stale=[];
for(const block of blocks){
  if(!block.includes('STATUS: in-progress')) continue;
  const mDate=block.match(/UPDATED_AT:\s*(\d{4}-\d{2}-\d{2})/);
  if(!mDate) continue;
  const d=new Date(mDate[1]);
  if(d<cutoff){stale.push(block.split('\n')[0]);}
}
console.log('STALE_IN_PROGRESS_COUNT',stale.length);
stale.forEach(b=>console.log('STALE_IN_PROGRESS_BLOCK',b));
" 
```

Output:

```text
STALE_IN_PROGRESS_COUNT 0
```

No block headers were printed, confirming that **no** tickets matched the stale in-progress criteria.

## 3. Implication for this step

Given the current contents of `project/kanban/board.md` as of 2026-02-20:

- There are **no** `STATUS: in-progress` tickets with `UPDATED_AT` older than 14 days.
- Therefore, there are no tickets to:
  - Downgrade to `STATUS: BACKLOG`, or
  - Annotate with `DEFERRED_REASON: Not aligned with Partnership-Led Community Growth push`.

This step is effectively satisfied with **zero changes** to the board — there are no stale, non-partnership in-progress tickets to move or annotate.

If/when such tickets appear in the future, the same scan pattern can be re-used to identify them and apply the required `STATUS` and `DEFERRED_REASON` edits.
