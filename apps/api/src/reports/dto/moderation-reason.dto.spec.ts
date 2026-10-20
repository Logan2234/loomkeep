import { validate } from "class-validator";
import "reflect-metadata";
import { ModerationReasonBody } from "./moderation-reason.dto";

const body = (fields: Partial<ModerationReasonBody>) =>
  Object.assign(new ModerationReasonBody(), {
    reasonText: "Lien vers un site de streaming illégal.",
    ...fields,
  });

describe("ModerationReasonBody", () => {
  it("needs no CGU clause when the measure rests on illegality", async () => {
    const errors = await validate(
      body({ legalBasis: "ILLEGAL_CONTENT", tosClause: "" }),
    );

    expect(errors).toEqual([]);
  });

  it("still needs the CGU clause for a terms breach", async () => {
    const errors = await validate(
      body({ legalBasis: "TOS_BREACH", tosClause: "" }),
    );

    expect(errors.map((e) => e.property)).toEqual(["tosClause"]);
  });
});
