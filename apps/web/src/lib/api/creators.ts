import type {
  CreatorSource,
  StudioKind,
  StudioWorkOrder,
} from "@loomkeep/shared/contracts";
import { getLocale } from "../paraglide/runtime.js";
import { typedRequest } from "./generated/typed-request";

/** A person's page: identity and works, each with the viewer's status. */
export const getPersonPage = (source: CreatorSource, id: string) =>
  typedRequest("/creators/{source}/person/{id}", {
    params: { source, id },
    query: { lang: getLocale() },
  });

/** A production company's or a network's page: identity, counts, best known titles. */
export const getStudioPage = (
  kind: StudioKind,
  source: CreatorSource,
  id: string,
) =>
  kind === "NETWORK"
    ? typedRequest("/creators/{source}/network/{id}", {
        params: { source, id },
        query: { lang: getLocale() },
      })
    : typedRequest("/creators/{source}/company/{id}", {
        params: { source, id },
        query: { lang: getLocale() },
      });

/** One page of a studio's films or series, 20 at a time. */
export const getStudioWorks = (
  kind: StudioKind,
  source: CreatorSource,
  id: string,
  query: { type: "MOVIE" | "SERIES"; order: StudioWorkOrder; page: number },
) => {
  const options = {
    params: { source, id },
    query: { ...query, page: String(query.page), lang: getLocale() },
  };
  return kind === "NETWORK"
    ? typedRequest("/creators/{source}/network/{id}/works", options)
    : typedRequest("/creators/{source}/company/{id}/works", options);
};
