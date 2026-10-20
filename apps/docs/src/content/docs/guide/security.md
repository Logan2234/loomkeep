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

## Confirming it's you

Some actions ask you to confirm it's really you, even though you're signed
in: creating an API key, changing your email, adding or removing a security
method, regenerating recovery codes, signing other devices out, and deleting
your account. Someone who got hold of your session in a browser can't do any
of these on their own.

Loomkeep offers the strongest way you've set up first (a security key or
passkey, then your authenticator app, then your password) and remembers the
one you used last. **Use another way** lists the others. Recovery codes and
email codes don't work here: the first are kept for a lost device, the
second land in a mailbox someone else may have access to.

Once confirmed, nothing is asked again for **10 minutes** on that device;
**Settings** shows how long is left. Signing in counts as a confirmation.
Deleting your account always asks, however recently you confirmed.

An authenticator app's code only works once, whether at sign-in or for a
confirmation: wait for the next one. After 5 wrong attempts in a row, the
device is signed out and you get an email.

## Keeping an eye on your account

- **Settings › Connected devices** lists the devices signed in, and signs
  any of them out.
- **Settings › Account activity** logs every sensitive event: sign-ins from a new
  device, failed attempts, password and email changes, security methods
  added or removed, API keys created or revoked.
- You get an **email** when someone signs in from a new device.

## Considered

Not planned yet, but considered:

- **Signing in with your own identity provider** (OpenID Connect: Authelia,
  Authentik, Keycloak…), mostly for self-hosted instances.

Vote for it or suggest others on the
[feature requests board](https://feedback.loomkeep.app/board/feature-requests).

## API keys and subscription links

API keys and calendar or feed links read your account without a password.
See [Security](/api/security/) in the API section, and
[Calendar & feeds](/api/feeds/).
