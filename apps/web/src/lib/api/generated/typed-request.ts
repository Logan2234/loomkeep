import { request } from "../core";
import type { paths } from "./schema";

type ApiPath = keyof paths;
type WebPath = ApiPath extends `/api${infer Rest}` ? Rest : never;
type OperationsFor<P extends WebPath> = paths[`/api${P}`];

type ReverseMethodMap = {
  GET: "get";
  POST: "post";
  PUT: "put";
  PATCH: "patch";
  DELETE: "delete";
};

type SuccessBody<Responses> = Responses extends {
  200: { content: { "application/json": infer R } };
}
  ? R
  : Responses extends { 201: { content: { "application/json": infer R } } }
    ? R
    : undefined;

/** Names of every `{param}`-style segment in a path, e.g. "{id}/episodes" -> "id". */
type PathParamNames<P extends string> =
  P extends `${string}{${infer Name}}${infer Rest}`
    ? Name | PathParamNames<Rest>
    : never;

type PathParams<P extends string> = Record<PathParamNames<P>, string>;

function interpolatePath(path: string, params: Record<string, string>): string {
  return path.replace(/\{(\w+)\}/g, (_match, name: string) =>
    encodeURIComponent(params[name]),
  );
}

type RequestOptions<Verb> = {
  method?: Verb;
  body?: unknown;
  /** Set to false for auth endpoints. */
  withAuth?: boolean;
};

export function typedRequest<
  P extends WebPath,
  Verb extends keyof ReverseMethodMap = "GET",
>(
  path: P,
  ...args: keyof PathParams<P> extends never
    ? [options?: RequestOptions<Verb>]
    : [options: RequestOptions<Verb> & { params: PathParams<P> }]
): Promise<
  ReverseMethodMap[Verb] extends keyof OperationsFor<P>
    ? OperationsFor<P>[ReverseMethodMap[Verb]] extends { responses: infer R }
      ? SuccessBody<R>
      : never
    : never
> {
  const [options] = args;
  const params = (options as { params?: Record<string, string> } | undefined)
    ?.params;
  const url = params ? interpolatePath(path, params) : path;
  return request(url, options as Parameters<typeof request>[1]);
}
