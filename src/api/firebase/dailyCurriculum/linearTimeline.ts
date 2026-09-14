import type { LinearPublishedVersion } from './linearPublication';
export interface LinearTimelineInput {
  completedSkillIds: readonly string[];
  currentAssignment: { skillId: string; skillName: string; versionId: string; skillType: 'protocol' | 'simulation'; phase: 'learn' | 'practice' | 'use_it'; completedDayCount: number; requiredDays: number; windowStart: string; windowEnd: string } | null;
  pinnedVersion: LinearPublishedVersion | null;
  latestApplicableVersion: LinearPublishedVersion | null;
  completedSkillSummaries?: readonly { skillId: string; name: string; versionId?: string }[];
}
export interface LinearTimeline {
  completed: { skillId: string; name: string }[];
  current: { skillId: string; name: string; versionId: string; phase: string; completedDayCount: number; requiredDays: 5; windowStart: string; windowEnd: string; phases: { id: string; label: string; description: string; status: 'complete' | 'current' | 'upcoming' }[] } | null;
  upcoming: { skillId: string; name: string }[];
  upcomingTotal: number;
  upcomingLabel: string;
}
/** Presentation of supplied progress only; publishing or ordering never creates completion evidence. */
export function buildLinearTimeline(input: LinearTimelineInput): LinearTimeline {
  const completedIds = [...new Set(input.completedSkillIds.filter(id => typeof id === 'string' && !!id.trim()))];
  const completedSet = new Set(completedIds);
  const nameFor = (id: string) => input.completedSkillSummaries?.find(s => s.skillId === id && s.name.trim())?.name || input.pinnedVersion?.skills.find(s => s.id === id)?.name || input.latestApplicableVersion?.skills.find(s => s.id === id)?.name || id;
  const assignment = input.currentAssignment;
  const definitions = assignment?.skillType === 'protocol' ? [
    { id: 'learn', label: 'Learn', description: 'Follow the guided module to learn the technique.' },
    { id: 'practice', label: 'Practice', description: 'Practice the technique independently.' },
    { id: 'use_it', label: 'Use it', description: 'Apply the technique in a real moment, with optional reflection.' },
  ] : [
    { id: 'practice', label: 'Practice', description: 'Play the existing simulation; its introduction teaches the task.' },
    { id: 'use_it', label: 'Use it', description: 'Use the skill intentionally in a real moment, with an optional journal entry.' },
  ];
  const currentIndex = assignment ? definitions.findIndex(p => p.id === assignment.phase) : -1;
  const current: LinearTimeline['current'] = assignment ? {
    skillId: assignment.skillId, name: assignment.skillName || nameFor(assignment.skillId), versionId: assignment.versionId,
    phase: assignment.phase, completedDayCount: Number.isFinite(assignment.completedDayCount) ? Math.max(0, Math.min(5, Math.floor(assignment.completedDayCount))) : 0,
    requiredDays: 5, windowStart: assignment.windowStart, windowEnd: assignment.windowEnd,
    phases: definitions.map((phase, index) => ({ ...phase, status: index === currentIndex ? 'current' : currentIndex >= 0 && index < currentIndex ? 'complete' : 'upcoming' })),
  } : null;
  const latest = input.latestApplicableVersion;
  const available = latest?.status === 'published';
  const upcomingIds = available ? [...new Set(latest.content.orderedIds)].filter(id => !completedSet.has(id) && id !== assignment?.skillId && latest.runtimeReadySkillIds.includes(id) && latest.skills.some(skill => skill.id === id)) : [];
  return { completed: completedIds.slice(-200).map(skillId => ({ skillId, name: nameFor(skillId) })), current,
    upcoming: upcomingIds.slice(0, 200).map(skillId => ({ skillId, name: latest!.skills.find(skill => skill.id === skillId)!.name || skillId })),
    upcomingTotal: upcomingIds.length,
    upcomingLabel: available ? 'Upcoming skills are a preview and may change before your current skill is complete.' : 'Upcoming skills are unavailable until an applicable published version is available.' };
}
