import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Lock,
  Search,
  Users,
} from 'lucide-react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';

import { db } from '../api/firebase/config';
import { useUser } from '../hooks/useUser';
import { exerciseService } from '../api/firebase/exercise/service';
import { Exercise, ExerciseDetail } from '../api/firebase/exercise/types';
import { ExerciseGrid } from '../components/App/ExerciseGrid/ExerciseGrid';
import { UserFilter } from '../components/App/UserFilter/UserFilter';
import { workoutService } from '../api/firebase/workout/service';
import { userService } from '../api/firebase/user';
import { generateId } from '../utils/generateId';
import { 
  Challenge, 
  ChallengeStatus, 
  ChallengeType,
  SweatlistCollection, 
  SweatlistIdentifiers, 
  SweatlistType as SweatlistTypeEnum,
  RoundType,
  RunRoundType,
  RunRoundConfiguration
} from '../api/firebase/workout/types';
import { 
  RoundTypeSelector, 
  RunRoundTemplateSelector, 
  RunRoundConfigurationView 
} from '../components/App/RoundCreation';

// Keep this page intentionally focused: this is the iOS-mirroring wizard entrypoint.
// This file wires iOS-style generation + persistence (no /programming redirect).

type WizardStep =
  | 'roundType'  // NEW: First step - select Lift/Run/Stretch/FatBurn
  | 'mode'
  | 'templateLibrary'
  | 'templatePreview'
  | 'templateFillMoves'
  | 'custom'
  | 'generating'
  | 'finalize'
  | 'runTemplateSelect'  // NEW: Run round template selection
  | 'runConfig';          // NEW: Run round configuration

type SweatlistType = 'together' | 'locked';

type ExerciseDetailMode = 'mixed' | 'timed' | 'repsSets';

type TemplateSortOption = 'newest' | 'oldest' | 'alpha';

interface RoundTemplate {
  id: string;
  name: string;
  description: string;
  instructions: string;
  moveSlots: number;
  screenTimeEnabled: boolean;
  uniqueOccurrences: number;
  occurrenceBodyPartHints: string[][];
  createdBy?: string | null;
  createdAt?: number; // seconds since epoch
  updatedAt?: number; // seconds since epoch
}

interface ChallengeDraft {
  challengeName: string;
  challengeDesc: string;
  startDate: string; // yyyy-mm-dd
  endDate: string; // yyyy-mm-dd
  roundType: SweatlistType;
  pinCode: string;
  includeRestDays: boolean;
  restDays: string[]; // weekday names
}

interface CustomDraft {
  instructions: string;
  selectedMoves: Exercise[];
  numberOfUniqueStacks: number;
  isBodyPartSplitMode: boolean;
  lockedBodyPartGroups: string[][]; // each non-empty group = 1 stack focus group
  useSelectedMovesOnly: boolean;
  exerciseDetailMode: ExerciseDetailMode;
}

const DEFAULT_CUSTOM_DRAFT: CustomDraft = {
  instructions: '',
  selectedMoves: [],
  numberOfUniqueStacks: 3,
  isBodyPartSplitMode: false,
  lockedBodyPartGroups: [],
  useSelectedMovesOnly: false,
  exerciseDetailMode: 'mixed',
};

const DEFAULT_CHALLENGE_DRAFT: ChallengeDraft = {
  challengeName: '',
  challengeDesc: '',
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date(Date.now() + 7 * 86400 * 1000).toISOString().slice(0, 10),
  roundType: 'together',
  pinCode: '',
  includeRestDays: false,
  restDays: [],
};

