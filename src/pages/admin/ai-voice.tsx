import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { motion } from 'framer-motion';
import { Mic2, Play, Square, Save, Info, RefreshCw } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import { OPENAI_VOICES, speakStep, stopNarration, VoiceChoice, clearVoiceCache } from '../../utils/tts';

type AiVoiceConfig = {
  provider: 'openai';
  voiceId: string; // e.g. alloy, nova, etc.
  updatedAt: number;
};

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

  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('alloy');
  const [sampleText, setSampleText] = useState(sampleScripts[0]);

  const voiceLabel = useMemo(() => {
    const found = OPENAI_VOICES.find((v) => v.provider === 'openai' && v.id === selectedVoiceId);
    return found?.label || selectedVoiceId;
  }, [selectedVoiceId]);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const ref = doc(db, CONFIG_COLLECTION, CONFIG_DOC_ID);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as Partial<AiVoiceConfig>;
        if (data.voiceId && typeof data.voiceId === 'string') {
          setSelectedVoiceId(data.voiceId);
        }
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
      const choice: VoiceChoice = { provider: 'openai', id: selectedVoiceId, label: voiceLabel };
      await speakStep(sampleText, {
        onEnd: () => setPlaying(false),
        onError: () => setPlaying(false),
      }, choice);
    } catch (e: any) {
      console.error('Preview failed', e);
      setError('Preview failed. If OPENAI_API_KEY is not configured locally, it will fall back to browser TTS.');
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
        provider: 'openai',
        voiceId: selectedVoiceId,
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

