import { describe, expect, it } from 'vitest';
import {
  addWorkingMinutes,
  easterSunday,
  endOfWorkingDay,
  isWorkingDay,
  polishPublicHolidays,
  workingMinutesBetween,
} from '../src/utils/working-time.js';

// All instants are written in UTC. Warsaw is UTC+2 (CEST) in summer and
// UTC+1 (CET) in winter, so 08:00/16:00 local are 06:00/14:00Z or 07:00/15:00Z.
const at = (iso: string) => new Date(iso);
const day = (year: number, month: number, dayOfMonth: number) => ({
  year,
  month,
  day: dayOfMonth,
});

describe('Polish public holiday calendar', () => {
  it('computes Easter Sunday for known years', () => {
    expect(easterSunday(2024)).toEqual(day(2024, 3, 31));
    expect(easterSunday(2025)).toEqual(day(2025, 4, 20));
    expect(easterSunday(2026)).toEqual(day(2026, 4, 5));
    expect(easterSunday(2027)).toEqual(day(2027, 3, 28));
  });

  it('includes every fixed and movable statutory holiday of 2026', () => {
    expect([...polishPublicHolidays(2026)].sort()).toEqual([
      '2026-01-01', // Nowy Rok
      '2026-01-06', // Trzech Króli
      '2026-04-05', // Wielkanoc
      '2026-04-06', // Poniedziałek Wielkanocny
      '2026-05-01', // Święto Pracy
      '2026-05-03', // Konstytucja 3 Maja
      '2026-05-24', // Zielone Świątki
      '2026-06-04', // Boże Ciało
      '2026-08-15', // Wniebowzięcie NMP
      '2026-11-01', // Wszystkich Świętych
      '2026-11-11', // Niepodległości
      '2026-12-24', // Wigilia (statutory since 2025)
      '2026-12-25',
      '2026-12-26',
    ]);
  });

  it('treats Wigilia as a working day only before 2025', () => {
    expect(polishPublicHolidays(2024).has('2024-12-24')).toBe(false);
    expect(polishPublicHolidays(2025).has('2025-12-24')).toBe(true);
  });

  it('includes the one-off 12 November 2018 day off', () => {
    expect(polishPublicHolidays(2018).has('2018-11-12')).toBe(true);
    expect(polishPublicHolidays(2019).has('2019-11-12')).toBe(false);
  });

  it('classifies weekends and holidays as non-working days', () => {
    expect(isWorkingDay(day(2026, 11, 11))).toBe(false); // Wednesday, holiday
    expect(isWorkingDay(day(2026, 11, 12))).toBe(true);
    expect(isWorkingDay(day(2026, 9, 26))).toBe(false); // Saturday
    expect(isWorkingDay(day(2026, 9, 27))).toBe(false); // Sunday
    expect(isWorkingDay(day(2026, 4, 3))).toBe(true); // Good Friday is a working day
    expect(isWorkingDay(day(2026, 6, 4))).toBe(false); // Corpus Christi (Thursday)
  });
});

