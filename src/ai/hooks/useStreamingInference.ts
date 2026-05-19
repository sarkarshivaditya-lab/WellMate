import React from "react";
import type { InferenceResult, InferenceStatus } from "../runtime/types";
import { submitInference } from "../orchestration/orchestrator";

export type StreamingInferenceState = {
  status: InferenceStatus;
  streamedText: string;
  run: (opts: {
    prompt: string;
    systemContext?: string;
    maxTokens?: number;
    temperature?: number;
  }) => Promise<InferenceResult | null>;
  cancel: () => void;
  reset: () => void;
};

export function useStreamingInference(): StreamingInferenceState {
  const [status, setStatus] = React.useState<InferenceStatus>({ phase: "idle" });
  const [streamedText, setStreamedText] = React.useState("");
  const controllerRef = React.useRef<AbortController | null>(null);

  const run = React.useCallback(
    async (opts: {
      prompt: string;
      systemContext?: string;
      maxTokens?: number;
      temperature?: number;
    }): Promise<InferenceResult | null> => {
      controllerRef.current?.abort();

      const controller = new AbortController();
      controllerRef.current = controller;

      const requestId = crypto.randomUUID();
      setStreamedText("");
      setStatus({ phase: "queued", position: 0 });

      try {
        setStatus({ phase: "running", requestId });

        const result = await submitInference({
          id: requestId,
          prompt: opts.prompt,
          systemContext: opts.systemContext,
          maxTokens: opts.maxTokens ?? 256,
          temperature: opts.temperature ?? 0.7,
          priority: "normal",
          controller,
          onToken: (token) => {
            setStreamedText((prev) => prev + token);
          },
        });

        setStatus({ phase: "complete", result });
        return result;
      } catch (err) {
        if (controller.signal.aborted) {
          setStatus({ phase: "cancelled" });
          return null;
        }
        setStatus({
          phase: "failed",
          error: err instanceof Error ? err.message : String(err),
        });
        return null;
      }
    },
    [],
  );

  const cancel = React.useCallback(() => {
    controllerRef.current?.abort();
    setStatus({ phase: "cancelled" });
  }, []);

  const reset = React.useCallback(() => {
    setStatus({ phase: "idle" });
    setStreamedText("");
  }, []);

  return { status, streamedText, run, cancel, reset };
}
