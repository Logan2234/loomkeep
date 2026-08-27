import { HttpStatus } from "@nestjs/common";
import { IsEmail, IsIn, Matches, MinLength, validate } from "class-validator";
import "reflect-metadata";
import { ValidationException } from "./validation.exception";

class TestDto {
  @IsEmail()
  email!: string;

  @MinLength(8)
  password!: string;

  @IsIn(["MEDIA", "GAMES", "BOOKS", "MUSIC"])
  domain!: string;

  @Matches(/^[a-z]+$/)
  slug!: string;
}

describe("ValidationException", () => {
  it("attaches the failing constraint's raw arguments as positional params", async () => {
    const dto = Object.assign(new TestDto(), {
      email: "not-an-email",
      password: "short",
      domain: "NOPE",
      slug: "totally valid regex-wise? no",
    });
    const errors = await validate(dto);

    const exception = new ValidationException(errors);

    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    const byField = Object.fromEntries(
      exception.details.map((d) => [d.field, d]),
    );

    expect(byField.email).toEqual({
      field: "email",
      constraint: "isEmail",
      params: undefined,
    });
    expect(byField.password).toEqual({
      field: "password",
      constraint: "minLength",
      params: [8],
    });
    expect(byField.domain.params).toEqual(["MEDIA, GAMES, BOOKS, MUSIC"]);
  });

  it("never leaks a RegExp constraint argument", async () => {
    const dto = Object.assign(new TestDto(), {
      email: "a@b.com",
      password: "longenough",
      domain: "MEDIA",
      slug: "Not Valid!!",
    });
    const errors = await validate(dto);

    const exception = new ValidationException(errors);
    const slugDetail = exception.details.find((d) => d.field === "slug");

    expect(slugDetail).toEqual({
      field: "slug",
      constraint: "matches",
      params: undefined,
    });
  });
});
