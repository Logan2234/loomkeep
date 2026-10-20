import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { Public } from "../../auth/decorators/public.decorator";
import { hashApiKey } from "../api-key-auth.service";
import { isWellFormedApiKey } from "../api-key-format";
import { ApiKeysService } from "../api-keys.service";
import { GithubSignatureGuard } from "./github-signature.guard";

interface SecretScanningAlert {
  token: string;
  type: string;
  /** Where GitHub found it; may be empty. */
  url?: string;
  source?: string;
}

interface SecretScanningFeedback {
  token_hash: string;
  token_type: string;
  label: "true_positive" | "false_positive";
}

/**
 * GitHub's secret scanning partner endpoint: GitHub posts the `lk_` keys it
 * finds in public (repositories, gists, npm packages, issues…), signed with
 * its own key. Every one that is still ours is revoked on the spot and its
 * owner told. Only the hosted instance is registered with GitHub, so on a
 * self-hosted one this route simply never gets called.
 */
@ApiExcludeController()
@Public()
@UseGuards(GithubSignatureGuard)
@Controller("integrations/github")
export class SecretScanningController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  /** The answer is GitHub's optional feedback, which tunes its matching. */
  @Post("secret-scanning")
  @HttpCode(HttpStatus.OK)
  async alerts(@Body() body: unknown): Promise<SecretScanningFeedback[]> {
    const alerts = Array.isArray(body) ? body.filter(isAlert) : [];
    const feedback: SecretScanningFeedback[] = [];

    for (const alert of alerts) {
      const verdict = (label: SecretScanningFeedback["label"]) =>
        feedback.push({
          token_hash: hashApiKey(alert.token),
          token_type: alert.type,
          label,
        });

      if (!isWellFormedApiKey(alert.token)) {
        verdict("false_positive");
      } else if (
        await this.apiKeys.revokeLeaked(alert.token, alert.url || null)
      ) {
        verdict("true_positive");
      }
    }

    return feedback;
  }
}

function isAlert(value: unknown): value is SecretScanningAlert {
  const alert = value as Partial<SecretScanningAlert> | null;
  return typeof alert?.token === "string" && typeof alert.type === "string";
}
