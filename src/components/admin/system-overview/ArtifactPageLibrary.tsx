import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, FileText } from 'lucide-react';

export interface ArtifactPageEntry {
  id: string;
  label: string;
  subtitle: string;
  icon: React.ElementType;
  accent: string;
  render: () => React.ReactNode;
}

interface ArtifactPageLibraryProps {
  eyebrow: string;
  title: string;
  summary: string;
  entries: ArtifactPageEntry[];
  initialEntryId?: string;
}

const ArtifactPageLibrary: React.FC<ArtifactPageLibraryProps> = ({
  eyebrow,
  title,
  summary,
  entries,
  initialEntryId,
}) => {
  const fallbackEntryId = initialEntryId ?? entries[0]?.id ?? '';
  const [activeEntryId, setActiveEntryId] = useState<string>(fallbackEntryId);

  const activeEntry =
    entries.find((entry) => entry.id === activeEntryId) ?? entries[0];

  if (!activeEntry) return null;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <FileText className="w-4 h-4 text-purple-400" />
          <p className="text-xs uppercase tracking-wide text-purple-400 font-semibold">
            {eyebrow}
          </p>
        </div>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="text-sm text-zinc-400 mt-1">{summary}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {entries.map((entry) => {
          const Icon = entry.icon;
          const isActive = entry.id === activeEntryId;

          return (
            <button
              key={entry.id}
              onClick={() => setActiveEntryId(entry.id)}
              className="group relative text-left rounded-xl border px-4 py-3 transition-all duration-200"
              style={{
                background: isActive
                  ? `linear-gradient(135deg, ${entry.accent}18, ${entry.accent}08)`
                  : 'rgba(255,255,255,0.02)',
                borderColor: isActive ? `${entry.accent}50` : 'rgba(63,63,70,0.6)',
                boxShadow: isActive ? `0 0 24px ${entry.accent}12` : 'none',
              }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: isActive ? `${entry.accent}25` : 'rgba(255,255,255,0.05)',
                  }}
                >
                  <Icon
                    className="w-4 h-4"
                    style={{ color: isActive ? entry.accent : '#a1a1aa' }}
                  />
                </div>
                <div className="min-w-0">
                  <p
                    className="text-sm font-semibold truncate"
                    style={{ color: isActive ? '#fff' : '#d4d4d8' }}
                  >
                    {entry.label}
                  </p>
                  <p className="text-[11px] text-zinc-500 line-clamp-2 mt-0.5">
                    {entry.subtitle}
                  </p>
                </div>
                <ChevronRight
                  className="w-4 h-4 ml-auto shrink-0 transition-transform group-hover:translate-x-0.5"
                  style={{ color: isActive ? entry.accent : '#52525b' }}
                />
              </div>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeEntry.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
        >
          {activeEntry.render()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default ArtifactPageLibrary;
