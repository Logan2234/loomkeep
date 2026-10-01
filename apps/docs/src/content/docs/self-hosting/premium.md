---
title: Premium edition
description: What the premium edition is, and what it means for a self-hosted instance today.
---

**There is no premium offer yet.** Until there is, every feature works on
every instance, for every account, without a key or a payment.

## How it will work

Loomkeep is open source under the AGPL-3.0. A few features, the ones that
are a whole feature of their own, like the calendar and feed subscription
links, live apart in `ee/` directories under a separate license,
[LICENSE-EE](https://github.com/Logan2234/loomkeep/blob/main/LICENSE-EE).
Their code is public and ships in every build.

Once the premium offer launches, running those features on a self-hosted
instance will take a license key in `LOOMKEEP_LICENSE_KEY`: a yearly key
that makes **every account of the instance** premium. Everything else,
and anything that is only a quota or a level of a free feature, stays in
the open-source core.

The reasoning behind what stays free is in the project's
[open-core decision record](https://github.com/Logan2234/loomkeep/blob/main/docs/adr/0001-open-core-agpl.md).
