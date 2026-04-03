import React, { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  Trash2,
} from 'lucide-react';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import {
  fetchPulseCheckSportConfiguration,
  getDefaultPulseCheckSports,
  savePulseCheckSportConfiguration,
  type PulseCheckSportConfigurationEntry,
} from '../../api/firebase/pulsecheckSportConfig';

type EditableSport = PulseCheckSportConfigurationEntry & {
  positionsInput: string;
};

const buildEditableSports = (sports: PulseCheckSportConfigurationEntry[]): EditableSport[] =>
  sports.map((sport) => ({
    ...sport,
    positionsInput: sport.positions.join(', '),
  }));

const buildNewSport = (): EditableSport => ({
  id: `new-sport-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name: '',
  emoji: '🏅',
  positions: ['Individual'],
  positionsInput: 'Individual',
  sortOrder: 0,
});

const normalizePositionsInput = (value: string) => {
  const seen = new Set<string>();

  const normalized = value
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter((entry) => {
      if (!entry) return false;
      const key = entry.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return normalized.length > 0 ? normalized : ['Individual'];
};

const slugifySportId = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `sport-${Date.now()}`;

const PulseCheckSportConfigurationPage: React.FC = () => {
  const router = useRouter();
  const [sports, setSports] = useState<EditableSport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const loadConfiguration = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const nextSports = await fetchPulseCheckSportConfiguration();
    setSports(buildEditableSports(nextSports));
    setHasChanges(false);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadConfiguration();
  }, [loadConfiguration]);

  const handleRefresh = async () => {
    setSuccessMessage(null);
    await loadConfiguration();
  };

  const handleSportFieldChange = (id: string, field: 'name' | 'emoji' | 'positionsInput', value: string) => {
    setSports((current) =>
      current.map((sport) => (sport.id === id ? { ...sport, [field]: value } : sport))
    );
    setHasChanges(true);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleAddSport = () => {
    setSports((current) => [
      ...current,
      {
        ...buildNewSport(),
        sortOrder: current.length,
      },
    ]);
    setHasChanges(true);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleRemoveSport = (id: string) => {
    setSports((current) => current.filter((sport) => sport.id !== id));
    setHasChanges(true);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleMoveSport = (id: string, direction: 'up' | 'down') => {
    setSports((current) => {
      const index = current.findIndex((sport) => sport.id === id);
      if (index < 0) return current;

      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= current.length) return current;

      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next.map((sport, nextIndex) => ({ ...sport, sortOrder: nextIndex }));
    });
    setHasChanges(true);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleResetDefaults = () => {
    setSports(buildEditableSports(getDefaultPulseCheckSports()));
    setHasChanges(true);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const validateSports = (): PulseCheckSportConfigurationEntry[] => {
    if (sports.length === 0) {
      throw new Error('At least one sport is required.');
    }

    const seenNames = new Set<string>();

    return sports.map((sport, index) => {
      const name = sport.name.trim();
      if (!name) {
        throw new Error(`Sport ${index + 1} is missing a name.`);
      }

      const normalizedName = name.toLowerCase();
      if (seenNames.has(normalizedName)) {
        throw new Error(`"${name}" appears more than once. Sport names must be unique.`);
      }
      seenNames.add(normalizedName);

      return {
        id: sport.id.startsWith('new-sport-') ? slugifySportId(name) : sport.id,
        name,
        emoji: sport.emoji.trim() || '🏅',
        positions: normalizePositionsInput(sport.positionsInput),
        sortOrder: index,
      };
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const validatedSports = validateSports();
      const savedSports = await savePulseCheckSportConfiguration(validatedSports);
      setSports(buildEditableSports(savedSports));
      setHasChanges(false);
      setSuccessMessage('PulseCheck sport configuration saved.');
    } catch (error) {
      console.error('[PulseCheckSportConfiguration] Failed to save sport configuration:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save sport configuration.');
    } finally {
      setIsSaving(false);
    }
  };

  const totalPositions = sports.reduce((sum, sport) => sum + normalizePositionsInput(sport.positionsInput).length, 0);

  return (
    <AdminRouteGuard>
      <Head>
        <title>PulseCheck Sport Configuration | Pulse Admin</title>
      </Head>

      <div className="min-h-screen bg-[#111417] px-4 py-10 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <button
                onClick={() => router.push('/admin')}
                className="mb-4 inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Admin
              </button>

              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1a1e24] text-[#d7ff00] shadow-lg shadow-black/20">
                  <Settings2 className="h-6 w-6" />
                </span>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">PulseCheck Sport Configuration</h1>
                  <p className="mt-2 max-w-3xl text-sm text-zinc-400">
                    This lookup powers sport selection in PulseCheck onboarding, PulseCheck profile editing, and the
                    PulseCheck provisioning team form.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-zinc-800 bg-[#1a1e24] px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Sports</div>
                <div className="mt-2 text-2xl font-semibold">{sports.length}</div>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-[#1a1e24] px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Positions</div>
                <div className="mt-2 text-2xl font-semibold">{totalPositions}</div>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-[#1a1e24] px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Consumers</div>
                <div className="mt-2 text-2xl font-semibold">3</div>
              </div>
            </div>
          </div>

          {successMessage && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-green-700 bg-green-900/20 px-4 py-3 text-green-200">
              <Check className="h-5 w-5" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-700 bg-red-900/20 px-4 py-3 text-red-200">
              <AlertCircle className="h-5 w-5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isLoading ? (
            <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-zinc-800 bg-[#1a1e24]">
              <Loader2 className="h-8 w-8 animate-spin text-[#d7ff00]" />
              <span className="ml-3 text-zinc-400">Loading PulseCheck sports…</span>
            </div>
          ) : (
            <>
              <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="rounded-3xl border border-zinc-800 bg-[#1a1e24] p-5 shadow-2xl shadow-black/20">
                  <div className="flex flex-col gap-4 border-b border-zinc-800 pb-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">Lookup Table</h2>
                      <p className="mt-1 text-sm text-zinc-400">
                        Add sports, define the onboarding emoji, and set the position list used when an athlete chooses that sport.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleRefresh}
                        className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-black/20 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500 hover:text-white"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Refresh
                      </button>
                      <button
                        type="button"
                        onClick={handleResetDefaults}
                        className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-black/20 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500 hover:text-white"
                      >
                        Reset Defaults
                      </button>
                      <button
                        type="button"
                        onClick={handleAddSport}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#d7ff00] px-3 py-2 text-sm font-medium text-black transition hover:brightness-110"
                      >
                        <Plus className="h-4 w-4" />
                        Add Sport
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 space-y-4">
                    {sports.map((sport, index) => (
                      <div key={sport.id} className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Sport {index + 1}</div>
                            <div className="mt-1 text-sm text-zinc-400">Order controls affect the picker order in the app.</div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleMoveSport(sport.id, 'up')}
                              disabled={index === 0}
                              className="rounded-lg border border-zinc-700 bg-[#171a1f] p-2 text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label={`Move ${sport.name || `sport ${index + 1}`} up`}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveSport(sport.id, 'down')}
                              disabled={index === sports.length - 1}
                              className="rounded-lg border border-zinc-700 bg-[#171a1f] p-2 text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label={`Move ${sport.name || `sport ${index + 1}`} down`}
                            >
                              <ArrowDown className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveSport(sport.id)}
                              className="rounded-lg border border-red-900/60 bg-red-950/30 p-2 text-red-300 transition hover:border-red-700 hover:text-red-200"
                              aria-label={`Remove ${sport.name || `sport ${index + 1}`}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-[96px_minmax(0,1fr)]">
                          <label className="space-y-2">
                            <span className="text-xs uppercase tracking-wide text-zinc-500">Emoji</span>
                            <input
                              value={sport.emoji}
                              onChange={(event) => handleSportFieldChange(sport.id, 'emoji', event.target.value)}
                              className="w-full rounded-xl border border-zinc-700 bg-[#111417] px-3 py-3 text-center text-2xl text-white outline-none transition focus:border-[#d7ff00]"
                              placeholder="🏅"
                            />
                          </label>

                          <label className="space-y-2">
                            <span className="text-xs uppercase tracking-wide text-zinc-500">Sport Name</span>
                            <input
                              value={sport.name}
                              onChange={(event) => handleSportFieldChange(sport.id, 'name', event.target.value)}
                              className="w-full rounded-xl border border-zinc-700 bg-[#111417] px-3 py-3 text-sm text-white outline-none transition focus:border-[#d7ff00]"
                              placeholder="Basketball"
                            />
                          </label>
                        </div>

                        <label className="mt-4 block space-y-2">
                          <span className="text-xs uppercase tracking-wide text-zinc-500">Positions</span>
                          <textarea
                            value={sport.positionsInput}
                            onChange={(event) => handleSportFieldChange(sport.id, 'positionsInput', event.target.value)}
                            className="min-h-[110px] w-full rounded-xl border border-zinc-700 bg-[#111417] px-3 py-3 text-sm text-white outline-none transition focus:border-[#d7ff00]"
                            placeholder="Point Guard, Shooting Guard, Small Forward"
                          />
                          <p className="text-xs text-zinc-500">
                            Separate positions with commas or new lines. Leave it as <span className="text-zinc-300">Individual</span> for single-role sports.
                          </p>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-3xl border border-zinc-800 bg-[#1a1e24] p-5 shadow-2xl shadow-black/20">
                    <h2 className="text-lg font-semibold">Where This Flows</h2>
                    <div className="mt-4 space-y-3 text-sm text-zinc-300">
                      <div className="rounded-2xl border border-zinc-800 bg-black/20 px-4 py-3">
                        PulseCheck onboarding uses the emoji, sport label, and position list.
                      </div>
                      <div className="rounded-2xl border border-zinc-800 bg-black/20 px-4 py-3">
                        PulseCheck profile edit uses the sport names in the dropdown.
                      </div>
                      <div className="rounded-2xl border border-zinc-800 bg-black/20 px-4 py-3">
                        PulseCheck provisioning uses the same lookup when attaching a sport to a team.
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-amber-900/60 bg-amber-950/20 p-5 text-sm text-amber-100 shadow-2xl shadow-black/20">
                    <div className="font-semibold">Important</div>
                    <p className="mt-2 text-amber-100/80">
                      Removing a sport takes it out of future selectors. Existing athlete profiles and team records keep whatever sport string
                      was already saved until someone updates that record.
                    </p>
                  </div>
                </div>
              </div>

              <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-[#111417]/95 p-4 shadow-2xl shadow-black/30 backdrop-blur md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-zinc-400">
                  {hasChanges ? 'You have unsaved changes.' : 'Configuration is in sync with Firestore.'}
                </div>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || !hasChanges}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#d7ff00] px-4 py-2.5 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {isSaving ? 'Saving…' : 'Save Configuration'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default PulseCheckSportConfigurationPage;
