"use client";

import { useState, useEffect, useRef, useSyncExternalStore } from "react";

interface CountdownTimerProps {
  targetTime: string;
  serverTime: string;
  onComplete?: () => void;
  className?: string;
  showPrefix?: boolean;
}

const emptySubscribe = () => () => {};

export function CountdownTimer({
  targetTime,
  serverTime,
  onComplete,
  className = "",
  showPrefix = false,
}: CountdownTimerProps) {
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(() => {
    const targetEpoch = new Date(targetTime).getTime();
    const serverEpoch = new Date(serverTime).getTime();
    const clockOffset = isNaN(serverEpoch) ? 0 : serverEpoch - Date.now();
    const nowWithOffset = Date.now() + clockOffset;
    return Math.max(0, Math.floor((targetEpoch - nowWithOffset) / 1000));
  });

  const completedRef = useRef(false);

  useEffect(() => {
    const targetEpoch = new Date(targetTime).getTime();
    const serverEpoch = new Date(serverTime).getTime();
    const clockOffset = isNaN(serverEpoch) ? 0 : serverEpoch - Date.now();

    const calculateRemaining = () => {
      const nowWithOffset = Date.now() + clockOffset;
      const diffMs = targetEpoch - nowWithOffset;
      return Math.max(0, Math.floor(diffMs / 1000));
    };

    const initial = calculateRemaining();
    if (initial <= 0) {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }
      return;
    }

    const interval = setInterval(() => {
      const secs = calculateRemaining();
      setRemainingSeconds(secs);
      if (secs <= 0) {
        clearInterval(interval);
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete?.();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [targetTime, serverTime, onComplete]);

  // Leaf component renders null during SSR to avoid hydration mismatch
  if (!isMounted || remainingSeconds === null) {
    return null;
  }

  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, "0");

  let formatted = "";
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    formatted = `${days}d ${pad(remHours)}h ${pad(minutes)}m ${pad(seconds)}s`;
  } else {
    formatted = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  return (
    <span
      className={`font-mono font-bold tracking-wider ${className}`}
      aria-label={`Time remaining: ${formatted}`}
    >
      {showPrefix && <span className="font-normal mr-1.5 opacity-70">Remaining:</span>}
      {formatted}
    </span>
  );
}
