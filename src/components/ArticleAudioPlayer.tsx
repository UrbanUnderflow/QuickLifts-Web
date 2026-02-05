/**
 * ArticleAudioPlayer
 * 
 * Reads article content aloud using OpenAI TTS (via Netlify function)
 * or browser speech synthesis as fallback.
 * 
 * For long articles, splits text into chunks and plays them sequentially.
 * Design inspired by Anthropic's clean article audio player.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, X } from 'lucide-react';

interface ArticleAudioPlayerProps {
  /** The full text of the article to narrate */
  articleText: string;
  /** Optional: author name to announce at the start */
  author?: string;
  /** Optional: article title to announce at the start */
  title?: string;
}

const CHUNK_SIZE = 700; // Safe limit for TTS function (max 800)

/**
 * Split text into chunks at sentence boundaries
 */
function splitIntoChunks(text: string, maxChunkSize: number): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    // If adding this sentence exceeds the limit, push current chunk and start new one
    if (currentChunk.length + trimmed.length + 1 > maxChunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = trimmed;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + trimmed;
    }
  }

  // Push remaining chunk
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

const ArticleAudioPlayer: React.FC<ArticleAudioPlayerProps> = ({
  articleText,
  author,
  title,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0); // 0-100 percentage

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<string[]>([]);
  const currentChunkIndexRef = useRef(0);
  const audioBufferRef = useRef<string[]>([]); // Store generated audio URLs
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup function
  const cleanup = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    // Revoke all object URLs
    audioBufferRef.current.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    });
    audioBufferRef.current = [];
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  useEffect(() => {
    // Build chunks on mount
    let fullText = '';
    if (title) fullText += `${title}. `;
    if (author) fullText += `By ${author}. `;
    fullText += articleText;

    chunksRef.current = splitIntoChunks(fullText, CHUNK_SIZE);
    console.log(`[ArticleAudioPlayer] Split into ${chunksRef.current.length} chunks`);

    return () => {
      cleanup();
    };
  }, [articleText, author, title]);

  /**
   * Generate audio for a specific chunk
   */
  const generateChunkAudio = async (chunkIndex: number): Promise<string> => {
    // Return cached if already generated
    if (audioBufferRef.current[chunkIndex]) {
      return audioBufferRef.current[chunkIndex];
    }

    const text = chunksRef.current[chunkIndex];
    if (!text) throw new Error('Invalid chunk index');

    const res = await fetch('/.netlify/functions/tts-mental-step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        voice: 'alloy',
        format: 'mp3',
      }),
    });

    if (!res.ok) {
      throw new Error(`TTS service error: ${res.status}`);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    audioBufferRef.current[chunkIndex] = url;
    return url;
  };

  /**
   * Play a specific chunk
   */
  const playChunk = async (chunkIndex: number) => {
    if (chunkIndex >= chunksRef.current.length) {
      // All chunks complete
      setIsPlaying(false);
      setProgress(100);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      return;
    }

    try {
      const url = await generateChunkAudio(chunkIndex);

      if (audioRef.current) {
        audioRef.current.pause();
      }

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        // Move to next chunk
        currentChunkIndexRef.current = chunkIndex + 1;
        playChunk(chunkIndex + 1);
      };

      audio.onerror = () => {
        setError('Audio playback failed');
        setIsLoading(false);
        setIsPlaying(false);
      };

      await audio.play();

      // Update progress based on chunk position
      const baseProgress = (chunkIndex / chunksRef.current.length) * 100;
      const nextProgress = ((chunkIndex + 1) / chunksRef.current.length) * 100;

      // Update progress within current chunk
      progressIntervalRef.current = setInterval(() => {
        if (audioRef.current && audioRef.current.duration > 0) {
          const chunkProgress =
            (audioRef.current.currentTime / audioRef.current.duration) *
            (nextProgress - baseProgress);
          setProgress(baseProgress + chunkProgress);
        }
      }, 100);
    } catch (err) {
      console.error('[ArticleAudioPlayer] Error playing chunk:', err);
      setError('Failed to generate audio. Please try again.');
      setIsLoading(false);
      setIsPlaying(false);
    }
  };

  const handlePlayPause = async () => {
    if (isLoading) return;

    if (isPlaying) {
      // Pause
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    } else {
      // Play
      setIsLoading(true);
      setError(null);
      setIsPlaying(true);

      try {
        await playChunk(currentChunkIndexRef.current);
      } catch (err) {
        console.error('[ArticleAudioPlayer] Error:', err);
        setError('Failed to start playback');
        setIsPlaying(false);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleStop = () => {
    cleanup();
    setIsPlaying(false);
    setProgress(0);
    currentChunkIndexRef.current = 0;
  };

  return (
    <div className="flex items-center gap-3 py-2">
      {/* Play/Pause button */}
      <button
        onClick={handlePlayPause}
        disabled={isLoading}
        className="flex-shrink-0 w-8 h-8 rounded-full bg-stone-900 hover:bg-stone-800 disabled:bg-stone-400 flex items-center justify-center text-white transition-colors"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isLoading ? (
          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : isPlaying ? (
          <Pause className="w-3 h-3" />
        ) : (
          <Play className="w-3 h-3 ml-0.5" />
        )}
      </button>

      {/* Label + time */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-stone-500">Listen to article</span>
        {progress > 0 && (
          <>
            <span className="text-stone-300">·</span>
            <span className="text-xs text-stone-400">{Math.round(progress)}%</span>
          </>
        )}
      </div>

      {/* Stop button (only show when playing) */}
      {(isPlaying || progress > 0) && (
        <button
          onClick={handleStop}
          className="flex-shrink-0 w-6 h-6 rounded-full hover:bg-stone-100 flex items-center justify-center text-stone-400 hover:text-stone-700 transition-colors ml-1"
          aria-label="Stop"
        >
          <X className="w-3 h-3" />
        </button>
      )}

      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
};

export default ArticleAudioPlayer;
