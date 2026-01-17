import React, { useMemo, useRef, useState } from "react";
import { Camera, Loader2, Sparkles, CheckCircle, AlertTriangle } from "lucide-react";
import { FirebaseStorageService, UploadImageType } from "../../api/firebase/storage/service";

export type ExtractedWorkoutMetrics = {
  duration?: number | null;
  calories?: number | null;
  distance?: number | null;
  floors?: number | null;
  steps?: number | null;
  strides?: number | null;
  pace?: string | null;
  speed?: number | null;
  level?: number | null;
  heartRate?: number | null;
  confidence?: number | null;
};

interface WorkoutProofPhotoUploaderProps {
  equipmentTypeLabel: string;
  onApplied: (payload: { photoUrl: string; metrics: ExtractedWorkoutMetrics }) => void;
  className?: string;
}

const storageService = new FirebaseStorageService();

const WorkoutProofPhotoUploader: React.FC<WorkoutProofPhotoUploaderProps> = ({
  equipmentTypeLabel,
  onApplied,
  className,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<ExtractedWorkoutMetrics | null>(null);
  const confidencePct = useMemo(() => {
    const c = metrics?.confidence;
    if (typeof c !== "number") return null;
    return Math.max(0, Math.min(100, Math.round(c * 100)));
  }, [metrics?.confidence]);

  const reset = () => {
    setSelectedFile(null);
    setPhotoUrl(null);
    setPreviewUrl(null);
    setIsUploading(false);
    setIsAnalyzing(false);
    setError(null);
    setMetrics(null);
  };

  const handleFileChosen = async (file: File) => {
    reset();
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));

    setIsUploading(true);
    try {
      const uploaded = await storageService.uploadImage(file, UploadImageType.WorkoutProof);
      setPhotoUrl(uploaded.downloadURL);
    } catch (e: any) {
      console.error("[WorkoutProofPhotoUploader] upload failed:", e);
      setError(e?.message || "Failed to upload photo.");
    } finally {
      setIsUploading(false);
    }
  };

  const analyze = async () => {
    if (!photoUrl) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const res = await fetch("/.netlify/functions/analyze-workout-machine-screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: photoUrl, equipmentType: equipmentTypeLabel }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to analyze the photo.");
      }
      setMetrics(json.metrics || {});
    } catch (e: any) {
      console.error("[WorkoutProofPhotoUploader] analyze failed:", e);
      setError(e?.message || "Failed to analyze photo.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const apply = () => {
    if (!photoUrl || !metrics) return;
    onApplied({ photoUrl, metrics });
  };

  return (
    <div className={className}>
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-white font-semibold">Upload your results photo</div>
            <div className="text-zinc-400 text-sm mt-1">
              Take a photo of your machine or tracker summary so we can extract distance, time, calories, steps, etc.
            </div>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white text-sm font-semibold"
          >
            <Camera className="w-4 h-4" />
            Choose Photo
          </button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFileChosen(f);
          }}
        />

        {(previewUrl || error || isUploading || photoUrl) && (
          <div className="mt-4">
            {previewUrl && (
              <div className="rounded-xl overflow-hidden border border-zinc-700 bg-black">
                <img src={previewUrl} alt="Workout proof preview" className="w-full object-contain max-h-[320px]" />
              </div>
            )}

            {error && (
              <div className="mt-3 flex items-start gap-2 text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                <AlertTriangle className="w-5 h-5 mt-0.5" />
                <div className="text-sm">{error}</div>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!photoUrl || isUploading || isAnalyzing}
                onClick={() => void analyze()}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition
                  ${!photoUrl || isUploading || isAnalyzing ? "bg-zinc-700 text-zinc-400 cursor-not-allowed" : "bg-[#E0FE10] text-black hover:bg-[#d4f00e]"}
                `}
              >
                {isUploading || isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isUploading ? "Uploading…" : isAnalyzing ? "Extracting…" : "Extract Stats"}
              </button>

              {metrics && (
                <>
                  <div className="text-xs text-zinc-400">
                    {confidencePct !== null ? `Confidence: ${confidencePct}%` : "Confidence: —"}
                  </div>
                  <button
                    type="button"
                    onClick={apply}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-200 font-semibold text-sm hover:bg-emerald-500/20"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Apply Extracted Values
                  </button>
                </>
              )}

              {selectedFile && (
                <button
                  type="button"
                  onClick={reset}
                  className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm font-semibold"
                >
                  Reset
                </button>
              )}
            </div>

            {metrics && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                <Metric label="Time (sec)" value={metrics.duration} />
                <Metric label="Calories" value={metrics.calories} />
                <Metric label="Distance (mi)" value={metrics.distance} />
                <Metric label="Steps" value={metrics.steps} />
                <Metric label="Floors" value={metrics.floors} />
                <Metric label="Level" value={metrics.level} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const Metric: React.FC<{ label: string; value: any }> = ({ label, value }) => {
  const display = value === null || value === undefined || value === "" ? "—" : String(value);
  return (
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-white font-semibold mt-1">{display}</div>
    </div>
  );
};

export default WorkoutProofPhotoUploader;

