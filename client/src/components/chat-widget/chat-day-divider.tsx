const DAY_MS = 86_400_000;

const startOfDay = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const formatDay = (iso: string): string => {
  const date = new Date(iso);
  const daysAgo = Math.round((startOfDay(new Date()) - startOfDay(date)) / DAY_MS);

  if (daysAgo === 0) return 'Today';
  if (daysAgo === 1) return 'Yesterday';
  return date.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export function ChatDayDivider({ iso }: { iso: string }): React.ReactElement {
  return (
    <div className="mb-3 flex items-center gap-3" role="separator">
      <span className="bg-chat-border h-px flex-1" />
      <span className="text-chat-dim text-xs font-medium">{formatDay(iso)}</span>
      <span className="bg-chat-border h-px flex-1" />
    </div>
  );
}
