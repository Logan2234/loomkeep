/** A single external id a catalog provider resolved for one item, tagged with which source it came from. */
export interface ProviderExternalId<TSource> {
  source: TSource;
  externalId: string;
}
