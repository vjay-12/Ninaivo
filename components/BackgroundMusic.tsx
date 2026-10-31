"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { Volume2, VolumeX } from "lucide-react";

interface BackgroundMusicContextValue {
  isMuted: boolean;
  toggleMute: () => void;
}

const BackgroundMusicContext = createContext<BackgroundMusicContextValue>({
  isMuted: false,
  toggleMute: () => {},
});

export function useBackgroundMusic() {
  return useContext(BackgroundMusicContext);
}

const DEFAULT_VOLUME = 0.4;
const FADE_IN_MS = 1500;
const FADE_OUT_MS = 500;

export function BackgroundMusicProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isMutedRef = useRef(false);
  const hasStartedRef = useRef(false);
  const fadeFrameRef = useRef<number | null>(null);

  // Clear any MediaSession lockscreen / notification metadata
  const clearMediaSession = useCallback(
    (playbackState: MediaSessionPlaybackState = "none") => {
      if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
        try {
          navigator.mediaSession.metadata = null;
          navigator.mediaSession.playbackState = playbackState;
          const actions: MediaSessionAction[] = [
            "play",
            "pause",
            "stop",
            "seekbackward",
            "seekforward",
            "seekto",
            "previoustrack",
            "nexttrack",
            "skipad",
          ];
          for (const action of actions) {
            try {
              navigator.mediaSession.setActionHandler(action, null);
            } catch {}
          }
        } catch {}
      }
    },
    []
  );

  const cancelFade = useCallback(() => {
    if (fadeFrameRef.current !== null) {
      cancelAnimationFrame(fadeFrameRef.current);
      fadeFrameRef.current = null;
    }
  }, []);

  const fadeVolume = useCallback(
    (
      targetVolume: number,
      durationMs: number,
      onComplete?: () => void
    ) => {
      cancelFade();
      const audio = audioRef.current;
      if (!audio) return;

      const prefersReducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (prefersReducedMotion || durationMs <= 0) {
        audio.volume = targetVolume;
        onComplete?.();
        return;
      }

      const startVolume = audio.volume;
      const startTime = performance.now();

      const step = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(1, elapsed / durationMs);
        const newVolume = startVolume + (targetVolume - startVolume) * progress;
        audio.volume = Math.max(0, Math.min(1, newVolume));

        if (progress < 1) {
          fadeFrameRef.current = requestAnimationFrame(step);
        } else {
          fadeFrameRef.current = null;
          onComplete?.();
        }
      };

      fadeFrameRef.current = requestAnimationFrame(step);
    },
    [cancelFade]
  );

  const fadeIn = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    clearMediaSession("none");

    if (audio.paused) {
      audio.volume = 0;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            clearMediaSession("none");
            fadeVolume(DEFAULT_VOLUME, FADE_IN_MS);
          })
          .catch(() => {
            // Autoplay blocked or interrupted silently
          });
      }
    } else {
      fadeVolume(DEFAULT_VOLUME, FADE_IN_MS);
    }
  }, [clearMediaSession, fadeVolume]);

  const fadeOut = useCallback(
    (andPause = true) => {
      const audio = audioRef.current;
      if (!audio || audio.paused) return;

      fadeVolume(0, FADE_OUT_MS, () => {
        if (andPause && audioRef.current) {
          audioRef.current.pause();
          clearMediaSession("none");
        }
      });
    },
    [clearMediaSession, fadeVolume]
  );

  const pauseImmediately = useCallback(() => {
    cancelFade();
    const audio = audioRef.current;
    if (audio && !audio.paused) {
      audio.pause();
      audio.volume = 0;
      clearMediaSession("none");
    }
  }, [cancelFade, clearMediaSession]);

  // Handle mute toggle
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      isMutedRef.current = next;

      try {
        localStorage.setItem("ninaivo-muted", next ? "true" : "false");
      } catch {}

      if (next) {
        // User muted
        fadeOut(true);
      } else {
        // User unmuted: counts as first interaction if not yet started
        hasStartedRef.current = true;
        fadeIn();
      }

      return next;
    });
  }, [fadeIn, fadeOut]);

  useEffect(() => {
    // 1. Read stored preference
    let initialMuted = false;
    try {
      initialMuted = localStorage.getItem("ninaivo-muted") === "true";
      setIsMuted(initialMuted);
      isMutedRef.current = initialMuted;
    } catch {}

    const audio = audioRef.current;
    if (!audio) return;

    // 2. Autoplay attempt on load (silent catch)
    if (!initialMuted) {
      audio.volume = 0;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            hasStartedRef.current = true;
            fadeIn();
          })
          .catch(() => {
            // Autoplay was blocked by browser. Wait for first user interaction.
            attachInteractionListeners();
          });
      } else {
        attachInteractionListeners();
      }
    }

    function onFirstInteraction() {
      removeInteractionListeners();
      if (!isMutedRef.current && !hasStartedRef.current) {
        hasStartedRef.current = true;
        fadeIn();
      }
    }

    function attachInteractionListeners() {
      window.addEventListener("click", onFirstInteraction, {
        passive: true,
        capture: true,
      });
      window.addEventListener("touchstart", onFirstInteraction, {
        passive: true,
        capture: true,
      });
      window.addEventListener("pointerdown", onFirstInteraction, {
        passive: true,
        capture: true,
      });
      window.addEventListener("keydown", onFirstInteraction, {
        passive: true,
        capture: true,
      });
    }

    function removeInteractionListeners() {
      window.removeEventListener("click", onFirstInteraction, {
        capture: true,
      });
      window.removeEventListener("touchstart", onFirstInteraction, {
        capture: true,
      });
      window.removeEventListener("pointerdown", onFirstInteraction, {
        capture: true,
      });
      window.removeEventListener("keydown", onFirstInteraction, {
        capture: true,
      });
    }

    // 3. Stop playback immediately when user leaves app / tab
    const handleVisibilityChange = () => {
      if (document.hidden) {
        pauseImmediately();
      } else {
        if (!isMutedRef.current && hasStartedRef.current) {
          fadeIn();
        }
      }
    };

    const handlePageHide = () => {
      pauseImmediately();
    };

    const handleBlur = () => {
      pauseImmediately();
    };

    const handleFocus = () => {
      if (!document.hidden && !isMutedRef.current && hasStartedRef.current) {
        fadeIn();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    return () => {
      removeInteractionListeners();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      cancelFade();
    };
  }, [fadeIn, pauseImmediately, cancelFade]);

  return (
    <BackgroundMusicContext.Provider value={{ isMuted, toggleMute }}>
      {/* Root single hidden audio element */}
      <audio
        ref={audioRef}
        src="/audio/ninaivo-theme.mp3"
        loop
        preload="metadata"
        onError={() => {
          // Fail silently on broken or missing audio file
        }}
        className="hidden"
        aria-hidden="true"
      />
      {children}
    </BackgroundMusicContext.Provider>
  );
}

export function MuteButton({ className = "" }: { className?: string }) {
  const { isMuted, toggleMute } = useBackgroundMusic();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Avoid hydration mismatch by waiting until mounted
  const muted = mounted ? isMuted : false;
  const Icon = muted ? VolumeX : Volume2;
  const label = muted ? "Unmute music" : "Mute music";

  return (
    <button
      type="button"
      onClick={toggleMute}
      aria-label={label}
      aria-pressed={muted}
      title={label}
      className={`min-w-[44px] min-h-[44px] flex items-center justify-center p-2 text-[#8A92A3] hover:text-white rounded-lg hover:bg-white/5 transition-colors focus:outline-none focus:ring-1 focus:ring-[#4FA3FF] cursor-pointer ${className}`}
    >
      <Icon className="w-5 h-5 transition-opacity duration-150" />
    </button>
  );
}
