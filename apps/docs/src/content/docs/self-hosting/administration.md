---
title: Administration
description: The administrator role and what the Admin area offers.
---

## Becoming administrator

The account whose email matches `ADMIN_EMAIL` in `.env` becomes
administrator when it signs up, or at its next sign-in if it already
existed. From **Admin › Users**, an administrator can then promote other
accounts.

With the HTTPS override (production), the Admin area **requires two-factor
authentication**: an administrator without it is asked to turn it on before
going further. Set up an authenticator app, or email codes if
[SMTP](/self-hosting/email-and-push/) works.

## The Admin area

| Section                     | What you find there                                                                                 |
| --------------------------- | --------------------------------------------------------------------------------------------------- |
| **Services**                | Which catalogue and service keys are set, whether each one answers, and quotas.                     |
| **Users**                   | Accounts and their sessions, invitations, password reset links, roles.                              |
| **Communications**          | Every email template, previewed and sent to you as a test; test and broadcast push.                 |
| **Stats**                   | How the instance is used, and library sizes.                                                        |
| **Instance settings**       | What's open to every account: see [Instance settings](/self-hosting/instance-settings/).            |
| **Jobs & tasks**            | Scheduled jobs and their last runs; run one by hand.                                                |
| **Backup**                  | Backups, made, downloaded and restored: see [Backups](/self-hosting/upgrades-and-backups/#backups). |
| **Imports**                 | Every account's import history.                                                                     |
| **Cache & synchronization** | The catalogue titles copied into the database, resynced one by one.                                 |
| **Security**                | The log of sensitive actions on every account.                                                      |
| **Reports**                 | The moderation queue, when social features are on.                                                  |

## Invitations

With [registration closed](/self-hosting/instance-settings/), an invitation
is the only way in. In **Admin › Users**, invite someone **by email**, or
create a **shareable link** to send yourself.

## Moderation

When social features are on, members can report comments, reviews, lists,
messages they received and profiles. Reports land in **Admin › Reports**, where you can:

- remove a comment, a review or a message (a reported message comes with
  the few around it in its conversation: you have no other way into it);
- delete a reported list, or open it, edit it like its owner would (title,
  description, works, visibility), then record the change;
- on a profile, remove the picture, clear the bio, change the display name
  or suspend the account for a set time, together if needed, or delete the
  account.

A suspended account can't sign in, its profile can't be reached, and it gets
no email or push until the date set; it comes back on its own, or earlier
from **Admin › Users**. Dismissing a report changes nothing. The person who
reported is told the outcome; the person a measure targets gets one email
naming every measure and the reason.

## Maintenance

To take part of the site down for a while, see
[Feature flags](/self-hosting/optional-services/feature-flags/): per domain
with Unleash, or the whole site with a marker file.
