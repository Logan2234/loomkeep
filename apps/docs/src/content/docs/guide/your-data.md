---
title: Your data
description: What you can export, in which format and for what, and how to delete your account.
---

Your data is yours: you can take all of it out, in open formats, at any
time, and delete it for good.

## What you can export

All from **Settings › Export**:

| Export                      | What it holds                                                                                                                                                                                    | When to use it                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| **Complete archive** (JSON) | Everything: profile and photo, settings and consents, every library, history (film rewatches included), sessions, reviews, comments, lists, follows, activity, XP and achievements, security log | A full backup, or to keep your data before leaving |
| **One library** (CSV)       | One domain as a flat table, one title per row                                                                                                                                                    | A spreadsheet, or another app that imports CSV     |
| **For Letterboxd** (CSV)    | Your films seen, rewatches included, and your watchlist                                                                                                                                          | Moving your films to Letterboxd                    |
| **For Goodreads** (CSV)     | Your books with their shelves and rereads; abandoned books on a "did-not-finish" shelf                                                                                                           | Moving your books to Goodreads                     |

The complete archive lists your API keys, passkeys and the browsers that get
your notifications, but never their secrets: no key, no password hash, no
private link.

The Letterboxd and Goodreads files can include your review texts if you ask:
they then become public there, even the ones you keep to your friends here.
Your private notes are never in them.

## Automatic backups

To save the complete archive every night without thinking about it, use the
[API](/api/recipes/backup/): it serves the same JSON.

## Deleting your account

**Settings › Delete my account** erases your account at once, after you
confirm with your password. Before confirming, you can see exactly what is
deleted and what stays:

- **Right away**: every session is closed; API keys and passkeys stop
  working.
- **Deleted**: your profile, libraries, history, lists only you edit,
  follows, blocks, votes and reactions, notifications, activity, XP and
  achievements, saved views, devices and settings. Notifications other
  members got about you go too.
- **Kept without your name**: your reviews, comments, the works you added to
  other members' lists, your reports and your import history, shown as from
  a "Deleted user", so what others took part in still makes sense.
- **Handed over**: a list you edit with others passes to its earliest
  editor instead of disappearing.
- **Kept by the instance**: the security log (without IP addresses) and any
  moderation decision about you, without your identity. Backups erase
  themselves within 30 days and are never used to bring an account back.

There is no undo: export first if you might want your data back.

## Inactive accounts

An account left unused for **two years** gets an email: it will be deleted
a year later unless you sign in once before then.
