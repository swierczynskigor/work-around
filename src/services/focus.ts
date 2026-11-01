import { BlockedTimeWindow } from "../domain/models";
export function scheduleTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
export function createFocusSchedule(input: {
  id?: string;
  name: string;
  start: string;
  end: string;
  days: number[];
  isEnabled: boolean;
}): BlockedTimeWindow {
  if (
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.start) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.end) ||
    input.start === input.end ||
    !input.days.length ||
    input.days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
  )
    throw new Error("Invalid focus schedule");
  const [startHour, startMinute] = input.start.split(":").map(Number);
  const [endHour, endMinute] = input.end.split(":").map(Number);
  return {
    id: input.id || crypto.randomUUID(),
    name: input.name.trim().slice(0, 80),
    daysOfWeek: [...new Set(input.days)].sort(),
    startHour,
    startMinute,
    endHour,
    endMinute,
    isEnabled: input.isEnabled,
  };
}
