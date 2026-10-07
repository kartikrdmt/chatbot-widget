/** The letters come from the site's settings (default: the first letter of its title). */
export function ChatBrandMark({ text }: { text?: string }): React.ReactElement {
  return (
    <span
      aria-hidden
      className="bg-chat-accent mt-1 grid size-6 shrink-0 rotate-45 place-items-center rounded-md"
    >
      <span className="text-chat-accent-foreground -rotate-45 text-[11px] font-bold">{text}</span>
    </span>
  );
}
