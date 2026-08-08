import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { screenpipe } from "@/lib/screenpipe";

type RecordingStatusContextValue = {
  recording: boolean;
  setRecording: (recording: boolean) => void;
  /** While true, status polls will not overwrite local recording state. */
  setStatusSyncPaused: (paused: boolean) => void;
  refreshRecordingStatus: () => Promise<void>;
};

const RecordingStatusContext =
  createContext<RecordingStatusContextValue | null>(null);

export function RecordingStatusProvider({ children }: { children: ReactNode }) {
  const [recording, setRecordingState] = useState(false);
  const statusSyncPausedRef = useRef(false);

  const setRecording = useCallback((next: boolean) => {
    setRecordingState(next);
  }, []);

  const setStatusSyncPaused = useCallback((paused: boolean) => {
    statusSyncPausedRef.current = paused;
  }, []);

  const refreshRecordingStatus = useCallback(async () => {
    if (statusSyncPausedRef.current) return;
    try {
      const status = await screenpipe.status();
      if (statusSyncPausedRef.current) return;
      setRecordingState(Boolean(status.recording));
    } catch {
      // Bridge may not be up yet; keep last known state.
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (statusSyncPausedRef.current) return;
      try {
        const status = await screenpipe.status();
        if (!alive || statusSyncPausedRef.current) return;
        setRecordingState(Boolean(status.recording));
      } catch {
        // Idle until the bridge is ready.
      }
    })();

    const id = window.setInterval(() => {
      void refreshRecordingStatus();
    }, 4000);

    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [refreshRecordingStatus]);

  const value = useMemo(
    () => ({
      recording,
      setRecording,
      setStatusSyncPaused,
      refreshRecordingStatus,
    }),
    [recording, setRecording, setStatusSyncPaused, refreshRecordingStatus],
  );

  return (
    <RecordingStatusContext.Provider value={value}>
      {children}
    </RecordingStatusContext.Provider>
  );
}

export function useRecordingStatus() {
  const ctx = useContext(RecordingStatusContext);
  if (!ctx) {
    throw new Error(
      "useRecordingStatus must be used within RecordingStatusProvider",
    );
  }
  return ctx;
}
