import { ValidationPipe } from "@nestjs/common";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { IS_PUBLIC_KEY } from "../auth/decorators/public.decorator";
import type { MailService } from "../mail/mail.service";
import type { PrismaService } from "../prisma/prisma.service";
import { registerNewsletterFormParser } from "./newsletter-form-parser";
import { NewsletterController } from "./newsletter.controller";
import { NewsletterService } from "./newsletter.service";

describe("newsletter one-click HTTP endpoint", () => {
  let app: NestFastifyApplication;
  const prisma = { user: { findUnique: vi.fn(), update: vi.fn() } };
  const path = "/api/newsletter/unsubscribe/one-click?token=stable-token";

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [NewsletterController],
      providers: [
        {
          provide: NewsletterService,
          useValue: new NewsletterService(
            prisma as unknown as PrismaService,
            {} as MailService,
          ),
        },
      ],
    }).compile();
    app = module.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
      { logger: false },
    );
    app.setGlobalPrefix("api");
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    registerNewsletterFormParser(app.getHttpAdapter().getInstance());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({ id: "newsletter-user" });
    prisma.user.update.mockResolvedValue({});
  });
  afterAll(async () => {
    await app?.close();
  });

  it("is public, accepts repeated form posts without cookies and changes only newsletter preferences", async () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, NewsletterController)).toBe(true);

    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await app.inject({
        method: "POST",
        url: path,
        headers: { "content-type": "application/x-www-form-urlencoded" },
        payload: "List-Unsubscribe=One-Click",
      });
      expect(response.statusCode).toBe(204);
      expect(response.body).toBe("");
    }

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { newsletterUnsubscribeToken: "stable-token" },
    });
    expect(prisma.user.update).toHaveBeenCalledTimes(2);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "newsletter-user" },
      data: { notifyNewsletter: false },
    });
  });

  it("accepts the RFC multipart form format", async () => {
    const response = await app.inject({
      method: "POST",
      url: path,
      headers: {
        "content-type": "multipart/form-data; boundary=newsletter-test",
      },
      payload:
        '--newsletter-test\r\nContent-Disposition: form-data; name="List-Unsubscribe"\r\n\r\nOne-Click\r\n--newsletter-test--\r\n',
    });
    expect(response.statusCode).toBe(204);
    expect(prisma.user.update).toHaveBeenCalledOnce();
  });

  it.each([
    { url: path, payload: "List-Unsubscribe=Wrong" },
    { url: path, payload: "" },
    {
      url: "/api/newsletter/unsubscribe/one-click",
      payload: "List-Unsubscribe=One-Click",
    },
  ])(
    "rejects an incomplete or invalid request: $url $payload",
    async ({ url, payload }) => {
      const response = await app.inject({
        method: "POST",
        url,
        headers: { "content-type": "application/x-www-form-urlencoded" },
        payload,
      });
      expect(response.statusCode).toBe(400);
      expect(prisma.user.update).not.toHaveBeenCalled();
    },
  );

  it("does not unsubscribe on a GET or an unknown token", async () => {
    expect((await app.inject({ method: "GET", url: path })).statusCode).toBe(
      404,
    );
    prisma.user.findUnique.mockResolvedValue(null);
    const response = await app.inject({
      method: "POST",
      url: path,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: "List-Unsubscribe=One-Click",
    });
    expect(response.statusCode).toBe(401);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("keeps the original JSON footer endpoint and rejects multipart posts on it", async () => {
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/newsletter/unsubscribe",
          payload: { token: "stable-token" },
        })
      ).statusCode,
    ).toBe(201);
    prisma.user.update.mockClear();
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/newsletter/unsubscribe",
          headers: { "content-type": "multipart/form-data; boundary=test" },
          payload: "--test--\r\n",
        })
      ).statusCode,
    ).toBe(415);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("bounds form body size", async () => {
    expect(
      (
        await app.inject({
          method: "POST",
          url: path,
          headers: { "content-type": "application/x-www-form-urlencoded" },
          payload: "x".repeat(4097),
        })
      ).statusCode,
    ).toBe(413);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
