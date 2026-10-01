---
title: Account security
description: Passwords, two-factor authentication, security keys, and keeping an eye on your account.
---

## Password

Loomkeep refuses a password that has appeared in a known data breach. It
checks without sending your password anywhere: only the first characters of
its hash leave your instance, the way
[Have I Been Pwned](https://haveibeenpwned.com/Passwords) works.

Changing or resetting your password signs every other device out.

## Two-factor authentication

In **Settings › Two-factor authentication**, add a second step to signing in.
You can turn on several methods and pick one at each sign-in:

| Method                  | How it works                                                                      |
| ----------------------- | --------------------------------------------------------------------------------- |
| Authenticator app       | A code from an app like Aegis, Google Authenticator or 1Password.                 |
| Email code              | A one-time code sent to your email address.                                       |
| Security key or passkey | A physical key (YubiKey…) or your device's fingerprint or face. Resists phishing. |

Security keys need a secure (HTTPS) connection, which loomkeep.app always has.

**Recovery codes** get you in if you lose your usual method. Each works once:
save them somewhere safe, and generate new ones when you run low.

## Signing in without a password

Once you have added a security key or passkey, you can sign in **with it
alone**, no password. Turn it on in **Settings › Two-factor authentication**.

## Keeping an eye on your account

- **Settings › Connected devices** lists the devices signed in, and signs
  any of them out.
- **Settings › Account activity** logs every sensitive event: sign-ins from a new
  device, failed attempts, password and email changes, security methods
  added or removed, API keys created or revoked.
- You get an **email** when someone signs in from a new device.

Sensitive changes, like turning off a security method, ask for your
password again.

## Considered

Not planned yet, but considered:

- **Signing in with your own identity provider** (OpenID Connect: Authelia,
  Authentik, Keycloak…), mostly for self-hosted instances.
- **Confirming it's you again** before the most sensitive actions, like
  creating an API key or changing your email, even within a session.

Vote for them or suggest others on the
[feature requests board](https://feedback.loomkeep.app/board/feature-requests).

## API keys and subscription links

API keys and calendar or feed links read your account without a password.
See [Security](/api/security/) in the API section, and
[Calendar & feeds](/api/feeds/).
