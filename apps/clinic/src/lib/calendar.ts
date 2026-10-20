import { minutesOfDay } from '@physio/core';

export interface CalendarItem {
  id: number;
  local_start: string; // "YYYY-MM-DDTHH:mm"
  local_end: string;
}

export interface PositionedItem<T extends CalendarItem> {
  item: T;
  top: number; // minutes from the start of the visible day
  height: number; // minutes
  lane: number;
  lanes: number;
}

/**
 * Lays out overlapping items side by side (classic calendar packing):
 * items are grouped into clusters of transitive overlap; within a cluster each
 * item takes the first free lane, and all items share the cluster's lane count.
 */
export function layoutDay<T extends CalendarItem>(items: T[], dayStartMinutes: number): PositionedItem<T>[] {
  const sorted = [...items].sort((a, b) => a.local_start.localeCompare(b.local_start) || b.local_end.localeCompare(a.local_end));
  const result: PositionedItem<T>[] = [];

  let cluster: PositionedItem<T>[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    const lanes = laneEnds.length || 1;
    cluster.forEach((p) => (p.lanes = lanes));
    result.push(...cluster);
    cluster = [];
    laneEnds = [];
  };

  for (const item of sorted) {
    const start = minutesOfDay(item.local_start);
    const end = item.local_end.slice(0, 10) > item.local_start.slice(0, 10) ? 24 * 60 : minutesOfDay(item.local_end);

    if (start >= clusterEnd) {
      flush();
      clusterEnd = -Infinity;
    }

    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    clusterEnd = Math.max(clusterEnd, end);

    cluster.push({ item, top: start - dayStartMinutes, height: Math.max(end - start, 15), lane, lanes: 1 });
  }
  flush();

  return result;
}

/** Visible hour range covering working hours and any appointments, padded to whole hours. */
export function visibleHours(workingTimes: { start_time: string; end_time: string }[], items: CalendarItem[], fallback: [number, number] = [8, 20]): [number, number] {
  const starts = [...workingTimes.map((w) => minutesOfDay(w.start_time)), ...items.map((i) => minutesOfDay(i.local_start))];
  const ends = [...workingTimes.map((w) => minutesOfDay(w.end_time)), ...items.map((i) => minutesOfDay(i.local_end))];
  if (starts.length === 0) return fallback;
  const from = Math.max(0, Math.floor(Math.min(...starts, fallback[0] * 60) / 60));
  const to = Math.min(24, Math.ceil(Math.max(...ends, fallback[1] * 60) / 60));
  return [from, Math.max(to, from + 1)];
}

/** Snap a pixel offset inside a day column to the booking grid (15 min). */
export function snapToGrid(offsetMinutes: number, grid = 15): number {
  return Math.max(0, Math.floor(offsetMinutes / grid) * grid);
}

export function isWithinWorkingHours(weekday: number, minutes: number, hours: { weekday: number; start_time: string; end_time: string }[]): boolean {
  return hours.some((h) => h.weekday === weekday && minutes >= minutesOfDay(h.start_time) && minutes < minutesOfDay(h.end_time));
}
