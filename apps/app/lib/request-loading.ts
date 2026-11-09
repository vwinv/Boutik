type Listener = (pending: number) => void;

let pending = 0;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener(pending);
}

export function beginRequestLoading() {
  pending += 1;
  emit();
}

export function endRequestLoading() {
  pending = Math.max(0, pending - 1);
  emit();
}

export function subscribeRequestLoading(listener: Listener) {
  listeners.add(listener);
  listener(pending);
  return () => {
    listeners.delete(listener);
  };
}

export async function withRequestLoading<T>(work: () => Promise<T>): Promise<T> {
  beginRequestLoading();
  try {
    return await work();
  } finally {
    endRequestLoading();
  }
}
