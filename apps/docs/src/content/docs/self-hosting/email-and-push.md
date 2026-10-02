---
title: Email and push
description: Send emails through SMTP and notifications through Web Push.
---

Both are optional. Without them, Loomkeep works, but can't reach people
outside the app.

## Email

Email carries password resets, email address confirmations, security alerts
(a sign-in from a new device, two-factor authentication turned off, an API key
created), new-episode digests and the administrators' alerts. The full list is
in [Notifications](/guide/notifications/). Fill in the `SMTP_*` variables:

| Variable               | Value                                                                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `SMTP_HOST`            | Your provider's SMTP server.                                                                                                            |
| `SMTP_PORT`            | Usually `587`.                                                                                                                          |
| `SMTP_USER`            | The SMTP login.                                                                                                                         |
| `SMTP_PASS`            | The SMTP password.                                                                                                                      |
| `SMTP_FROM`            | The sender, e.g. `Loomkeep <noreply@example.com>`.                                                                                      |
| `MAIL_SUPPORT_ADDRESS` | Support mailbox used by contact links and `Reply-To`. Defaults to `contact@loomkeep.app`; set it to your own address when self-hosting. |

Any SMTP provider works. [Brevo](https://www.brevo.com) has a free relay
(300 emails a day), open to personal accounts: its **SMTP & API** page gives
the host, login and password.

Without SMTP, emails are silently skipped, and a forgotten password can't
be reset: the reset link, even one an administrator sends, goes by email.

**Admin › Communications** previews every email and sends you a test one.

Replies to emails go to `MAIL_SUPPORT_ADDRESS`, which must be a bare email
address (for example `support@example.com`). Moderation notices include the
decision reference in their contact link's subject.

### Newsletter unsubscribe button

Only newsletters include the RFC 8058 `List-Unsubscribe` and
`List-Unsubscribe-Post` headers. Set `PUBLIC_API_URL` to the public HTTPS API
address, for example `https://loomkeep.example/api`. The mail provider posts
to `/newsletter/unsubscribe/one-click` without a login or cookies; it disables
only the newsletter subscription. HTTP API addresses omit these headers.
The unsubscribe link in the email footer remains available in every case.

Configure your SMTP provider's DKIM signature to cover **both** headers,
as required by [RFC 8058](https://www.rfc-editor.org/rfc/rfc8058). Mail clients
decide whether to display their unsubscribe button; adding headers alone
does not guarantee its appearance.

## Push notifications

Push alerts people about new episodes, replies and the like even with the
app closed. Generate a
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
