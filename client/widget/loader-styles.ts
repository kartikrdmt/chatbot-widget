import { DEFAULT_VARIABLES } from '@/lib/theme-vars';

const defaults = Object.entries(DEFAULT_VARIABLES)
  .map(([name, value]) => `${name}:${value}`)
  .join(';');

export const LOADER_CSS = `
:host{${defaults}}
.myra-widget-root{all:initial;display:block;font-family:var(--chat-font-family,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif);font-size:16px;line-height:1.5;color:var(--chat-foreground);-webkit-font-smoothing:antialiased}
.myra-widget-root *,.myra-widget-root *::before,.myra-widget-root *::after{box-sizing:border-box}
.myra-panel,.myra-inline{overflow:hidden;border:1px solid var(--chat-border);border-radius:var(--chat-radius-window);background:var(--chat-surface)}
.myra-panel{position:fixed;z-index:2147483647;box-shadow:0 25px 50px -12px rgba(0,0,0,.3)}
.myra-inline{width:100%;height:100%}
.myra-mount{width:100%;height:100%}
.myra-launcher{position:fixed;z-index:2147483646;display:flex;align-items:center;justify-content:center;width:56px;height:56px;padding:0;border:0;cursor:pointer;border-radius:var(--chat-radius-launcher);background:var(--chat-accent);color:var(--chat-accent-foreground);box-shadow:0 10px 15px -3px rgba(0,0,0,.3),0 4px 6px -4px rgba(0,0,0,.3);transition:transform .15s ease}
.myra-launcher:hover{transform:scale(1.05)}
.myra-launcher:focus-visible{outline:2px solid var(--chat-accent-foreground);outline-offset:-4px}
.myra-icons{position:relative;display:block;width:24px;height:24px}
.myra-icons svg{position:absolute;inset:0;width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.myra-status{display:flex;align-items:center;justify-content:center;width:100%;height:100%;padding:24px;text-align:center;font-size:14px;color:var(--chat-muted)}
.myra-status button{margin-top:12px;padding:6px 14px;border:1px solid var(--chat-border);border-radius:var(--chat-radius-control);background:var(--chat-surface);color:var(--chat-foreground);cursor:pointer;font:inherit}
.myra-dots{display:flex;gap:6px}
.myra-dots i{width:8px;height:8px;border-radius:50%;background:var(--chat-dim);animation:myra-bounce 1s infinite}
.myra-dots i:nth-child(2){animation-delay:.15s}
.myra-dots i:nth-child(3){animation-delay:.3s}
@keyframes myra-bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}
@media (prefers-reduced-motion:reduce){.myra-dots i{animation:none}}
`
  .replace(/\n/g, '')
  .trim();
