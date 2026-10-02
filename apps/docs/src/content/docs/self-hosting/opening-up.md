---
title: Opening it to others
description: What to set up, and what you take on, before other people use your instance.
---

An instance for yourself needs little care. As soon as friends, family or
strangers have an account, a few things matter more.

## What you take on

Under the GDPR, you become the **data controller** for their accounts: you
answer for what is stored, for how long, and for their requests to see or
delete it.

The legal pages that come with Loomkeep (`/legal/…`) are loomkeep.app's own,
and say they only cover loomkeep.app. There is no setting yet to replace
them with yours: write your own notice and privacy policy, publish them
where your users can find them, and point them there. loomkeep.app's privacy
policy is a starting point to adapt; it is in French.

## Before you open it

- **[A domain with HTTPS](/self-hosting/https/)**: people will want the app
  on their phone, which needs it.
- **[Email](/self-hosting/email-and-push/)**: without SMTP, nobody can reset
  a forgotten password, and dormant accounts are never cleaned up, since
  the warning before deletion can't go out (see
  [Scheduled jobs](/self-hosting/scheduled-jobs/#worth-knowing)).
- **[Backups](/self-hosting/upgrades-and-backups/#backups)**, copied off the
  server, and restored once to be sure they work.
- **Two-factor authentication** for every administrator. With the HTTPS
  override, the Admin area requires it.

## Choosing who gets in

In [instance settings](/self-hosting/instance-settings/):

- **Registration open**: anyone who finds the address can sign up. Add
  [Turnstile](/self-hosting/cloudflare/#turnstile-on-sign-up) against bots.
- **Registration closed**: only an
  [invitation](/self-hosting/administration/#invitations), by email or by a
  link, lets someone in. The right choice for a family or a group of friends.

## Social features

With social features on, people see each other's activity, reviews and
lists, within the privacy settings each one chooses. They can also report
what others post: reports reach **Admin › Reports**, and administrators get
a daily email while some are pending. Someone has to look at them: see
[Moderation](/self-hosting/administration/#moderation).

## What happens on its own

- **Inactive accounts** are warned by email after two years without use,
  and deleted after three.
- **API keys** unused for a year are deleted.
- **The security log** keeps a year of sign-ins and sensitive actions.

The full list is in [Scheduled jobs](/self-hosting/scheduled-jobs/). Each
person can [export or delete](/guide/your-data/) their own data at any time,
without asking you.
