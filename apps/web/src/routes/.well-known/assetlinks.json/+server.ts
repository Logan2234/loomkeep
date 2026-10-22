import { assetLinkStatements } from "#lib/native/asset-links.js";
import * as env from "$app/env/private";
import type { RequestHandler } from "./$types";

// 404 unless configured: a self-hosted instance has no app to vouch for.
export const GET: RequestHandler = () => {
  const statements = assetLinkStatements(env.ANDROID_APP_LINKS);
  if (statements.length === 0) return new Response(null, { status: 404 });

  return Response.json(statements);
};
