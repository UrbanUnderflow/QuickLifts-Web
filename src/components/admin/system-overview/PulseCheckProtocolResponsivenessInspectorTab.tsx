import React, { useEffect, useMemo, useState } from 'react';
import { BrainCircuit, Database, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import {
  protocolResponsivenessService,
  type PulseCheckProtocolResponsivenessProfile,
} from '../../../api/firebase/mentaltraining';
import {
  BulletList,
  CardGrid,
  DataTable,
  DocHeader,
  InfoCard,
  InlineTag,
  RuntimeAlignmentPanel,
  SectionBlock,
} from './PulseCheckRuntimeDocPrimitives';

function formatDate(timestamp?: number) {
  if (!timestamp) return 'Not set';
  return new Date(timestamp).toLocaleString();
}

function formatFreshness(profile: PulseCheckProtocolResponsivenessProfile) {
  return profile.staleAt > Date.now() ? 'current' : 'refresh_required';
}

function getProfileFamilyRows(profile: PulseCheckProtocolResponsivenessProfile) {
  return Object.values(profile.familyResponses)
    .sort((left, right) => right.sampleSize - left.sampleSize)
    .map((summary) => [
      summary.protocolFamilyLabel || summary.protocolFamilyId || 'Unknown family',
      summary.responseDirection,
      summary.confidence,
      summary.freshness,
      String(summary.sampleSize),
      summary.supportingEvidence.slice(0, 2).join(' • ') || 'No explanation trace yet',
    ]);
}

function getProfileVariantRows(profile: PulseCheckProtocolResponsivenessProfile) {
  return Object.values(profile.variantResponses)
    .sort((left, right) => right.sampleSize - left.sampleSize)
    .map((summary) => [
      summary.variantLabel || summary.variantId || 'Unknown variant',
      summary.protocolFamilyLabel || summary.protocolFamilyId || 'Unknown family',
      summary.responseDirection,
      summary.confidence,
      summary.freshness,
      String(summary.sampleSize),
    ]);
}

const PulseCheckProtocolResponsivenessInspectorTab: React.FC = () => {
  const [profiles, setProfiles] = useState<PulseCheckProtocolResponsivenessProfile[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>('');
  const [athleteQuery, setAthleteQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRecentProfiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const recentProfiles = await protocolResponsivenessService.listRecentProfiles(12);
      setProfiles(recentProfiles);
      setSelectedAthleteId((current) => current || recentProfiles[0]?.athleteId || '');
    } catch (loadError) {
      console.error('Failed to load recent protocol responsiveness profiles:', loadError);
      setError('Could not load recent responsiveness profiles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRecentProfiles();
  }, []);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.athleteId === selectedAthleteId) || null,
    [profiles, selectedAthleteId]
  );

  const recentProfiles = useMemo(
    () => [...profiles].sort((left, right) => (right.updatedAt || right.lastUpdatedAt || 0) - (left.updatedAt || left.lastUpdatedAt || 0)),
    [profiles]
  );

  const summaryRows = useMemo(() => {
    if (!selectedProfile) return [];
    const familyKeys = Object.keys(selectedProfile.familyResponses);
    const firstFamily = familyKeys.length > 0 ? selectedProfile.familyResponses[familyKeys[0]] : undefined;
    return [
      ['Athlete', selectedProfile.athleteId],
      ['Freshness', formatFreshness(selectedProfile)],
      ['Last updated', formatDate(selectedProfile.lastUpdatedAt || selectedProfile.updatedAt)],
      ['Created', formatDate(selectedProfile.createdAt)],
      ['Stale at', formatDate(selectedProfile.staleAt)],
      ['Source events', String(selectedProfile.sourceEventIds.length)],
      ['Family summaries', String(Object.keys(selectedProfile.familyResponses).length)],
      ['Variant summaries', String(Object.keys(selectedProfile.variantResponses).length)],
      ['State fit sample', firstFamily ? firstFamily.stateFit.slice(0, 3).join(', ') : 'No state fit yet'],
    ];
  }, [selectedProfile]);

  const handleLoadAthlete = async () => {
    const athleteId = athleteQuery.trim();
    if (!athleteId) return;

    setLoadingProfile(true);
    setError(null);
    try {
      const profile = await protocolResponsivenessService.getByAthleteId(athleteId);
      if (!profile) {
        setError(`No responsiveness profile found for ${athleteId}.`);
        return;
      }

      setProfiles((current) => {
        const next = current.filter((entry) => entry.athleteId !== profile.athleteId);
        next.unshift(profile);
        return next;
      });
      setSelectedAthleteId(profile.athleteId);
    } catch (loadError) {
      console.error('Failed to load protocol responsiveness profile:', loadError);
      setError('Could not load the selected responsiveness profile.');
    } finally {
      setLoadingProfile(false);
    }
  };

  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Runtime"
        title="Protocol Responsiveness Inspector"
        version="Read-only operator surface"
        summary="A lightweight admin-facing surface for inspecting athlete protocol responsiveness profiles directly, without entering coach assignment review. It reads the shared responsiveness profile collection and shows freshness, evidence traces, family posture, and variant posture in one read-only view."
        highlights={[
          {
            title: 'Operator-Facing, Read-Only',
            body: 'This surface is for inspection and support workflows, not editing or coach review actions.',
          },
          {
            title: 'Direct Profile Lookup',
            body: 'Operators can load recent profiles or search an athlete id directly from the shared responsiveness profile collection.',
          },
          {
            title: 'Evidence First',
            body: 'The inspector surfaces sample size, freshness, supporting evidence, and state-fit tags so the profile is explainable at a glance.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Read-only operator companion for protocol responsiveness memory. It is intentionally smaller than coach assignment review and exists to inspect the profile docs, not to change assignment state."
        sourceOfTruth="This page reads the shared protocol responsiveness profile collection and mirrors the runtime summary that Nora uses when ranking bounded protocol candidates."
        masterReference="Use Protocol Responsiveness Profile Spec for the learning model and Nora Assignment Rules for planner behavior. Use this inspector when you need to see what the current responsiveness memory looks like for a specific athlete."
        relatedDocs={[
          'Protocol Responsiveness Profile Spec',
          'Protocol Governance Spec',
          'Protocol Registry',
          'Nora Assignment Rules',
        ]}
      />

      <SectionBlock icon={Search} title="Profile Lookup">
        <CardGrid columns="md:grid-cols-3">
          <InfoCard
            title="Lookup Controls"
            accent="blue"
            body={
              <div className="space-y-3">
                <input
                  className="w-full rounded-xl border border-zinc-800 bg-[#0b1220] px-3 py-2 text-sm text-white outline-none transition focus:border-lime-400/60"
                  value={athleteQuery}
                  onChange={(event) => setAthleteQuery(event.target.value)}
                  placeholder="Athlete id"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void handleLoadAthlete();
                    }
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleLoadAthlete}
                    disabled={loadingProfile}
                    className="rounded-full border border-lime-400/40 bg-lime-500/10 px-3 py-1.5 text-xs font-medium text-lime-200 transition hover:bg-lime-500/20 disabled:opacity-60"
                  >
                    {loadingProfile ? 'Loading...' : 'Load profile'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadRecentProfiles()}
                    disabled={loading}
                    className="rounded-full border border-zinc-700 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-white/[0.08] disabled:opacity-60"
                  >
                    <span className="inline-flex items-center gap-1">
                      <RefreshCw className="h-3.5 w-3.5" />
                      Refresh recent
                    </span>
                  </button>
                </div>
              </div>
            }
          />
          <InfoCard
            title="Operator Guidance"
            accent="amber"
            body={
              <BulletList
                items={[
                  'Use this when you need to inspect the profile memory that informs Nora planning.',
                  'Do not use this as a coach assignment review workflow.',
                  'Recent profiles are ordered by update time, but you can jump directly to a specific athlete id.',
                ]}
              />
            }
          />
          <InfoCard
            title="Current Queue"
            accent="green"
            body={
              <div className="space-y-2">
                {recentProfiles.length ? (
                  recentProfiles.map((profile) => {
                    const selected = profile.athleteId === selectedAthleteId;
                    return (
                      <button
                        key={profile.athleteId}
                        type="button"
                        onClick={() => setSelectedAthleteId(profile.athleteId)}
                        className={`w-full rounded-2xl border px-3 py-2 text-left transition ${
                          selected
                            ? 'border-lime-400/40 bg-lime-500/10'
                            : 'border-zinc-800 bg-black/20 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-medium text-white">{profile.athleteId}</div>
                          <InlineTag label={formatFreshness(profile)} color={formatFreshness(profile) === 'current' ? 'green' : 'amber'} />
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">{formatDate(profile.lastUpdatedAt || profile.updatedAt)}</div>
                      </button>
                    );
                  })
                ) : (
                  <div className="text-sm text-zinc-500">{loading ? 'Loading profiles...' : 'No responsiveness profiles found.'}</div>
                )}
              </div>
            }
          />
        </CardGrid>
        {error ? <div className="text-sm text-red-300">{error}</div> : null}
      </SectionBlock>

      <SectionBlock icon={Database} title="Selected Profile">
        {selectedProfile ? (
          <div className="space-y-4">
            <DataTable columns={['Field', 'Value']} rows={summaryRows} />
            <CardGrid columns="md:grid-cols-3">
              <InfoCard
                title="Profile Status"
                accent={formatFreshness(selectedProfile) === 'current' ? 'green' : 'amber'}
                body={
                  <BulletList
                    items={[
                      `Freshness: ${formatFreshness(selectedProfile)}`,
                      `Source events: ${selectedProfile.sourceEventIds.length}`,
                      `Family summaries: ${Object.keys(selectedProfile.familyResponses).length}`,
                      `Variant summaries: ${Object.keys(selectedProfile.variantResponses).length}`,
                    ]}
                  />
                }
              />
              <InfoCard
                title="Evidence Trace"
                accent="blue"
                body={
                  <BulletList
                    items={
                      selectedProfile.sourceEventIds.length
                        ? selectedProfile.sourceEventIds.slice(0, 6)
                        : ['No source event ids have been attached yet.']
                    }
                  />
                }
              />
              <InfoCard
                title="Planner Use"
                accent="purple"
                body={
                  <BulletList
                    items={[
                      'Use the profile to bias candidate ranking, not to override present-moment state.',
                      'A strong current-state signal still wins over stale or weak responsiveness memory.',
                      'Responsiveness should only influence choices inside the bounded protocol / sim inventory.',
                    ]}
                  />
                }
              />
            </CardGrid>
          </div>
        ) : (
          <InfoCard
            title="No Profile Selected"
            accent="amber"
            body="Pick a recent athlete from the queue or search an athlete id to load a responsiveness profile."
          />
        )}
      </SectionBlock>

      {selectedProfile ? (
        <>
          <SectionBlock icon={BrainCircuit} title="Family Responsiveness">
            <DataTable
              columns={['Family', 'Direction', 'Confidence', 'Freshness', 'Samples', 'Evidence']}
              rows={getProfileFamilyRows(selectedProfile)}
            />
          </SectionBlock>

          <SectionBlock icon={ShieldCheck} title="Variant Responsiveness">
            <DataTable
              columns={['Variant', 'Family', 'Direction', 'Confidence', 'Freshness', 'Samples']}
              rows={getProfileVariantRows(selectedProfile)}
            />
          </SectionBlock>
        </>
      ) : null}
    </div>
  );
};

export default PulseCheckProtocolResponsivenessInspectorTab;
