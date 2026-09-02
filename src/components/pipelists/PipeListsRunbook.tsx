import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { marked, type Token, type Tokens } from 'marked';
import {
  AlertTriangle,
  BookOpen,
  Check,
  Clipboard,
  Clock3,
  Download,
  Edit3,
  FileClock,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  checkPipeListsRunbookCurrent,
  loadPipeListsRunbook,
  loadPipeListsRunbookRevision,
  PipeListsRunbookConflictError,
  savePipeListsRunbook,
  type PipeListsRunbookRevision,
  type PipeListsRunbookSnapshot,
} from '../../api/pipelistsRunbook';
import {
  buildPipeListsRunbookLineDiff,
  isSafePipeListsRunbookUrl,
  PIPELISTS_RUNBOOK_CONTENT_MAX_LENGTH,
  PIPELISTS_RUNBOOK_TITLE_MAX_LENGTH,
  summarizePipeListsRunbookDiff,
} from '../../utils/pipelistsRunbook';

type PipeListsRunbookProps = {
  user: User;
  onDirtyChange?: (dirty: boolean) => void;
};

const HISTORY_REFRESH_INTERVAL_MS = 20_000;

const formatRevisionTime = (value: string | null) => {
  if (!value) return 'Time pending';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  }).format(parsed);
};

const mergeRevisionPages = (
  current: PipeListsRunbookRevision[],
  incoming: PipeListsRunbookRevision[],
) => {
  const byId = new Map(current.map((revision) => [revision.id, revision]));
  incoming.forEach((revision) => {
    const existing = byId.get(revision.id);
    byId.set(revision.id, {
      ...existing,
      ...revision,
      contentBefore: revision.contentBefore ?? existing?.contentBefore,
      contentAfter: revision.contentAfter ?? existing?.contentAfter,
    });
  });
  return Array.from(byId.values()).sort((left, right) => right.version - left.version);
};

function renderInlineTokens(tokens: Token[] = [], keyPrefix = 'inline'): React.ReactNode[] {
  return tokens.map((token, index) => {
    const key = `${keyPrefix}-${index}-${token.type}`;

    switch (token.type) {
      case 'text': {
        const text = token as Tokens.Text;
        return text.tokens?.length ? (
          <React.Fragment key={key}>{renderInlineTokens(text.tokens, key)}</React.Fragment>
        ) : (
          <React.Fragment key={key}>{text.text}</React.Fragment>
        );
      }
      case 'escape':
        return <React.Fragment key={key}>{(token as Tokens.Escape).text}</React.Fragment>;
      case 'strong':
        return <strong key={key}>{renderInlineTokens((token as Tokens.Strong).tokens, key)}</strong>;
      case 'em':
        return <em key={key}>{renderInlineTokens((token as Tokens.Em).tokens, key)}</em>;
      case 'del':
        return <del key={key}>{renderInlineTokens((token as Tokens.Del).tokens, key)}</del>;
      case 'codespan':
        return (
          <code key={key} className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[0.9em] text-stone-800">
            {(token as Tokens.Codespan).text}
          </code>
        );
      case 'br':
        return <br key={key} />;
      case 'link': {
        const link = token as Tokens.Link;
        const safe = isSafePipeListsRunbookUrl(link.href);
        if (!safe) {
          return (
            <span key={key} className="text-stone-700 underline decoration-dotted">
              {renderInlineTokens(link.tokens, key)}
            </span>
          );
        }
        const external = /^https?:/i.test(link.href);
        return (
          <a
            key={key}
            href={link.href}
            title={link.title || undefined}
            target={external ? '_blank' : undefined}
            rel={external ? 'noreferrer noopener' : undefined}
            className="font-medium text-sky-700 underline decoration-sky-200 underline-offset-2 hover:text-sky-900"
          >
            {renderInlineTokens(link.tokens, key)}
          </a>
        );
      }
      case 'image': {
        const image = token as Tokens.Image;
        return isSafePipeListsRunbookUrl(image.href) ? (
          <a
            key={key}
            href={image.href}
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-sky-700 underline decoration-sky-200 underline-offset-2"
          >
            [Image resource: {image.text || 'Open'}]
          </a>
        ) : (
          <span key={key}>[Image resource: {image.text || 'Blocked link'}]</span>
        );
      }
      case 'html':
        return (
          <code key={key} className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[0.9em] text-stone-700">
            {(token as Tokens.HTML).text}
          </code>
        );
      case 'checkbox':
        return (
          <input
            key={key}
            type="checkbox"
            checked={(token as Tokens.Checkbox).checked}
            readOnly
            className="mr-2 h-4 w-4 rounded border-stone-300"
          />
        );
      default: {
        const generic = token as Tokens.Generic;
        if (generic.tokens?.length) {
          return <React.Fragment key={key}>{renderInlineTokens(generic.tokens, key)}</React.Fragment>;
        }
        return <React.Fragment key={key}>{String(generic.text || generic.raw || '')}</React.Fragment>;
      }
    }
  });
}

