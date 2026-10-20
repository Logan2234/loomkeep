import { furthestStatus } from "./entry-status.util";

describe("furthestStatus", () => {
  it("takes the incoming status for a new entry", () => {
    expect(furthestStatus(null, "PLANNED")).toBe("PLANNED");
  });

  it("never moves an entry back", () => {
    expect(furthestStatus("COMPLETED", "PLANNED")).toBe("COMPLETED");
    expect(furthestStatus("COMPLETED", "WATCHING")).toBe("COMPLETED");
    expect(furthestStatus("WATCHING", "PLANNED")).toBe("WATCHING");
  });

  it("moves an entry forward", () => {
    expect(furthestStatus("PLANNED", "WATCHING")).toBe("WATCHING");
    expect(furthestStatus("WATCHING", "COMPLETED")).toBe("COMPLETED");
  });

  it("keeps the user's own choice between statuses as far along", () => {
    expect(furthestStatus("DROPPED", "WATCHING")).toBe("DROPPED");
    expect(furthestStatus("UP_TO_DATE", "COMPLETED")).toBe("UP_TO_DATE");
  });
});
