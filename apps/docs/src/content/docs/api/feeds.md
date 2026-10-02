---
title: Calendar & feeds
description: Subscription links for calendar apps and feed readers, which need no API key.
---

Calendar apps and feed readers can't send an API key. For them, Loomkeep
offers private subscription links instead, each carrying a secret token in
its URL:

| Link                   | What it holds                                                | Open it in                                       |
| ---------------------- | ------------------------------------------------------------ | ------------------------------------------------ |
| Calendar (`.ics`)      | Upcoming episodes of the shows you follow                    | Google Calendar, Apple Calendar, Thunderbird…    |
| Releases (Atom or RSS) | Episodes already out, newest first                           | Any feed reader, or Home Assistant's feed sensor |
| Activity (Atom)        | Your activity feed, when the instance has social features on | Any feed reader                                  |

Find them in **Settings › Integrations**, or from the calendar page and your
profile; [Calendar & feeds](/guide/calendar-and-feeds/) shows how to add them
to each app. They belong to Loomkeep's premium edition; every account has
them while premium isn't offered.

## Keeping them private

Anyone with a link can read what it holds, without signing in. Don't share
it, and if one leaks, generate a new one from the same place: the old link
stops working at once.

## Feeds or API?

A subscription link suits a calendar or a reader that only needs that one
view. For anything else, filters, other resources, your own format, use the
API with a key.
