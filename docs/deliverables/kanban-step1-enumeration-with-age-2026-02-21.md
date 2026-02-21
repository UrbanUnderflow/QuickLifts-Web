# Kanban Step 1 – BLOCKED / IN_PROGRESS Enumeration with Age (2026-02-21)

Step 1 requirement:

> Enumerate all tickets with `STATUS: BLOCKED` or `STATUS: IN_PROGRESS` whose `UPDATED_AT` timestamp is older than 14 days.

Audit date: **2026-02-21**  
Cutoff for "older than 14 days": **2026-02-07**  
Board: `project/kanban/board.md`

Below, I list **all** `STATUS: BLOCKED` and `STATUS: in-progress` tickets on the board, then explicitly mark whether each is older than 14 days.

---

## 1. STATUS: BLOCKED tickets

Search result:

- `STATUS: BLOCKED` occurrences in `project/kanban/board.md`: **0**

So there are **no** blocked tickets to evaluate for age.

---

## 2. STATUS: in-progress tickets (with age vs cutoff)

All in-progress tickets on the board:

| Assignee | Status       | UPDATED_AT  | Older than 14 days? |
|----------|--------------|-------------|----------------------|
| Nora     | in-progress  | 2026-02-19  | No (>= 2026-02-07)   |
| Scout    | in-progress  | 2026-02-19  | No (>= 2026-02-07)   |
| Sage     | in-progress  | 2026-02-19  | No (>= 2026-02-07)   |
| Solara   | in-progress  | 2026-02-16  | No (>= 2026-02-07)   |

All `UPDATED_AT` dates are **after** the cutoff date (2026-02-07).

---

## 3. Tickets matching the Step 1 filter

Filter:

- `STATUS: BLOCKED` or `STATUS: IN_PROGRESS` / `in-progress`, **and**
- `UPDATED_AT` < **2026-02-07**

From sections 1 and 2 above:

- Blocked tickets: **none**.
- In-progress tickets older than 14 days: **none**.

Therefore, the set of tickets matching the Step 1 filter is:

```text
<no matching tickets>
```

This file enumerates all relevant tickets and shows explicitly that **zero** tickets currently satisfy the "BLOCKED or IN_PROGRESS and older than 14 days" condition as of 2026-02-21.
