import React, { useEffect, useMemo, useState } from 'react';
import { BrainCircuit, Database, MessageCircleMore, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import {
  assignmentOrchestratorService,
  type PulseCheckDailyAssignment,
  type PulseCheckPlannerAuditCandidate,
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

function humanizeRuntimeLabel(value?: string | null) {
  return value ? value.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim() : 'Not set';
}

function formatFreshness(profile: PulseCheckProtocolResponsivenessProfile) {
  return profile.staleAt > Date.now() ? 'current' : 'refresh_required';
}

function formatProtocolAuditTrace(assignment: PulseCheckDailyAssignment) {
  const lines: string[] = [];

  if (assignment.protocolFamilyId) {
    lines.push(`Family ${assignment.protocolFamilyId}`);
  }

  if (assignment.protocolVariantLabel || assignment.protocolVariantId || assignment.protocolVariantVersion) {
    const variantLabel = assignment.protocolVariantLabel || assignment.protocolVariantId || 'Published variant';
    const variantVersion = assignment.protocolVariantVersion ? ` ${assignment.protocolVariantVersion}` : '';
    lines.push(`Variant ${variantLabel}${variantVersion}`);
  }

  if (assignment.protocolPublishedAt) {
    lines.push(`Published ${formatDate(assignment.protocolPublishedAt)}`);
  }

  if (assignment.protocolPublishedRevisionId) {
    lines.push(`Revision ${assignment.protocolPublishedRevisionId}`);
  }

  if (assignment.protocolId) {
    lines.push(`Runtime ${assignment.protocolId}`);
  }

  return lines;
}

function formatPlannerAuditCandidateTrace(candidate: PulseCheckPlannerAuditCandidate) {
  const lines: string[] = [];

  if (candidate.protocolFamilyId) {
    lines.push(`Family ${candidate.protocolFamilyId}`);
  }

  if (candidate.protocolVariantLabel || candidate.protocolVariantId || candidate.protocolVariantVersion) {
    const variantLabel = candidate.protocolVariantLabel || candidate.protocolVariantId || 'Published variant';
    const variantVersion = candidate.protocolVariantVersion ? ` ${candidate.protocolVariantVersion}` : '';
    lines.push(`Variant ${variantLabel}${variantVersion}`);
  }

  if (candidate.protocolPublishedAt) {
    lines.push(`Published ${formatDate(candidate.protocolPublishedAt)}`);
  }

  if (candidate.protocolPublishedRevisionId) {
    lines.push(`Revision ${candidate.protocolPublishedRevisionId}`);
  }

  if (candidate.protocolId) {
    lines.push(`Runtime ${candidate.protocolId}`);
  }

  return lines;
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
  const [latestAssignment, setLatestAssignment] = useState<PulseCheckDailyAssignment | null>(null);
  const [assignmentRevisions, setAssignmentRevisions] = useState<PulseCheckDailyAssignment[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>('');
  const [athleteQuery, setAthleteQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingAssignmentTrace, setLoadingAssignmentTrace] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignmentTraceError, setAssignmentTraceError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!selectedAthleteId) {
      setLatestAssignment(null);
      setAssignmentRevisions([]);
      setAssignmentTraceError(null);
      return;
    }

    let cancelled = false;

    const loadAssignmentTrace = async () => {
      setLoadingAssignmentTrace(true);
      setAssignmentTraceError(null);
      try {
        const assignment = await assignmentOrchestratorService.getLatestForAthlete(selectedAthleteId);
        if (cancelled) return;

        setLatestAssignment(assignment);

        if (!assignment) {
          setAssignmentRevisions([]);
          return;
        }

        const revisions = await assignmentOrchestratorService.listRevisions(assignment.id);
        if (cancelled) return;
        setAssignmentRevisions(revisions);
      } catch (loadError) {
        console.error('Failed to load assignment audit trace:', loadError);
        if (!cancelled) {
          setLatestAssignment(null);
          setAssignmentRevisions([]);
          setAssignmentTraceError('Could not load the latest assignment audit trace.');
        }
      } finally {
        if (!cancelled) {
          setLoadingAssignmentTrace(false);
        }
      }
    };

    void loadAssignmentTrace();

    return () => {
      cancelled = true;
    };
  }, [selectedAthleteId]);

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

  const assignmentSummaryRows = useMemo(() => {
    if (!latestAssignment) return [];

    return [
      ['Assignment id', latestAssignment.id],
      ['Source date', latestAssignment.sourceDate],
      ['Status', humanizeRuntimeLabel(latestAssignment.status)],
      ['Action type', humanizeRuntimeLabel(latestAssignment.actionType)],
      ['Revision', String(latestAssignment.revision)],
      ['Chosen candidate', latestAssignment.chosenCandidateId || 'Not stored'],
      ['Updated', formatDate(latestAssignment.updatedAt)],
      ['Planner generated', formatDate(latestAssignment.plannerAudit?.generatedAt)],
    ];
  }, [latestAssignment]);

  const plannerAuditRows = useMemo(() => {
    if (!latestAssignment?.plannerAudit?.rankedCandidates?.length) return [];

    return latestAssignment.plannerAudit.rankedCandidates.slice(0, 4).map((candidate) => [
      <div key={`${candidate.candidateId}-label`} className="space-y-1">
        <div className="font-medium text-white">{candidate.label}</div>
        <div className="text-xs text-zinc-500">{humanizeRuntimeLabel(candidate.type)}</div>
      </div>,
      candidate.selected ? 'Selected' : 'Candidate',
      candidate.rationale,
      candidate.protocolId ? formatPlannerAuditCandidateTrace(candidate).join(' • ') : 'No protocol lineage',
    ]);
  }, [latestAssignment]);

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
          {
            title: 'Assignment Audit Trace',
            body: 'Operators can inspect the latest Nora assignment lineage and planner audit for the selected athlete without leaving this internal surface.',
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
          'Protocol Revision & Audit Trace',
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

      <SectionBlock icon={Database} title="Latest Assignment Audit Trace">
        {loadingAssignmentTrace ? (
          <InfoCard
            title="Loading Trace"
            accent="blue"
            body="Loading the latest Nora assignment and revision lineage for the selected athlete."
          />
        ) : latestAssignment ? (
          <div className="space-y-4">
            <DataTable columns={['Field', 'Value']} rows={assignmentSummaryRows} />
            <CardGrid columns="md:grid-cols-3">
              <InfoCard
                title="Protocol Lineage"
                accent={latestAssignment.protocolId ? 'green' : 'amber'}
                body={
                  latestAssignment.protocolId ? (
                    <div className="flex flex-wrap gap-2">
                      {formatProtocolAuditTrace(latestAssignment).map((item) => (
                        <InlineTag key={`${latestAssignment.id}-${item}`} label={item} color="green" />
                      ))}
                    </div>
                  ) : (
                    'The latest assignment is not a protocol-backed runtime task.'
                  )
                }
              />
              <InfoCard
                title="Planner Posture"
                accent="purple"
                body={
                  <BulletList
                    items={[
                      `State confidence: ${humanizeRuntimeLabel(latestAssignment.plannerAudit?.stateConfidence)}`,
                      latestAssignment.plannerAudit?.responsivenessApplied ? 'Responsiveness weighting was applied.' : 'Responsiveness weighting was not applied.',
                      `Candidate set shown: ${latestAssignment.plannerAudit?.rankedCandidates?.length || 0}`,
                    ]}
                  />
                }
              />
              <InfoCard
                title="Revision Trail"
                accent="blue"
                body={
                  <BulletList
                    items={
                      assignmentRevisions.length
                        ? assignmentRevisions.slice(0, 4).map((revision) => {
                            const revisionLead = `Revision ${revision.revision} • ${humanizeRuntimeLabel(revision.status)} • ${formatDate(revision.updatedAt)}`;
                            const protocolTrace = revision.protocolId ? formatProtocolAuditTrace(revision).join(' • ') : 'No protocol lineage';
                            return `${revisionLead} • ${protocolTrace}`;
                          })
                        : ['No stored revisions have been attached to this assignment yet.']
                    }
                  />
                }
              />
            </CardGrid>
            {plannerAuditRows.length ? (
              <DataTable columns={['Candidate', 'Status', 'Rationale', 'Audit Trace']} rows={plannerAuditRows} />
            ) : (
              <InfoCard
                title="Planner Audit"
                accent="amber"
                body="No ranked planner candidates were stored on the latest assignment."
              />
            )}
          </div>
        ) : (
          <InfoCard
            title="No Assignment Trace"
            accent="amber"
            body={assignmentTraceError || 'No Nora daily assignment was found yet for the selected athlete.'}
          />
        )}
      </SectionBlock>

      <SectionBlock icon={MessageCircleMore} title="Practice Conversation Review">
        {latestAssignment ? (
          <CardGrid columns="md:grid-cols-3">
            <InfoCard
              title="Review Boundary"
              accent="blue"
              body={
                <BulletList
                  items={[
                    'This inspector reads the assignment-linked practice session when one is persisted; it does not invent transcript content.',
                    'When transcript data is unavailable, the inspector should say so plainly instead of inventing a summary.',
                    'Coach review remains the richer surface for turn-by-turn narrative context.',
                  ]}
                />
              }
            />
            <InfoCard
              title="Practice Transcript"
              accent={latestAssignment.protocolPracticeSession?.turns?.length ? 'green' : 'amber'}
              body={
                latestAssignment.protocolPracticeSession?.turns?.length
                  ? latestAssignment.protocolPracticeSession.turns.slice(0, 2).map((turn) => `${turn.promptLabel || 'Prompt'}: ${turn.responseText}`).join(' ')
                  : 'No persisted practice transcript summary is attached to this assignment yet. Use coach review or the evidence dashboard for the transcript-level surface once records land.'
              }
            />
            <InfoCard
              title="Scorecard Contract"
              accent={latestAssignment.protocolPracticeSession?.scorecard ? 'green' : 'amber'}
              body={
                latestAssignment.protocolPracticeSession?.scorecard ? (
                  <BulletList
                    items={[
                      `Signal awareness: ${latestAssignment.protocolPracticeSession.scorecard.dimensionScores.signalAwareness.toFixed(1)} / 5`,
                      `Technique fidelity: ${latestAssignment.protocolPracticeSession.scorecard.dimensionScores.techniqueFidelity.toFixed(1)} / 5`,
                      `Language quality: ${latestAssignment.protocolPracticeSession.scorecard.dimensionScores.languageQuality.toFixed(1)} / 5`,
                      `Shift quality: ${latestAssignment.protocolPracticeSession.scorecard.dimensionScores.shiftQuality.toFixed(1)} / 5`,
                      `Coachability: ${latestAssignment.protocolPracticeSession.scorecard.dimensionScores.coachability.toFixed(1)} / 5`,
                    ]}
                  />
                ) : (
                  <BulletList
                    items={[
                      'Signal awareness',
                      'Technique fidelity',
                      'Language quality',
                      'Shift quality',
                      'Coachability',
                    ]}
                  />
                )
              }
            />
          </CardGrid>
        ) : (
          <InfoCard
            title="No Practice Context"
            accent="amber"
            body="Select a recent athlete assignment first so the inspector can at least anchor the practice-conversation review to real lineage."
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
