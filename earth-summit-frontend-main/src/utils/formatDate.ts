/**
 * Format date from ISO string to "DD MMM" format
 * @param dateString - ISO date string
 * @returns Formatted date string (e.g., "7 Oct")
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.toLocaleString("en-US", { month: "short" });
  return `${day} ${month}`;
}
