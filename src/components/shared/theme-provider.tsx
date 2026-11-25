"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import {
  ThemeSwitcher,
  type ThemeChoice,
  type ThemeOrigin,
} from "@/components/ui/theme-switcher";

export type ThemeMode = ThemeChoice;

interface ThemeContextValue {
  theme: ThemeMode;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: ThemeMode, origin?: ThemeOrigin) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => {},
  toggleTheme: () => {},
});

const STORAGE_KEY = "meridian-theme";
const TRANSITION_DURATION = 500;

function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "light" || mode === "dark") return mode;
  if (typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return "light";
}

function applyResolvedTheme(resolved: "light" | "dark") {
  const root = document.documentElement;
  if (resolved === "dark") {
    root.classList.add("dark");
    root.style.colorScheme = "dark";
  } else {
    root.classList.remove("dark");
    root.style.colorScheme = "light";
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
  const isTransitioningRef = useRef(false);
  const activeAnimRef = useRef<Animation | null>(null);

  const cancelAnim = useCallback(() => {
    activeAnimRef.current?.cancel();
    activeAnimRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      cancelAnim();
      const root = document.documentElement;
      if (root.dataset.magicuiThemeVt !== "active") return;
      delete root.dataset.magicuiThemeVt;
      root.style.removeProperty("--magicui-theme-toggle-vt-duration");
      root.style.removeProperty("--magicui-theme-vt-clip-from");
    };
  }, [cancelAnim]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      const initial: ThemeMode =
        saved === "dark" || saved === "light" || saved === "system"
          ? saved
          : "system";
      const resolved = resolveTheme(initial);
      setThemeState(initial);
      setResolvedTheme(resolved);
      applyResolvedTheme(resolved);
    } catch {
      // ignore storage errors
    }
  }, []);

  // Keep OS system theme in sync when mode === "system"
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const resolved = mq.matches ? "dark" : "light";
      setResolvedTheme(resolved);
      applyResolvedTheme(resolved);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback(
    (next: ThemeMode, origin?: ThemeOrigin) => {
      const nextResolved = resolveTheme(next);
      const currentResolved = document.documentElement.classList.contains("dark")
        ? "dark"
        : "light";

      const commit = () => {
        setThemeState(next);
        setResolvedTheme(nextResolved);
        applyResolvedTheme(nextResolved);
        try {
          window.localStorage.setItem(STORAGE_KEY, next);
        } catch {
          // ignore
        }
      };

      if (
        nextResolved === currentResolved ||
        typeof document.startViewTransition !== "function" ||
        isTransitioningRef.current ||
        document.documentElement.dataset.magicuiThemeVt === "active"
      ) {
        commit();
        return;
      }

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const cx = origin?.x ?? viewportWidth / 2;
      const cy = origin?.y ?? viewportHeight / 2;
      const maxRadius = Math.hypot(
        Math.max(cx, viewportWidth - cx),
        Math.max(cy, viewportHeight - cy)
      );

      const xPct = `${(cx / viewportWidth) * 100}%`;
      const yPct = `${(cy / viewportHeight) * 100}%`;
      const rPct = `${
        (maxRadius / (Math.hypot(viewportWidth, viewportHeight) / Math.SQRT2)) *
        100
      }%`;
      const clipPath: [string, string] = [
        `circle(0% at ${xPct} ${yPct})`,
        `circle(${rPct} at ${xPct} ${yPct})`,
      ];

      const root = document.documentElement;
      root.dataset.magicuiThemeVt = "active";
      root.style.setProperty(
        "--magicui-theme-toggle-vt-duration",
        `${TRANSITION_DURATION}ms`
      );
      root.style.setProperty("--magicui-theme-vt-clip-from", clipPath[0]);

      const cleanup = () => {
        isTransitioningRef.current = false;
        delete root.dataset.magicuiThemeVt;
        root.style.removeProperty("--magicui-theme-toggle-vt-duration");
        root.style.removeProperty("--magicui-theme-vt-clip-from");
        cancelAnim();
      };

      isTransitioningRef.current = true;
      const transition = document.startViewTransition(() => {
        flushSync(commit);
      });

      if (typeof transition?.finished?.finally === "function") {
        transition.finished.finally(cleanup).catch(() => {});
      } else {
        cleanup();
      }

      const ready = transition?.ready;
      if (ready && typeof ready.then === "function") {
        ready
          .then(() => {
            const anim = document.documentElement.animate(
              { clipPath },
              {
                duration: TRANSITION_DURATION,
                easing: "ease-in-out",
                fill: "forwards",
                pseudoElement: "::view-transition-new(root)",
              }
            );
            activeAnimRef.current = anim;
          })
          .catch(() => {});
      }
    },
    [cancelAnim]
  );

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  return (
    <ThemeContext.Provider
      value={{ theme, resolvedTheme, setTheme, toggleTheme }}
    >
      {children}
      {/* Subtle tactile film grain overlay active only in dark mode */}
      <div
        aria-hidden="true"
        className="meridian-dark-grain pointer-events-none fixed inset-0 z-[9999]"
      />
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return <ThemeSwitcher value={theme} onChange={setTheme} />;
}
