export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay = 150
): (...args: Parameters<T>) => void {
  let timer: number | undefined;
  return function (this: unknown, ...args: Parameters<T>) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      fn.apply(this, args);
    }, delay) as unknown as number;
  };
}
