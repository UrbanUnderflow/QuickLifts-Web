import React, { useMemo, useState } from 'react';
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from '@headlessui/react';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';

export interface PilotTeamFilterOption {
  id: string;
  teamName: string;
  organizationName: string;
  athleteCount: number;
}

interface PilotTeamMultiSelectProps {
  options: PilotTeamFilterOption[];
  selectedTeamIds: string[];
  totalAthleteCount: number;
  onChange: (teamIds: string[]) => void;
}

const normalizeQuery = (value: string) => value.trim().toLowerCase();

const formatAthleteCount = (count: number) => `${count} athlete${count === 1 ? '' : 's'}`;

const PilotTeamMultiSelect: React.FC<PilotTeamMultiSelectProps> = ({
  options,
  selectedTeamIds,
  totalAthleteCount,
  onChange,
}) => {
  const [query, setQuery] = useState('');
  const selectedTeamIdSet = useMemo(() => new Set(selectedTeamIds), [selectedTeamIds]);
  const selectedOptions = useMemo(
    () => options.filter((option) => selectedTeamIdSet.has(option.id)),
    [options, selectedTeamIdSet]
  );
  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeQuery(query);
    if (!normalizedQuery) return options;

    return options.filter((option) =>
      [option.teamName, option.organizationName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [options, query]);

  const updateSelection = (nextOptions: PilotTeamFilterOption[]) => {
    onChange(Array.from(new Set(nextOptions.map((option) => option.id).filter(Boolean))));
  };

  const removeTeam = (teamId: string) => {
    onChange(selectedTeamIds.filter((selectedTeamId) => selectedTeamId !== teamId));
  };

  return (
    <div className="pilot-team-filter" data-testid="pilot-athlete-team-filter">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
            Filter roster by team
          </div>
          <div className="mt-1 text-xs text-white/45">
            Search teams or organizations and select as many teams as you need.
          </div>
        </div>
        <span className="pilot-font-mono text-[11px] text-white/45" aria-live="polite">
          {selectedOptions.length === 0
            ? 'All teams'
            : `${selectedOptions.length} team${selectedOptions.length === 1 ? '' : 's'} selected`}
        </span>
      </div>

      <div
        className="mt-3 flex min-h-10 flex-wrap items-center gap-2"
        data-testid="pilot-athlete-team-filter-pills"
      >
        <button
          type="button"
          onClick={() => onChange([])}
          aria-pressed={selectedOptions.length === 0}
          data-testid="pilot-athlete-team-filter-all"
          className={`pilot-team-filter-focus inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition ${
            selectedOptions.length === 0
              ? 'border-[#00d4aa]/35 bg-[#00d4aa]/10 text-[#9cf4e2]'
              : 'border-white/10 bg-white/[0.03] text-white/55 hover:border-white/15 hover:bg-white/[0.06] hover:text-white/80'
          }`}
        >
          All teams
          <span className="pilot-font-mono rounded-full border border-current/20 px-2 py-0.5 text-[10px] opacity-80">
            {totalAthleteCount}
          </span>
        </button>

        {selectedOptions.map((option) => (
          <span
            key={option.id}
            className="inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-full border border-[#00d4aa]/35 bg-[#00d4aa]/10 py-1.5 pl-3.5 pr-1.5 text-xs font-semibold text-[#9cf4e2]"
            data-testid={`pilot-athlete-team-filter-pill-${option.id}`}
          >
            <span className="max-w-[16rem] truncate">{option.teamName}</span>
            <span className="pilot-font-mono rounded-full border border-current/20 px-1.5 py-0.5 text-[9px] opacity-80">
              {option.athleteCount}
            </span>
            <button
              type="button"
              onClick={() => removeTeam(option.id)}
              className="pilot-team-filter-focus inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-current/70 transition hover:bg-white/10 hover:text-current"
              aria-label={`Remove ${option.teamName}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>

      <Combobox
        value={selectedOptions}
        onChange={updateSelection}
        by="id"
        multiple
        immediate
        onClose={() => setQuery('')}
      >
        {() => (
          <div className="relative mt-3 max-w-2xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-white/35" />
            <ComboboxInput
              aria-label="Search roster teams or organizations"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search teams or organizations..."
              className="pilot-team-filter-control pilot-team-filter-focus h-12 w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-11 pr-12 text-sm text-white/80 outline-none transition placeholder:text-white/25 hover:border-white/15 focus:border-[#00d4aa]/35"
            />
            <ComboboxButton
              className="pilot-team-filter-focus absolute inset-y-1.5 right-1.5 inline-flex w-9 items-center justify-center rounded-lg text-white/45 transition hover:bg-white/[0.06] hover:text-white/80"
              aria-label="Roster team options"
            >
              <ChevronsUpDown className="h-4 w-4" />
            </ComboboxButton>

            <ComboboxOptions
              aria-label="Roster team options"
              transition
              className="pilot-team-filter-menu absolute z-30 mt-2 max-h-80 w-full origin-top overflow-y-auto rounded-2xl border border-white/10 bg-[rgba(9,12,19,0.98)] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.42)] outline-none transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
            >
              {filteredOptions.length === 0 ? (
                <div className="px-4 py-7 text-center" role="status">
                  <div className="text-sm font-semibold text-white/75">No matching teams</div>
                  <div className="mt-1 text-xs text-white/40">Try a team or organization name.</div>
                </div>
              ) : (
                filteredOptions.map((option) => (
                  <ComboboxOption
                    key={option.id}
                    value={option}
                    className="group flex min-h-[3.5rem] cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-white/70 outline-none transition data-[focus]:bg-white/[0.06] data-[selected]:bg-[#00d4aa]/10"
                    data-testid={`pilot-athlete-team-filter-option-${option.id}`}
                  >
                    {({ selected }) => (
                      <>
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                            selected
                              ? 'border-[#00d4aa]/55 bg-[#00d4aa]/15 text-[#9cf4e2]'
                              : 'border-white/15 bg-white/[0.03] text-transparent group-data-[focus]:border-white/25'
                          }`}
                          aria-hidden="true"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-white/90">
                            {option.teamName}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-white/42">
                            {option.organizationName || 'Organization not available'}
                          </span>
                        </span>
                        <span className="pilot-font-mono shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-white/50">
                          {formatAthleteCount(option.athleteCount)}
                        </span>
                      </>
                    )}
                  </ComboboxOption>
                ))
              )}
            </ComboboxOptions>
          </div>
        )}
      </Combobox>
    </div>
  );
};

export default PilotTeamMultiSelect;