const parseTemplateDoc = (id: string, data: Record<string, any>): RoundTemplate => {
  const serializedHints: string[] = Array.isArray(data?.occurrenceBodyPartHints)
    ? data.occurrenceBodyPartHints
    : [];
  const occurrenceBodyPartHints = serializedHints.map((s) =>
    String(s || '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
  );
  return {
    id,
    name: data?.name || 'Template',
    description: data?.description || '',
    instructions: data?.instructions || '',
    moveSlots: typeof data?.moveSlots === 'number' ? data.moveSlots : 0,
    screenTimeEnabled: typeof data?.screenTimeEnabled === 'boolean' ? data.screenTimeEnabled : true,
    uniqueOccurrences: typeof data?.uniqueOccurrences === 'number' ? data.uniqueOccurrences : 1,
    occurrenceBodyPartHints,
    createdBy: data?.createdBy ?? null,
    createdAt: typeof data?.createdAt === 'number' ? data.createdAt : undefined,
    updatedAt: typeof data?.updatedAt === 'number' ? data.updatedAt : undefined,
  };
};

const CreateRoundPage: React.FC = () => {
  const router = useRouter();
  const currentUser = useUser();

  const [step, setStep] = useState<WizardStep>('roundType');
  
  // Round type selection (Lift/Run/Stretch/FatBurn)
  const [selectedRoundType, setSelectedRoundType] = useState<RoundType | null>(null);
  
  // Run round specific state
  const [selectedRunRoundType, setSelectedRunRoundType] = useState<RunRoundType | null>(null);

  // Templates
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<RoundTemplate[]>([]);
  const [templateSearch, setTemplateSearch] = useState('');
  const [minMovesText, setMinMovesText] = useState('');
  const [maxMovesText, setMaxMovesText] = useState('');
  const [templateSort, setTemplateSort] = useState<TemplateSortOption>('newest');
  const [selectedTemplate, setSelectedTemplate] = useState<RoundTemplate | null>(null);

  // Move library (used for template fill and custom selection)
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [exercisesLoading, setExercisesLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [moveSearch, setMoveSearch] = useState('');

  // Template fill moves state
  const [activeOccurrenceIndex, setActiveOccurrenceIndex] = useState(0);
  const [occurrenceSelections, setOccurrenceSelections] = useState<Exercise[][]>([]);

  // Drafts
  const [challengeDraft, setChallengeDraft] = useState<ChallengeDraft>(DEFAULT_CHALLENGE_DRAFT);
  const [customDraft, setCustomDraft] = useState<CustomDraft>(DEFAULT_CUSTOM_DRAFT);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [thinking, setThinking] = useState<string>('');

  // Refs
  const topRef = useRef<HTMLDivElement | null>(null);

  const ensureLoggedIn = useCallback(() => {
    if (!currentUser) {
      router.push('/login');
      return false;
    }
    return true;
  }, [currentUser, router]);

  const loadTemplates = useCallback(async () => {
    try {
      setTemplatesLoading(true);
      setTemplatesError(null);
      const ref = collection(db, 'round-templates');
      // iOS sorts locally; we can get newest first to reduce perceived load.
      const q = query(ref, orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const items = snap.docs.map((d) => parseTemplateDoc(d.id, d.data() as any));
      setTemplates(items);
    } catch (e) {
      console.error('[create-round] Failed to load templates:', e);
      setTemplatesError('Failed to load templates. Please try again.');
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  const loadExercises = useCallback(async () => {
    try {
      setExercisesLoading(true);
      await exerciseService.fetchExercises();
      setAllExercises(exerciseService.allExercises);
    } catch (e) {
      console.error('[create-round] Failed to load exercises:', e);
    } finally {
      setExercisesLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load exercises early so the Move selection screens feel instant.
    loadExercises();
  }, [loadExercises]);

  const filteredTemplates = useMemo(() => {
    let results = [...templates];
    const min = parseInt(minMovesText, 10);
    const max = parseInt(maxMovesText, 10);
    if (!Number.isNaN(min)) results = results.filter((t) => t.moveSlots >= min);
    if (!Number.isNaN(max)) results = results.filter((t) => t.moveSlots <= max);

    const q = templateSearch.trim().toLowerCase();
    if (q) {
      results = results.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
      );
    }

    switch (templateSort) {
      case 'alpha':
        results.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'oldest':
        results.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        break;
      case 'newest':
      default:
        results.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        break;
    }
    return results;
  }, [templates, templateSearch, minMovesText, maxMovesText, templateSort]);

  const filteredExercises = useMemo(() => {
    const q = moveSearch.trim().toLowerCase();
    return allExercises
      .filter((ex) => (selectedUserId ? ex.author?.userId === selectedUserId : true))
      .filter((ex) => (q ? ex.name.toLowerCase().includes(q) : true));
  }, [allExercises, moveSearch, selectedUserId]);

  const initTemplateSelections = useCallback((template: RoundTemplate) => {
    const occurrences = Math.max(1, template.uniqueOccurrences || 1);
    setActiveOccurrenceIndex(0);
    setOccurrenceSelections(Array.from({ length: occurrences }, () => []));
  }, []);

  const totalSelectedInTemplate = useMemo(() => {
    return occurrenceSelections.reduce((sum, arr) => sum + arr.length, 0);
  }, [occurrenceSelections]);

  const canContinueTemplateFillMoves = useMemo(() => {
    if (!selectedTemplate) return false;
    if (selectedTemplate.id === 'custom-selector') return true;
    const occurrences = Math.max(1, selectedTemplate.uniqueOccurrences || 1);
    if (occurrences <= 1) {
      // moveSlots=0 means unlimited selection (custom selector)
      if (selectedTemplate.moveSlots === 0) return true;
      return (occurrenceSelections[0]?.length || 0) === selectedTemplate.moveSlots;
    }
    // Mirror iOS behavior: allow continue when cumulative selections reach the per-stack target.
    return totalSelectedInTemplate >= selectedTemplate.moveSlots;
  }, [occurrenceSelections, selectedTemplate, totalSelectedInTemplate]);

  const toggleTemplateMove = useCallback(
    (exercise: Exercise) => {
      if (!selectedTemplate) return;
      const occurrences = Math.max(1, selectedTemplate.uniqueOccurrences || 1);
      const targetIndex = occurrences > 1 ? activeOccurrenceIndex : 0;

      setOccurrenceSelections((prev) => {
        const next = [...prev];
        const current = [...(next[targetIndex] || [])];
        const existingIdx = current.findIndex((e) => e.id === exercise.id);

        if (existingIdx >= 0) {
          current.splice(existingIdx, 1);
          next[targetIndex] = current;
          return next;
        }

        // Limit per occurrence to moveSlots (matches iOS guard)
        if (selectedTemplate.moveSlots > 0 && current.length >= selectedTemplate.moveSlots) {
          return prev;
        }

        current.push(exercise);
        next[targetIndex] = current;
        return next;
      });
    },
    [activeOccurrenceIndex, selectedTemplate]
  );

  const selectedExercisesForTemplate = useMemo(() => {
    // Flatten for multi-occurrence, else use occurrence 0
    if (!selectedTemplate) return [];
    const occurrences = Math.max(1, selectedTemplate.uniqueOccurrences || 1);
    if (occurrences > 1) return occurrenceSelections.flatMap((x) => x);
    return occurrenceSelections[0] || [];
  }, [occurrenceSelections, selectedTemplate]);

  const goBack = useCallback(() => {
    switch (step) {
      case 'roundType':
        router.push('/create');
        return;
      case 'mode':
        setStep('roundType');
        return;
      case 'templateLibrary':
        setStep('mode');
        return;
      case 'templatePreview':
        setStep('templateLibrary');
        return;
      case 'templateFillMoves':
        setStep('templatePreview');
        return;
      case 'runTemplateSelect':
        setStep('roundType');
        return;
      case 'runConfig':
        setStep('runTemplateSelect');
        return;
      case 'custom':
        setStep('mode');
        return;
      case 'finalize':
        // finalize can come from template flow or custom flow; go back to mode for now
        setStep('mode');
        return;
      default:
        setStep('roundType');
    }
  }, [step, router]);

  const headerTitle = useMemo(() => {
    switch (step) {
      case 'roundType':
        return 'Create a Round';
      case 'mode':
        return selectedRoundType === RoundType.Lift ? 'Lift Round' : 
               selectedRoundType === RoundType.Stretch ? 'Stretch Round' : 
               'Create a Round';
      case 'templateLibrary':
        return 'Template Library';
      case 'templatePreview':
        return 'Template Preview';
      case 'templateFillMoves':
        return 'Select Moves';
      case 'runTemplateSelect':
        return 'Run Round';
      case 'runConfig':
        return 'Configure Run Round';
      case 'custom':
        return 'Custom Round';
      case 'generating':
        return 'Generating…';
      case 'finalize':
        return 'Finalize Round';
      default:
        return 'Create a Round';
    }
  }, [step]);

  // Basic validation (iOS validates name before create)
  const validateChallengeBasics = useCallback(() => {
    if (!challengeDraft.challengeName.trim()) return 'Round needs a name before you can create it';
    if (!challengeDraft.startDate || !challengeDraft.endDate) return 'Start and end dates are required';
    if (challengeDraft.roundType === 'locked' && challengeDraft.pinCode.trim().length !== 9) {
      return 'Private rounds require a 9-digit PIN code';
    }
    return null;
  }, [challengeDraft]);

  const onSelectModeCustom = useCallback(() => {
    if (!ensureLoggedIn()) return;
    setStep('custom');
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ensureLoggedIn]);

  const onSelectModeTemplate = useCallback(async () => {
    if (!ensureLoggedIn()) return;
    setStep('templateLibrary');
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (templates.length === 0 && !templatesLoading) {
      await loadTemplates();
    }
  }, [ensureLoggedIn, loadTemplates, templates.length, templatesLoading]);

  const onPickTemplate = useCallback(
    (t: RoundTemplate) => {
      setSelectedTemplate(t);
      // Prefill finalize fields like iOS template preview → Use Template
      setChallengeDraft((prev) => ({
        ...prev,
        challengeName: prev.challengeName || t.name,
        challengeDesc: prev.challengeDesc || t.description,
      }));
      setStep('templatePreview');
      topRef.current?.scrollIntoView({ behavior: 'smooth' });
    },
    []
  );

  const onUseTemplate = useCallback(() => {
    if (!selectedTemplate) return;
    initTemplateSelections(selectedTemplate);
    setStep('templateFillMoves');
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [initTemplateSelections, selectedTemplate]);

  const onContinueFromTemplateMoves = useCallback(() => {
    if (selectedTemplate?.id === 'custom-selector') {
      setCustomDraft((p) => ({ ...p, selectedMoves: selectedExercisesForTemplate }));
      setSelectedTemplate(null);
      setOccurrenceSelections([]);
      setActiveOccurrenceIndex(0);
      setStep('custom');
      topRef.current?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    setStep('finalize');
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedExercisesForTemplate, selectedTemplate?.id]);

  const computeTotalDays = (start: Date, end: Date) => {
    const s = new Date(start);
    const e = new Date(end);
    s.setHours(0, 0, 0, 0);
    e.setHours(0, 0, 0, 0);
    const diff = e.getTime() - s.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  };

  const dayNameToIndex: Record<string, number> = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };

  const buildBackupByBodyPart = (limitPerPart = 50) => {
    const by: Record<string, { id: string; name: string }[]> = {};
    for (const ex of allExercises) {
      const primary = (ex.primaryBodyParts?.[0] || 'fullbody').toLowerCase();
      if (!by[primary]) by[primary] = [];
      if (by[primary].length >= limitPerPart) continue;
      by[primary].push({ id: ex.id, name: ex.name });
    }
    return by;
  };

  const generateAndSaveRound = useCallback(async (mode: 'template' | 'custom') => {
    if (isSubmitting) return;
    const err = validateChallengeBasics();
    if (err) {
      alert(err);
      return;
    }
    if (!currentUser?.id) {
      alert('You must be signed in to create a round.');
      return;
    }

    setIsSubmitting(true);
    setThinking('');
    setStep('generating');

    try {
      const startDate = new Date(challengeDraft.startDate);
      const endDate = new Date(challengeDraft.endDate);
      const totalDays = computeTotalDays(startDate, endDate);

      const restDayIndices = (challengeDraft.includeRestDays ? challengeDraft.restDays : [])
        .map((d) => dayNameToIndex[d])
        .filter((n) => typeof n === 'number');

      const request = (() => {
        if (mode === 'template') {
          if (!selectedTemplate) throw new Error('No template selected');
          const userSelected = selectedExercisesForTemplate.map((m) => ({ id: m.id, name: m.name }));
          return {
            templateTitle: selectedTemplate.name,
            templateDescription: selectedTemplate.description,
            instructions: selectedTemplate.instructions,
            allowedMoves: { userSelected, backupByBodyPart: {} },
            numberOfUniqueStacks: Math.max(1, selectedTemplate.uniqueOccurrences || 1),
            bodyPartFocusPerStack: selectedTemplate.occurrenceBodyPartHints || [],
            screenTimeEnabled: !!selectedTemplate.screenTimeEnabled,
            maxMovesPerStack: selectedTemplate.moveSlots || 8,
            timeBudgetMinutesPerStack: null,
          };
        }

        const userSelected = customDraft.selectedMoves.map((m) => ({ id: m.id, name: m.name }));
        const useSelectedOnly = customDraft.useSelectedMovesOnly;
        const backupByBodyPart = useSelectedOnly
          ? {}
          : (userSelected.length === 0 ? buildBackupByBodyPart(50) : {});

        const derivedUniqueStacks = customDraft.isBodyPartSplitMode && customDraft.lockedBodyPartGroups.length > 0
          ? customDraft.lockedBodyPartGroups.filter((g) => g.length > 0).length
          : Math.max(1, customDraft.numberOfUniqueStacks || 3);

        const bodyPartFocusPerStack = customDraft.isBodyPartSplitMode
          ? customDraft.lockedBodyPartGroups
          : [];

        return {
          templateTitle: challengeDraft.challengeName,
          templateDescription: challengeDraft.challengeDesc,
          instructions: customDraft.instructions,
          allowedMoves: { userSelected, backupByBodyPart },
          numberOfUniqueStacks: derivedUniqueStacks,
          bodyPartFocusPerStack,
          screenTimeEnabled: customDraft.exerciseDetailMode === 'timed',
          maxMovesPerStack: 8,
          timeBudgetMinutesPerStack: null,
        };
      })();

      const resp = await fetch('/api/generateRoundV2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`AI generation failed: ${txt}`);
      }

      const generated = await resp.json();
      if (generated?.thinking) setThinking(String(generated.thinking));

      const stacks = Array.isArray(generated?.stacks) ? generated.stacks : [];
      if (stacks.length === 0) throw new Error('AI returned zero stacks.');

      // Create stacks in user library
      const createdStacks = [];
      for (const stack of stacks) {
        const exercises = Array.isArray(stack.exercises) ? stack.exercises : [];
        const details: ExerciseDetail[] = exercises
          .map((ex: any) => {
            const id = String(ex.id || '').trim();
            const name = String(ex.name || '').trim();
            const found =
              allExercises.find((a) => a.id === id) ||
              allExercises.find((a) => a.name.toLowerCase() === name.toLowerCase());
            if (!found) return null;

            const categoryId = String(ex?.category?.id || 'weight-training');
            if (categoryId === 'cardio') {
              return new ExerciseDetail({
                exerciseName: found.name,
                exercise: found,
                groupId: 0,
                notes: '',
                isSplit: false,
                closestMatch: [],
                category: {
                  type: 'cardio',
                  details: {
                    duration: ex?.category?.duration || 60,
                    bpm: ex?.category?.bpm || 140,
                    calories: ex?.category?.calories || 0,
                    screenTime: ex?.category?.screenTime || 0,
                    selectedVideo: null,
                  },
                },
              });
            }

            return new ExerciseDetail({
              exerciseName: found.name,
              exercise: found,
              groupId: 0,
              notes: '',
              isSplit: false,
              closestMatch: [],
              category: {
                type: 'weight-training',
                details: {
                  reps: Array.isArray(ex?.category?.reps) ? ex.category.reps : ['12'],
                  sets: typeof ex?.category?.sets === 'number' ? ex.category.sets : 3,
                  weight: typeof ex?.category?.weight === 'number' ? ex.category.weight : 0,
                  screenTime: typeof ex?.category?.screenTime === 'number' ? ex.category.screenTime : 0,
                  selectedVideo: null,
                },
              },
            });
          })
          .filter(Boolean);

        if (details.length === 0) continue;
        const { workout, exerciseLogs } = await workoutService.formatWorkoutAndInitializeLogs(details, currentUser.id);
        workout.title = stack.title || 'Workout';
        workout.description = stack.description || '';
        workout.autoGenerated = true;
        workout.sourceRoundId = null;

        const created = await userService.createStack(workout, exerciseLogs);
        if (created) createdStacks.push(created);
      }

      if (createdStacks.length === 0) throw new Error('Failed to create any stacks.');

      // Build sweatlistIds across all days (mirror iOS autofill)
      const sweatlistIds: SweatlistIdentifiers[] = [];
      let workoutIndex = 0;
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      for (let dayIndex = 0; dayIndex < totalDays; dayIndex++) {
        const currentDate = new Date(start);
        currentDate.setDate(start.getDate() + dayIndex);
        const dayOfWeek = currentDate.getDay();

        if (restDayIndices.includes(dayOfWeek)) {
          sweatlistIds.push(
            new SweatlistIdentifiers({
              id: `rest-${generateId()}`,
              sweatlistAuthorId: currentUser.id,
              sweatlistName: 'Rest',
              order: dayIndex + 1,
              isRest: true,
            })
          );
        } else {
          const w = createdStacks[workoutIndex % createdStacks.length];
          sweatlistIds.push(
            new SweatlistIdentifiers({
              id: w.id,
              sweatlistAuthorId: currentUser.id,
              sweatlistName: w.title,
              order: dayIndex + 1,
              isRest: false,
            })
          );
          workoutIndex++;
        }
      }

      const createdAt = new Date();
      const challenge = new Challenge({
        id: '',
        title: challengeDraft.challengeName,
        subtitle: challengeDraft.challengeDesc,
        participants: [],
        status: ChallengeStatus.Draft,
        startDate,
        endDate,
        createdAt,
        updatedAt: createdAt,
        ownerId: [currentUser.id],
      });

      const collectionToCreate = new SweatlistCollection({
        id: '',
        title: challengeDraft.challengeName,
        subtitle: challengeDraft.challengeDesc,
        pin: challengeDraft.roundType === 'locked' ? challengeDraft.pinCode : '',
        challenge,
        sweatlistIds,
        ownerId: [currentUser.id],
        participants: [],
        privacy: challengeDraft.roundType === 'locked' ? SweatlistTypeEnum.Locked : SweatlistTypeEnum.Together,
        createdAt,
        updatedAt: createdAt,
      });

      const saved = await workoutService.updateCollection(collectionToCreate);
      if (!saved?.id) throw new Error('Failed to save the round.');

      router.push(`/round/${saved.id}`);
    } catch (e: any) {
      console.error('[create-round] Failed to generate/save:', e);
      alert(e?.message || 'Failed to create round.');
      setStep(mode === 'template' ? 'finalize' : 'custom');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    allExercises,
    challengeDraft,
    computeTotalDays,
    currentUser?.id,
    customDraft,
    isSubmitting,
    router,
    selectedExercisesForTemplate,
    selectedTemplate,
    validateChallengeBasics,
  ]);

  const onContinueFromCustom = useCallback(() => {
    generateAndSaveRound('custom');
  }, [generateAndSaveRound]);

  const onFinalizeCreate = useCallback(() => {
    generateAndSaveRound('template');
  }, [generateAndSaveRound]);

  // UI helpers
  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-black text-white">
      <Head>
        <title>Create a Round | Pulse</title>
      </Head>

      <div ref={topRef} />

      <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-xl border-b border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => {
              if (step === 'roundType') router.push('/create');
              else goBack();
            }}
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">{step === 'roundType' ? 'Back to Creator Studio' : 'Back'}</span>
          </button>
          <div className="text-center flex-1">
            <div className="text-sm text-zinc-500">Pulse</div>
            <div className="text-white font-semibold">{headerTitle}</div>
          </div>
          <div className="w-[160px]" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {children}
      </div>
    </div>
  );

  if (!currentUser) {
    // AuthWrapper usually handles gating; this is an extra guard for direct hits.
    return shell(
      <div className="max-w-lg mx-auto text-center">
        <h1 className="text-2xl font-bold mb-2">Sign in to create a Round</h1>
        <p className="text-zinc-400 mb-6">Rounds are creator tools. Please sign in to continue.</p>
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="px-5 py-3 bg-[#E0FE10] text-black rounded-xl font-semibold hover:bg-[#d4f00e] transition-colors"
        >
          Sign In
        </button>
      </div>
    );
  }

  // ========================================
  // ROUND TYPE SELECTION (First step)
  // ========================================
  if (step === 'roundType') {
    return (
      <RoundTypeSelector
        onClose={() => router.push('/create')}
        onSelectType={(roundType) => {
          setSelectedRoundType(roundType);
          
          if (roundType === RoundType.Lift || roundType === RoundType.Stretch) {
            // Go to traditional template/custom mode selection
            setStep('mode');
          } else if (roundType === RoundType.Run) {
            // Go to run round template selection
            setStep('runTemplateSelect');
          } else if (roundType === RoundType.FatBurn) {
            // Fat Burn coming soon - handled in the selector component
          }
        }}
      />
    );
  }

  // ========================================
  // RUN ROUND TEMPLATE SELECTION
  // ========================================
  if (step === 'runTemplateSelect') {
    return (
      <RunRoundTemplateSelector
        onClose={() => router.push('/create')}
        onBack={() => setStep('roundType')}
        onSelectTemplate={(template) => {
          setSelectedRunRoundType(template);
          setStep('runConfig');
        }}
      />
    );
  }

  // ========================================
  // RUN ROUND CONFIGURATION
  // ========================================
  if (step === 'runConfig' && selectedRunRoundType) {
    return (
      <RunRoundConfigurationView
        selectedTemplate={selectedRunRoundType}
        onClose={() => router.push('/create')}
        onBack={() => setStep('runTemplateSelect')}
        onComplete={async (config) => {
          if (!currentUser?.id) {
            alert('You must be signed in to create a round.');
            return;
          }

          setIsSubmitting(true);
          setStep('generating');

          try {
            // Create the run round
            const collectionId = generateId();
            const challengeId = generateId();
            
            const now = new Date();
            const challengeData: Partial<Challenge> = {
              id: challengeId,
              title: config.title,
              subtitle: config.subtitle,
              participants: [],
              status: ChallengeStatus.Draft,
              introVideos: [],
              privacy: config.privacy,
              pin: config.pin,
              startDate: config.startDate,
              endDate: config.endDate,
              ownerId: [currentUser.id],
              createdAt: now,
              updatedAt: now,
              originalId: collectionId,
              joinWindowEnds: config.startDate,
              minParticipants: 1,
              maxParticipants: 100,
              allowLateJoins: true,
              cohortAuthor: [currentUser.id],
              challengeType: ChallengeType.Run,
              dailyStepGoal: 0,
              totalStepGoal: 0,
              allowedMissedDays: 0,
            };

            const collectionData: Partial<SweatlistCollection> = {
              id: collectionId,
              title: config.title,
              subtitle: config.subtitle,
              pin: config.pin || null,
              challenge: challengeData as Challenge,
              sweatlistIds: [], // Run rounds don't have workout stacks
              ownerId: [currentUser.id],
              privacy: config.privacy,
              createdAt: now,
              updatedAt: now,
              runRoundConfig: config.runRoundConfig,
            };

            // Save to Firestore
            await workoutService.updateCollection(
              new SweatlistCollection(collectionData)
            );

            // Redirect to the new round
            router.push(`/round/${collectionId}`);
          } catch (error) {
            console.error('Failed to create run round:', error);
            alert('Failed to create run round. Please try again.');
            setStep('runConfig');
          } finally {
            setIsSubmitting(false);
          }
        }}
      />
    );
  }

  if (step === 'generating') {
    return shell(
      <div className="max-w-xl mx-auto text-center">
        <div className="w-14 h-14 border-4 border-[#E0FE10] border-t-transparent rounded-full animate-spin mx-auto mb-6" />
        <h2 className="text-2xl font-bold mb-2">Generating your Round…</h2>
        <p className="text-zinc-400">
          Creating stacks, scheduling your round, and saving…
        </p>
        {thinking && (
          <div className="mt-6 p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl text-left">
            <div className="text-zinc-400 text-xs mb-2">AI reasoning</div>
            <div className="text-zinc-200 text-sm">{thinking}</div>
          </div>
        )}
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              // Don't allow cancel mid-request; just return to roundType once finished.
              if (!isSubmitting) setStep('roundType');
            }}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (step === 'mode') {
    const roundTypeName = selectedRoundType === RoundType.Lift ? 'Lift' : 
                          selectedRoundType === RoundType.Stretch ? 'Stretch' : 'Workout';
    return shell(
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-3">Create a {roundTypeName} Round</h1>
          <p className="text-zinc-400">Choose how you want to create your round</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            type="button"
            onClick={onSelectModeCustom}
            className="text-left bg-zinc-900/50 border border-[#E0FE10]/25 hover:border-[#E0FE10]/50 rounded-2xl p-8 transition-colors"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-[#E0FE10]/10 border border-[#E0FE10]/20 flex items-center justify-center">
                <span className="text-[#E0FE10] font-bold">C</span>
              </div>
              <div>
                <div className="text-white text-xl font-semibold">Custom Round</div>
                <div className="text-zinc-400 text-sm">Build from scratch with your moves</div>
              </div>
            </div>
            <p className="text-zinc-500 text-sm">
              Write AI instructions, choose your unique stacks and body-part splits, optionally pre-select moves, then generate.
            </p>
          </button>

          <button
            type="button"
            onClick={onSelectModeTemplate}
            className="text-left bg-zinc-900/50 border border-blue-400/25 hover:border-blue-400/50 rounded-2xl p-8 transition-colors"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-400/20 flex items-center justify-center">
                <span className="text-blue-300 font-bold">T</span>
              </div>
              <div>
                <div className="text-white text-xl font-semibold">Use a Template</div>
                <div className="text-zinc-400 text-sm">Choose a pre-built template to guide you</div>
              </div>
            </div>
            <p className="text-zinc-500 text-sm">
              Pick a template, fill its move slots, generate, then finalize title/dates/privacy.
            </p>
          </button>
        </div>
      </div>
    );
  }

  if (step === 'templateLibrary') {
    return shell(
      <div>
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Template Library</h1>
            <p className="text-zinc-400 text-sm">
              {filteredTemplates.length} template{filteredTemplates.length === 1 ? '' : 's'} available
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadTemplates}
              className="px-3 py-2 bg-zinc-900/60 border border-zinc-800 rounded-lg text-sm text-zinc-200 hover:border-zinc-700 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
          <div className="lg:col-span-2">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
                placeholder="Search templates"
                className="w-full pl-12 pr-4 py-3 bg-zinc-900/50 text-white rounded-xl border border-zinc-800 focus:border-[#E0FE10]/40 focus:outline-none transition-colors placeholder:text-zinc-600"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <input
              value={minMovesText}
              onChange={(e) => setMinMovesText(e.target.value)}
              placeholder="Min moves"
              className="w-full px-4 py-3 bg-zinc-900/50 text-white rounded-xl border border-zinc-800 focus:border-[#E0FE10]/40 focus:outline-none transition-colors placeholder:text-zinc-600"
            />
            <input
              value={maxMovesText}
              onChange={(e) => setMaxMovesText(e.target.value)}
              placeholder="Max moves"
              className="w-full px-4 py-3 bg-zinc-900/50 text-white rounded-xl border border-zinc-800 focus:border-[#E0FE10]/40 focus:outline-none transition-colors placeholder:text-zinc-600"
            />
          </div>

          <select
            value={templateSort}
            onChange={(e) => setTemplateSort(e.target.value as TemplateSortOption)}
            className="w-full px-4 py-3 bg-zinc-900/50 text-white rounded-xl border border-zinc-800 focus:border-[#E0FE10]/40 focus:outline-none transition-colors"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="alpha">A–Z</option>
          </select>
        </div>

        {templatesError && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-sm">
            {templatesError}
          </div>
        )}

        {templatesLoading ? (
          <div className="p-10 text-center text-zinc-400">Loading templates…</div>
        ) : filteredTemplates.length === 0 ? (
          <div className="p-10 text-center text-zinc-500">No templates found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTemplates.map((t) => (
              <button
                type="button"
                key={t.id}
                onClick={() => onPickTemplate(t)}
                className="text-left bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-5 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-white font-semibold">{t.name}</div>
                    <div className="text-zinc-500 text-sm mt-1 line-clamp-2">{t.description}</div>
                  </div>
                  <div className="text-right text-xs text-zinc-400 whitespace-nowrap">
                    <div>{t.moveSlots} moves</div>
                    <div>{Math.max(1, t.uniqueOccurrences)} stack{Math.max(1, t.uniqueOccurrences) === 1 ? '' : 's'}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (step === 'templatePreview' && selectedTemplate) {
    const occ = Math.max(1, selectedTemplate.uniqueOccurrences || 1);
    return shell(
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-3">{selectedTemplate.name}</h1>
        <p className="text-zinc-400 mb-6">{selectedTemplate.description}</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <div className="text-zinc-500 text-xs mb-1">Move slots</div>
            <div className="text-white text-xl font-semibold">{selectedTemplate.moveSlots}</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <div className="text-zinc-500 text-xs mb-1">Unique stacks</div>
            <div className="text-white text-xl font-semibold">{occ}</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <div className="text-zinc-500 text-xs mb-1">Mode</div>
            <div className="text-white text-xl font-semibold">{selectedTemplate.screenTimeEnabled ? 'Timed' : 'Reps/Sets'}</div>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 mb-6">
          <div className="text-white font-semibold mb-2">Instructions</div>
          <p className="text-zinc-400 whitespace-pre-wrap text-sm leading-relaxed">
            {selectedTemplate.instructions || '—'}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep('templateLibrary')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          <button
            type="button"
            onClick={onUseTemplate}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#E0FE10] text-black font-semibold hover:bg-[#d4f00e] transition-colors"
          >
            Use Template
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  if (step === 'templateFillMoves' && selectedTemplate) {
    const occurrences = Math.max(1, selectedTemplate.uniqueOccurrences || 1);
    const selectedExercisesFlat = selectedExercisesForTemplate;

    // ExerciseGrid expects "selectedExercises" list for UI selection state.
    return shell(
      <div>
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Select Moves</h1>
            <p className="text-zinc-400 text-sm">
              Fill this template with {selectedTemplate.moveSlots} move{selectedTemplate.moveSlots === 1 ? '' : 's'}.
            </p>
          </div>
          <div className="text-right text-zinc-500 text-sm">
            <div>
              Selected: <span className="text-white font-semibold">{selectedExercisesFlat.length}</span>
              {occurrences > 1 ? ' total' : ` / ${selectedTemplate.moveSlots}`}
            </div>
          </div>
        </div>

        {occurrences > 1 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {Array.from({ length: occurrences }, (_, i) => i).map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveOccurrenceIndex(i)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  activeOccurrenceIndex === i
                    ? 'bg-[#E0FE10] text-black border-[#E0FE10]'
                    : 'bg-zinc-900/50 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                Stack {i + 1} ({occurrenceSelections[i]?.length || 0})
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4">
          <div className="lg:col-span-2">
            <UserFilter selectedUserId={selectedUserId} onUserSelect={setSelectedUserId} />
          </div>
          <div className="lg:col-span-2">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input
                value={moveSearch}
                onChange={(e) => setMoveSearch(e.target.value)}
                placeholder="Search moves…"
                className="w-full pl-12 pr-4 py-3 bg-zinc-900/50 text-white rounded-xl border border-zinc-800 focus:border-[#E0FE10]/40 focus:outline-none transition-colors placeholder:text-zinc-600"
              />
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-4">
          {exercisesLoading ? (
            <div className="p-10 text-center text-zinc-400">Loading move library…</div>
          ) : (
            <ExerciseGrid
              userVideos={filteredExercises}
              multiSelection={true}
              selectedExercises={selectedExercisesFlat}
              onToggleSelection={toggleTemplateMove}
              onSelectVideo={toggleTemplateMove}
            />
          )}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep('templatePreview')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          <button
            type="button"
            disabled={!canContinueTemplateFillMoves}
            onClick={onContinueFromTemplateMoves}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#E0FE10] text-black font-semibold hover:bg-[#d4f00e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {selectedTemplate.id === 'custom-selector' ? 'Done' : 'Continue'}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  if (step === 'custom') {
    return shell(
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Custom Round</h1>
          <p className="text-zinc-400">
            Match the iOS flow: write AI-only instructions, configure custom options, then generate.
          </p>
        </div>

        <div className="space-y-6">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
            <h3 className="text-white font-semibold mb-4">Round Basics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-zinc-400 text-sm block mb-2">Round Name</label>
                <input
                  value={challengeDraft.challengeName}
                  onChange={(e) => setChallengeDraft((p) => ({ ...p, challengeName: e.target.value }))}
                  placeholder="Add a name for your round"
                  className="w-full px-4 py-3 bg-zinc-900/50 text-white rounded-xl border border-zinc-800 focus:border-[#E0FE10]/40 focus:outline-none transition-colors placeholder:text-zinc-600"
                />
              </div>
              <div>
                <label className="text-zinc-400 text-sm block mb-2">Round Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setChallengeDraft((p) => ({ ...p, roundType: 'together' }))}
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition-colors ${
                      challengeDraft.roundType === 'together'
                        ? 'bg-[#E0FE10] text-black border-[#E0FE10]'
                        : 'bg-zinc-900/50 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    Together
                  </button>
                  <button
                    type="button"
                    onClick={() => setChallengeDraft((p) => ({ ...p, roundType: 'locked' }))}
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition-colors ${
                      challengeDraft.roundType === 'locked'
                        ? 'bg-[#E0FE10] text-black border-[#E0FE10]'
                        : 'bg-zinc-900/50 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <Lock className="w-4 h-4" />
                    Private
                  </button>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="text-zinc-400 text-sm block mb-2">Description</label>
                <textarea
                  value={challengeDraft.challengeDesc}
                  onChange={(e) => setChallengeDraft((p) => ({ ...p, challengeDesc: e.target.value }))}
                  placeholder="Add a description for your round"
                  className="w-full px-4 py-3 bg-zinc-900/50 text-white rounded-xl border border-zinc-800 focus:border-[#E0FE10]/40 focus:outline-none transition-colors placeholder:text-zinc-600 resize-none"
                  rows={4}
                />
              </div>

              <div>
                <label className="text-zinc-400 text-sm block mb-2">Start Date</label>
                <input
                  type="date"
                  value={challengeDraft.startDate}
                  onChange={(e) => setChallengeDraft((p) => ({ ...p, startDate: e.target.value }))}
                  className="w-full px-4 py-3 bg-zinc-900/50 text-white rounded-xl border border-zinc-800 focus:border-[#E0FE10]/40 focus:outline-none transition-colors [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="text-zinc-400 text-sm block mb-2">End Date</label>
                <input
                  type="date"
                  value={challengeDraft.endDate}
                  min={challengeDraft.startDate}
                  onChange={(e) => setChallengeDraft((p) => ({ ...p, endDate: e.target.value }))}
                  className="w-full px-4 py-3 bg-zinc-900/50 text-white rounded-xl border border-zinc-800 focus:border-[#E0FE10]/40 focus:outline-none transition-colors [color-scheme:dark]"
                />
              </div>

              {challengeDraft.roundType === 'locked' && (
                <div className="md:col-span-2">
                  <label className="text-zinc-400 text-sm block mb-2">PIN Code (9 digits)</label>
                  <input
                    value={challengeDraft.pinCode}
                    onChange={(e) => setChallengeDraft((p) => ({ ...p, pinCode: e.target.value }))}
                    maxLength={9}
                    placeholder="123456789"
                    className="w-full px-4 py-3 bg-zinc-900/50 text-white rounded-xl border border-zinc-800 focus:border-[#E0FE10]/40 focus:outline-none transition-colors placeholder:text-zinc-600"
                  />
                </div>
              )}
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-white font-semibold">Rest Days</div>
                  <div className="text-zinc-500 text-sm">Optional: schedule rest days by weekday</div>
                </div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={challengeDraft.includeRestDays}
                    onChange={() => setChallengeDraft((p) => ({
                      ...p,
                      includeRestDays: !p.includeRestDays,
                      restDays: !p.includeRestDays ? p.restDays : [],
                    }))}
                    className="w-5 h-5 accent-[#E0FE10] rounded"
                  />
                  <span className="text-zinc-300 text-sm">Include rest days</span>
                </label>
              </div>

              {challengeDraft.includeRestDays && (
                <div className="flex flex-wrap gap-2">
                  {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map((d) => {
                    const active = challengeDraft.restDays.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setChallengeDraft((p) => ({
                          ...p,
                          restDays: active ? p.restDays.filter((x) => x !== d) : [...p.restDays, d],
                        }))}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                          active ? 'bg-[#E0FE10] text-black border-[#E0FE10]' : 'bg-zinc-900/50 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
            <h3 className="text-white font-semibold mb-2">Instructions (AI-only)</h3>
            <p className="text-zinc-500 text-sm mb-4">
              Not visible to participants. Used only to generate your stacks.
            </p>
            <textarea
              value={customDraft.instructions}
              onChange={(e) => setCustomDraft((p) => ({ ...p, instructions: e.target.value }))}
              placeholder="Example: 7-day strength program, intermediate, focus on posterior chain + shoulders. Keep workouts under 40 minutes."
              className="w-full px-4 py-3 bg-zinc-900/50 text-white rounded-xl border border-zinc-800 focus:border-[#E0FE10]/40 focus:outline-none transition-colors placeholder:text-zinc-600 resize-none"
              rows={6}
            />
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
            <h3 className="text-white font-semibold mb-4">Custom Options</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <label className="text-zinc-400 text-sm block mb-2">Exercise Detail Mode</label>
                <select
                  value={customDraft.exerciseDetailMode}
                  onChange={(e) => setCustomDraft((p) => ({ ...p, exerciseDetailMode: e.target.value as ExerciseDetailMode }))}
                  className="w-full px-4 py-3 bg-zinc-900/50 text-white rounded-xl border border-zinc-800 focus:border-[#E0FE10]/40 focus:outline-none transition-colors"
                >
                  <option value="mixed">Mixed</option>
                  <option value="timed">Timed</option>
                  <option value="repsSets">Reps/Sets</option>
                </select>
              </div>
              <div className="md:col-span-1">
                <label className="text-zinc-400 text-sm block mb-2">Unique Stacks</label>
                <input
                  type="number"
                  min={1}
                  max={14}
                  value={customDraft.numberOfUniqueStacks}
                  onChange={(e) => setCustomDraft((p) => ({ ...p, numberOfUniqueStacks: parseInt(e.target.value || '3', 10) || 3 }))}
                  className="w-full px-4 py-3 bg-zinc-900/50 text-white rounded-xl border border-zinc-800 focus:border-[#E0FE10]/40 focus:outline-none transition-colors"
                />
              </div>
              <div className="md:col-span-1 flex items-end">
                <label className="flex items-center gap-3 px-4 py-3 bg-zinc-900/50 rounded-xl border border-zinc-800 w-full">
                  <input
                    type="checkbox"
                    checked={customDraft.useSelectedMovesOnly}
                    onChange={() => setCustomDraft((p) => ({ ...p, useSelectedMovesOnly: !p.useSelectedMovesOnly }))}
                    className="w-5 h-5 accent-[#E0FE10] rounded"
                  />
                  <span className="text-zinc-300 text-sm">Use selected moves only</span>
                </label>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-zinc-400 text-sm">Pre-select Moves (optional)</div>
                  <div className="text-zinc-500 text-xs">If none are selected, we’ll fall back to the full catalog by body part (iOS behavior).</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    // Reuse the template move picker UI behavior by switching to templateFillMoves-like controls,
                    // but without enforcing a moveSlots limit (iOS uses this UI as a selector too).
                    // For now, we keep it simple: jump to templateFillMoves using a pseudo-template.
                    const pseudo: RoundTemplate = {
                      id: 'custom-selector',
                      name: 'Custom Move Selection',
                      description: '',
                      instructions: '',
                      moveSlots: 0,
                      screenTimeEnabled: false,
                      uniqueOccurrences: 1,
                      occurrenceBodyPartHints: [],
                      createdAt: undefined,
                      updatedAt: undefined,
                    };
                    setSelectedTemplate(pseudo);
                    setOccurrenceSelections([customDraft.selectedMoves]);
                    setActiveOccurrenceIndex(0);
                    setStep('templateFillMoves');
                  }}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-sm transition-colors"
                >
                  Select Moves
                </button>
              </div>

              {customDraft.selectedMoves.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {customDraft.selectedMoves.slice(0, 12).map((m) => (
                    <span
                      key={m.id}
                      className="text-xs px-2 py-1 rounded-lg bg-zinc-800/60 border border-zinc-700 text-zinc-200"
                    >
                      {m.name}
                    </span>
                  ))}
                  {customDraft.selectedMoves.length > 12 && (
                    <span className="text-xs text-zinc-500">+{customDraft.selectedMoves.length - 12} more</span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep('mode')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            <button
              type="button"
              onClick={onContinueFromCustom}
            disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#E0FE10] text-black font-semibold hover:bg-[#d4f00e] transition-colors"
            >
              Generate Round
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'finalize') {
    // Finalize is shared (template + custom). In template flow, we have selectedTemplate and selected moves.
    // In custom flow, finalize can be used later (wired in next todo).
    return shell(
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Finalize Round</h1>
        <p className="text-zinc-400 mb-8">
          Confirm title, dates, and privacy. Then we’ll create your Round and take you to the Round page.
        </p>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-zinc-400 text-sm block mb-2">Round Name</label>
              <input
                value={challengeDraft.challengeName}
                onChange={(e) => setChallengeDraft((p) => ({ ...p, challengeName: e.target.value }))}
                placeholder="Add a name for your round"
                className="w-full px-4 py-3 bg-zinc-900/50 text-white rounded-xl border border-zinc-800 focus:border-[#E0FE10]/40 focus:outline-none transition-colors placeholder:text-zinc-600"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-sm block mb-2">Round Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setChallengeDraft((p) => ({ ...p, roundType: 'together' }))}
                  className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition-colors ${
                    challengeDraft.roundType === 'together'
                      ? 'bg-[#E0FE10] text-black border-[#E0FE10]'
                      : 'bg-zinc-900/50 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Together
                </button>
                <button
                  type="button"
                  onClick={() => setChallengeDraft((p) => ({ ...p, roundType: 'locked' }))}
                  className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition-colors ${
                    challengeDraft.roundType === 'locked'
                      ? 'bg-[#E0FE10] text-black border-[#E0FE10]'
                      : 'bg-zinc-900/50 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <Lock className="w-4 h-4" />
                  Private
                </button>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="text-zinc-400 text-sm block mb-2">Description</label>
              <textarea
                value={challengeDraft.challengeDesc}
                onChange={(e) => setChallengeDraft((p) => ({ ...p, challengeDesc: e.target.value }))}
                placeholder="Add a description for your round"
                className="w-full px-4 py-3 bg-zinc-900/50 text-white rounded-xl border border-zinc-800 focus:border-[#E0FE10]/40 focus:outline-none transition-colors placeholder:text-zinc-600 resize-none"
                rows={4}
              />
            </div>
            <div>
              <label className="text-zinc-400 text-sm block mb-2">Start Date</label>
              <input
                type="date"
                value={challengeDraft.startDate}
                onChange={(e) => setChallengeDraft((p) => ({ ...p, startDate: e.target.value }))}
                className="w-full px-4 py-3 bg-zinc-900/50 text-white rounded-xl border border-zinc-800 focus:border-[#E0FE10]/40 focus:outline-none transition-colors [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-sm block mb-2">End Date</label>
              <input
                type="date"
                value={challengeDraft.endDate}
                min={challengeDraft.startDate}
                onChange={(e) => setChallengeDraft((p) => ({ ...p, endDate: e.target.value }))}
                className="w-full px-4 py-3 bg-zinc-900/50 text-white rounded-xl border border-zinc-800 focus:border-[#E0FE10]/40 focus:outline-none transition-colors [color-scheme:dark]"
              />
            </div>
            {challengeDraft.roundType === 'locked' && (
              <div className="md:col-span-2">
                <label className="text-zinc-400 text-sm block mb-2">PIN Code (9 digits)</label>
                <input
                  value={challengeDraft.pinCode}
                  onChange={(e) => setChallengeDraft((p) => ({ ...p, pinCode: e.target.value }))}
                  maxLength={9}
                  placeholder="123456789"
                  className="w-full px-4 py-3 bg-zinc-900/50 text-white rounded-xl border border-zinc-800 focus:border-[#E0FE10]/40 focus:outline-none transition-colors placeholder:text-zinc-600"
                />
              </div>
            )}
          </div>
        </div>

        <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-white font-semibold">Rest Days</div>
              <div className="text-zinc-500 text-sm">Optional: schedule rest days by weekday</div>
            </div>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={challengeDraft.includeRestDays}
                onChange={() => setChallengeDraft((p) => ({
                  ...p,
                  includeRestDays: !p.includeRestDays,
                  restDays: !p.includeRestDays ? p.restDays : [],
                }))}
                className="w-5 h-5 accent-[#E0FE10] rounded"
              />
              <span className="text-zinc-300 text-sm">Include rest days</span>
            </label>
          </div>
          {challengeDraft.includeRestDays && (
            <div className="flex flex-wrap gap-2">
              {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map((d) => {
                const active = challengeDraft.restDays.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setChallengeDraft((p) => ({
                      ...p,
                      restDays: active ? p.restDays.filter((x) => x !== d) : [...p.restDays, d],
                    }))}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                      active ? 'bg-[#E0FE10] text-black border-[#E0FE10]' : 'bg-zinc-900/50 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {selectedTemplate && selectedTemplate.id !== 'custom-selector' && (
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-semibold">Template</div>
                <div className="text-zinc-500 text-sm">{selectedTemplate.name}</div>
              </div>
              <div className="text-zinc-500 text-sm">
                <span className="text-white font-semibold">{selectedExercisesForTemplate.length}</span> moves selected
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep('mode')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          <button
            type="button"
            onClick={onFinalizeCreate}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#E0FE10] text-black font-semibold hover:bg-[#d4f00e] transition-colors"
          >
            <Check className="w-4 h-4" />
            Create Round
          </button>
        </div>
      </div>
    );
  }

  // Fallback
  return shell(
    <div className="text-zinc-400">Loading…</div>
  );
};

export default CreateRoundPage;

