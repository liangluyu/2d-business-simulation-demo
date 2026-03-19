export class GameLoop {
  private timerId: number | null = null
  private readonly tickRateMs: number
  private readonly onTick: () => void

  constructor(tickRateMs: number, onTick: () => void) {
    this.tickRateMs = tickRateMs
    this.onTick = onTick
  }

  start(): void {
    if (this.timerId !== null) {
      return
    }

    this.timerId = window.setInterval(() => {
      this.onTick()
    }, this.tickRateMs)
  }

  stop(): void {
    if (this.timerId === null) {
      return
    }

    window.clearInterval(this.timerId)
    this.timerId = null
  }
}
