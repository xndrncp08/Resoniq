import { useState } from "react";
import { useMutation } from "@tanstack/react-query";

/**
 * An on/off relationship stored on the server (saved, bookmarked, following,
 * joined). Flips instantly, rolls back if the server refuses, and queues rapid
 * taps on the same target in order instead of racing them.
 */
export function useServerToggle({ scope, initial, send, onSettled }: { scope: string; initial: boolean; send: (next: boolean) => Promise<unknown>; onSettled?: () => void }) {
  const [on, setOn] = useState(initial);
  const mutation = useMutation({
    scope: { id: scope },
    mutationFn: send,
    onMutate: (next: boolean) => {
      setOn(next);
      return !next;
    },
    onError: (_err, _next, previous) => {
      if (previous !== undefined) setOn(previous);
    },
    onSettled,
  });
  return { on, toggle: () => mutation.mutate(!on), pending: mutation.isPending, error: mutation.error };
}
