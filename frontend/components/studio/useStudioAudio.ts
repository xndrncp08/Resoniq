"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StudioStore } from "@/lib/stores/studio-store";
import type { StudioAudio } from "@/lib/studio/audio";

const MAX_IR_BYTES = 5 * 1024 * 1024;
const MAX_IR_SECONDS = 2;

export type SourceKind = "demo" | "file" | "live";
export type AudioStatus = { state: "off" | "starting" | "playing" | "error"; source: SourceKind | null; message: string | null; latencyMs: number | null };

/**
 * Owns the audio engine for one studio: created on the first Play (browsers
 * need a gesture), kept in step with the store, torn down on unmount. The
 * engine module itself only downloads when someone presses Play.
 */
export function useStudioAudio(store: StudioStore) {
  const engine = useRef<StudioAudio | null>(null);
  const demo = useRef<AudioBuffer | null>(null);
  const [status, setStatus] = useState<AudioStatus>({ state: "off", source: null, message: null, latencyMs: null });
  const [impulse, setImpulse] = useState<{ name: string; seconds: number } | null>(null);

  useEffect(() => {
    const unsub = store.subscribe((s, prev) => {
      if (s.patch !== prev.patch) engine.current?.apply(s.patch);
    });
    return () => {
      unsub();
      void engine.current?.dispose();
      engine.current = null;
    };
  }, [store]);

  const ensure = useCallback(async () => {
    if (!engine.current) {
      const { StudioAudio } = await import("@/lib/studio/audio");
      engine.current = new StudioAudio();
      engine.current.apply(store.getState().patch);
    }
    return engine.current;
  }, [store]);

  const start = useCallback(
    async (source: SourceKind, file?: File, deviceId?: string) => {
      setStatus((s) => ({ ...s, state: "starting", source, message: null }));
      try {
        const e = await ensure();
        if (source === "live") {
          await e.listen(deviceId);
        } else {
          let buffer: AudioBuffer;
          if (source === "file" && file) buffer = await e.ctx.decodeAudioData(await file.arrayBuffer());
          else {
            if (!demo.current) {
              const { demoRiff } = await import("@/lib/studio/dsp");
              const data = demoRiff(e.ctx.sampleRate);
              demo.current = e.ctx.createBuffer(1, data.length, e.ctx.sampleRate);
              demo.current.copyToChannel(data, 0);
            }
            buffer = demo.current;
          }
          await e.play(buffer);
        }
        setStatus({ state: "playing", source, message: null, latencyMs: e.latencyMs });
      } catch (err) {
        const name = err instanceof Error ? err.name : "";
        const message =
          name === "NotAllowedError" ? "Audio input permission was refused. Allow it in the browser's site settings to play live."
          : name === "NotFoundError" ? "No audio input was found. Connect an interface or mic and try again."
          : name === "EncodingError" ? "That file couldn't be decoded. Try an MP3, WAV or FLAC."
          : "Audio couldn't start in this browser.";
        setStatus({ state: "error", source, message, latencyMs: null });
      }
    },
    [ensure],
  );

  const stop = useCallback(() => {
    engine.current?.stopSource();
    setStatus((s) => ({ ...s, state: "off", message: null }));
  }, []);

  /** A cabinet IR from a WAV on this device. Kept for this session only; nothing is uploaded. */
  const loadImpulse = useCallback(
    async (file: File) => {
      if (file.size > MAX_IR_BYTES) throw new Error("That impulse response is over 5 MB; cabinet IRs are usually under 1 MB.");
      const e = await ensure();
      let buffer: AudioBuffer;
      try {
        buffer = await e.ctx.decodeAudioData(await file.arrayBuffer());
      } catch {
        throw new Error("That file couldn't be decoded. Cabinet IRs are usually WAV files.");
      }
      if (buffer.duration > MAX_IR_SECONDS) throw new Error("That's longer than a cabinet IR (over 2 seconds); try a reverb pedal for rooms.");
      e.setImpulse(buffer);
      setImpulse({ name: file.name, seconds: buffer.duration });
    },
    [ensure],
  );
  const clearImpulse = useCallback(() => {
    engine.current?.setImpulse(null);
    setImpulse(null);
  }, []);

  const readInput = useCallback(() => engine.current?.levels().input ?? { rms: -100, peak: -100 }, []);
  const readOutput = useCallback(() => engine.current?.levels().output ?? { rms: -100, peak: -100 }, []);

  return { status, start, stop, readInput, readOutput, impulse, loadImpulse, clearImpulse };
}
