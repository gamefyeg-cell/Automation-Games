/**
 * Formats an ISO date string into a clean, human-readable relative time string.
 * Examples: "just now", "5m ago", "2h ago", "yesterday", "3d ago", "2w ago", "1mo ago".
 */
export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "never";
  const timestamp = new Date(iso).getTime();
  if (isNaN(timestamp)) return "never";

  const diffMs = Date.now() - timestamp;
  if (diffMs < 0) return "just now";

  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";

  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;

  const days = Math.floor(hr / 24);
  if (days === 1) return "yesterday";
  if (days < 14) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

/**
 * Formats an ISO date string into a localized full date/time string.
 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
