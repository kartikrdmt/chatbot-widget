/**
 * Where the chat file is, worked out from where the loader itself was loaded: the same host, and
 * the same folder tree, as the loader. It never uses the page's own address.
 *
 * The loader is published three ways (see scripts/build-widget.mjs), and the chat file only lives in
 * the pinned folder, so each one finds it differently:
 *   <base>/v1.0.0/widget.js   next to it
 *   <base>/v1/widget.js       one folder up, then into v1.0.0
 *   <base>/widget.js          into v1.0.0 below it
 */
export function resolveChatUrl(
  scriptUrl: string,
  version: string,
  chatFile: string,
): string | null {
  let loader: URL;
  try {
    loader = new URL(scriptUrl);
  } catch {
    return null;
  }
  if (loader.protocol !== 'https:' && loader.protocol !== 'http:') return null;

  const folder = loader.pathname.split('/').slice(0, -1).pop() ?? '';
  const major = version.split('.')[0];
  const relative =
    folder === `v${version}`
      ? chatFile
      : folder === `v${major}`
        ? `../v${version}/${chatFile}`
        : `v${version}/${chatFile}`;
  return new URL(relative, loader).href;
}
