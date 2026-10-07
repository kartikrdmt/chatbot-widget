/**
 * Decides whether a streamed piece of a reply should be shown. A piece is dropped when it repeats
 * or arrives behind one already shown, and every piece of a reply that has already been finalised
 * is dropped, so a late one can never append text to a finished message.
 */
export class DeltaGate {
  private readonly last = new Map<string, number>();
  private readonly finished = new Set<string>();

  accept(id: string, seq?: number): boolean {
    if (this.finished.has(id)) return false;
    if (seq === undefined) return true;
    if (seq <= (this.last.get(id) ?? -1)) return false;
    this.last.set(id, seq);
    return true;
  }

  finish(id: string): void {
    this.finished.add(id);
    this.last.delete(id);
  }
}
