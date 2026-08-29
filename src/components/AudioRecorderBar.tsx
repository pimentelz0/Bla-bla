import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Send, Mic, AlertCircle } from 'lucide-react';
import { formatAudioDuration } from '../utils/mediaHelper';

interface AudioRecorderBarProps {
  onSendAudio: (audioDataUrl: string, duration: number) => void;
  onCancel: () => void;
}

export const AudioRecorderBar: React.FC<AudioRecorderBarProps> = ({
  onSendAudio,
  onCancel,
}) => {
  const [recordingTime, setRecordingTime] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    startRecording();

    return () => {
      stopTracks();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const stopTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const startRecording = async () => {
    setErrorMsg(null);
    audioChunksRef.current = [];
    setRecordingTime(0);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Navegador não suporta gravação de áudio.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Audio recording failed:', err);
      setErrorMsg(
        err.name === 'NotAllowedError'
          ? 'Permissão de microfone negada. Habilite nas configurações.'
          : 'Não foi possível acessar o microfone.'
      );
    }
  };

  const handleFinishAndSend = () => {
    if (!mediaRecorderRef.current) return;
    if (timerRef.current) clearInterval(timerRef.current);

    const duration = recordingTime;

    mediaRecorderRef.current.onstop = () => {
      const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
      stopTracks();

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        onSendAudio(base64, duration);
      };
      reader.readAsDataURL(audioBlob);
    };

    mediaRecorderRef.current.stop();
  };

  const handleDiscard = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    stopTracks();
    onCancel();
  };

  if (errorMsg) {
    return (
      <div className="flex items-center justify-between gap-2 p-3 bg-rose-50 text-rose-700 rounded-2xl border border-rose-200">
        <div className="flex items-center gap-2 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
        <button
          type="button"
          onClick={handleDiscard}
          className="text-xs font-semibold underline px-2 py-1 hover:text-rose-900"
        >
          Fechar
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 p-2 bg-white rounded-2xl border border-blue-200 shadow-sm w-full">
      {/* Delete / Cancel */}
      <button
        type="button"
        onClick={handleDiscard}
        className="p-2.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 active:bg-rose-100 rounded-full transition-colors cursor-pointer"
        title="Cancelar áudio"
      >
        <Trash2 className="w-5 h-5" />
      </button>

      {/* Recording indicator & timer */}
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
        </span>

        <span className="font-mono font-semibold text-sm text-[#17191C]">
          {formatAudioDuration(recordingTime)}
        </span>

        {/* Animated wave pulses */}
        <div className="flex items-center gap-0.5 ml-2 h-4 overflow-hidden">
          {[4, 12, 18, 8, 16, 20, 10, 14, 6, 15, 19, 9, 13].map((h, i) => (
            <span
              key={i}
              className="w-0.5 bg-blue-500 rounded-full animate-pulse"
              style={{
                height: `${h}px`,
                animationDelay: `${(i % 5) * 150}ms`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Send Audio Button */}
      <button
        type="button"
        onClick={handleFinishAndSend}
        disabled={recordingTime < 1}
        className="p-2.5 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 disabled:opacity-40 text-white rounded-full transition-all shadow-xs shrink-0 flex items-center justify-center cursor-pointer active:scale-95"
        title="Enviar áudio"
      >
        <Send className="w-4 h-4 translate-x-px" />
      </button>
    </div>
  );
};
