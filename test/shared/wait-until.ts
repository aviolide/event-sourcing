export interface WaitUntilOptions {
  timeout?: number;
  interval?: number;
  message?: string;
}

export async function waitUntil(
  fn: () => Promise<boolean>,
  options?: WaitUntilOptions,
): Promise<void> {
  const timeout = options?.timeout ?? 30000;
  const interval = options?.interval ?? 500;
  const startedAt = Date.now();

  while (true) {
    const result = await fn();
    if (result) return;

    if (Date.now() - startedAt > timeout) {
      throw new Error(
        options?.message ?? `waitUntil timeout exceeded (${timeout}ms)`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}
