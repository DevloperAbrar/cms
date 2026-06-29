import { useEffect, useState, useRef } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

// ─── QuizTimer ───────────────────────────────────────────────────────────────
// startedAt: ISO string from server (attempt.started_at) — timer survives refresh
// durationMinutes: quiz duration
// onTimeUp: called once when time runs out
export const QuizTimer = ({ durationMinutes, startedAt, onTimeUp }) => {
  const calcEnd = () =>
    new Date(startedAt).getTime() + durationMinutes * 60 * 1000;

  const endTime = useRef(calcEnd());
  const firedRef = useRef(false);

  const [remaining, setRemaining] = useState(
    Math.max(0, endTime.current - Date.now())
  );

  // Recalculate if startedAt or duration changes (e.g. after server response)
  useEffect(() => {
    endTime.current = calcEnd();
    setRemaining(Math.max(0, endTime.current - Date.now()));
    firedRef.current = false;
  }, [startedAt, durationMinutes]);

  useEffect(() => {
    if (remaining <= 0) {
      if (!firedRef.current) {
        firedRef.current = true;
        onTimeUp?.();
      }
      return;
    }
    const tick = setInterval(() => {
      const left = Math.max(0, endTime.current - Date.now());
      setRemaining(left);
      if (left === 0 && !firedRef.current) {
        firedRef.current = true;
        onTimeUp?.();
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [remaining]);

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const isWarning = remaining < 5 * 60 * 1000;
  const isDanger  = remaining < 60 * 1000;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
        isDanger
          ? 'bg-red-100 text-red-700 animate-pulse'
          : isWarning
          ? 'bg-red-50 text-red-700'
          : 'bg-primary-50 text-primary-700'
      }`}
    >
      {isWarning ? (
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      ) : (
        <Clock className="h-4 w-4 flex-shrink-0" />
      )}
      <span className="font-mono tabular-nums">
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </span>
      {isDanger && (
        <span className="text-xs font-normal">Submit now!</span>
      )}
    </div>
  );
};

export default QuizTimer;