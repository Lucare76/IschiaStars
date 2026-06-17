import { AnnouncementSettings } from "@/lib/announcement-settings";

export async function playStationAnnouncement(settings: AnnouncementSettings): Promise<void> {
  if (settings.notificationAnnouncementJingle) {
    await playJingle(settings.notificationAnnouncementVolume);
  }
  await speakText(
    settings.notificationAnnouncementMessage,
    settings.notificationAnnouncementRate,
    settings.notificationAnnouncementPitch,
    settings.notificationAnnouncementVolume
  );
}

// Waits for speechSynthesis.onvoiceschanged with a hard timeout fallback.
// Clears the timeout as soon as the event fires to prevent double execution.
function waitForVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve(window.speechSynthesis.getVoices());
    }, timeoutMs);

    window.speechSynthesis.addEventListener(
      "voiceschanged",
      () => {
        clearTimeout(timer);
        resolve(window.speechSynthesis.getVoices());
      },
      { once: true }
    );
  });
}

// Priority order:
//   1. name contains "google italiano" (case-insensitive)
//   2. lang === "it-IT"
//   3. lang starts with "it" (e.g. "it-CH")
//   4. browser default voice
//   5. null (browser picks whatever it wants)
async function getPreferredItalianVoice(): Promise<SpeechSynthesisVoice | null> {
  let voices = window.speechSynthesis.getVoices();
  if (!voices.length) {
    voices = await waitForVoices();
  }

  const voice =
    voices.find((v) => v.name.toLowerCase().includes("google italiano")) ??
    voices.find((v) => v.lang === "it-IT") ??
    voices.find((v) => v.lang.toLowerCase().startsWith("it")) ??
    voices.find((v) => v.default) ??
    null;

  if (process.env.NODE_ENV === "development") {
    console.debug("[announcement] selected voice", voice?.name, voice?.lang);
  }

  return voice;
}

async function speakText(text: string, rate: number, pitch: number, volume: number): Promise<void> {
  try {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const voice = await getPreferredItalianVoice();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "it-IT";
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;
    if (voice) utterance.voice = voice;

    window.speechSynthesis.speak(utterance);
  } catch {
    console.debug("[announcement-player] speechSynthesis non disponibile o bloccato");
  }
}

export async function playConfirmaSound(volume: number, audioUrl?: string): Promise<void> {
  if (audioUrl) {
    return playAudioUrl(audioUrl, volume);
  }
  return playConfirmaFanfare(volume);
}

async function playAudioUrl(url: string, volume: number): Promise<void> {
  return new Promise((resolve) => {
    try {
      const audio = new Audio(url);
      audio.volume = Math.max(0, Math.min(1, volume));
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      audio.play().catch(() => resolve());
    } catch {
      resolve();
    }
  });
}

// Ascending 4-note fanfare played on confirmed bookings (C5 → E5 → G5 → C6)
async function playConfirmaFanfare(volume: number): Promise<void> {
  return new Promise((resolve) => {
    try {
      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) { resolve(); return; }

      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      const notes: { freq: number; start: number; duration: number }[] = [
        { freq: 523.25, start: 0,    duration: 0.16 }, // C5
        { freq: 659.25, start: 0.19, duration: 0.16 }, // E5
        { freq: 783.99, start: 0.38, duration: 0.16 }, // G5
        { freq: 1046.5, start: 0.57, duration: 0.70 }, // C6 – tenuta
      ];

      for (const note of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "triangle";
        osc.frequency.value = note.freq;
        gain.gain.setValueAtTime(0, now + note.start);
        gain.gain.linearRampToValueAtTime(volume * 0.7, now + note.start + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.001, now + note.start + note.duration);
        osc.start(now + note.start);
        osc.stop(now + note.start + note.duration + 0.05);
      }

      const totalMs = (0.57 + 0.70 + 0.15) * 1000;
      setTimeout(() => {
        ctx.close().catch(() => null);
        resolve();
      }, totalMs);
    } catch {
      resolve();
    }
  });
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
