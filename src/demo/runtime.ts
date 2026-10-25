import { useSyncExternalStore } from "react";
import { clock } from "@/core/clock/clock";
import { DemoRuntime } from "@/mocks/runtime/runtime";

/** One runtime for the whole demo, driven by the shared virtual clock. */
export const runtime = new DemoRuntime(clock);

export function useRuntime(): DemoRuntime {
  useSyncExternalStore(runtime.subscribe, runtime.getVersion);
  return runtime;
}
