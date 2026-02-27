import React from 'react';
import type { SystemOverviewSection } from '../../../content/system-overview/schema';

interface SectionNavProps {
  sections: SystemOverviewSection[];
  activeSectionId?: string;
}

const SectionNav: React.FC<SectionNavProps> = ({ sections, activeSectionId }) => {
  return (
    <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-48px)] lg:overflow-auto bg-[#080d18] border border-zinc-800 rounded-2xl p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500 mb-3">Handbook Sections</p>
      <nav className="space-y-2">
        {sections.map((section) => {
          const isActive = section.id === activeSectionId;
          return (
            <a
              key={section.id}
              href={`#${section.id}`}
              className={`block rounded-xl border px-3 py-2 transition-colors ${
                isActive
                  ? 'border-white bg-white text-black'
                  : 'border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:bg-white/5'
              }`}
            >
              <p className={`text-sm font-semibold ${isActive ? 'text-black' : 'text-white'}`}>
                {section.label}
              </p>
              <p className={`text-[11px] mt-0.5 ${isActive ? 'text-zinc-700' : 'text-zinc-500'}`}>
                {section.description}
              </p>
            </a>
          );
        })}
      </nav>
    </aside>
  );
};

export default SectionNav;
