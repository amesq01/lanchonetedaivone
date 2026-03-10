let audioCtx: AudioContext | null = null;
let somAtivadoGlobal = true;

function tocarBip() {
  if (!audioCtx || audioCtx.state === 'closed') return;
  const ctx = audioCtx;
  const play = () => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.value = 1100;
    osc2.type = 'sine';
    gain2.gain.setValueAtTime(0.5, ctx.currentTime + 0.35);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.65);
    osc2.start(ctx.currentTime + 0.35);
    osc2.stop(ctx.currentTime + 0.65);
  };
  if (ctx.state === 'suspended') {
    ctx.resume().then(play).catch(() => {});
  } else {
    play();
  }
}

export function playSomNovoPedido() {
  if (somAtivadoGlobal && audioCtx) tocarBip();
}

export function setCozinhaSomAtivado(value: boolean) {
  somAtivadoGlobal = value;
}

export function cozinhaSomTurnOff() {
  somAtivadoGlobal = false;
  if (audioCtx) {
    audioCtx.close().catch(() => {});
    audioCtx = null;
  }
}

export function cozinhaSomTurnOn() {
  try {
    const CtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!CtxClass) return;
    if (audioCtx?.state === 'closed') audioCtx = null;
    if (!audioCtx) audioCtx = new CtxClass();
    somAtivadoGlobal = true;
    audioCtx.resume().then(() => tocarBip()).catch(() => {});
  } catch {
    //
  }
}

/** Chamar no primeiro clique do usuário (unlock de áudio). */
export function cozinhaSomInitOnFirstClick() {
  if (somAtivadoGlobal && !audioCtx) {
    try {
      const CtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (CtxClass) {
        audioCtx = new CtxClass();
        audioCtx.resume().catch(() => {});
      }
    } catch {
      //
    }
  }
}
