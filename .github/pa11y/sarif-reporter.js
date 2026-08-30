"use strict";

// pa11y-ci reporter (see .pa11yci.json's defaults.reporters) that writes the
// run's issues as SARIF, so accessibility findings land in GitHub Code
// Scanning next to ESLint/CodeQL/Trivy/Scorecard/ZAP instead of only ever
// existing in the CI log. pa11y-ci has no built-in SARIF reporter — this is
// a plain CommonJS module per its documented `--reporter <path>` /
// `defaults.reporters` loading (lib/helpers/loader.js: require(path)).
//
// Reporter shape: lib/pa11y-ci.js only ever calls afterAll(report) with the
// full run — no incremental writes needed.

const fs = require("fs");
const path = require("path");

const OUTPUT_FILE =
  process.env.PA11Y_SARIF_OUTPUT ||
  path.join(process.cwd(), "pa11y-results.sarif");

// pa11y issue.type is "error" | "warning" | "notice".
const LEVEL_BY_TYPE = { error: "error", warning: "warning", notice: "note" };

// Code Scanning's upload-sarif step always sends a file:// checkoutURI (it
// defaults checkout_path to the job's own workspace) and the server rejects
// the whole upload if any result's artifactLocation.uri is absolute with a
// different scheme — "SARIF URI scheme https did not match the checkout URI
// scheme file". A relative, repo-path-shaped location is the only kind
// Code Scanning accepts, even though these pages aren't real files —
// GitHub still lists the alert, just without an inline code snippet.
function relativeLocation(url) {
  const { pathname } = new URL(url);
  const slug = pathname === "/" ? "index" : pathname.replace(/^\//, "");
  return `pa11y-pages/${slug}`;
}

function toSarif(report) {
  const rulesByCode = new Map();
  const results = [];

  for (const [url, issues] of Object.entries(report.results)) {
    for (const issue of issues) {
      if (issue instanceof Error) continue; // "Failed to run" entries, not findings

      if (!rulesByCode.has(issue.code)) {
        rulesByCode.set(issue.code, {
          id: issue.code,
          shortDescription: { text: issue.message },
        });
      }

      results.push({
        ruleId: issue.code,
        level: LEVEL_BY_TYPE[issue.type] || "warning",
        message: { text: `${issue.message} (${url})` },
        locations: [
          {
            physicalLocation: {
              artifactLocation: { uri: relativeLocation(url) },
            },
          },
        ],
        properties: {
          url,
          selector: issue.selector,
          context: issue.context,
          runner: issue.runner,
        },
      });
    }
  }

  return {
    $schema:
      "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "pa11y-ci",
            informationUri: "https://github.com/pa11y/pa11y-ci",
            rules: [...rulesByCode.values()],
          },
        },
        results,
      },
    ],
  };
}

module.exports = function sarifReporter() {
  return {
    afterAll(report) {
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(toSarif(report), null, 2));
    },
  };
};
