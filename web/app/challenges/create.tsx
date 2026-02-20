"use client";

import React, { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  getTemplatesForBrand,
  BrandChallengeTemplate,
} from "../../lib/brandChallengeTemplates";

// Temporary, focused UI for wiring brand-specific templates into the
// challenge creation flow. In later steps this selector will be
// integrated with the full challenge creation form so that choosing a
// template applies its presets into the form fields.

function BrandTemplateSelector(props: {
  brandType: string;
  selectedTemplateId?: string;
  onChange: (templateId: string) => void;
}) {
  const { brandType, selectedTemplateId, onChange } = props;

  const templates: BrandChallengeTemplate[] = useMemo(
    () => getTemplatesForBrand(brandType),
    [brandType]
  );

  if (!brandType) {
    return null;
  }

  if (!templates.length) {
    return (
      <section className="mt-4 rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-600">
        <p>
          No brand-specific challenge templates are configured yet for
          <span className="font-semibold"> {brandType}</span>.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-4 rounded-md border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">
        Brand challenge templates
      </h2>
      <p className="mt-1 text-xs text-gray-600">
        Choose a starting point that matches this campaign. You can still
        edit the title, description, and schedule before publishing.
      </p>

      <div className="mt-3 space-y-3">
        {templates.map((template) => {
          const checked = selectedTemplateId === template.id;
          return (
            <label
              key={template.id}
              className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition hover:border-gray-400 ${
                checked
                  ? "border-blue-500 bg-blue-50/70"
                  : "border-gray-200 bg-white"
              }`}
            >
              <input
                type="radio"
                name="brandTemplate"
                value={template.id}
                checked={checked}
                onChange={() => onChange(template.id)}
                className="mt-1 h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">
                    {template.name}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-gray-600">
                    {template.defaultDurationDays} days · {" "}
                    {template.targetSessionsPerWeek}x / week
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-700">
                  {template.description}
                </p>
                {template.targetBehaviors?.length ? (
                  <p className="mt-1 text-[11px] text-gray-600">
                    Focus: {" "}
                    {template.targetBehaviors
                      .map((b) => `${b.label} (${b.sessionsPerWeek}x/wk)`)
                      .join(" · ")}
                  </p>
                ) : null}
              </div>
            </label>
          );
        })}
      </div>
    </section>
  );
}

export default function ChallengeCreatePage() {
  const searchParams = useSearchParams();

  // In future steps, this brandType will come from the actual challenge
  // creation form state / brandCampaign selection. For now we read from
  // the query string as a simple way to exercise the template wiring.
  const brandType = (searchParams.get("brandType") || "").toLowerCase();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(
    undefined
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold text-gray-900">
          Create Brand Challenge
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          This page will host the full challenge creation flow. For now,
          when a <code>brandType</code> is provided in the URL
          (e.g., <code>?brandType=gymshark</code>), you’ll see the
          configured templates for that brand.
        </p>
      </header>

      {!brandType ? (
        <p className="text-sm text-gray-600">
          Provide a <code>brandType</code> in the URL query to see
          available templates (for example: <code>?brandType=gymshark</code>).
        </p>
      ) : (
        <BrandTemplateSelector
          brandType={brandType}
          selectedTemplateId={selectedTemplateId}
          onChange={setSelectedTemplateId}
        />
      )}
    </main>
  );
}
