import { AnnouncementSettings } from "@/lib/announcement-settings";

export async function playStationAnnouncement(settings: AnnouncementSettings): Promise<void> {
  if (settings.notificationAnnouncementJingle) {
    await playJingle(settings.notificationAnnouncementVolume);
  }
  speakText(
    settings.notificationAnnouncementMessage,
    settings.notificationAnnouncementRate,
    settings.notificationAnnouncementPitch,
    settings.notificationAnnouncementVolume
  );
}

// Two-tone station-style ding-dong: E5 (880Hz) then E4 (659Hz)
async function playJingle(volume: number): Promise<void> {
  return new Promise((resolve) => {
    try {
      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) { resolve(); return; }

      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      const notes: { freq: number; start: number; duration: number }[] = [
        { freq: 880, start: 0,    duration: 0.28 },
        { freq: 659, start: 0.32, duration: 0.40 },
      ];

      for (const note of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = note.freq;
        gain.gain.setValueAtTime(0, now + note.start);
        gain.gain.linearRampToValueAtTime(volume * 0.55, now + note.start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + note.start + note.duration);
        osc.start(now + note.start);
        osc.stop(now + note.start + note.duration + 0.05);
      }

      const totalMs = (0.32 + 0.40 + 0.12) * 1000;
      setTimeout(() => {
        ctx.close().catch(() => null);
        resolve();
      }, totalMs);
    } catch {
      resolve();
    }
  });
}

function speakText(text: string, rate: number, pitch: number, volume: number): void {
  try {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "it-IT";
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const italianVoice =
        voices.find((v) => v.lang === "it-IT") ??
        voices.find((v) => v.lang.startsWith("it-"));
      if (italianVoice) utterance.voice = italianVoice;
      window.speechSynthesis.speak(utterance);
    };

    // Voices may not be loaded yet on first call
    if (window.speechSynthesis.getVoices().length > 0) {
      pickVoice();
    } else {
      window.speechSynthesis.addEventListener("voiceschanged", pickVoice, { once: true });
      // Fallback if voiceschanged never fires
      setTimeout(pickVoice, 300);
    }
  } catch {
    // Browser blocked speech; fail silently
    console.debug("[announcement-player] speechSynthesis non disponibile o bloccato");
  }
}
