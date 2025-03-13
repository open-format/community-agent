import dayjs from "dayjs";

export function validateTimeWindow(start_time?: string, end_time?: string): boolean {
  if (!start_time && !end_time) {
    return true;
  }

  const now = dayjs();

  if (start_time && now.isBefore(start_time)) {
    return false;
  }

  if (end_time && now.isAfter(end_time)) {
    return false;
  }

  return true;
}
