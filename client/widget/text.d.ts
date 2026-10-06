// The built stylesheet is imported as a string (see scripts/build-widget.mjs).
declare module '*.txt' {
  const text: string;
  export default text;
}
