"use client";

type ToneStep = { frequency: number; duration: number };

function playSequence(steps: ToneStep[]) {
  if (typeof window === "undefined") {
    return;
  }

  const AudioContextImpl = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextImpl) {
    return;
  }

  const context = new AudioContextImpl();
  let offset = context.currentTime;

  steps.forEach((step) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = step.frequency;
    gain.gain.setValueAtTime(0.0001, offset);
    gain.gain.exponentialRampToValueAtTime(0.09, offset + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, offset + step.duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(offset);
    oscillator.stop(offset + step.duration);
    offset += step.duration;
  });

  const closeDelayMs = (offset - context.currentTime + 0.05) * 1000;
  window.setTimeout(() => {
    void context.close();
  }, Math.max(0, closeDelayMs));
}

export function playWinSound() {
  playSequence([
    { frequency: 660, duration: 0.1 },
    { frequency: 880, duration: 0.12 },
    { frequency: 1100, duration: 0.14 },
  ]);
}

export function playLoseSound() {
  playSequence([
    { frequency: 340, duration: 0.13 },
    { frequency: 260, duration: 0.18 },
  ]);
}

export function playClickSound() {
  playSequence([
    { frequency: 520, duration: 0.04 },
    { frequency: 610, duration: 0.05 },
  ]);
}

export function playSuccessSound() {
  playSequence([
    { frequency: 740, duration: 0.08 },
    { frequency: 920, duration: 0.09 },
    { frequency: 1180, duration: 0.1 },
  ]);
}

export function playTimeWarningSound() {
  playSequence([
    { frequency: 330, duration: 0.06 },
    { frequency: 330, duration: 0.06 },
    { frequency: 330, duration: 0.06 },
  ]);
}