describe('addWorkingMinutes', () => {
  it('stays within a working day', () => {
    // Mon 2026-09-21 10:00 CEST + 3h
    expect(addWorkingMinutes(at('2026-09-21T08:00:00Z'), 180)).toEqual(at('2026-09-21T11:00:00Z'));
  });

  it('does not elapse over a weekend', () => {
    // Fri 15:00 + 2h -> Mon 09:00
    expect(addWorkingMinutes(at('2026-09-25T13:00:00Z'), 120)).toEqual(at('2026-09-28T07:00:00Z'));
  });

  it('starts counting at 08:00 when created before working hours', () => {
    // Mon 06:00 + 1h -> Mon 09:00
    expect(addWorkingMinutes(at('2026-09-21T04:00:00Z'), 60)).toEqual(at('2026-09-21T07:00:00Z'));
  });

  it('starts counting the next working day when created after 16:00', () => {
    // Tue 18:00 + 1h -> Wed 09:00
    expect(addWorkingMinutes(at('2026-09-22T16:00:00Z'), 60)).toEqual(at('2026-09-23T07:00:00Z'));
  });

  it('starts counting on Monday when created during the weekend', () => {
    // Sat 12:00 + 1h -> Mon 09:00
    expect(addWorkingMinutes(at('2026-09-26T10:00:00Z'), 60)).toEqual(at('2026-09-28T07:00:00Z'));
  });

  it('ends at 16:00 when the budget is used up exactly at the end of a day', () => {
    expect(addWorkingMinutes(at('2026-09-21T06:00:00Z'), 480)).toEqual(at('2026-09-21T14:00:00Z'));
  });

  it('skips a mid-week public holiday', () => {
    // Tue 2026-11-10 15:00 CET + 2h -> Wed 11-11 is a holiday -> Thu 09:00 CET
    expect(addWorkingMinutes(at('2026-11-10T14:00:00Z'), 120)).toEqual(at('2026-11-12T08:00:00Z'));
  });

  it('skips Easter Monday', () => {
    // Fri 2026-04-03 15:00 CEST + 2h -> Tue 04-07 09:00 CEST
    expect(addWorkingMinutes(at('2026-04-03T13:00:00Z'), 120)).toEqual(at('2026-04-07T07:00:00Z'));
  });

  it('skips the Christmas block including Wigilia', () => {
    // Tue 2025-12-23 15:00 CET + 2h -> 24/25/26 holidays, weekend -> Mon 29 09:00 CET
    expect(addWorkingMinutes(at('2025-12-23T14:00:00Z'), 120)).toEqual(at('2025-12-29T08:00:00Z'));
  });

  it('keeps 08:00-16:00 local across the autumn DST change', () => {
    // Fri 2026-10-23 15:00 CEST + 2h -> Mon 10-26 09:00 CET (DST ended 10-25)
    expect(addWorkingMinutes(at('2026-10-23T13:00:00Z'), 120)).toEqual(at('2026-10-26T08:00:00Z'));
  });

  it('keeps 08:00-16:00 local across the spring DST change', () => {
    // Fri 2026-03-27 15:00 CET + 2h -> Mon 03-30 09:00 CEST (DST began 03-29)
    expect(addWorkingMinutes(at('2026-03-27T14:00:00Z'), 120)).toEqual(at('2026-03-30T07:00:00Z'));
  });

  it('spans ten working days over two weeks', () => {
    // Mon 2026-09-14 08:00 CEST + 10 working days -> Fri 09-25 16:00 CEST
    expect(addWorkingMinutes(at('2026-09-14T06:00:00Z'), 10 * 480)).toEqual(
      at('2026-09-25T14:00:00Z'),
    );
  });

  it('rejects negative or non-finite budgets', () => {
    expect(() => addWorkingMinutes(at('2026-09-14T06:00:00Z'), -1)).toThrow(RangeError);
    expect(() => addWorkingMinutes(at('2026-09-14T06:00:00Z'), Number.NaN)).toThrow(RangeError);
  });
});

describe('workingMinutesBetween', () => {
  it('counts only working time and is signed', () => {
    const friday = at('2026-09-25T13:00:00Z'); // Fri 15:00
    const monday = at('2026-09-28T07:00:00Z'); // Mon 09:00
    expect(workingMinutesBetween(friday, monday)).toBe(120);
    expect(workingMinutesBetween(monday, friday)).toBe(-120);
  });

  it('is zero across a non-working span', () => {
    expect(workingMinutesBetween(at('2026-09-25T15:00:00Z'), at('2026-09-28T05:00:00Z'))).toBe(0);
  });

  it('is the inverse of addWorkingMinutes', () => {
    const start = at('2026-12-22T09:17:00Z');
    const due = addWorkingMinutes(start, 7 * 480);
    expect(workingMinutesBetween(start, due)).toBe(7 * 480);
  });
});

describe('endOfWorkingDay', () => {
  it('returns 16:00 local on a working day and null on weekends/holidays', () => {
    expect(endOfWorkingDay(at('2026-09-21T08:00:00Z'))).toEqual(at('2026-09-21T14:00:00Z'));
    expect(endOfWorkingDay(at('2026-09-26T08:00:00Z'))).toBeNull();
    expect(endOfWorkingDay(at('2026-11-11T08:00:00Z'))).toBeNull();
  });
});

describe('workingMinutesBetween rounding', () => {
  it('reports a deadline missed by seconds as -1 minute', () => {
    const due = at('2026-09-21T08:00:00Z');
    expect(workingMinutesBetween(at('2026-09-21T08:00:30Z'), due)).toBe(-1);
    expect(workingMinutesBetween(due, at('2026-09-21T08:00:30Z'))).toBe(0);
  });
});
