/** Apple Notes-style relative date bucketing for a list pane. */
export function groupByDate<T>(
  items: T[],
  getDate: (item: T) => string | Date,
): { label: string; items: T[] }[] {
  const now = new Date();
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = startOfDay(now);
  const yesterday = today - 86_400_000;
  const sevenDaysAgo = today - 7 * 86_400_000;
  const thirtyDaysAgo = today - 30 * 86_400_000;

  const buckets = new Map<string, T[]>();
  const order = ["Today", "Yesterday", "Previous 7 Days", "Previous 30 Days", "Older"];

  for (const item of items) {
    const d = startOfDay(new Date(getDate(item)));
    let label: string;
    if (d === today) label = "Today";
    else if (d === yesterday) label = "Yesterday";
    else if (d > sevenDaysAgo) label = "Previous 7 Days";
    else if (d > thirtyDaysAgo) label = "Previous 30 Days";
    else label = "Older";

    const list = buckets.get(label) ?? [];
    list.push(item);
    buckets.set(label, list);
  }

  return order
    .filter((label) => buckets.has(label))
    .map((label) => ({ label, items: buckets.get(label)! }));
}

/** Short Apple-Notes-style timestamp: time for today, weekday for the
 * last week, otherwise a compact date. */
export function formatNoteTimestamp(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const startOfDay = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = (startOfDay(now) - startOfDay(d)) / 86_400_000;

  if (diffDays === 0) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) {
    return d.toLocaleDateString(undefined, { weekday: "long" });
  }
  return d.toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "2-digit" });
}
