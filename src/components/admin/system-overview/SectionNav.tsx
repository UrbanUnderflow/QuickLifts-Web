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
          className={`block w-full text-left rounded-xl border px-3 py-2 transition-colors ${
            isActive
              ? "border-white bg-white text-black"
              : descendantActive
                ? "border-zinc-600 bg-white/[0.03] text-zinc-200"
                : "border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:bg-white/5"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p
                className={`font-semibold ${isActive ? "text-black" : "text-white"} ${
                  depth > 0 ? "text-[13px]" : "text-sm"
                }`}
              >
                {section.label}
              </p>
              <p
                className={`mt-0.5 ${isActive ? "text-zinc-700" : "text-zinc-500"} ${
                  depth > 0 ? "text-[10px]" : "text-[11px]"
                }`}
              >
                {section.description}
              </p>
            </div>
            {hasChildren ? (
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${
                  isActive
                    ? "bg-black/10 text-zinc-700"
                    : "bg-white/5 text-zinc-500"
                }`}
              >
                Group
              </span>
            ) : null}
          </div>
        </button>

        {children.length > 0 ? (
          <div className="mt-2 space-y-2">
            {children.map((child) => renderSectionNode(child, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-48px)] lg:overflow-auto bg-[#080d18] border border-zinc-800 rounded-2xl p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500 mb-3">
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
  );
};

export default SectionNav;
