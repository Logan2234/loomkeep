import { ErrorCode } from "@loomkeep/shared";
import { HttpStatus } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { vi } from "vitest";
import { InstancePingRequestDto } from "./dto/instance-ping-request.dto";
import { InstancePingController } from "./instance-ping.controller";
import type { InstancePingService } from "./instance-ping.service";

const PING = {
  instanceId: "0b6f3c3e-8d4a-4f7e-9a51-2c1d5e7f9a10",
  version: "1.14.0",
};

function make(isReceiver: boolean) {
  const pings = {
    isReceiver: () => isReceiver,
    record: vi.fn().mockResolvedValue("1.15.0"),
  } as unknown as InstancePingService;
  return { controller: new InstancePingController(pings), pings };
}

describe("InstancePingController", () => {
  it("answers the latest version on the hosted instance", async () => {
    const { controller } = make(true);

    await expect(controller.ping(PING)).resolves.toEqual({
      latestVersion: "1.15.0",
    });
  });

  it("answers 404 on a self-host and records nothing", async () => {
    const { controller, pings } = make(false);

    await expect(controller.ping(PING)).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
      code: ErrorCode.AdminInstancePingsNotReceived,
    });
    expect(pings.record).not.toHaveBeenCalled();
  });
});

describe("InstancePingRequestDto", () => {
  async function errors(body: Record<string, unknown>) {
    return validate(plainToInstance(InstancePingRequestDto, body));
  }

  it("accepts a v4 id and an x.y.z version", async () => {
    await expect(errors(PING)).resolves.toHaveLength(0);
  });

  it.each([
    ["an id that isn't a UUID", { ...PING, instanceId: "my-server" }],
    ["a version that isn't x.y.z", { ...PING, version: "v1.14.0" }],
    ["a missing version", { instanceId: PING.instanceId }],
  ])("rejects %s", async (_, body) => {
    await expect(errors(body)).resolves.not.toHaveLength(0);
  });
});
