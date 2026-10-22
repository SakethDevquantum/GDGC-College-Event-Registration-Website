import React, { useEffect, useRef } from 'react';

interface LandingBackgroundVideoProps {
  darkMode: boolean;
  delayMs?: number;
}

export const LandingBackgroundVideo: React.FC<LandingBackgroundVideoProps> = ({
  darkMode,
  delayMs = 2000,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const restartTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    vid.muted = true;
    vid.defaultMuted = true;
    const playPromise = vid.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Autoplay fallback if browser blocks initial un-interacted play
      });
    }

    return () => {
      if (restartTimerRef.current !== null) {
        window.clearTimeout(restartTimerRef.current);
      }
    };
  }, []);

  const handleEnded = () => {
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
    }

    restartTimerRef.current = window.setTimeout(() => {
      const vid = videoRef.current;
      if (!vid) return;
      vid.currentTime = 0;
      const playPromise = vid.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }
    }, delayMs);
  };

  return (
    <div
      data-testid="landing-background-video-container"
      aria-hidden="true"
      className="fixed inset-0 w-full h-full overflow-hidden pointer-events-none z-0 select-none"
    >
      <video
        ref={videoRef}
        data-testid="landing-background-video"
        src="/assets/aistudio/69b02bc208ba173f5ae5371e_69b1d6a8680f61fc3d7d372f_Vibrant_Festival_Crowd_mp4_42c3b3f8.mp4"
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={handleEnded}
        className="w-full h-full object-cover object-center"
        style={{
          filter: darkMode
            ? 'contrast(1.08) saturate(1.08) brightness(0.92)'
            : 'contrast(1.05) brightness(0.95)',
        }}
      />
      {/* Subtle radial/vertical vignette so the background video stays crystal clear while foreground controls remain legible */}
      <div
        className={`absolute inset-0 transition-colors duration-300 ${
          darkMode
            ? 'bg-gradient-to-b from-[#050507]/55 via-[#050507]/25 to-[#050507]/70'
            : 'bg-gradient-to-b from-white/65 via-white/40 to-white/75'
        }`}
      />
    </div>
  );
};
