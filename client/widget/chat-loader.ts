import type { ChatModule } from './chat-entry';

const REGISTRY_KEY = Symbol.for('myra-widget.chat');

const loaded = new Map<string, Promise<ChatModule>>();

/**
 * Loads the chat file with a <script> that carries its integrity hash, so the browser refuses to
 * run a file that is not byte for byte the one this loader was built with. (`import()` cannot
 * check integrity.) The chat file hands itself over on a private global, taken at once.
 */
export function loadChatModule(url: string, integrity: string): Promise<ChatModule> {
  const known = loaded.get(url);
  if (known) return known;

  const pending = new Promise<ChatModule>((resolve, reject) => {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = url;
    script.integrity = integrity;
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      const registry = globalThis as unknown as Record<symbol, ChatModule | undefined>;
      const chat = registry[REGISTRY_KEY];
      delete registry[REGISTRY_KEY];
      script.remove();
      if (chat) resolve(chat);
      else reject(new Error('The chat file loaded but did not register itself.'));
    };
    script.onerror = () => {
      script.remove();
      reject(new Error('The chat file was blocked or could not be loaded.'));
    };
    document.head.appendChild(script);
  });

  loaded.set(url, pending);
  pending.catch(() => loaded.delete(url));
  return pending;
}
