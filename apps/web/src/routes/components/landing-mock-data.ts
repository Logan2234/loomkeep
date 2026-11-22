/**
 * Decorative poster wall behind the hero — real cover art from the same
 * providers the app queries live (TMDB, IGDB, Open Library, MusicBrainz),
 * not invented artwork. Titles without a cover fall back to
 * Poster's gradient like they do in the real library. Each URL asks for the
 * smallest size its CDN offers that still fills a cell (w342, medium, -M):
 * the wall weighs half what it did with the large sizes.
 */
export const LANDING_LIBRARY: {
  title: string;
  cover: string | null;
}[] = [
  {
    title: "Severance",
    cover: "https://image.tmdb.org/t/p/w342/xmjW474DJ27bqTYNvS4MvraJgiQ.jpg",
  },
  {
    title: "Frieren",
    cover: "https://image.tmdb.org/t/p/w342/dqZENchTd7lp5zht7BdlqM7RBhD.jpg",
  },
  {
    title: "Piranesi",
    cover: "https://covers.openlibrary.org/b/id/10226290-M.jpg",
  },
  {
    title: "Blue Prince",
    cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co9mzd.jpg",
  },
  {
    title: "Andor",
    cover: "https://image.tmdb.org/t/p/w342/wj0F4fU0jdsZI1cjiUSfeuE28y1.jpg",
  },
  {
    title: "BRAT",
    cover:
      "https://coverartarchive.org/release-group/e0fdb431-0109-420d-8a37-f99eaeb4d671/front-250",
  },
  {
    title: "Dune, deuxième partie",
    cover: "https://image.tmdb.org/t/p/w342/iRNbRAIGQQr5diGnjpwJFm0dgt4.jpg",
  },
  {
    title: "La Horde du Contrevent",
    cover: "https://covers.openlibrary.org/b/id/6670450-M.jpg",
  },
  {
    title: "The Bear",
    cover: "https://image.tmdb.org/t/p/w342/iaJfffjCqXATU5msr4PAgOWLMl4.jpg",
  },
  {
    title: "Chainsaw Man",
    cover: "https://image.tmdb.org/t/p/w342/npdB6eFzizki0WaZ1OvKcJrWe97.jpg",
  },
  {
    title: "In Rainbows",
    cover:
      "https://coverartarchive.org/release-group/6e335887-60ba-38f0-95af-fae7774336bf/front-250",
  },
  {
    title: "Hollow Knight: Silksong",
    cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/cobebu.jpg",
  },
  {
    title: "Arcane",
    cover: "https://image.tmdb.org/t/p/w342/ypS7R36Vjcn51zZsXsta5onnaCo.jpg",
  },
  {
    title: "Project Hail Mary",
    cover: "https://covers.openlibrary.org/b/id/11200092-M.jpg",
  },
  {
    title: "Everything Everywhere All at Once",
    cover: "https://image.tmdb.org/t/p/w342/qHy7BlA1I3iUEIGp7atsMjSNJSK.jpg",
  },
  {
    title: "Cyberpunk: Edgerunners",
    cover: "https://image.tmdb.org/t/p/w342/v3JuB15WybKmxDeT1hWdK3j6eSJ.jpg",
  },
  {
    title: "Shōgun",
    cover: "https://image.tmdb.org/t/p/w342/7O4iVfOMQmdCSxhOg1WnzG1AgYT.jpg",
  },
  {
    title: "Random Access Memories",
    cover:
      "https://coverartarchive.org/release-group/aa997ea0-2936-40bd-884d-3af8a0e064dc/front-250",
  },
  {
    title: "Silo",
    cover: "https://image.tmdb.org/t/p/w342/dxktdopZCOlff10ocoEdn2TXBzl.jpg",
  },
  {
    title: "Vinland Saga",
    cover: "https://image.tmdb.org/t/p/w342/vUHlpA5c1NXkds59reY3HMb4Abs.jpg",
  },
  {
    title: "Le Nom du vent",
    cover: "https://covers.openlibrary.org/b/id/11480483-M.jpg",
  },
  {
    title: "Past Lives",
    cover: "https://image.tmdb.org/t/p/w342/aFAANQwb3dYudPHXaQZX5NwVuTO.jpg",
  },
  {
    title: "Blonde",
    cover:
      "https://coverartarchive.org/release-group/0da340a0-6ad7-4fc2-a272-6f94393a7831/front-250",
  },
  {
    title: "Outer Wilds",
    cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co65ac.jpg",
  },
];
