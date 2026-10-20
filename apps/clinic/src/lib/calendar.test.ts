import { describe, expect, it } from 'vitest';
import { isWithinWorkingHours, layoutDay, snapToGrid, visibleHours } from './calendar';

const item = (id: number, start: string, end: string) => ({ id, local_start: `2026-10-15T${start}`, local_end: `2026-10-15T${end}` });

describe('calendar layout', () => {
  it('places non-overlapping items in a single full-width lane', () => {
    const laid = layoutDay([item(1, '09:00', '09:45'), item(2, '09:45', '10:30')], 8 * 60);
    expect(laid.map((p) => [p.item.id, p.lane, p.lanes, p.top, p.height])).toEqual([
      [1, 0, 1, 60, 45],
      [2, 0, 1, 105, 45],
    ]);
  });

  it('splits overlapping clusters into side-by-side lanes', () => {
    const laid = layoutDay([item(1, '09:00', '10:00'), item(2, '09:30', '10:30'), item(3, '10:00', '11:00'), item(4, '12:00', '12:30')], 8 * 60);
    const byId = Object.fromEntries(laid.map((p) => [p.item.id, p]));

    expect(byId[1].lanes).toBe(2);
    expect(byId[2].lane).toBe(1);
    expect(byId[3].lane).toBe(0); // reuses the lane freed at 10:00
    expect(byId[4].lanes).toBe(1); // separate cluster
  });

  it('keeps tiny appointments clickable', () => {
    expect(layoutDay([item(1, '09:00', '09:05')], 0)[0].height).toBe(15);
  });

  it('derives the visible hour range from hours and appointments', () => {
    expect(visibleHours([{ start_time: '09:00', end_time: '19:00' }], [])).toEqual([8, 20]);
    expect(visibleHours([{ start_time: '06:30', end_time: '13:00' }], [item(1, '21:00', '21:45')])).toEqual([6, 22]);
  });

  it('snaps clicks to the 15-minute booking grid', () => {
    expect(snapToGrid(7)).toBe(0);
    expect(snapToGrid(44)).toBe(30);
    expect(snapToGrid(-5)).toBe(0);
  });

  it('knows working hours per weekday', () => {
    const hours = [{ weekday: 1, start_time: '09:00', end_time: '13:00' }];
    expect(isWithinWorkingHours(1, 9 * 60, hours)).toBe(true);
    expect(isWithinWorkingHours(1, 13 * 60, hours)).toBe(false);
    expect(isWithinWorkingHours(2, 10 * 60, hours)).toBe(false);
  });
});
