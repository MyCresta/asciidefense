export const SPEEDS = [1, 2, 3, 5, 10];
const STEP = 1 / 60;

// Combat gets the same steps at every playback speed. Never carry elapsed time
// across a choice, a manual pause or a hidden tab.
export class SimulationClock {
  constructor() { this.reset(); }
  reset() { this.remainder = 0; }
  advance(game, realDeltaSeconds, rate) {
    if (game.status !== 'running') { this.reset(); return; }
    if (!Number.isFinite(realDeltaSeconds) || realDeltaSeconds <= 0 || !SPEEDS.includes(rate)) return;
    this.remainder += realDeltaSeconds * rate;
    while (this.remainder + 1e-10 >= STEP) {
      game.update(STEP);
      this.remainder = Math.max(0, this.remainder - STEP);
      if (game.status !== 'running') { this.reset(); break; }
    }
  }
}
