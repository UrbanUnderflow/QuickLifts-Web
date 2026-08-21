import React from "react";
import type { SystemOverviewSection } from "../../../content/system-overview/schema";

interface SectionNavProps {
  sections: SystemOverviewSection[];
  activeSectionId?: string;
  onSectionChange?: (sectionId: string) => void;
  title?: string;
  emptyMessage?: string;
}

const SectionNav: React.FC<SectionNavProps> = ({
  sections,
  activeSectionId,
  onSectionChange,
  title = "Handbook Sections",
  emptyMessage = "No handbook sections available.",
}) => {
  const sectionMap = new Map(sections.map((section) => [section.id, section]));
  const childSectionsByParent = new Map<string, SystemOverviewSection[]>();
  const rootSections: SystemOverviewSection[] = [];

  sections.forEach((section) => {
    if (section.parentSectionId && sectionMap.has(section.parentSectionId)) {
      const existingChildren =
        childSectionsByParent.get(section.parentSectionId) || [];
      existingChildren.push(section);
      childSectionsByParent.set(section.parentSectionId, existingChildren);
      return;
    }

    rootSections.push(section);
  });

  const hasActiveDescendant = (sectionId: string): boolean => {
    const children = childSectionsByParent.get(sectionId) || [];
    return children.some(
      (child) =>
        child.id === activeSectionId || hasActiveDescendant(child.id),
    );
  };

  const getSectionPathLabel = (section: SystemOverviewSection) => {
    const labels = [section.label];
    let current = section;

    while (current.parentSectionId) {
      const parent = sectionMap.get(current.parentSectionId);
      if (!parent) break;
      labels.unshift(parent.label);
      current = parent;
    }

    return labels.join(" / ");
  };

  const renderSectionNode = (
    section: SystemOverviewSection,
    depth = 0,
  ): React.ReactNode => {
    const isActive = section.id === activeSectionId;
    const hasChildren = (childSectionsByParent.get(section.id) || []).length > 0;
    const descendantActive = hasActiveDescendant(section.id);
    const children = childSectionsByParent.get(section.id) || [];

    return (
      <div
        key={section.id}
        className={depth > 0 ? "ml-4 border-l border-zinc-800 pl-3" : undefined}
      >
        <button
          onClick={() => onSectionChange?.(section.id)}
          className={`block w-full border-l-2 px-3 py-2 text-left transition-colors ${
            isActive
              ? "border-l-[#d7ff00] bg-[#d7ff00]/[0.08]"
              : descendantActive
                ? "border-l-zinc-600 bg-white/[0.03]"
                : "border-l-transparent hover:bg-white/[0.04]"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p
                className={`font-semibold ${isActive ? "text-white" : "text-zinc-200"} ${
                  depth > 0 ? "text-[13px]" : "text-sm"
                }`}
              >
                {section.label}
              </p>
              <p
                className={`mt-0.5 text-zinc-500 ${
                  depth > 0 ? "text-[10px]" : "text-[11px]"
                }`}
              >
                {section.description}
              </p>
            </div>
            {hasChildren ? (
              <span className="shrink-0 rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                Group
              </span>
            ) : null}
          </div>
        </button>

        {children.length > 0 ? (
          <div className="mt-1 space-y-1">
            {children.map((child) => renderSectionNode(child, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <>
      <div className="rounded-lg border border-zinc-800 bg-[#080d18] p-3 xl:hidden">
        <label
          htmlFor="system-overview-section-select"
          className="mb-2 block text-xs font-medium text-zinc-500"
        >
          {title}
        </label>
        {sections.length > 0 ? (
          <select
            id="system-overview-section-select"
            value={activeSectionId || sections[0]?.id || ""}
            onChange={(event) => onSectionChange?.(event.target.value)}
            className="h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
          >
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {getSectionPathLabel(section)}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-zinc-500">{emptyMessage}</p>
        )}
      </div>

      <aside className="hidden max-h-[calc(100vh-48px)] overflow-auto rounded-2xl border border-zinc-800 bg-[#080d18] p-4 xl:sticky xl:top-6 xl:block">
        <p className="mb-3 text-xs uppercase tracking-wide text-zinc-500">
          {title}
        </p>
        {sections.length > 0 ? (
          <nav className="space-y-2">
            {rootSections.map((section) => renderSectionNode(section))}
          </nav>
        ) : (
          <div className="rounded-xl border border-dashed border-zinc-700 bg-black/20 px-3 py-4 text-xs text-zinc-500">
            {emptyMessage}
          </div>
        )}
      </aside>
    </>
  );
};

export default SectionNav;
