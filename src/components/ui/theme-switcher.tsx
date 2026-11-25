"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const themes = [
  {
    key: "system",
    icon: Monitor,
    label: "System theme",
  },
  {
    key: "light",
    icon: Sun,
    label: "Light theme",
  },
  {
    key: "dark",
    icon: Moon,
    label: "Dark theme",
  },
] as const;

export type ThemeChoice = "light" | "dark" | "system";

export type ThemeSwitcherProps = {
  value?: ThemeChoice;
  onChange?: (theme: ThemeChoice) => void;
  defaultValue?: ThemeChoice;
  className?: string;
};

export const ThemeSwitcher = ({
  value,
  onChange,
  defaultValue = "system",
  className,
}: ThemeSwitcherProps) => {
  const [internalTheme, setInternalTheme] = useState<ThemeChoice>(defaultValue);
  const [mounted, setMounted] = useState(false);

  const isControlled = value !== undefined;
  const theme = isControlled ? value : internalTheme;

  const setTheme = (next: ThemeChoice) => {
    if (!isControlled) {
      setInternalTheme(next);
    }
    onChange?.(next);
  };

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={cn(
          "relative flex h-8 w-[80px] rounded-full bg-background p-1 ring-1 ring-border",
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "relative flex h-8 items-center rounded-full bg-background p-1 ring-1 ring-border",
        className
      )}
    >
      {themes.map(({ key, icon: Icon, label }) => {
        const isActive = theme === key;

        return (
          <button
            type="button"
            key={key}
            className="relative flex h-6 w-6 items-center justify-center rounded-full"
            onClick={() => setTheme(key)}
            aria-label={label}
            title={label}
          >
            {isActive && (
              <motion.div
                layoutId="activeTheme"
                className="absolute inset-0 rounded-full bg-secondary"
                transition={{ type: "spring", duration: 0.5 }}
              />
            )}
            <Icon
              className={cn(
                "relative z-10 h-3.5 w-3.5 transition-colors",
                isActive ? "text-foreground" : "text-muted-foreground"
              )}
            />
          </button>
        );
      })}
    </div>
  );
};
