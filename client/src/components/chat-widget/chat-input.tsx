'use client';

import { Send } from 'lucide-react';
import { type SyntheticEvent, useState } from 'react';

interface ChatInputProps {
  disabled: boolean;
  placeholder?: string;
  onSend: (text: string) => void;
}

export function ChatInput({
  disabled,
  placeholder = 'Write a message...',
  onSend,
}: ChatInputProps): React.ReactElement {
  const [value, setValue] = useState('');

  const handleSubmit = (event: SyntheticEvent): void => {
    event.preventDefault();
    if (!value.trim() || disabled) return;
    onSend(value);
    setValue('');
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-chat-surface border-chat-border flex items-center gap-2 border-t p-4"
    >
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        className="border-chat-border bg-chat-raised text-chat-foreground placeholder:text-chat-dim focus:border-chat-accent min-w-0 flex-1 rounded-lg border px-4 py-2.5 text-sm outline-none"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        aria-label="Send message"
        className="bg-chat-accent text-chat-accent-foreground flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg transition hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Send className="size-4" aria-hidden />
      </button>
    </form>
  );
}
