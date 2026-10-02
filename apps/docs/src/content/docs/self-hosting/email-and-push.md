---
title: Email and push
description: Send emails through SMTP and notifications through Web Push.
---

Both are optional. Without them, Loomkeep works, but can't reach people
outside the app.

## Email

Email carries password resets, email address confirmations, security alerts
(a sign-in from a new device, an API key created) and new-episode digests.
Fill in the `SMTP_*` variables:

| Variable    | Value                                              |
| ----------- | -------------------------------------------------- |
| `SMTP_HOST` | Your provider's SMTP server.                       |
| `SMTP_PORT` | Usually `587`.                                     |
| `SMTP_USER` | The SMTP login.                                    |
| `SMTP_PASS` | The SMTP password.                                 |
| `SMTP_FROM` | The sender, e.g. `Loomkeep <noreply@example.com>`. |

Any SMTP provider works. [Brevo](https://www.brevo.com) has a free relay
(300 emails a day), open to personal accounts: its **SMTP & API** page gives
the host, login and password.

Without SMTP, emails are silently skipped, and a forgotten password can't
be reset: the reset link, even one an administrator sends, goes by email.

**Admin › Communications** previews every email and sends you a test one.

## Push notifications

Push alerts people about new episodes even with the app closed. Generate a
key pair once:

```sh
npx web-push generate-vapid-keys
```

and set:

| Variable            | Value                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `VAPID_PUBLIC_KEY`  | The public key.                                                                                                           |
| `VAPID_PRIVATE_KEY` | The private key.                                                                                                          |
| `VAPID_SUBJECT`     | Optional: how push services reach you, e.g. `mailto:admin@example.com`. Defaults to your site's address when it is HTTPS. |

:::caution
Keep the same keys afterwards: new ones unsubscribe every device.
:::

Push needs HTTPS on a real device: see [Domain & HTTPS](/self-hosting/https/).
**Admin › Communications** sends a test notification.
