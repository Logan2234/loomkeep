import { NestFactory } from "@nestjs/core";
import { SpelunkerModule } from "nestjs-spelunker";
import { mkdirSync, writeFileSync } from "node:fs";
import "reflect-metadata";
import { AppModule } from "../src/app.module";

/** Dumps the module dependency graph as a Mermaid file (docs/modules.md) */
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const tree = SpelunkerModule.explore(app);
  const root = SpelunkerModule.graph(tree);
  const edges = SpelunkerModule.findGraphEdges(root);

  const lines = [
    ...new Set(
      edges.map((e) => `  ${e.from.module.name} --> ${e.to.module.name}`),
    ),
  ];
  const mermaid = ["```mermaid", "graph LR", ...lines, "```", ""].join("\n");

  mkdirSync("../../docs", { recursive: true });
  writeFileSync("../../docs/modules.md", mermaid);
  await app.close();
  process.exit(0);
}

void main();
