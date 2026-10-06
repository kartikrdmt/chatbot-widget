# @myra-technolabs/chatbot-widget

The Myra Technolabs AI chatbot for React and Next.js. It loads the widget from your widget
host in an iframe, so your site's CSS can't break it and it can't break yours.

```bash
npm install @myra-technolabs/chatbot-widget
```

```tsx
import { ChatbotWidget } from '@myra-technolabs/chatbot-widget';

export function Chat() {
  return (
    <ChatbotWidget
      widgetKey="your-site-key"
      widgetUrl="https://chat.example.com"
      apiUrl="https://api.example.com"
      position="bottom-left"
      accentColor="#ea7a2d"
      title="Myra Technolabs"
      subtitle="AI assistant"
    />
  );
}
```

In Next.js (App Router) the component is already marked `'use client'`, so you can use it from
a server component such as `app/layout.tsx`.

## Where it appears

- **Floating** (default): `position` is one of `bottom-right`, `bottom-left`, `bottom-center`,
  `top-right`, `top-left`, `top-center`, `left-center`, `right-center`. Use `offset` for the gap
  from the screen edge, and `width` / `height` for the largest size of the chat window.
- **Inline**: add `inline` and the chat is drawn inside the component's own box, wherever you
  put it, for example in the middle of a page. `width` / `height` set its exact size, and
  `className` / `style` style the box around it.

```tsx
<div style={{ maxWidth: 480, margin: '0 auto' }}>
  <ChatbotWidget inline widgetKey="..." widgetUrl="..." apiUrl="..." height={520} />
</div>
```

## Props

| Prop | What it controls |
| --- | --- |
| `widgetKey`, `widgetUrl`, `apiUrl` | Required. Site key, widget host, API host |
| `position`, `offset`, `width`, `height`, `inline` | Placement and size (above) |
| `title`, `subtitle`, `greeting`, `placeholder`, `avatarText` | Texts |
| `accentColor` | Header, launcher, send button, your bubbles, bot avatar |
| `accentTextColor` | Text and icons on top of the accent colour |
| `backgroundColor` | Chat window and bot bubbles |
| `chatBackgroundColor` | Area behind the messages |
| `textColor` | Main text |
| `mutedColor` | Timestamps and placeholder |
| `borderColor` | Borders and dividers |

These are the same options as the `data-*` attributes on the script tag
(`data-accent-color`, `data-position`, `data-container`, ...).

The site's domain must be allowed for the widget key on the server (`WIDGET_SITES`), otherwise the
chat shows "This chat widget is not available."

## Publishing

```bash
npm run build
npm publish --access public
```
