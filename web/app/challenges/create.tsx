"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

import {
  getTemplatesForBrand,
  getTemplateById,
  BrandChallengeTemplate,
  getAllBrandTemplateGroups,
} from "../../lib/brandChallengeTemplates";
import { getBrandChallengeTemplates } from "../../lib/challenges/brandTemplates";

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

export type ChallengeCreatePageProps = {
  // Optional brandCampaignId passed from a parent route or server component.
  // If omitted, we fall back to the `brandCampaignId` query param so
  // marketing / demo links can still deep-link directly into prefilled
  // brand campaigns.
  brandCampaignId?: string;
};

export default function ChallengeCreatePage(props: ChallengeCreatePageProps) {
  const searchParams = useSearchParams();

  // In future steps, this brandType will come from the actual challenge
  // creation form state / brandCampaign selection. For now we read from
  // the query string as a simple way to exercise the template wiring.
  const brandType = (searchParams.get("brandType") || "").toLowerCase();

  const queryBrandCampaignId = searchParams.get("brandCampaignId") || "";
  const initialBrandCampaignId = (props.brandCampaignId ?? queryBrandCampaignId).trim();

  const [brandCampaignId, setBrandCampaignId] = useState(initialBrandCampaignId);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(
    undefined
  );

  // Form state that will eventually be wired into the real challenge
  // creation mutation. For now this lets us prove that choosing a
  // template applies presets but still allows manual overrides.
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationDays, setDurationDays] = useState<number | "">("");
  const [sessionsPerWeek, setSessionsPerWeek] = useState<number | "">("");
  const [visualStyleKey, setVisualStyleKey] = useState("");

  const brandCampaignOptions = useMemo(() => {
    const groups = getAllBrandTemplateGroups();
    const seen = new Set<string>();

    return groups.flatMap((group) => {
      return group.templates.reduce<{ id: string; label: string }[]>(
        (acc, template) => {
          const archetype = template.brandArchetype;
          if (!archetype || seen.has(archetype)) return acc;

          seen.add(archetype);

          acc.push({
            id: archetype,
            label: `${group.displayName} · ${template.title || template.name}`,
          });

          return acc;
        },
        []
      );
    });
  }, []);

  // When a brandCampaignId is provided (either via props or the query
  // string), prefill the draft with the first template tied to that
  // archetype. This lets partner links like
  // `/challenges/create?brandCampaignId=on_running_recovery_block`
  // immediately render a challenge that feels like "their" season rather
  // than a generic template.
  useEffect(() => {
    if (!brandCampaignId) return;

    const templatesForCampaign = getBrandChallengeTemplates(brandCampaignId);
    if (!templatesForCampaign.length) return;

    const template = templatesForCampaign[0];

    setTitle((prev) => (prev ? prev : template.title || template.name));
    setDescription((prev) => (prev ? prev : template.description));
    setDurationDays((prev) =>
      prev ? prev : template.durationDays || template.defaultDurationDays
    );
    setSessionsPerWeek((prev) =>
      prev ? prev : template.sessionsPerWeek || template.targetSessionsPerWeek
    );
    setVisualStyleKey((prev) =>
      prev ? prev : template.brandStyleKey || template.visualStyleKey
    );

    // If no template has been manually chosen yet, align the
    // selectedTemplateId so the UI reflects the archetype-driven
    // prefilling.
    if (!selectedTemplateId) {
      setSelectedTemplateId(template.id);
    }
  }, [brandCampaignId, selectedTemplateId]);

  // When a template is selected, apply its presets into the form fields.
  useEffect(() => {
    if (!selectedTemplateId) return;
    const template = getTemplateById(selectedTemplateId);
    if (!template) return;

    setTitle((prev) => (prev ? prev : template.name));
    setDescription((prev) => (prev ? prev : template.description));
    setDurationDays((prev) => (prev ? prev : template.defaultDurationDays));
    setSessionsPerWeek((prev) => (prev ? prev : template.targetSessionsPerWeek));
    setVisualStyleKey((prev) => (prev ? prev : template.visualStyleKey));
  }, [selectedTemplateId]);

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
          configured templates for that brand and can apply their presets
          into the draft challenge fields.
        </p>

        {brandCampaignOptions.length > 0 && (
          <div className="mt-4 grid gap-3 rounded-md border border-gray-200 bg-white p-3 text-sm shadow-sm sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-700">
                Brand campaign
              </label>
              <select
                value={brandCampaignId}
                onChange={(e) => setBrandCampaignId(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">No specific campaign</option>
                {brandCampaignOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-gray-600">
              Choosing a brand campaign will prefill this draft using that
              campaign&rsquo;s challenge template (title, description,
              duration, and target sessions per week) and apply the
              matching brand style key.
            </p>
          </div>
        )}
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

      <section className="mt-8 rounded-md border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">
          Draft challenge details
        </h2>
        <p className="mt-1 text-xs text-gray-600">
          Selecting a brand template will prefill these fields, but you can
          still edit anything before saving.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. 30-Day Strength Streak"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Describe what members will actually do together in this block."
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-700">
                Duration (days)
              </label>
              <input
                type="number"
                min={1}
                value={durationDays}
                onChange={(e) =>
                  setDurationDays(e.target.value ? Number(e.target.value) : "")
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">
                Target sessions per week
              </label>
              <input
                type="number"
                min={1}
                value={sessionsPerWeek}
                onChange={(e) =>
                  setSessionsPerWeek(
                    e.target.value ? Number(e.target.value) : ""
                  )
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">
              Visual style key (for design system)
            </label>
            <input
              type="text"
              value={visualStyleKey}
              onChange={(e) => setVisualStyleKey(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. gymshark-strength-dark-neon"
            />
            <p className="mt-1 text-[11px] text-gray-500">
              This will eventually map to a design token / theme variant so
              brand campaigns carry a consistent visual treatment.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
