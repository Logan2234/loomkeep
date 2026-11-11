import { imageKey, stripAdultImages } from "./adult-images.util";

const TMDB_POSTER = "https://image.tmdb.org/t/p/w500/adult.jpg";
const IGDB_COVER =
  "https://images.igdb.com/igdb/image/upload/t_cover_big/co1.jpg";

describe("imageKey", () => {
  it("ignores the size TMDB and IGDB put in the path", () => {
    expect(imageKey(TMDB_POSTER)).toBe(
      imageKey("https://image.tmdb.org/t/p/w780/adult.jpg"),
    );
    expect(imageKey(IGDB_COVER)).toBe(
      imageKey("https://images.igdb.com/igdb/image/upload/t_thumb/co1.jpg"),
    );
  });

  it("keeps two different images apart", () => {
    expect(imageKey(TMDB_POSTER)).not.toBe(
      imageKey("https://image.tmdb.org/t/p/w500/other.jpg"),
    );
  });
});

describe("stripAdultImages", () => {
  const none = new Set<string>();

  it("clears every image and video of an 18+ work, nested ones included", () => {
    const details = {
      id: "m1",
      title: "Adult",
      isAdult: true,
      posterUrl: TMDB_POSTER,
      backdropUrl: "https://image.tmdb.org/t/p/w1280/b.jpg",
      trailerVideoId: "yt1",
      screenshots: ["https://image.tmdb.org/t/p/w780/s.jpg"],
      seasons: [
        { number: 1, posterUrl: "https://image.tmdb.org/t/p/w500/s1.jpg" },
      ],
    };

    expect(stripAdultImages(details, none)).toEqual({
      id: "m1",
      title: "Adult",
      isAdult: true,
      posterUrl: null,
      backdropUrl: null,
      trailerVideoId: null,
      screenshots: [],
      seasons: [{ number: 1, posterUrl: null }],
    });
  });

  it("leaves a work that isn't 18+ untouched", () => {
    const work = { isAdult: false, posterUrl: TMDB_POSTER };

    expect(stripAdultImages(work, none)).toEqual(work);
  });

  it("clears an 18+ work's image where the response doesn't say it is 18+", () => {
    const adultKeys = new Set([imageKey(IGDB_COVER)]);
    const message = {
      text: "Look at this",
      work: { id: "g1", imageUrl: IGDB_COVER },
      others: [{ imageUrl: "https://image.tmdb.org/t/p/w500/fine.jpg" }],
    };

    expect(stripAdultImages(message, adultKeys)).toEqual({
      text: "Look at this",
      work: { id: "g1", imageUrl: null },
      others: [{ imageUrl: "https://image.tmdb.org/t/p/w500/fine.jpg" }],
    });
  });

  it("passes a file or a date through instead of copying it", () => {
    const file = Buffer.from("csv");
    const date = new Date("2026-11-11");

    expect(stripAdultImages(file, none)).toBe(file);
    expect(stripAdultImages({ isAdult: true, at: date }, none)).toEqual({
      isAdult: true,
      at: date,
    });
  });

  it("never changes the object it was given", () => {
    const work = { isAdult: true, posterUrl: TMDB_POSTER };

    stripAdultImages(work, none);

    expect(work.posterUrl).toBe(TMDB_POSTER);
  });
});
