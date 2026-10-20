import type {
  FinishSessionTimerDto,
  StartSessionTimerDto,
} from "@loomkeep/shared";
import { typedRequest } from "./generated/typed-request";

export const getSessionTimer = () => typedRequest("/session-timer", {});

export const startSessionTimer = (body: StartSessionTimerDto) =>
  typedRequest("/session-timer", { method: "POST", body });

export const pauseSessionTimer = () =>
  typedRequest("/session-timer/pause", { method: "PATCH" });

export const resumeSessionTimer = () =>
  typedRequest("/session-timer/resume", { method: "PATCH" });

export const finishSessionTimer = (body: FinishSessionTimerDto) =>
  typedRequest("/session-timer/finish", { method: "POST", body });

export const cancelSessionTimer = (): Promise<void> =>
  typedRequest("/session-timer", { method: "DELETE" });
