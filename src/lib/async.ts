// (c) 2026 ambe / Business_Card_Folder

export class TimeoutError extends Error {
  constructor(message: string = "Timed out") {
    super(message);
    this.name = "TimeoutError";
  }
}

export async function withTimeout<T>(
  promise: PromiseLike<T>,
  ms: number,
  message: string
): Promise<T> {
  let t: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    t = window.setTimeout(() => reject(new TimeoutError(message)), ms);
  });

  try {
    return await Promise.race([Promise.resolve(promise), timeout]);
  } finally {
    if (t !== undefined) window.clearTimeout(t);
  }
}

