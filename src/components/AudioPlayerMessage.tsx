import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';
import { formatAudioDuration } from '../utils/mediaHelper';

interface AudioPlayerMessageProps {
  audioUrl: string;
  duration?: number;
  isMe: boolean;
}

export const AudioPlayerMessage: React.FC<AudioPlayerMessageProps> = ({
  audioUrl,
  duration = 0,
  isMe,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setTotalDuration(audio.duration);
      }
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.pause();
    };
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.play().then(() => setIsPlaying(true)).catch((err) => console.error('Audio play error:', err));
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const newTime = parseFloat(e.target.value);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const cycleSpeed = () => {
    const speeds = [1, 1.5, 2];
    const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackRate(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const progressPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className="flex items-center gap-2.5 py-1 min-w-[210px] sm:min-w-[250px]">
      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer shadow-xs ${
          isMe
            ? 'bg-white text-blue-600 hover:bg-blue-50'
            : 'bg-blue-500 text-white hover:bg-blue-600'
        }`}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </button>

      {/* Waveform & Scrubber */}
      <div className="flex-1 flex flex-col justify-center gap-1 min-w-0">
        <div className="relative flex items-center h-4">
          {/* Simulated Waveform Bars */}
          <div className="absolute inset-0 flex items-center justify-between gap-0.5 pointer-events-none opacity-80">
            {[18, 45, 28, 70, 95, 60, 40, 85, 100, 75, 45, 30, 60, 80, 50, 35, 70, 90, 40, 20].map((h, i) => {
              const barPercent = (i / 20) * 100;
              const isPast = progressPercent >= barPercent;
              return (
                <div
                  key={i}
                  className={`w-1 rounded-full transition-all ${
                    isPast
                      ? isMe ? 'bg-white' : 'bg-blue-500'
                      : isMe ? 'bg-blue-300/60' : 'bg-gray-300'
                  }`}
                  style={{ height: `${Math.max(20, h)}%` }}
                />
              );
            })}
          </div>

          <input
            type="range"
            min={0}
            max={totalDuration || 1}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full opacity-0 cursor-pointer h-5 z-10"
          />
        </div>

        <div className="flex items-center justify-between text-[11px] font-medium leading-none">
          <span className={isMe ? 'text-blue-100' : 'text-[#7A7F87]'}>
            {formatAudioDuration(isPlaying ? currentTime : totalDuration)}
          </span>

          <button
            type="button"
            onClick={cycleSpeed}
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-tight uppercase transition-colors ${
              isMe
                ? 'bg-blue-600/60 text-white hover:bg-blue-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {playbackRate}x
          </button>
        </div>
      </div>
    </div>
  );
};
