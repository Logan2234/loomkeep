---
title: Weekly digest
description: A script listing what you watched, played, read and listened to over the past week.
sidebar:
  order: 4
---

`GET /v1/history` returns every dated viewing, session and finish. This script
turns the last seven days into a short summary you can paste anywhere or
send yourself.

**Key:** `library:read`.

```python
import os
from collections import Counter
from datetime import date, timedelta

import requests

API = "https://loomkeep.app/api/v1"
HEADERS = {"Authorization": f"Bearer {os.environ['LOOMKEEP_API_KEY']}"}

since = (date.today() - timedelta(days=7)).isoformat()
events, page = [], 1

while True:
    res = requests.get(
        f"{API}/history",
        headers=HEADERS,
        params={"from": since, "limit": 100, "page": page},
    )
    res.raise_for_status()
    body = res.json()
    events += body["items"]
    if not body["hasMore"]:
        break
    page += 1

minutes = sum(e["durationMinutes"] or 0 for e in events)
episodes = Counter(
    e["work"]["title"] for e in events if e["type"] == "EPISODE_WATCHED"
)
finished = [
    e["work"]["title"]
    for e in events
    if e["type"] in ("MOVIE_WATCHED", "GAME_COMPLETED", "BOOK_FINISHED", "ALBUM_LISTENED")
]

print(f"This week: {len(events)} moments, about {minutes // 60} hours.")
for title, count in episodes.most_common():
    print(f"- {title}: {count} episode(s)")
for title in finished:
    print(f"- Finished {title}")
```

Titles come in your account's language; add `"lang": "en"` to `params` to
force one. Events without a date, often from an import, never fall in a
window: see [History and cycles](/api/concepts/#history-and-cycles).
