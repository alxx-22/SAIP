import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { DEFAULT_ACCENT, getAccent, type AccentId } from './accents';
import type { NotificationSeverity } from '@/services';

/**
 * User settings: appearance and notification preferences.
 *
 * One provider and one storage key rather than several, because these are all
 * "things this person chose" and they are read together by the Profile page.
 *
 * WHERE THESE LIVE
 *
 * localStorage, keyed per browser. That is deliberate for now: none of this is
 * business data, and Power Pages has no per-user preference store we can write
 * to without a Dataverse table. When the data layer lands, the natural home is a
 * `saip_userpreference` row keyed on the signed-in contact — at which point this
 * provider keeps its shape and only `load`/`persist` change.
 */

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface NotificationSettings {
  /** Master switch. When false the pane shows nothing and the badge is hidden. */
  enabled: boolean;
  /** Per-severity visibility. Notifications are derived, so this filters rather than mutes. */
  severities: Record<NotificationSeverity, boolean>;
  /**
   * Months of inactivity before a monitoring field is treated as overdue.
   * Overrides `MONITORING_OVERDUE_MONTHS` for this user's notifications only —
   * the Account Monitoring ribbon keeps using the business rule, because that
   * flag is a fact about the account rather than a personal preference.
   */
  overdueAfterMonths: number;
}

export interface Settings {
  mode: ThemeMode;
  accent: AccentId;
  notifications: NotificationSettings;
}

/**
 * A partial update to the notification settings.
 *
 * `severities` is partial too, so a caller can flip one severity without
 * restating the other two — which is what every call site actually wants.
 */
export type NotificationSettingsPatch = Partial<
  Omit<NotificationSettings, 'severities'>
> & {
  severities?: Partial<Record<NotificationSeverity, boolean>>;
};

export const DEFAULT_SETTINGS: Settings = {
  mode: 'auto',
  accent: DEFAULT_ACCENT,
  notifications: {
    enabled: true,
    severities: { critical: true, warning: true, info: true },
    overdueAfterMonths: 12,
  },
};

/** Bounds for the overdue slider, also enforced when reading stored values. */
export const OVERDUE_MONTHS_MIN = 3;
export const OVERDUE_MONTHS_MAX = 24;

const STORAGE_KEY = 'saip.settings.v1';

interface SettingsContextValue extends Settings {
  /** 'auto' resolved against the OS preference. Never 'auto'. */
  resolvedMode: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentId) => void;
  setNotifications: (next: NotificationSettingsPatch) => void;
  resetAll: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

/**
 * Reads stored settings, tolerating anything.
 *
 * Storage can hold a value written by an older build, hand-edited JSON, or
 * nothing at all — and it throws outright in a browser with site data blocked.
 * Every field is validated individually so one bad key falls back to its default
 * instead of discarding the whole object.
 */
function load(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return DEFAULT_SETTINGS;
  }
  if (!raw) return DEFAULT_SETTINGS;

  try {
    // Everything out of storage is untrusted, so it is typed as deeply partial
    // rather than as Settings — an older build may not have written these keys
    // at all, and a hand-edited value may be any shape.
    const parsed = JSON.parse(raw) as {
      mode?: unknown;
      accent?: unknown;
      notifications?: Partial<Omit<NotificationSettings, 'severities'>> & {
        severities?: Partial<Record<NotificationSeverity, boolean>>;
      };
    };
    const storedNotifications = parsed.notifications ?? {};
    const storedSeverities = storedNotifications.severities ?? {};

    return {
      mode: ['light', 'dark', 'auto'].includes(parsed.mode as string)
        ? (parsed.mode as ThemeMode)
        : DEFAULT_SETTINGS.mode,
      accent: getAccent(parsed.accent as AccentId).id,
      notifications: {
        enabled:
          typeof storedNotifications.enabled === 'boolean'
            ? storedNotifications.enabled
            : DEFAULT_SETTINGS.notifications.enabled,
        severities: {
          critical: storedSeverities.critical !== false,
          warning: storedSeverities.warning !== false,
          info: storedSeverities.info !== false,
        },
        overdueAfterMonths: clampMonths(storedNotifications.overdueAfterMonths),
      },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function clampMonths(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_SETTINGS.notifications.overdueAfterMonths;
  }
  return Math.min(OVERDUE_MONTHS_MAX, Math.max(OVERDUE_MONTHS_MIN, Math.round(value)));
}

function persist(settings: Settings) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage blocked or full. The setting still applies for this session —
    // failing to remember a theme is not worth surfacing an error for.
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(load);

  /**
   * Tracks the OS colour scheme so `mode: 'auto'` follows it live, including
   * when the user flips their system theme while the tab is open.
   */
  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const resolvedMode: 'light' | 'dark' =
    settings.mode === 'auto' ? (systemDark ? 'dark' : 'light') : settings.mode;

  useEffect(() => persist(settings), [settings]);

  /**
   * Applies the theme to the document element.
   *
   * `data-mode` is HPE's own switch: `color.light.css` targets
   * `:root, [data-mode=auto], [data-mode=light]` and `color.dark.css` targets
   * `[data-mode=dark]` plus `[data-mode=auto]` inside a prefers-color-scheme
   * query. So writing the raw mode — including 'auto' — is all that is needed
   * for several hundred colour tokens to flip. We do not reimplement any of it.
   *
   * The accent is layered on top as `--saip-accent` / `--saip-on-accent`, which
   * is what every component in the app already references.
   */
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-mode', settings.mode);

    const accent = getAccent(settings.accent);
    // Keyed off the RESOLVED mode, not the raw one: under 'auto' we still need
    // to know which of the two accent steps to use.
    const palette = resolvedMode === 'dark' ? accent.dark : accent.light;
    root.style.setProperty('--saip-accent', palette.accent);
    root.style.setProperty('--saip-on-accent', palette.on);
    /*
      The button pair. Separate from the decorative pair because a button label
      is body text at 4.5:1 while a decorative fill only owes 3:1 — see the
      contrast note in accents.ts for why one pair cannot serve both.
    */
    root.style.setProperty('--saip-accent-solid', palette.solid);
    root.style.setProperty('--saip-on-solid', palette.onSolid);

    // Lets the browser render form controls and scrollbars to match.
    root.style.colorScheme = resolvedMode;
  }, [settings.mode, settings.accent, resolvedMode]);

  const setMode = useCallback(
    (mode: ThemeMode) => setSettings((s) => ({ ...s, mode })),
    [],
  );
  const setAccent = useCallback(
    (accent: AccentId) => setSettings((s) => ({ ...s, accent })),
    [],
  );
  const setNotifications = useCallback(
    (next: NotificationSettingsPatch) =>
      setSettings((s) => ({
        ...s,
        notifications: {
          ...s.notifications,
          ...next,
          severities: { ...s.notifications.severities, ...(next.severities ?? {}) },
          overdueAfterMonths:
            next.overdueAfterMonths === undefined
              ? s.notifications.overdueAfterMonths
              : clampMonths(next.overdueAfterMonths),
        },
      })),
    [],
  );
  const resetAll = useCallback(() => setSettings(DEFAULT_SETTINGS), []);

  const value = useMemo<SettingsContextValue>(
    () => ({ ...settings, resolvedMode, setMode, setAccent, setNotifications, resetAll }),
    [settings, resolvedMode, setMode, setAccent, setNotifications, resetAll],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used inside <SettingsProvider>');
  }
  return context;
}
