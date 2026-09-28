import { typedRequest } from "./generated/typed-request";

export const getModerationTransparency = (year: number | undefined) =>
  typedRequest("/transparency", { query: { year }, withAuth: false });
