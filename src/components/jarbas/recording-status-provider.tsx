import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { screenpipe } from "@/lib/screenpipe";

type RecordingStatusContextValue = {
  recording: boolean;
  setRecording: (recording: boolean) => void;
  refreshRecordingStatus: () => Promise<void>;
};

const RecordingStatusContext =
  createContext<RecordingStatusContextValue | null>(null);

export function RecordingStatusProvider({ children }: { children: ReactNode }) {
  const [recording, setRecording] = useState(false);

  const refreshRecordingStatus = useCallback(async () => {
    try {
      const status = await screenpipe.status();
      setRecording(Boolean(status.recording));
    } catch {
      // Bridge may not be up yet; keep last known state.
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const status = await screenpipe.status();
        if (alive) setRecording(Boolean(status.recording));
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
    () => ({ recording, setRecording, refreshRecordingStatus }),
    [recording, refreshRecordingStatus],
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
