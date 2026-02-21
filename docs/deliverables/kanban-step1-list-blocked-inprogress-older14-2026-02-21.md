# Kanban Step 1 – Blocked / In-Progress Tickets Older Than 14 Days (2026-02-21)

## Step Definition

> List all tickets in `project/kanban/board.md` with `STATUS: BLOCKED` or `STATUS: IN_PROGRESS` whose `UPDATED_AT` timestamp is older than 14 days.

Audit date: **2026-02-21**  
Canonical file: `project/kanban/board.md`

Cutoff for "older than 14 days":
- Audit date: 2026-02-21
- Threshold: 14 days
- **Cutoff date:** 2026-02-07

A ticket is included in this list only if **both** are true:

1. `STATUS` is `BLOCKED` or `in-progress` / `IN_PROGRESS`, and  
2. `UPDATED_AT` is earlier than **2026-02-07**.

---

## 1. STATUS: BLOCKED tickets

Search in `project/kanban/board.md`:

```bash
grep -ni "STATUS: BLOCKED" project/kanban/board.md || echo "NO_BLOCKED_FOUND"
```

Result:

```text
NO_BLOCKED_FOUND
```

**Blocked tickets older than 14 days:**

```text
<none – no STATUS: BLOCKED tickets on the board>
```

---

## 2. STATUS: in-progress / IN_PROGRESS tickets

From `project/kanban/board.md`, the in-progress tickets are:

1. Nora
   ```text
   STATUS: in-progress
   PROJECT: General
   ASSIGNEE: Nora
   CREATED_AT: 2026-02-13
   UPDATED_AT: 2026-02-19
   ```

2. Scout
   ```text
   STATUS: in-progress
   PROJECT: General
   ASSIGNEE: Scout
   CREATED_AT: 2026-02-16
   UPDATED_AT: 2026-02-19
   ```

3. Sage
   ```text
   STATUS: in-progress
   PROJECT:
   ASSIGNEE: Sage
   CREATED_AT: 2026-02-19
   UPDATED_AT: 2026-02-19
   ```

4. Solara
   ```text
   STATUS: in-progress
   PROJECT: General
   ASSIGNEE: Solara
   CREATED_AT: 2026-02-16
   UPDATED_AT: 2026-02-16
   ```

Comparison vs cutoff (2026-02-07):

- Nora:   UPDATED_AT = 2026-02-19 → newer than cutoff → **exclude**
- Scout:  UPDATED_AT = 2026-02-19 → newer than cutoff → **exclude**
- Sage:   UPDATED_AT = 2026-02-19 → newer than cutoff → **exclude**
- Solara: UPDATED_AT = 2026-02-16 → newer than cutoff → **exclude**

**In-progress tickets older than 14 days:**

```text
<none – no STATUS: in-progress tickets with UPDATED_AT before 2026-02-07>
```

---

## 3. Final list of matching tickets

Tickets in `project/kanban/board.md` with:
- `STATUS: BLOCKED` or `STATUS: IN_PROGRESS` / `in-progress`, **and**
- `UPDATED_AT < 2026-02-07`

```text
<no matching tickets>
```

**Conclusion:**
- There are **zero** tickets on the canonical board that are both blocked or in-progress **and** older than 14 days as of 2026-02-21.
