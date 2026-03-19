export interface TimeSnapshot {
  day: number
  hour: number
  minute: number
  totalMinutes: number
}

export class TimeSystem {
  private totalMinutes = 8 * 60

  setTotalMinutes(totalMinutes: number): void {
    this.totalMinutes = totalMinutes
  }

  advance(minutes: number): TimeSnapshot {
    this.totalMinutes += minutes
    return this.getSnapshot()
  }

  getSnapshot(): TimeSnapshot {
    const day = Math.floor(this.totalMinutes / (24 * 60)) + 1
    const minuteOfDay = this.totalMinutes % (24 * 60)
    const hour = Math.floor(minuteOfDay / 60)
    const minute = minuteOfDay % 60

    return {
      day,
      hour,
      minute,
      totalMinutes: this.totalMinutes,
    }
  }
}
