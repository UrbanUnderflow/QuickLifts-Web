# Git Agent Attribution Workflow

This repo now supports automatic agent attribution in commit metadata without creating separate GitHub accounts.

## What happens automatically

A commit-message hook is installed at `.githooks/commit-msg`.

On every commit it appends:
- a subject tag prefix: `[<name>]`
- a commit trailer: `Agent: <name>`

## One-time setup

From the project root:

```bash
yarn agent:setup-hooks
```

## How to commit with an agent tag

Set an agent identity before committing:

```bash
export AGENT_NAME=nora
```

Then commit using:

```bash
yarn agent:commit -m "Fix token totals in virtual office"
```

or plain git commit (the hook still applies if `AGENT_NAME` is set in your shell):

```bash
git commit -m "Fix token totals in virtual office"
```

## Quick overrides

- `VIRTUALOFFICE_AGENT` or `QUICKLIFTS_AGENT` can be used instead of `AGENT_NAME`.
- If no agent variable is set, the hook leaves the message unchanged.
