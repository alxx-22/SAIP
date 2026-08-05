import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { MeetingLogModal } from './MeetingLogModal';

interface MeetingLogContextValue {
  /**
   * Open the meeting log.
   * Pass an `accountId` to pre-select and lock the account (Account Focus);
   * omit it to make the rep pick one (Homepage).
   */
  openMeetingLog: (accountId?: string) => void;
  /** Increments after every successful save, so pages can refresh their data. */
  savedCount: number;
}

const MeetingLogContext = createContext<MeetingLogContextValue | null>(null);

/**
 * Hosts the single meeting-log modal instance for the whole app.
 *
 * Mounting it once at the root — rather than once per page — is what lets the
 * same component serve both entry points, and keeps the modal's animation
 * unaffected by whatever route is underneath it.
 */
export function MeetingLogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [lockedAccountId, setLockedAccountId] = useState<string | undefined>();
  const [savedCount, setSavedCount] = useState(0);

  // Keeps the locked account visible during the modal's exit animation, so the
  // account name doesn't blank out as the panel fades.
  const closingRef = useRef(false);

  const openMeetingLog = useCallback((accountId?: string) => {
    closingRef.current = false;
    setLockedAccountId(accountId);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    closingRef.current = true;
    setOpen(false);
  }, []);

  const value = useMemo(
    () => ({ openMeetingLog, savedCount }),
    [openMeetingLog, savedCount],
  );

  return (
    <MeetingLogContext.Provider value={value}>
      {children}
      <MeetingLogModal
        open={open}
        onClose={close}
        lockedAccountId={lockedAccountId}
        onSaved={() => setSavedCount((c) => c + 1)}
      />
    </MeetingLogContext.Provider>
  );
}

export function useMeetingLog(): MeetingLogContextValue {
  const ctx = useContext(MeetingLogContext);
  if (!ctx) {
    throw new Error('useMeetingLog must be used inside <MeetingLogProvider>.');
  }
  return ctx;
}
