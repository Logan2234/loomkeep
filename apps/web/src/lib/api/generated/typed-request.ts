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

type OperationFor<
  P extends WebPath,
  Verb extends keyof ReverseMethodMap,
> = ReverseMethodMap[Verb] extends keyof OperationsFor<P>
  ? OperationsFor<P>[ReverseMethodMap[Verb]]
  : never;

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

/** The `query` object an operation's schema declares, or `never` when it has none. */
type QueryOf<P extends WebPath, Verb extends keyof ReverseMethodMap> =
  OperationFor<P, Verb> extends { parameters: { query?: infer Q } } ? Q : never;

/** True when Q has at least one required key — an all-optional (or `never`) query is omittable. */
type QueryIsRequired<Q> = [Q] extends [never]
  ? false
  : Partial<Q> extends Q
    ? false
    : true;

type QueryOption<Q> =
  QueryIsRequired<Q> extends true ? { query: Q } : { query?: Q };

function buildQueryString(query: Record<string, unknown> | undefined): string {
  if (!query) return "";
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;

    if (Array.isArray(value)) {
      for (const v of value) params.append(key, String(v));
    } else {
      params.set(key, String(value));
    }
  }

  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

type RequestOptions<P extends WebPath, Verb extends keyof ReverseMethodMap> = {
  method?: Verb;
  body?: unknown;
  /** Set to false for auth endpoints. */
  withAuth?: boolean;
} & QueryOption<QueryOf<P, Verb>>;

type ParamsOption<P extends WebPath> = keyof PathParams<P> extends never
  ? unknown
  : { params: PathParams<P> };

type FullOptions<
  P extends WebPath,
  Verb extends keyof ReverseMethodMap,
> = RequestOptions<P, Verb> & ParamsOption<P>;

// The whole options argument can be omitted only when neither path params nor
// a required query are in play — otherwise `options?: FullOptions` would let
// a caller skip it entirely and silently drop a mandatory `params`/`query`.
type OptionsIsOptional<
  P extends WebPath,
  Verb extends keyof ReverseMethodMap,
> = keyof PathParams<P> extends never
  ? QueryIsRequired<QueryOf<P, Verb>> extends true
    ? false
    : true
  : false;

export function typedRequest<
  P extends WebPath,
  Verb extends keyof ReverseMethodMap = "GET",
>(
  path: P,
  ...args: OptionsIsOptional<P, Verb> extends true
    ? [options?: FullOptions<P, Verb>]
    : [options: FullOptions<P, Verb>]
): Promise<
  ReverseMethodMap[Verb] extends keyof OperationsFor<P>
    ? OperationsFor<P>[ReverseMethodMap[Verb]] extends { responses: infer R }
      ? SuccessBody<R>
      : never
    : never
> {
  const [options] = args;
  const opts = options as
    | { params?: Record<string, string>; query?: Record<string, unknown> }
    | undefined;
  const interpolated = opts?.params ? interpolatePath(path, opts.params) : path;
  const url = interpolated + buildQueryString(opts?.query);
  return request(url, options as Parameters<typeof request>[1]);
}
