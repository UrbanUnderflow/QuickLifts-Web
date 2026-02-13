# Meeting Minutes Schema Update

## Old Structure
- executiveSummary
- topicsDiscussed (title + summary)
- keyInsights (string[])
- decisions (string[])
- openQuestions (string[])
- actionItems (task + owner)

## New Structure (2026-02-11)
- executiveSummary (2-3 sentence synthesis)
- valueInsights: array of { title, takeaway, impact }
- strategicDecisions: string[] summarizing positions reached
- nextActions: array of { task, owner, due? }
- highlights: array of { speaker, summary } for brief notable moments
- risksOrOpenQuestions: string[] focusing on blockers or follow-up questions

This schema shift supports the new “thoughtful synthesis” requirement by emphasizing actionable insights and minimizing raw transcript content.
