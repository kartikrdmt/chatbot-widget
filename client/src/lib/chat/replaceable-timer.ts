/** One timeout that can be replaced or cancelled, so an old one can never fire after a new event. */
export class ReplaceableTimer {
  private handle: ReturnType<typeof setTimeout> | undefined;

  set(callback: () => void, ms: number): void {
    this.clear();
    this.handle = setTimeout(() => {
      this.handle = undefined;
      callback();
    }, ms);
  }

  clear(): void {
    if (this.handle === undefined) return;
    clearTimeout(this.handle);
    this.handle = undefined;
  }
}
