let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

/** Debe llamarse dentro de un manejador de clic para que el navegador permita reproducir audio. */
export function unlockAudio(): void {
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
  } catch {
    // ignorar
  }
}

/** Reproduce un tono suave y corto (~600ms) para avisar que un temporizador terminó. */
export function playChime(): void {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = 660;
    oscillator.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.1);
    gain.gain.linearRampToValueAtTime(0, now + 0.6);

    oscillator.start(now);
    oscillator.stop(now + 0.6);
  } catch {
    // Web Audio no disponible (p. ej. bloqueado por el navegador) — falla en silencio.
  }
}
