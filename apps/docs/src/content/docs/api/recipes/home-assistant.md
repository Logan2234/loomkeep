---
title: Home Assistant sensor
description: A Home Assistant sensor counting today's episodes, and an automation announcing them.
sidebar:
  order: 2
---

Home Assistant's [RESTful integration](https://www.home-assistant.io/integrations/rest/)
turns any JSON API into sensors. This one counts the episodes airing today
for the shows you follow.

**Key:** `calendar:read`.

1. Create the key in **Settings › Integrations**, then store it in
   `secrets.yaml`, with its `Bearer ` prefix:

   ```yaml
   loomkeep_api_key: "Bearer lk_…"
   ```

2. Add the sensor to `configuration.yaml`:

   ```yaml
   rest:
     - resource: https://loomkeep.app/api/v1/calendar?days=1
       headers:
         Authorization: !secret loomkeep_api_key
       scan_interval: 1800 # 30 minutes
       sensor:
         - name: Loomkeep episodes today
           unique_id: loomkeep_episodes_today
           icon: mdi:television-play
           value_template: "{{ value_json | length }}"
   ```

3. Restart Home Assistant: `sensor.loomkeep_episodes_today` appears.

## Announce them

An automation can say it out loud when you get home, for instance:

```yaml
automation:
  - alias: Announce today's episodes
    triggers:
      - trigger: state
        entity_id: person.me
        to: home
    conditions:
      - condition: numeric_state
        entity_id: sensor.loomkeep_episodes_today
        above: 0
    actions:
      - action: tts.speak
        target:
          entity_id: tts.home_assistant_cloud
        data:
          media_player_entity_id: media_player.living_room
          message: >-
            {{ states('sensor.loomkeep_episodes_today') }} new episodes
            are out today.
```

Replace the person, the speech service and the speaker with yours.

## Without a key

To list the episodes in Home Assistant's calendar rather than count them,
subscribe to your [calendar link](/api/feeds/) with the
[remote calendar](https://www.home-assistant.io/integrations/remote_calendar/)
integration: no key needed.
