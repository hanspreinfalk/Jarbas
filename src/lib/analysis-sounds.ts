import streamingCompleteUrl from "@/assets/streaming-complete.mp3";

let completeAudio: HTMLAudioElement | null = null;

/** Short chime when insights / opportunities / report analysis finishes. */
export function playAnalysisCompleteSound() {
  try {
    if (!completeAudio) {
      completeAudio = new Audio(streamingCompleteUrl);
    } else {
      completeAudio.pause();
      completeAudio.currentTime = 0;
    }
    void completeAudio.play().catch(() => {
      // Browser may block autoplay without a prior gesture — ignore.
    });
  } catch {
    // Missing asset / Audio unsupported — ignore.
  }
}
