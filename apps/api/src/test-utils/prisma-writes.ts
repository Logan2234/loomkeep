import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = join(__dirname, "..");
const SCHEMA_DIR = join(SRC, "..", "prisma", "schema");

const WRITE_OPS =
  "create|createMany|createManyAndReturn|update|updateMany|updateManyAndReturn|upsert|delete|deleteMany";

/** A Prisma write found in the source: `this.prisma.user.update({ … })`. */
export interface PrismaWrite {
  /** Path from src/, e.g. `auth/auth.service.ts`. */
  file: string;
  line: number;
  /** The client's accessor, e.g. `user`, `mediaEntry`. */
  model: string;
  op: string;
  /** The call's argument text, between its parentheses. */
  args: string;
}

/**
 * Every model of the schema, keyed by its client accessor (`mediaEntry`),
 * with the schema file it is declared in (`library`).
 */
export function schemaModels(): Map<string, string> {
  const models = new Map<string, string>();

  for (const file of readdirSync(SCHEMA_DIR)) {
    if (!file.endsWith(".prisma")) continue;
    const source = readFileSync(join(SCHEMA_DIR, file), "utf-8");

    for (const [, name] of source.matchAll(/^model (\w+)/gm)) {
      models.set(name[0].toLowerCase() + name.slice(1), file.slice(0, -7));
    }
  }

  return models;
}

/**
 * The Prisma writes of src/, tests excluded. A static scan: it sees the
 * calls written `<client>.<model>.<op>(…)`, which is how every write here is
 * written, not a model reached through a variable.
 */
export function prismaWrites(): PrismaWrite[] {
  const models = schemaModels();
  const call = new RegExp(`\\.(\\w+)\\s*\\.\\s*(${WRITE_OPS})\\s*\\(`, "g");
  return sourceFiles(SRC).flatMap((path) => {
    const source = readFileSync(path, "utf-8");
    return [...source.matchAll(call)]
      .filter(([, model]) => models.has(model))
      .map((match) => {
        const open = match.index + match[0].length - 1;
        return {
          file: relative(SRC, path),
          line: source.slice(0, match.index).split("\n").length,
          model: match[1],
          op: match[2],
          args: source.slice(open + 1, closingParen(source, open)),
        };
      });
  });
}

function closingParen(source: string, open: number): number {
  let depth = 0;

  for (let i = open; i < source.length; i++) {
    if (source[i] === "(") depth++;
    else if (source[i] === ")" && --depth === 0) return i;
  }

  return source.length;
}

/** The .ts files of src/, tests and these helpers excluded. */
export function sourceFiles(dir = SRC): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      return entry.name === "test-utils" ? [] : sourceFiles(full);
    }

    return entry.name.endsWith(".ts") && !entry.name.endsWith(".spec.ts")
      ? [full]
      : [];
  });
}
