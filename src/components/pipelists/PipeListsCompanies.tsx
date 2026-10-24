import React from 'react';
import { APPLICABLE_COMPANIES, normalizeApplicableCompanies, type ApplicableCompany } from '../../utils/pipelistsCompanies';

export default function PipeListsCompanies({ value, onChange }: { value: unknown; onChange: (value: ApplicableCompany[]) => void }) {
  const selected = normalizeApplicableCompanies(value);
  return <fieldset className="min-w-0">
    <legend className="mb-1.5 text-xs font-semibold uppercase text-stone-400">Applicable company</legend>
    <p className="mb-2 text-xs text-stone-500">Optional. Select all that apply; leave empty for unassigned.</p>
    <div className="flex flex-wrap gap-2">
      {APPLICABLE_COMPANIES.map(company => <label key={company} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-700">
        <input type="checkbox" checked={selected.includes(company)} onChange={event => onChange(normalizeApplicableCompanies(event.target.checked ? [...selected, company] : selected.filter(value => value !== company)))} className="h-4 w-4 accent-stone-800" />
        {company}
      </label>)}
    </div>
  </fieldset>;
}
