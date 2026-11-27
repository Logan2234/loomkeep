import { describe, expect, it } from "vitest";
import { mailInboxFor } from "./mail-inbox";

describe("mailInboxFor", () => {
  it("finds the webmail of a well-known domain, whatever its case", () => {
    expect(mailInboxFor("Alice.Martin@GMail.com")?.name).toBe("Gmail");
    expect(mailInboxFor("alice@hotmail.fr")?.name).toBe("Outlook");
  });

  it("offers nothing for a domain it doesn't know", () => {
    expect(mailInboxFor("alice@loomkeep.app")).toBeNull();
  });
});
