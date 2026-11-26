import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { WebauthnLoginOptionsDto } from "../../auth/dto/webauthn-login-options.dto";
import { UpdateUsernameDto } from "./update-username.dto";

describe("UpdateUsernameDto", () => {
  it("stores a chosen username lowercase, as sign-in looks it up", async () => {
    const dto = plainToInstance(UpdateUsernameDto, { username: "  Alice " });

    expect(dto.username).toBe("alice");
    expect(await validate(dto)).toEqual([]);
  });
});

describe("WebauthnLoginOptionsDto", () => {
  it("lowercases the identifier like the password sign-in", () => {
    const dto = plainToInstance(WebauthnLoginOptionsDto, {
      identifier: "Alice@Example.com",
    });

    expect(dto.identifier).toBe("alice@example.com");
  });
});
