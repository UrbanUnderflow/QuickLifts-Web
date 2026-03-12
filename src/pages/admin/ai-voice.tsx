import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { motion } from 'framer-motion';
import { Mic2, Play, Square, Save, Info, RefreshCw, Sparkles, SlidersHorizontal } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import { clearVoiceCache, speakStep, stopNarration } from '../../utils/tts';
import {
  AiVoiceConfig,
  ELEVENLABS_PRESETS,
  ELEVENLABS_VOICES,
  ElevenLabsVoiceSettings,
  OPENAI_VOICES,
  VoiceChoice,
  getElevenLabsPreset,
  normalizeAiVoiceConfig,
  normalizeElevenLabsSettings,
  shouldUseElevenLabsVoiceDefaults,
} from '../../lib/aiVoice';

const CONFIG_COLLECTION = 'app-config';
const CONFIG_DOC_ID = 'ai-voice';

const sampleScripts = [
  'You’re safe. Let your shoulders drop. Find one point and stay with it.',
  'Notice the urge to rush. Slow down by 5%. Precision over panic.',
  'If your mind wanders, that’s the rep. Return to the target calmly.',
];

const AdminAiVoice: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [provider, setProvider] = useState<AiVoiceConfig['provider']>('openai');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('alloy');
  const [selectedPresetId, setSelectedPresetId] = useState<string>(getElevenLabsPreset().id);
  const [elevenLabsSettings, setElevenLabsSettings] = useState<ElevenLabsVoiceSettings>(
    normalizeElevenLabsSettings(undefined, getElevenLabsPreset().id)
  );
  const [punctuationPauses, setPunctuationPauses] = useState(true);
  const [sampleText, setSampleText] = useState(sampleScripts[0]);

  const voiceLabel = useMemo(() => {
    const source = provider === 'elevenlabs' ? ELEVENLABS_VOICES : OPENAI_VOICES;
    const found = source.find((v) => v.id === selectedVoiceId);
    return found?.label || selectedVoiceId;
  }, [provider, selectedVoiceId]);

  const presetMeta = useMemo(
    () => ELEVENLABS_PRESETS.find((preset) => preset.id === selectedPresetId) || getElevenLabsPreset(),
    [selectedPresetId]
  );

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const ref = doc(db, CONFIG_COLLECTION, CONFIG_DOC_ID);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = normalizeAiVoiceConfig(snap.data() as Partial<AiVoiceConfig>);
        setProvider(data.provider);
        setSelectedVoiceId(data.voiceId);
        setSelectedPresetId(data.presetId || getElevenLabsPreset().id);
        setElevenLabsSettings(
          normalizeElevenLabsSettings(data.elevenLabsSettings || undefined, data.presetId || undefined)
        );
        setPunctuationPauses(data.punctuationPauses !== false);
      }
    } catch (e: any) {
      console.error('Failed to load AI voice config', e);
      setError(e?.message || 'Failed to load config');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
    // stop audio if navigating away
    return () => stopNarration();
  }, []);

  const handlePreview = async () => {
    setError(null);
    stopNarration();
    setPlaying(true);
    try {
      const choice: VoiceChoice = provider === 'elevenlabs'
        ? {
            provider: 'elevenlabs',
            id: selectedVoiceId,
            label: voiceLabel,
            presetId: selectedPresetId,
            settings: shouldUseElevenLabsVoiceDefaults(selectedPresetId) ? null : elevenLabsSettings,
            punctuationPauses,
          }
        : { provider: 'openai', id: selectedVoiceId, label: voiceLabel };
      await speakStep(sampleText, {
        onEnd: () => setPlaying(false),
        onError: () => setPlaying(false),
        fallbackToBrowser: false,
      }, choice);
    } catch (e: any) {
      console.error('Preview failed', e);
      setError('Preview failed. Check the selected provider API key and voice settings.');
      setPlaying(false);
    }
  };

  const handleStop = () => {
    stopNarration();
    setPlaying(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const ref = doc(db, CONFIG_COLLECTION, CONFIG_DOC_ID);
      const payload: AiVoiceConfig = {
        provider,
        voiceId: selectedVoiceId,
        presetId: provider === 'elevenlabs' ? selectedPresetId : null,
        elevenLabsSettings:
          provider === 'elevenlabs' && !shouldUseElevenLabsVoiceDefaults(selectedPresetId)
            ? elevenLabsSettings
            : null,
        punctuationPauses: provider === 'elevenlabs' ? punctuationPauses : null,
        updatedAt: Date.now(),
      };
      await setDoc(ref, payload, { merge: true });
      // Clear the cached voice so all components pick up the new setting
      clearVoiceCache();
    } catch (e: any) {
      console.error('Save failed', e);
      setError(e?.message || 'Failed to save config');
    } finally {
      setSaving(false);
    }
  };

  const applyPreset = (presetId: string) => {
    const preset = getElevenLabsPreset(presetId);
    setSelectedPresetId(preset.id);
    setElevenLabsSettings(normalizeElevenLabsSettings(preset.settings, preset.id));
  };

  const updateElevenLabsSetting = (
    key: keyof Pick<ElevenLabsVoiceSettings, 'stability' | 'similarityBoost' | 'style'>,
    
    value: number
  ) => {
    setSelectedPresetId('custom');
    setElevenLabsSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>AI Voice Configuration | Pulse Admin</title>
      </Head>

      <div className="min-h-screen bg-[#0a0a0b] text-white p-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto"
        >
          <div className="flex items-start justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <span className="w-11 h-11 rounded-2xl bg-[#E0FE10]/15 border border-[#E0FE10]/20 flex items-center justify-center">
                  <Mic2 className="w-6 h-6 text-[#E0FE10]" />
                </span>
                AI Voice Configuration
              </h1>
              <p className="text-zinc-400 mt-2">
                Set the global Nora voice used for mental training step narration. This applies to all users.
              </p>
            </div>

            <button
              onClick={loadConfig}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-white hover:bg-zinc-700 transition-colors"
              disabled={loading}
              title="Reload config"
            >
              <RefreshCw className="w-4 h-4" />
              Reload
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-900/20 border border-red-700/40 text-red-200">
              {error}
            </div>
          )}

          <div className="rounded-2xl bg-zinc-900/40 border border-white/10 backdrop-blur-xl p-6">
            <div className="flex items-start gap-3 mb-6 text-sm text-zinc-300">
              <Info className="w-5 h-5 text-zinc-400 mt-0.5" />
              <div>
                <div className="text-white font-medium">Security</div>
                <div className="text-zinc-400">
                  Voice audio is generated server-side via Netlify functions. No API keys are exposed in the browser.
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      setProvider('openai');
                      setSelectedVoiceId((current) =>
                        OPENAI_VOICES.some((voice) => voice.id === current) ? current : OPENAI_VOICES[0].id
                      );
                    }}
                    className={`flex-1 rounded-xl border px-4 py-3 text-left transition-colors ${
                      provider === 'openai'
                        ? 'border-[#E0FE10]/40 bg-[#E0FE10]/10 text-white'
                        : 'border-zinc-700 bg-zinc-800 text-zinc-300'
                    }`}
                  >
                    <div className="text-sm font-semibold">OpenAI</div>
                    <div className="text-xs text-zinc-400 mt-1">Fast baseline previews and default fallback.</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProvider('elevenlabs');
                      setSelectedVoiceId((current) =>
                        ELEVENLABS_VOICES.some((voice) => voice.id === current) ? current : ELEVENLABS_VOICES[0].id
                      );
                    }}
                    className={`flex-1 rounded-xl border px-4 py-3 text-left transition-colors ${
                      provider === 'elevenlabs'
                        ? 'border-[#E0FE10]/40 bg-[#E0FE10]/10 text-white'
                        : 'border-zinc-700 bg-zinc-800 text-zinc-300'
                    }`}
                  >
                    <div className="text-sm font-semibold flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      ElevenLabs
                    </div>
                    <div className="text-xs text-zinc-400 mt-1">Voice identity plus inflection control.</div>
                  </button>
                </div>

                {provider === 'openai' ? (
                  <>
                    <label className="block text-sm text-zinc-400 mb-2">Default OpenAI Voice</label>
                    <select
                      value={selectedVoiceId}
                      onChange={(e) => setSelectedVoiceId(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-white/10"
                      disabled={loading}
                    >
                      {OPENAI_VOICES.filter((v) => v.provider === 'openai').map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                    <div className="mt-3 text-xs text-zinc-500">
                      Selected: <span className="text-zinc-300">{voiceLabel}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <label className="block text-sm text-zinc-400 mb-2">ElevenLabs Voice</label>
                    <select
                      value={selectedVoiceId}
                      onChange={(e) => setSelectedVoiceId(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-white/10"
                      disabled={loading}
                    >
                      {ELEVENLABS_VOICES.filter((v) => v.provider === 'elevenlabs').map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.label}
                        </option>
                      ))}
                    </select>

                    <div className="mt-5 flex items-center gap-2 text-sm text-zinc-300">
                      <SlidersHorizontal className="w-4 h-4 text-zinc-400" />
                      Expression Presets
                    </div>
                    <div className="grid grid-cols-1 gap-2 mt-3">
                      {ELEVENLABS_PRESETS.map((preset) => {
                        const active = selectedPresetId === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => applyPreset(preset.id)}
                            className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                              active
                                ? 'border-[#E0FE10]/40 bg-[#E0FE10]/10'
                                : 'border-zinc-700 bg-zinc-800 hover:bg-zinc-700/60'
                            }`}
                          >
                            <div className="text-sm font-semibold text-white">{preset.label}</div>
                            <div className="text-xs text-zinc-400 mt-1">{preset.description}</div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-5 space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
                      {shouldUseElevenLabsVoiceDefaults(selectedPresetId) && (
                        <div className="rounded-lg border border-[#E0FE10]/20 bg-[#E0FE10]/8 px-3 py-2 text-xs text-zinc-300">
                          Default sends no custom ElevenLabs overrides, so preview/save should match the voice library baseline more closely.
                        </div>
                      )}
                      <div>
                        <div className="flex items-center justify-between text-sm text-zinc-300 mb-2">
                          <span>Stability</span>
                          <span>{elevenLabsSettings.stability.toFixed(2)}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={elevenLabsSettings.stability}
                          onChange={(e) => updateElevenLabsSetting('stability', Number(e.target.value))}
                          className="w-full"
                          disabled={shouldUseElevenLabsVoiceDefaults(selectedPresetId)}
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-sm text-zinc-300 mb-2">
                          <span>Similarity Boost</span>
                          <span>{elevenLabsSettings.similarityBoost.toFixed(2)}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={elevenLabsSettings.similarityBoost}
                          onChange={(e) => updateElevenLabsSetting('similarityBoost', Number(e.target.value))}
                          className="w-full"
                          disabled={shouldUseElevenLabsVoiceDefaults(selectedPresetId)}
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-sm text-zinc-300 mb-2">
                          <span>Style</span>
                          <span>{elevenLabsSettings.style.toFixed(2)}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={elevenLabsSettings.style}
                          onChange={(e) => updateElevenLabsSetting('style', Number(e.target.value))}
                          className="w-full"
                          disabled={shouldUseElevenLabsVoiceDefaults(selectedPresetId)}
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-sm text-zinc-300 mb-2">
                          <span>Speed</span>
                          <span>{elevenLabsSettings.speed.toFixed(2)}</span>
                        </div>
                        <input
                          type="range"
                          min="0.7"
                          max="1.2"
                          step="0.01"
                          value={elevenLabsSettings.speed}
                          onChange={(e) => {
                            setSelectedPresetId('custom');
                            setElevenLabsSettings((prev) => ({
                              ...prev,
                              speed: Number(e.target.value),
                            }));
                          }}
                          className="w-full"
                          disabled={shouldUseElevenLabsVoiceDefaults(selectedPresetId)}
                        />
                      </div>
                      <label className="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2">
                        <span className="text-sm text-zinc-300">Speaker Boost</span>
                        <input
                          type="checkbox"
                          checked={elevenLabsSettings.useSpeakerBoost}
                          onChange={(e) => {
                            setSelectedPresetId('custom');
                            setElevenLabsSettings((prev) => ({
                              ...prev,
                              useSpeakerBoost: e.target.checked,
                            }));
                          }}
                          className="h-4 w-4"
                          disabled={shouldUseElevenLabsVoiceDefaults(selectedPresetId)}
                        />
                      </label>
                      <label className="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2">
                        <div>
                          <div className="text-sm text-zinc-300">Respect Punctuation</div>
                          <div className="text-xs text-zinc-500">Adds short SSML pauses after commas and sentence endings.</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={punctuationPauses}
                          onChange={(e) => setPunctuationPauses(e.target.checked)}
                          className="h-4 w-4"
                        />
                      </label>
                      <div className="text-xs text-zinc-500">
                        Active profile:{' '}
                        <span className="text-zinc-300">
                          {selectedPresetId === 'custom' ? 'Custom' : presetMeta.label}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Preview Script</label>
                <textarea
                  value={sampleText}
                  onChange={(e) => setSampleText(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-white/10 min-h-[96px]"
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  {sampleScripts.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSampleText(s)}
                      className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/80 hover:bg-white/10"
                      type="button"
                    >
                      Sample
                    </button>
                  ))}
                </div>
                <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 text-sm text-zinc-400">
                  <div className="text-white font-medium mb-2">Active Preview</div>
                  <div>Provider: <span className="text-zinc-200">{provider === 'elevenlabs' ? 'ElevenLabs' : 'OpenAI'}</span></div>
                  <div>Voice: <span className="text-zinc-200">{voiceLabel}</span></div>
                  {provider === 'elevenlabs' && (
                    <div>
                      Preset: <span className="text-zinc-200">{selectedPresetId === 'custom' ? 'Custom' : presetMeta.label}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-8 gap-3">
              <div className="flex gap-2">
                {!playing ? (
                  <button
                    onClick={handlePreview}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white hover:bg-zinc-700 transition-colors"
                    disabled={loading}
                  >
                    <Play className="w-4 h-4" />
                    Preview
                  </button>
                ) : (
                  <button
                    onClick={handleStop}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white hover:bg-zinc-700 transition-colors"
                  >
                    <Square className="w-4 h-4" />
                    Stop
                  </button>
                )}
              </div>

              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#E0FE10] text-black font-semibold hover:bg-[#c8e40e] transition-colors disabled:opacity-60"
                disabled={loading || saving}
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving…' : 'Save Default Voice'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AdminRouteGuard>
  );
};

export default AdminAiVoice;