function renderBlockTokens(tokens: Token[] = [], keyPrefix = 'block'): React.ReactNode[] {
  return tokens.map((token, index) => {
    const key = `${keyPrefix}-${index}-${token.type}`;

    switch (token.type) {
      case 'space':
      case 'def':
        return null;
      case 'heading': {
        const heading = token as Tokens.Heading;
        const level = Math.min(Math.max(heading.depth, 1), 6);
        const headingClasses: Record<number, string> = {
          1: 'mt-8 mb-4 text-3xl font-bold tracking-tight text-stone-950',
          2: 'mt-8 mb-3 border-b border-stone-200 pb-2 text-2xl font-bold text-stone-950',
          3: 'mt-6 mb-2 text-xl font-bold text-stone-900',
          4: 'mt-5 mb-2 text-lg font-semibold text-stone-900',
          5: 'mt-4 mb-2 text-base font-semibold text-stone-900',
          6: 'mt-4 mb-2 text-sm font-semibold uppercase tracking-wide text-stone-700',
        };
        return React.createElement(
          `h${level}`,
          { key, className: headingClasses[level] },
          renderInlineTokens(heading.tokens, key),
        );
      }
      case 'paragraph': {
        const paragraph = token as Tokens.Paragraph;
        return (
          <p key={key} className="my-3 text-[15px] leading-7 text-stone-700">
            {renderInlineTokens(paragraph.tokens, key)}
          </p>
        );
      }
      case 'blockquote': {
        const blockquote = token as Tokens.Blockquote;
        return (
          <blockquote key={key} className="my-5 border-l-4 border-sky-300 bg-sky-50 px-5 py-2 text-stone-700">
            {renderBlockTokens(blockquote.tokens, key)}
          </blockquote>
        );
      }
      case 'list': {
        const list = token as Tokens.List;
        const items = list.items.map((item, itemIndex) => (
          <li key={`${key}-item-${itemIndex}`} className="pl-1">
            <span className="inline">
              {item.task && (
                <input
                  type="checkbox"
                  checked={Boolean(item.checked)}
                  readOnly
                  className="mr-2 h-4 w-4 rounded border-stone-300 align-middle"
                />
              )}
              {renderBlockTokens(item.tokens, `${key}-item-${itemIndex}`)}
            </span>
          </li>
        ));
        return list.ordered ? (
          <ol
            key={key}
            start={typeof list.start === 'number' ? list.start : undefined}
            className="my-4 list-decimal space-y-1 pl-7 text-[15px] leading-7 text-stone-700"
          >
            {items}
          </ol>
        ) : (
          <ul key={key} className="my-4 list-disc space-y-1 pl-7 text-[15px] leading-7 text-stone-700">
            {items}
          </ul>
        );
      }
      case 'code': {
        const code = token as Tokens.Code;
        return (
          <pre key={key} className="my-5 overflow-x-auto rounded-lg bg-stone-950 p-4 text-sm leading-6 text-stone-100">
            <code>{code.text}</code>
          </pre>
        );
      }
      case 'hr':
        return <hr key={key} className="my-7 border-stone-200" />;
      case 'table': {
        const table = token as Tokens.Table;
        return (
          <div key={key} className="my-5 overflow-x-auto rounded-lg border border-stone-200">
            <table className="w-full min-w-[620px] border-collapse text-left text-sm">
              <thead className="bg-stone-100 text-stone-900">
                <tr>
                  {table.header.map((cell, cellIndex) => (
                    <th
                      key={`${key}-header-${cellIndex}`}
                      className="border-b border-stone-200 px-4 py-3 font-semibold"
                      style={{ textAlign: cell.align || 'left' }}
                    >
                      {renderInlineTokens(cell.tokens, `${key}-header-${cellIndex}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {table.rows.map((row, rowIndex) => (
                  <tr key={`${key}-row-${rowIndex}`}>
                    {row.map((cell, cellIndex) => (
                      <td
                        key={`${key}-row-${rowIndex}-cell-${cellIndex}`}
                        className="px-4 py-3 align-top text-stone-700"
                        style={{ textAlign: cell.align || 'left' }}
                      >
                        {renderInlineTokens(cell.tokens, `${key}-row-${rowIndex}-cell-${cellIndex}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      case 'html':
        return (
          <pre key={key} className="my-4 overflow-x-auto rounded-lg bg-stone-100 p-3 font-mono text-xs text-stone-700">
            {(token as Tokens.HTML).text}
          </pre>
        );
      case 'text':
        return (
          <p key={key} className="my-3 text-[15px] leading-7 text-stone-700">
            {renderInlineTokens([token], key)}
          </p>
        );
      default: {
        const generic = token as Tokens.Generic;
        if (generic.tokens?.length) {
          return <React.Fragment key={key}>{renderBlockTokens(generic.tokens, key)}</React.Fragment>;
        }
        return generic.raw ? (
          <p key={key} className="my-3 text-[15px] leading-7 text-stone-700">
            {generic.raw}
          </p>
        ) : null;
      }
    }
  });
}

function SafeRunbookMarkdown({ content }: { content: string }) {
  const tokens = useMemo(() => {
    try {
      return marked.lexer(content, { gfm: true, breaks: false });
    } catch {
      return [];
    }
  }, [content]);

  if (tokens.length === 0) {
    return <p className="text-sm text-stone-400">Start writing to see the preview.</p>;
  }

  return <div className="first:[&>*]:mt-0 last:[&>*]:mb-0">{renderBlockTokens(tokens)}</div>;
}

function HistoryDiff({ revision }: { revision: PipeListsRunbookRevision }) {
  const contentBefore = revision.contentBefore ?? '';
  const contentAfter = revision.contentAfter ?? '';
  const diff = useMemo(
    () => buildPipeListsRunbookLineDiff(contentBefore, contentAfter),
    [contentAfter, contentBefore],
  );
  const summary = useMemo(() => summarizePipeListsRunbookDiff(diff), [diff]);
  const changedLines = useMemo(() => diff.filter((line) => line.kind !== 'unchanged'), [diff]);
  const titleChanged = revision.titleBefore !== revision.titleAfter;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-stone-950">Exact changes</p>
        <p className="mt-1 text-xs leading-5 text-stone-500">
          +{summary.additions} added, -{summary.removals} removed
        </p>
      </div>

      {titleChanged && (
        <div className="overflow-hidden rounded-md border border-stone-200 font-mono text-xs">
          <div className="border-b border-rose-100 bg-rose-50 px-3 py-2 text-rose-800">
            <span className="mr-2 select-none text-rose-400">-</span>
            {revision.titleBefore || '(empty title)'}
          </div>
          <div className="bg-emerald-50 px-3 py-2 text-emerald-800">
            <span className="mr-2 select-none text-emerald-500">+</span>
            {revision.titleAfter || '(empty title)'}
          </div>
        </div>
      )}

      {changedLines.length > 0 ? (
        <div className="max-h-[420px] overflow-auto rounded-md border border-stone-200 bg-stone-950 font-mono text-[11px] leading-5">
          {changedLines.map((line, index) => {
            const isAdded = line.kind === 'added';
            return (
              <div
                key={`${line.kind}-${line.beforeLineNumber || line.afterLineNumber}-${index}`}
                className={`grid grid-cols-[42px_18px_minmax(0,1fr)] border-b border-white/5 px-2 py-1 ${
                  isAdded ? 'bg-emerald-950/70 text-emerald-100' : 'bg-rose-950/70 text-rose-100'
                }`}
              >
                <span className="select-none text-right text-white/35">
                  {isAdded ? line.afterLineNumber : line.beforeLineNumber}
                </span>
                <span className={`select-none text-center ${isAdded ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isAdded ? '+' : '-'}
                </span>
                <span className="whitespace-pre-wrap break-words">{line.text || ' '}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-md bg-stone-100 px-3 py-2 text-xs leading-5 text-stone-500">
          This revision changed the title only.
        </p>
      )}
    </div>
  );
}

export default function PipeListsRunbook({ user, onDirtyChange }: PipeListsRunbookProps) {
  const [snapshot, setSnapshot] = useState<PipeListsRunbookSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loadingRevisionId, setLoadingRevisionId] = useState('');
  const [revisionError, setRevisionError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [draftChangeSummary, setDraftChangeSummary] = useState('');
  const [baseVersion, setBaseVersion] = useState(0);
  const [conflictVersion, setConflictVersion] = useState<number | null>(null);
  const [selectedRevisionId, setSelectedRevisionId] = useState('');
  const editingRef = useRef(false);
  const baseVersionRef = useRef(0);
  const currentCheckRunningRef = useRef(false);
  const latestVersionRef = useRef(0);

  useEffect(() => {
    editingRef.current = isEditing;
    baseVersionRef.current = baseVersion;
  }, [baseVersion, isEditing]);

  const applyLatestSnapshot = useCallback((next: PipeListsRunbookSnapshot) => {
    if (next.runbook.version < latestVersionRef.current) return;
    latestVersionRef.current = next.runbook.version;
    setSnapshot((current) => {
      const hasLoadedOlderPages = Boolean(current && current.revisions.length > next.revisions.length);
      return {
        ...next,
        revisions: mergeRevisionPages(current?.revisions || [], next.revisions),
        hasMoreHistory: hasLoadedOlderPages ? current?.hasMoreHistory || false : next.hasMoreHistory,
      };
    });
    setSelectedRevisionId((current) => current || next.revisions[0]?.id || '');

    if (editingRef.current) {
      if (next.runbook.version !== baseVersionRef.current) {
        setConflictVersion(next.runbook.version);
        setSelectedRevisionId(next.revisions[0]?.id || '');
      }
      return;
    }

    setDraftTitle(next.runbook.title);
    setDraftContent(next.runbook.content);
    setBaseVersion(next.runbook.version);
    setConflictVersion(null);
  }, []);

  const refreshRunbook = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        const next = await loadPipeListsRunbook(user);
        applyLatestSnapshot(next);
        setError('');
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'The runbook could not be loaded.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [applyLatestSnapshot, user],
  );

  useEffect(() => {
    void refreshRunbook();
  }, [refreshRunbook]);

  useEffect(() => {
    const checkForNewVersion = async () => {
      if (currentCheckRunningRef.current) return;
      currentCheckRunningRef.current = true;
      try {
        const current = await checkPipeListsRunbookCurrent(user);
        if (current.runbook.version !== latestVersionRef.current) {
          await refreshRunbook(true);
        }
      } catch (checkError) {
        setError(checkError instanceof Error ? checkError.message : 'The runbook could not be refreshed.');
      } finally {
        currentCheckRunningRef.current = false;
      }
    };
    const interval = window.setInterval(() => void checkForNewVersion(), HISTORY_REFRESH_INTERVAL_MS);
    const handleFocus = () => void refreshRunbook(true);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refreshRunbook]);

  const isDirty = Boolean(
    snapshot &&
      isEditing &&
      (draftTitle !== snapshot.runbook.title || draftContent !== snapshot.runbook.content),
  );

  useEffect(() => {
    onDirtyChange?.(isDirty);
    return () => onDirtyChange?.(false);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (!isDirty) return undefined;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const selectedRevision = useMemo(
    () => snapshot?.revisions.find((revision) => revision.id === selectedRevisionId) || snapshot?.revisions[0] || null,
    [selectedRevisionId, snapshot?.revisions],
  );

  useEffect(() => {
    if (
      !selectedRevision ||
      (selectedRevision.contentBefore !== undefined && selectedRevision.contentAfter !== undefined)
    ) {
      return undefined;
    }

    let cancelled = false;
    setLoadingRevisionId(selectedRevision.id);
    setRevisionError('');

    void loadPipeListsRunbookRevision(user, selectedRevision.id)
      .then(({ revision }) => {
        if (cancelled) return;
        setSnapshot((current) =>
          current
            ? {
                ...current,
                revisions: mergeRevisionPages(current.revisions, [revision]),
              }
            : current,
        );
      })
      .catch((revisionLoadError) => {
        if (cancelled) return;
        setRevisionError(
          revisionLoadError instanceof Error
            ? revisionLoadError.message
            : 'The exact revision could not be loaded.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingRevisionId('');
      });

    return () => {
      cancelled = true;
    };
  }, [selectedRevision, user]);

  const beginEditing = () => {
    if (!snapshot) return;
    setDraftTitle(snapshot.runbook.title);
    setDraftContent(snapshot.runbook.content);
    setDraftChangeSummary('');
    setBaseVersion(snapshot.runbook.version);
    baseVersionRef.current = snapshot.runbook.version;
    setConflictVersion(null);
    setNotice('');
    setIsEditing(true);
    editingRef.current = true;
  };

  const cancelEditing = () => {
    if (isDirty && !window.confirm('Discard your unsaved runbook changes?')) return;
    if (snapshot) {
      setDraftTitle(snapshot.runbook.title);
      setDraftContent(snapshot.runbook.content);
      setBaseVersion(snapshot.runbook.version);
      baseVersionRef.current = snapshot.runbook.version;
    }
    setDraftChangeSummary('');
    setConflictVersion(null);
    setIsEditing(false);
    editingRef.current = false;
  };

  const useLatestVersion = () => {
    if (!snapshot) return;
    if (isDirty && !window.confirm('Replace your draft with the latest saved version?')) return;
    setDraftTitle(snapshot.runbook.title);
    setDraftContent(snapshot.runbook.content);
    setDraftChangeSummary('');
    setBaseVersion(snapshot.runbook.version);
    baseVersionRef.current = snapshot.runbook.version;
    setConflictVersion(null);
    setIsEditing(true);
    editingRef.current = true;
  };

  const saveDraft = async () => {
    if (!snapshot || saving || conflictVersion) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const next = await savePipeListsRunbook(user, {
        title: draftTitle,
        content: draftContent,
        changeSummary: draftChangeSummary,
        expectedVersion: baseVersion,
      });
      editingRef.current = false;
      baseVersionRef.current = next.runbook.version;
      setIsEditing(false);
      setBaseVersion(next.runbook.version);
      applyLatestSnapshot(next);
      setDraftChangeSummary('');
      setNotice(next.changed === false ? 'Everything was already up to date.' : `Saved version ${next.runbook.version}.`);
      setSelectedRevisionId(next.revisions[0]?.id || '');
    } catch (saveError) {
      if (saveError instanceof PipeListsRunbookConflictError) {
        if (saveError.snapshot) applyLatestSnapshot(saveError.snapshot);
        setConflictVersion(saveError.snapshot?.runbook.version || snapshot.runbook.version + 1);
      }
      setError(saveError instanceof Error ? saveError.message : 'The runbook could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const loadOlderHistory = async () => {
    if (!snapshot || loadingOlder || snapshot.revisions.length === 0) return;
    const oldestVersion = Math.min(...snapshot.revisions.map((revision) => revision.version));
    setLoadingOlder(true);
    try {
      const olderPage = await loadPipeListsRunbook(user, oldestVersion);
      setSnapshot((current) =>
        current
          ? {
              ...current,
              revisions: mergeRevisionPages(current.revisions, olderPage.revisions),
              hasMoreHistory: olderPage.hasMoreHistory,
            }
          : olderPage,
      );
      setError('');
    } catch (historyError) {
      setError(historyError instanceof Error ? historyError.message : 'Older history could not be loaded.');
    } finally {
      setLoadingOlder(false);
    }
  };

  const copyMarkdown = async () => {
    const title = isEditing ? draftTitle : snapshot?.runbook.title || '';
    const content = isEditing ? draftContent : snapshot?.runbook.content || '';
    await navigator.clipboard.writeText(`# ${title}\n\n${content}`);
    setNotice('Markdown copied.');
  };

  const downloadMarkdown = () => {
    const title = isEditing ? draftTitle : snapshot?.runbook.title || 'PipeLists Runbook';
    const content = isEditing ? draftContent : snapshot?.runbook.content || '';
    const fileName = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pipelists-runbook'}.md`;
    const url = URL.createObjectURL(new Blob([`# ${title}\n\n${content}\n`], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  if (loading && !snapshot) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-stone-200 bg-white">
        <div className="text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-stone-400" />
          <p className="mt-3 text-sm font-medium text-stone-500">Opening the shared runbook...</p>
        </div>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div>
            <h3 className="font-semibold text-rose-950">Runbook access needs attention</h3>
            <p className="mt-1 text-sm leading-6 text-rose-800">{error}</p>
            <button
              type="button"
              onClick={() => void refreshRunbook()}
              className="mt-4 inline-flex h-9 items-center gap-2 rounded-full bg-rose-900 px-4 text-sm font-semibold text-white"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-sky-50 p-2 text-sky-700">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-stone-950">Shared sales strategy</p>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                {snapshot.actor.role === 'owner' ? 'Owner' : 'Editor'}
              </span>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-600">
                Version {snapshot.runbook.version}
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-stone-500">
              Access comes from the owner invitation list. Every save records the account, timestamp, and exact edit.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void refreshRunbook(true)}
            disabled={refreshing}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-stone-200 bg-white px-3 text-sm font-medium text-stone-600 hover:text-stone-950 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void copyMarkdown()}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-stone-200 bg-white px-3 text-sm font-medium text-stone-600 hover:text-stone-950"
          >
            <Clipboard className="h-4 w-4" />
            Copy
          </button>
          <button
            type="button"
            onClick={downloadMarkdown}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-stone-200 bg-white px-3 text-sm font-medium text-stone-600 hover:text-stone-950"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={cancelEditing}
                disabled={saving}
                className="inline-flex h-9 items-center gap-2 rounded-full border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-600 hover:text-stone-950 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveDraft()}
                disabled={saving || Boolean(conflictVersion) || !isDirty}
                className="inline-flex h-9 items-center gap-2 rounded-full bg-stone-950 px-4 text-sm font-semibold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save revision
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={beginEditing}
              className="inline-flex h-9 items-center gap-2 rounded-full bg-stone-950 px-4 text-sm font-semibold text-white hover:bg-stone-800"
            >
              <Edit3 className="h-4 w-4" />
              Edit runbook
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <Check className="h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}
      {conflictVersion && (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <p className="text-sm leading-6 text-amber-900">
              A teammate saved version {conflictVersion} while you were editing. Your draft remains here. Review the newest revision in the history panel, then load it before continuing.
            </p>
          </div>
          <button
            type="button"
            onClick={useLatestVersion}
            className="shrink-0 rounded-full bg-amber-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Load latest
          </button>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <main className="min-w-0 rounded-xl border border-stone-200 bg-white shadow-sm">
          {isEditing ? (
            <div className="space-y-5 p-5 md:p-7">
              <div>
                <label htmlFor="runbook-title" className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Page title
                </label>
                <input
                  id="runbook-title"
                  value={draftTitle}
                  maxLength={PIPELISTS_RUNBOOK_TITLE_MAX_LENGTH}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  className="mt-2 h-12 w-full rounded-lg border border-stone-200 bg-stone-50 px-4 text-lg font-semibold text-stone-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                />
              </div>

              <div className="grid gap-4">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label htmlFor="runbook-content" className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                      Markdown editor
                    </label>
                    <span className="text-xs text-stone-400">
                      {draftContent.length.toLocaleString()} / {PIPELISTS_RUNBOOK_CONTENT_MAX_LENGTH.toLocaleString()}
                    </span>
                  </div>
                  <textarea
                    id="runbook-content"
                    value={draftContent}
                    maxLength={PIPELISTS_RUNBOOK_CONTENT_MAX_LENGTH}
                    onChange={(event) => setDraftContent(event.target.value)}
                    spellCheck
                    className="min-h-[680px] w-full resize-y rounded-lg border border-stone-200 bg-stone-950 p-4 font-mono text-sm leading-6 text-stone-100 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  />
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Safe preview</p>
                  <div className="min-h-[680px] overflow-auto rounded-lg border border-stone-200 bg-white p-5">
                    <SafeRunbookMarkdown content={draftContent} />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="runbook-change-summary" className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Change note <span className="normal-case tracking-normal text-stone-400">(optional)</span>
                </label>
                <input
                  id="runbook-change-summary"
                  value={draftChangeSummary}
                  maxLength={240}
                  onChange={(event) => setDraftChangeSummary(event.target.value)}
                  placeholder="Example: Updated the pilot discovery sequence"
                  className="mt-2 h-11 w-full rounded-lg border border-stone-200 bg-stone-50 px-4 text-sm text-stone-800 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                />
              </div>
            </div>
          ) : (
            <article className="p-5 md:p-8 lg:p-10">
              <div className="mb-8 border-b border-stone-200 pb-6">
                <h1 className="text-3xl font-bold tracking-tight text-stone-950 md:text-4xl">{snapshot.runbook.title}</h1>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-stone-500">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="h-3.5 w-3.5" />
                    Updated {formatRevisionTime(snapshot.runbook.updatedAt)}
                  </span>
                  <span>
                    by {snapshot.runbook.updatedBy.name || snapshot.runbook.updatedBy.email}
                  </span>
                </div>
              </div>
              <SafeRunbookMarkdown content={snapshot.runbook.content} />
            </article>
          )}
        </main>

        <aside className="min-w-0 space-y-4 xl:sticky xl:top-20 xl:self-start" aria-label="Runbook change history">
          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
            <div className="border-b border-stone-200 px-4 py-4">
              <div className="flex items-center gap-2">
                <FileClock className="h-4 w-4 text-stone-500" />
                <h3 className="text-sm font-semibold text-stone-950">Change history</h3>
              </div>
              <p className="mt-1 text-xs leading-5 text-stone-500">Select a revision to inspect its exact saved changes.</p>
            </div>
            <div className="max-h-[310px] overflow-y-auto divide-y divide-stone-100">
              {snapshot.revisions.map((revision) => {
                const active = revision.id === selectedRevision?.id;
                return (
                  <button
                    key={revision.id}
                    type="button"
                    onClick={() => setSelectedRevisionId(revision.id)}
                    className={`w-full px-4 py-3 text-left transition ${active ? 'bg-sky-50' : 'bg-white hover:bg-stone-50'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`truncate text-sm font-semibold ${active ? 'text-sky-950' : 'text-stone-900'}`}>
                          Version {revision.version}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-stone-600">{revision.changeSummary}</p>
                      </div>
                      <span className="shrink-0 text-[11px] font-medium text-stone-400">
                        {revision.changedAt ? new Date(revision.changedAt).toLocaleDateString() : 'Pending'}
                      </span>
                    </div>
                    <p className="mt-2 truncate text-[11px] text-stone-400">
                      {revision.changedBy.name || revision.changedBy.email} · {formatRevisionTime(revision.changedAt)}
                    </p>
                  </button>
                );
              })}
            </div>
            {snapshot.hasMoreHistory && (
              <div className="border-t border-stone-200 p-3">
                <button
                  type="button"
                  onClick={() => void loadOlderHistory()}
                  disabled={loadingOlder}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-600 hover:text-stone-950 disabled:opacity-50"
                >
                  {loadingOlder ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileClock className="h-3.5 w-3.5" />}
                  Load older revisions
                </button>
              </div>
            )}
          </div>

          {selectedRevision && (
            <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <div className="mb-4 border-b border-stone-100 pb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Version {selectedRevision.version}</p>
                <p className="mt-1 text-sm font-semibold text-stone-950">{selectedRevision.changeSummary}</p>
                <p className="mt-2 text-xs leading-5 text-stone-500">
                  {selectedRevision.changedBy.name || selectedRevision.changedBy.email}
                  <br />
                  {selectedRevision.changedBy.email}
                  <br />
                  {formatRevisionTime(selectedRevision.changedAt)}
                </p>
              </div>
              {loadingRevisionId === selectedRevision.id ? (
                <div className="flex items-center gap-2 rounded-md bg-stone-100 px-3 py-3 text-xs text-stone-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading exact changes...
                </div>
              ) : revisionError ? (
                <p className="rounded-md bg-rose-50 px-3 py-3 text-xs leading-5 text-rose-700">{revisionError}</p>
              ) : (
                <HistoryDiff revision={selectedRevision} />
              )}
            </div>
          )}

          <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
              <p className="text-xs leading-5 text-sky-900">
                Every save creates a permanent revision. Keep athlete records, private customer data, clinical notes, and Nora transcripts in their approved systems.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
