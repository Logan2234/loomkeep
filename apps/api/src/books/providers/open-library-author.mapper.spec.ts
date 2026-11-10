import { describe, expect, it } from "vitest";
import {
  authorDate,
  editionTitle,
  type OpenLibraryAuthorWork,
  toAuthorPage,
} from "./open-library-author.mapper";

const PRATCHETT = "OL25712A";

// Trimmed from `search.json?q=author_key:OL25712A&lang=fr` (2026-11).
const work = (
  id: string,
  title: string,
  extra: Partial<OpenLibraryAuthorWork> = {},
): OpenLibraryAuthorWork => ({
  key: `/works/${id}`,
  title,
  author_key: [PRATCHETT],
  first_publish_year: 1990,
  edition_count: 30,
  ...extra,
});

const french = (title: string) => ({
  editions: { docs: [{ title, language: ["fre"] }] },
});

const docs: OpenLibraryAuthorWork[] = [
  work("OL450125W", "The Colour of Magic", {
    first_publish_year: 1983,
    edition_count: 93,
    cover_i: 6596441,
    series_key: ["OL339711L"],
    series_name: ["Discworld"],
    series_position: ["1"],
    ...french("La huitième couleur"),
  }),
  // Its only nested edition is Polish: the original title reads better.
  work("OL450078W", "Interesting Times", {
    edition_count: 45,
    series_key: ["OL339711L"],
    series_name: ["Discworld"],
    series_position: ["17"],
    editions: { docs: [{ title: "Ciekawe czasy", language: ["pol"] }] },
  }),
  // A novel credited with its illustrators: the author still comes first.
  work("OL17865106W", "The Shepherd's Crown", {
    first_publish_year: 2015,
    edition_count: 23,
    author_key: [PRATCHETT, "OL1", "OL2", "OL3"],
  }),
  work("OL450063W", "Mort", { edition_count: 61 }),
  // The same book catalogued twice.
  work("OL20628413W", "Mort [graphic novel]", { edition_count: 1 }),
  work("OL450070W", "Legends", {
    edition_count: 4,
    author_key: ["OL19981A", PRATCHETT, "OL3", "OL4"],
  }),
  work("OL450071W", "The Colour of Magic / The Light Fantastic", {
    edition_count: 12,
  }),
  work(
    "OL450072W",
    "Pratchett Fiction Collection Eight-Book Set (Night Watch, Truth)",
    {
      edition_count: 1,
    },
  ),
  work("OL450073W", "Seriously Funny", { edition_count: 2 }),
  // Recent, so too new to have many editions.
  work("OL450074W", "A Stroke of the Pen", {
    first_publish_year: 2023,
    edition_count: 1,
  }),
  ...["Pyramids", "Eric", "Sourcery", "Jingo", "Hogfather", "Snuff"].map(
    (title, i) => work(`OL4501${i}0W`, title, { edition_count: 20 + i }),
  ),
];

const author = {
  name: "Terry Pratchett",
  alternate_names: ["Terence David John Pratchett", "Terry Pratchett"],
  bio: { value: "English novelist, known for [Discworld](https://x)." },
  birth_date: "28 April 1948",
  death_date: "12 March 2015",
  photos: [-1, 14852573],
  remote_ids: { wikidata: "Q46248", imdb: "nm0695332" },
};

const page = () => toAuthorPage(PRATCHETT, author, docs, "fr", 2026);
const titles = () =>
  Object.fromEntries(page().groups[0].works.map((w) => [w.title, w.kind]));

describe("toAuthorPage", () => {
  it("keeps the books people know, titled in French when a French edition exists", () => {
    expect(titles()).toMatchObject({
      "La huitième couleur": "WORK",
      "Interesting Times": "WORK",
      "The Shepherd's Crown": "WORK",
      Mort: "WORK",
      "A Stroke of the Pen": "WORK",
    });
  });

  it("sets collections apart and counts what it leaves out", () => {
    const result = page();

    expect(titles()).toMatchObject({
      Legends: "ANTHOLOGY",
      "The Colour of Magic / The Light Fantastic": "OMNIBUS",
    });
    // The duplicate Mort, the one-off box set and Seriously Funny.
    expect(Object.keys(titles())).not.toContain("Seriously Funny");
    expect(result.rareCount).toBe(3);
  });

  it("gives each book its series and edition count", () => {
    const colour = page().groups[0].works.find(
      (w) => w.sourceId === "OL450125W",
    );

    expect(colour).toMatchObject({
      domain: "BOOKS",
      type: null,
      year: 1983,
      editionCount: 93,
      series: { key: "OL339711L", name: "Discworld", position: 1 },
      posterUrl: "https://covers.openlibrary.org/b/id/6596441-L.jpg",
    });
  });

  it("shows everything for an author with few known books", () => {
    const result = toAuthorPage(
      "OL10336604A",
      { name: "Clément Viktorovitch" },
      [
        work("OL1W", "Le Pouvoir rhétorique", {
          author_key: ["OL10336604A"],
          first_publish_year: 2021,
          edition_count: 1,
        }),
        work("OL2W", "Logocratie", {
          author_key: ["OL10336604A"],
          first_publish_year: 2025,
          edition_count: 1,
        }),
      ],
      "fr",
      2026,
    );

    expect(result.groups[0].works.map((w) => w.title)).toEqual([
      "Le Pouvoir rhétorique",
      "Logocratie",
    ]);
    expect(result.rareCount).toBe(0);
  });

  it("reads the author's identity", () => {
    expect(page()).toMatchObject({
      source: "openlibrary",
      name: "Terry Pratchett",
      photoUrl: "https://covers.openlibrary.org/a/id/14852573-L.jpg",
      description: "English novelist, known for Discworld.",
      birthday: "1948-04-28",
      deathday: "2015-03-12",
      knownFor: "WRITING",
      alsoKnownAs: ["Terence David John Pratchett"],
      imdbId: "nm0695332",
      wikidataId: "Q46248",
    });
  });
});

describe("authorDate", () => {
  it("reads Open Library's free-text dates", () => {
    expect(authorDate("7 Jun 1957")).toBe("1957-06-07");
    expect(authorDate("September 21, 1947")).toBe("1947-09-21");
    expect(authorDate("1929")).toBe("1929");
    expect(authorDate("c. 1500")).toBeNull();
    expect(authorDate(undefined)).toBeNull();
  });
});

describe("editionTitle", () => {
  it("drops a collection and volume prefix, and a language note", () => {
    expect(
      editionTitle("Les Annales du disque-monde. Tome VIII. Au guet !"),
    ).toBe("Au guet !");
    expect(
      editionTitle(
        "Les annales du Disque-monde. [10], Les zinzins d'Olive-Oued",
      ),
    ).toBe("Les zinzins d'Olive-Oued");
    expect(editionTitle("Le Peuple Du Tapis (French Edition)")).toBe(
      "Le Peuple Du Tapis",
    );
  });

  it("leaves an ordinary title alone", () => {
    expect(editionTitle("Au guet !")).toBe("Au guet !");
    expect(editionTitle("Dune : Le Messie")).toBe("Dune : Le Messie");
    expect(editionTitle("11/22/63")).toBe("11/22/63");
  });
});
