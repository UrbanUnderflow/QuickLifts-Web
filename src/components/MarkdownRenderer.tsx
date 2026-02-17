import React, { useMemo } from 'react';
import { marked } from 'marked';

interface MarkdownRendererProps {
    content: string;
    accentColor?: string;
}

/**
 * Renders markdown content as beautifully styled HTML.
 * Used in deliverables pages to display .md artifacts.
 */
export function MarkdownRenderer({ content, accentColor = '#8b5cf6' }: MarkdownRendererProps) {
    const html = useMemo(() => {
        if (!content) return '';
        try {
            // Configure marked for clean output
            marked.setOptions({
                gfm: true,
                breaks: true,
            });
            return marked.parse(content) as string;
        } catch {
            return `<pre>${content}</pre>`;
        }
    }, [content]);

    return (
        <>
            <div
                className="md-rendered"
                dangerouslySetInnerHTML={{ __html: html }}
                style={{ '--md-accent': accentColor } as React.CSSProperties}
            />
            <style jsx>{`
                .md-rendered {
                    font-family: 'Inter', -apple-system, sans-serif;
                    font-size: 14px;
                    line-height: 1.75;
                    color: #d4d4d8;
                    padding: 28px 32px;
                    max-width: 800px;
                }

                /* ── headings ── */
                .md-rendered :global(h1) {
                    font-size: 26px;
                    font-weight: 800;
                    color: #fff;
                    margin: 0 0 16px;
                    padding-bottom: 12px;
                    border-bottom: 1px solid rgba(255,255,255,0.06);
                    letter-spacing: -0.02em;
                }
                .md-rendered :global(h2) {
                    font-size: 20px;
                    font-weight: 700;
                    color: #f4f4f5;
                    margin: 32px 0 12px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid rgba(255,255,255,0.04);
                }
                .md-rendered :global(h3) {
                    font-size: 16px;
                    font-weight: 700;
                    color: #e4e4e7;
                    margin: 24px 0 8px;
                }
                .md-rendered :global(h4) {
                    font-size: 14px;
                    font-weight: 700;
                    color: #a1a1aa;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    margin: 20px 0 8px;
                }

                /* ── paragraphs ── */
                .md-rendered :global(p) {
                    margin: 0 0 14px;
                    color: #a1a1aa;
                }
                .md-rendered :global(p:last-child) {
                    margin-bottom: 0;
                }

                /* ── links ── */
                .md-rendered :global(a) {
                    color: var(--md-accent, #8b5cf6);
                    text-decoration: none;
                    border-bottom: 1px solid rgba(139,92,246,0.3);
                    transition: all 0.2s;
                }
                .md-rendered :global(a:hover) {
                    color: #a78bfa;
                    border-bottom-color: #a78bfa;
                }

                /* ── bold / italic / inline code ── */
                .md-rendered :global(strong) {
                    color: #e4e4e7;
                    font-weight: 700;
                }
                .md-rendered :global(em) {
                    color: #d4d4d8;
                    font-style: italic;
                }
                .md-rendered :global(code) {
                    font-family: 'JetBrains Mono', 'Fira Code', monospace;
                    font-size: 12px;
                    background: rgba(255,255,255,0.06);
                    border: 1px solid rgba(255,255,255,0.06);
                    padding: 2px 6px;
                    border-radius: 4px;
                    color: #fbbf24;
                }

                /* ── code blocks ── */
                .md-rendered :global(pre) {
                    background: rgba(0,0,0,0.35);
                    border: 1px solid rgba(255,255,255,0.06);
                    border-radius: 10px;
                    padding: 16px 20px;
                    margin: 16px 0;
                    overflow-x: auto;
                    scrollbar-width: thin;
                    scrollbar-color: rgba(255,255,255,0.08) transparent;
                }
                .md-rendered :global(pre code) {
                    background: none;
                    border: none;
                    padding: 0;
                    font-size: 12.5px;
                    line-height: 1.6;
                    color: #a1a1aa;
                }

                /* ── lists ── */
                .md-rendered :global(ul),
                .md-rendered :global(ol) {
                    margin: 12px 0;
                    padding-left: 24px;
                }
                .md-rendered :global(li) {
                    margin-bottom: 6px;
                    color: #a1a1aa;
                }
                .md-rendered :global(li::marker) {
                    color: var(--md-accent, #8b5cf6);
                }
                .md-rendered :global(ul li) {
                    list-style: disc;
                }
                .md-rendered :global(ol li) {
                    list-style: decimal;
                }

                /* nested lists */
                .md-rendered :global(li > ul),
                .md-rendered :global(li > ol) {
                    margin-top: 4px;
                    margin-bottom: 4px;
                }

                /* ── blockquotes ── */
                .md-rendered :global(blockquote) {
                    margin: 16px 0;
                    padding: 12px 20px;
                    border-left: 3px solid var(--md-accent, #8b5cf6);
                    background: rgba(139,92,246,0.04);
                    border-radius: 0 8px 8px 0;
                    color: #a1a1aa;
                    font-style: italic;
                }
                .md-rendered :global(blockquote p) {
                    margin: 0;
                }

                /* ── horizontal rules ── */
                .md-rendered :global(hr) {
                    border: none;
                    border-top: 1px solid rgba(255,255,255,0.06);
                    margin: 24px 0;
                }

                /* ── tables ── */
                .md-rendered :global(table) {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 16px 0;
                    font-size: 13px;
                }
                .md-rendered :global(thead th) {
                    text-align: left;
                    padding: 8px 12px;
                    background: rgba(255,255,255,0.04);
                    border-bottom: 1px solid rgba(255,255,255,0.08);
                    color: #e4e4e7;
                    font-weight: 600;
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }
                .md-rendered :global(td) {
                    padding: 8px 12px;
                    border-bottom: 1px solid rgba(255,255,255,0.04);
                    color: #a1a1aa;
                }
                .md-rendered :global(tr:hover td) {
                    background: rgba(255,255,255,0.02);
                }

                /* ── images ── */
                .md-rendered :global(img) {
                    max-width: 100%;
                    border-radius: 10px;
                    margin: 16px 0;
                    border: 1px solid rgba(255,255,255,0.06);
                }

                /* ── task lists (GFM) ── */
                .md-rendered :global(input[type="checkbox"]) {
                    margin-right: 8px;
                    accent-color: var(--md-accent, #8b5cf6);
                }
            `}</style>
        </>
    );
}
