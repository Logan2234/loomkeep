/**
 * Decorative poster wall behind the hero — real cover art from the same
 * providers the app queries live (TMDB, AniList, Open Library, MusicBrainz),
 * not invented artwork. Games have no public, key-free cover source, so they
 * fall back to Poster's gradient like they do in the real library.
 */
export const LANDING_LIBRARY: {
  title: string;
  cover: string | null;
}[] = [
  {
    title: "Severance",
    cover: "https://image.tmdb.org/t/p/w500/xmjW474DJ27bqTYNvS4MvraJgiQ.jpg",
  },
  {
    title: "Frieren",
    cover:
      "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-qQTzQnEJJ3oB.jpg",
  },
  {
    title: "Piranesi",
    cover: "https://covers.openlibrary.org/b/id/10226290-L.jpg",
  },
  { title: "Blue Prince", cover: null },
  {
    title: "Andor",
    cover: "https://image.tmdb.org/t/p/w500/wj0F4fU0jdsZI1cjiUSfeuE28y1.jpg",
  },
  {
    title: "BRAT",
    cover:
      "https://coverartarchive.org/release-group/e0fdb431-0109-420d-8a37-f99eaeb4d671/front-250",
  },
  {
    title: "Dune, deuxième partie",
    cover: "https://image.tmdb.org/t/p/w500/iRNbRAIGQQr5diGnjpwJFm0dgt4.jpg",
  },
  {
    title: "La Horde du Contrevent",
    cover: "https://covers.openlibrary.org/b/id/6670450-L.jpg",
  },
  {
    title: "The Bear",
    cover: "https://image.tmdb.org/t/p/w500/iaJfffjCqXATU5msr4PAgOWLMl4.jpg",
  },
  {
    title: "Chainsaw Man",
    cover:
      "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx127230-DdP4vAdssLoz.png",
  },
  {
    title: "In Rainbows",
    cover:
      "https://coverartarchive.org/release-group/6e335887-60ba-38f0-95af-fae7774336bf/front-250",
  },
  { title: "Hollow Knight: Silksong", cover: null },
  {
    title: "Arcane",
    cover: "https://image.tmdb.org/t/p/w500/ypS7R36Vjcn51zZsXsta5onnaCo.jpg",
  },
  {
    title: "Project Hail Mary",
    cover: "https://covers.openlibrary.org/b/id/11200092-L.jpg",
  },
  {
    title: "Everything Everywhere All at Once",
    cover: "https://image.tmdb.org/t/p/w500/qHy7BlA1I3iUEIGp7atsMjSNJSK.jpg",
  },
  {
    title: "Cyberpunk: Edgerunners",
    cover:
      "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx120377-ayZPoxiWt4Li.jpg",
  },
  {
    title: "Shōgun",
    cover: "https://image.tmdb.org/t/p/w500/7O4iVfOMQmdCSxhOg1WnzG1AgYT.jpg",
  },
  {
    title: "Random Access Memories",
    cover:
      "https://coverartarchive.org/release-group/aa997ea0-2936-40bd-884d-3af8a0e064dc/front-250",
  },
  {
    title: "Silo",
    cover: "https://image.tmdb.org/t/p/w500/dxktdopZCOlff10ocoEdn2TXBzl.jpg",
  },
  {
    title: "Vinland Saga",
    cover:
      "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101348-2fhDFPCuMNiz.jpg",
  },
  {
    title: "Le Nom du vent",
    cover: "https://covers.openlibrary.org/b/id/11480483-L.jpg",
  },
  {
    title: "Past Lives",
    cover: "https://image.tmdb.org/t/p/w500/aFAANQwb3dYudPHXaQZX5NwVuTO.jpg",
  },
  {
    title: "Blonde",
    cover:
      "https://coverartarchive.org/release-group/0da340a0-6ad7-4fc2-a272-6f94393a7831/front-250",
  },
  { title: "Outer Wilds", cover: null },
];
