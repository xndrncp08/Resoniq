/**
 * Reads a newline-delimited JSON stream, calling `onEvent` for each line as
 * it arrives. Handles lines split across chunks and a last line without a
 * trailing newline. Used on the server (reading python-engine) and in the
 * browser (reading /api/analyze).
 */
export async function readNdjson<T = unknown>(body: ReadableStream<Uint8Array>, onEvent: (event: T) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    let newline: number;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) onEvent(JSON.parse(line) as T);
    }
    if (done) break;
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer) as T);
}

export const NDJSON = "application/x-ndjson";
