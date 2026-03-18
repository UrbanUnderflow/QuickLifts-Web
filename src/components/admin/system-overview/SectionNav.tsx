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
  return (
    <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-48px)] lg:overflow-auto bg-[#080d18] border border-zinc-800 rounded-2xl p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500 mb-3">
        {title}
      </p>
      {sections.length > 0 ? (
        <nav className="space-y-2">
          {sections.map((section) => {
            const isActive = section.id === activeSectionId;
            return (
              <button
                key={section.id}
                onClick={() => onSectionChange?.(section.id)}
                className={`block w-full text-left rounded-xl border px-3 py-2 transition-colors ${
                  isActive
                    ? "border-white bg-white text-black"
                    : "border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:bg-white/5"
                }`}
              >
                <p
                  className={`text-sm font-semibold ${isActive ? "text-black" : "text-white"}`}
                >
                  {section.label}
                </p>
                <p
                  className={`text-[11px] mt-0.5 ${isActive ? "text-zinc-700" : "text-zinc-500"}`}
                >
                  {section.description}
                </p>
              </button>
            );
          })}
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
