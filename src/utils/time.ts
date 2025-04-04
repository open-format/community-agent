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

// function to create a timestamp from a date this will falllback to configurate days ago if no date is provided
//     const startTimestamp = dayjs(startDate || dayjs().subtract(30, "day")).valueOf();
// const endTimestamp = dayjs(endDate || dayjs()).valueOf();

export function createUnixTimestamp(date?: string, daysAgo?: number) {
  if (date) {
    return dayjs(date).valueOf();
  }

  if (daysAgo) {
    return dayjs().subtract(daysAgo, "day").valueOf();
  }

  return dayjs().valueOf();
}
