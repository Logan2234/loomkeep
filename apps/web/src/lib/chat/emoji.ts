/**
 * `:shortcode:` emoji for the composer. The names follow GitHub's and Slack's
 * (`:joy:`, `:+1:`), which people already type elsewhere; the words after a
 * name only help finding it.
 */
const TABLE = `
😀 grinning smile happy
😃 smiley happy joy
😄 smile happy laugh
😁 grin happy
😆 laughing satisfied lol
😅 sweat_smile phew relief
🤣 rofl laugh lol
😂 joy laugh lol tears
🙂 slightly_smiling_face smile
🙃 upside_down_face sarcasm
😉 wink
😊 blush happy
😇 innocent angel halo
🥰 smiling_face_with_three_hearts love
😍 heart_eyes love crush
🤩 star_struck wow amazing
😘 kissing_heart kiss love
😋 yum delicious
😛 stuck_out_tongue tongue
😜 stuck_out_tongue_winking_eye crazy
🤪 zany_face crazy wild
😝 stuck_out_tongue_closed_eyes
🤑 money_mouth_face rich
🤗 hugs hug
🤭 hand_over_mouth oops giggle
🤫 shushing_face shh secret spoiler
🤔 thinking hmm
🤐 zipper_mouth_face secret silence
🤨 raised_eyebrow suspicious doubt
😐 neutral_face meh
😑 expressionless blank
😶 no_mouth silent
😏 smirk sly
😒 unamused meh
🙄 roll_eyes eyeroll
😬 grimacing awkward
😮‍💨 face_exhaling relief phew
🤥 lying_face liar
😌 relieved calm
😔 pensive sad
😪 sleepy tired
🤤 drooling_face
😴 sleeping bored tired
😷 mask sick
🤒 face_with_thermometer sick ill
🤢 nauseated_face sick gross
🤮 vomiting_face gross
🥵 hot_face heat
🥶 cold_face freezing
🥴 woozy_face drunk dizzy
😵 dizzy_face dizzy
🤯 exploding_head mind_blown wow
🤠 cowboy_hat_face
🥳 partying_face party celebrate
🥸 disguised_face incognito
😎 sunglasses cool
🤓 nerd_face geek
🧐 monocle_face inspect
😕 confused
🫤 face_with_diagonal_mouth unsure
😟 worried
🙁 slightly_frowning_face sad
😮 open_mouth surprise wow
😯 hushed surprise
😲 astonished shocked wow
😳 flushed embarrassed
🥺 pleading_face puppy please
🥹 face_holding_back_tears moved
😦 frowning
😧 anguished
😨 fearful scared fear
😰 cold_sweat nervous
😥 disappointed_relieved phew
😢 cry sad tear
😭 sob cry sad
😱 scream fear shock omg
😖 confounded
😣 persevere
😞 disappointed sad
😓 sweat
😩 weary tired
😫 tired_face exhausted
🥱 yawning_face bored tired
😤 triumph huff
😡 rage angry mad
😠 angry mad
🤬 cursing_face swear angry
😈 smiling_imp devil evil
👿 imp devil angry
💀 skull dead lol
☠️ skull_and_crossbones danger dead
💩 poop crap
🤡 clown_face clown
👹 japanese_ogre monster
👻 ghost halloween boo
👽 alien ufo
🤖 robot bot
🫠 melting_face embarrassed
🥲 smiling_face_with_tear bittersweet
🫡 saluting_face respect
🫣 face_with_peeking_eye peek scared
😺 smiley_cat cat
😹 joy_cat cat laugh
😻 heart_eyes_cat cat love
🙈 see_no_evil monkey hide spoiler
🙉 hear_no_evil monkey
🙊 speak_no_evil monkey secret
💋 kiss lips
💌 love_letter
💘 cupid love
💝 gift_heart love
💖 sparkling_heart love
💗 heartpulse love
💓 heartbeat love
💞 revolving_hearts love
💕 two_hearts love
💔 broken_heart sad heartbreak
❤️‍🔥 heart_on_fire passion
❤️ heart love red
🧡 orange_heart love
💛 yellow_heart love
💚 green_heart love
💙 blue_heart love
💜 purple_heart love
🖤 black_heart dark
🤍 white_heart love
🤎 brown_heart love
💯 100 perfect score
💢 anger angry
💥 boom collision explosion
💫 dizzy star
💦 sweat_drops water
💨 dash fast wind
💬 speech_balloon comment talk
💭 thought_balloon thinking
💤 zzz sleep bored
👋 wave hello bye
🤚 raised_back_of_hand
🖐️ raised_hand_with_fingers_splayed hand
✋ hand raised stop high_five
🖖 vulcan_salute spock trek
👌 ok_hand ok perfect
🤌 pinched_fingers italian
🤏 pinching_hand small little
✌️ v peace victory
🤞 crossed_fingers luck hope
🫰 hand_with_index_finger_and_thumb_crossed money love
🤟 love_you_gesture love
🤘 metal rock
🤙 call_me_hand
👈 point_left left
👉 point_right right
👆 point_up_2 up
👇 point_down down
☝️ point_up up
👍 thumbsup +1 yes like ok
👎 thumbsdown -1 no dislike
✊ fist raised
👊 facepunch punch fist_bump
🤛 fist_left
🤜 fist_right
👏 clap bravo applause
🙌 raised_hands hooray celebrate
🫶 heart_hands love
👐 open_hands
🤲 palms_up_together
🤝 handshake deal agree
🙏 pray please thanks
✍️ writing_hand write
💪 muscle strong flex
🧠 brain smart
👀 eyes look see
👁️ eye look
👅 tongue
👄 lips mouth
🫦 biting_lip
👶 baby
🧒 child kid
👨 man
👩 woman
🧓 older_adult old
🕵️ detective sleuth spy
💂 guard
🥷 ninja
🧙 mage wizard magic
🧚 fairy magic
🧛 vampire dracula
🧟 zombie undead
🧜 merperson mermaid
🧞 genie
🦸 superhero hero
🦹 supervillain villain
🤷 shrug dunno whatever
🤦 facepalm
🙋 raising_hand
🙅 no_good no
🙆 ok_woman ok
💁 tipping_hand_person sassy
🙇 bow sorry thanks
💃 dancer dance
🕺 man_dancing dance
👯 dancers party
🧘 lotus_position zen calm
🛌 sleeping_bed bed sleep
🐶 dog puppy
🐱 cat kitten
🐭 mouse
🐹 hamster
🐰 rabbit bunny
🦊 fox_face fox
🐻 bear
🐼 panda_face panda
🐨 koala
🐯 tiger
🦁 lion
🐮 cow
🐷 pig
🐸 frog
🐵 monkey_face monkey
🐔 chicken
🐧 penguin
🐦 bird
🦆 duck
🦉 owl
🦇 bat
🐺 wolf
🐴 horse
🦄 unicorn magic
🐝 bee honeybee
🐛 bug
🦋 butterfly
🐌 snail slow
🐞 lady_beetle ladybug
🕷️ spider
🦂 scorpion
🐢 turtle slow
🐍 snake
🦎 lizard
🦖 t-rex dinosaur
🦕 sauropod dinosaur
🐙 octopus
🦑 squid
🦀 crab
🐠 tropical_fish fish
🐟 fish
🐬 dolphin
🐳 whale
🦈 shark
🐊 crocodile
🐉 dragon
🌵 cactus
🎄 christmas_tree noel xmas
🌲 evergreen_tree tree
🌳 deciduous_tree tree
🌴 palm_tree tree beach
🌱 seedling plant
🍀 four_leaf_clover luck
🍁 maple_leaf autumn fall
🍂 fallen_leaf autumn fall
🍄 mushroom
🌹 rose flower love
🌻 sunflower flower
🌸 cherry_blossom flower spring
🌷 tulip flower
💐 bouquet flowers
🌍 earth_africa world earth
🌎 earth_americas world earth
🌏 earth_asia world earth
🌙 crescent_moon moon night
🌚 new_moon_with_face moon
🌝 full_moon_with_face moon
⭐ star favorite
🌟 star2 glowing star
✨ sparkles shiny magic
⚡ zap lightning power
🔥 fire flame hot lit
🌈 rainbow
☀️ sunny sun
⛅ partly_sunny cloud
☁️ cloud
🌧️ cloud_with_rain rain
⛈️ cloud_with_lightning_and_rain storm
❄️ snowflake snow cold winter
☃️ snowman winter
🌊 ocean wave sea
🍎 apple fruit
🍌 banana fruit
🍉 watermelon fruit summer
🍓 strawberry fruit
🍒 cherries fruit
🍑 peach fruit
🥑 avocado
🍆 eggplant
🥕 carrot
🌽 corn
🌶️ hot_pepper spicy chili
🥐 croissant breakfast
🥖 baguette_bread bread french
🧀 cheese
🍳 fried_egg egg breakfast
🥞 pancakes breakfast
🥓 bacon
🍔 hamburger burger
🍟 fries
🍕 pizza
🌭 hotdog
🌮 taco
🌯 burrito
🥗 green_salad salad
🍝 spaghetti pasta
🍜 ramen noodles
🍣 sushi
🍤 fried_shrimp shrimp
🍦 icecream ice_cream
🍩 doughnut donut
🍪 cookie
🎂 birthday cake
🍰 cake dessert
🧁 cupcake
🍫 chocolate_bar chocolate
🍬 candy sweet
🍭 lollipop candy
🍿 popcorn movie snack cinema
☕ coffee morning cafe
🍵 tea
🧋 bubble_tea tea boba
🍺 beer drink
🍻 beers cheers drink
🥂 clinking_glasses cheers champagne
🍷 wine_glass wine drink
🍸 cocktail drink
🍾 champagne bottle celebrate
⚽ soccer football
🏀 basketball
🏈 football
⚾ baseball
🎾 tennis
🏐 volleyball
🏉 rugby_football rugby
🎱 8ball pool billiards
🏓 ping_pong
🥊 boxing_glove boxing
🥋 martial_arts_uniform judo karate
⛳ golf
🎣 fishing_pole_and_fish fishing
🎿 ski
🏂 snowboarder
🏄 surfer surf
🏊 swimmer swim
🚴 bicyclist bike
🏆 trophy win achievement
🥇 1st_place_medal gold first
🥈 2nd_place_medal silver second
🥉 3rd_place_medal bronze third
🏅 medal_sports medal
🎖️ medal_military medal
🎗️ reminder_ribbon
🎫 ticket cinema
🎟️ tickets admission cinema
🎪 circus_tent circus
🎭 performing_arts theater drama
🎨 art paint
🎬 clapper movie film cinema
🎤 microphone sing karaoke
🎧 headphones music listen
🎼 musical_score music
🎹 musical_keyboard piano
🥁 drum music
🎷 saxophone music jazz
🎺 trumpet music
🎸 guitar music rock
🎻 violin music
🎵 musical_note music song
🎶 notes music song
🎮 video_game game controller gaming
🕹️ joystick game arcade retro
👾 space_invader game alien retro
🎲 game_die dice board
🧩 jigsaw puzzle
♟️ chess_pawn chess
🎯 dart bullseye target
🎳 bowling
🎰 slot_machine casino
🎉 tada party celebrate hooray
🎊 confetti_ball party celebrate
🎈 balloon party birthday
🎁 gift present birthday
🎀 ribbon
🎃 jack_o_lantern halloween pumpkin
🎆 fireworks celebration
🎇 sparkler celebration
🧨 firecracker
🪄 magic_wand magic
🔮 crystal_ball fortune magic
🧸 teddy_bear toy
📚 books read library
📖 book open_book read
📕 closed_book book
📗 green_book book
📘 blue_book book
📙 orange_book book
📓 notebook
📒 ledger notebook
📜 scroll
📝 memo note write
✏️ pencil2 write
🖊️ pen write
🖋️ fountain_pen write
🔖 bookmark
🏷️ label tag
📰 newspaper news
🗞️ newspaper_roll news
📺 tv television series show
📻 radio
📷 camera photo
📸 camera_flash photo
📹 video_camera video
🎥 movie_camera film cinema
📽️ film_projector cinema movie
🎞️ film_strip film_frames movie cinema
💿 cd music album
📀 dvd movie
💾 floppy_disk save
💻 computer laptop
🖥️ desktop_computer computer
⌨️ keyboard
🖱️ computer_mouse mouse
📱 iphone phone mobile
☎️ phone telephone
📡 satellite
🔋 battery
🔌 electric_plug plug
💡 bulb idea
🔦 flashlight
🕯️ candle
📦 package box delivery
✉️ email envelope mail
📧 e-mail email mail
📅 date calendar
📆 calendar
🗓️ spiral_calendar calendar
📌 pushpin pin
📍 round_pushpin pin location
📎 paperclip
✂️ scissors cut
🔒 lock locked private
🔓 unlock open
🔑 key
🗝️ old_key key
🔨 hammer
🪓 axe
⚔️ crossed_swords fight battle
🛡️ shield
🏹 bow_and_arrow archery
🔫 gun water_pistol
💣 bomb
🧪 test_tube science
🔭 telescope space
🔬 microscope science
💊 pill medicine
🩹 adhesive_bandage bandage
🧲 magnet
🧭 compass
⏰ alarm_clock alarm
⏳ hourglass_flowing_sand wait time
⌛ hourglass time
⏱️ stopwatch time
🕰️ mantelpiece_clock clock
🚗 car auto
🚕 taxi
🚌 bus
🚓 police_car police
🚑 ambulance
🏎️ racing_car race
🏍️ motorcycle
🚲 bike bicycle
🚂 steam_locomotive train
🚆 train2 train
✈️ airplane plane travel flight
🚀 rocket launch space
🛸 flying_saucer ufo alien
🚁 helicopter
⛵ sailboat boat
🚢 ship boat
⚓ anchor
🗺️ world_map map travel
🧳 luggage travel
🏠 house home
🏰 european_castle castle
🗼 tokyo_tower tower
🗽 statue_of_liberty
🏝️ desert_island island beach
🏖️ beach_umbrella beach summer
🌋 volcano
⛺ tent camping
🌃 night_with_stars night city
🌅 sunrise morning
🌌 milky_way space galaxy stars
💰 moneybag money
💸 money_with_wings money expensive
💎 gem diamond
👑 crown king queen best
🎩 tophat hat
👓 eyeglasses glasses
🕶️ dark_sunglasses cool
👕 shirt tshirt
👗 dress
👟 athletic_shoe sneaker shoe
🛒 shopping_cart cart shopping
✅ white_check_mark check done yes
☑️ ballot_box_with_check check done
✔️ heavy_check_mark check done
❌ x no wrong cross
❎ negative_squared_cross_mark no
➕ heavy_plus_sign plus add
➖ heavy_minus_sign minus
❓ question
❗ exclamation bang
‼️ bangbang exclamation
⁉️ interrobang
⚠️ warning spoiler alert caution
🚫 no_entry_sign forbidden no
⛔ no_entry forbidden stop
🔞 underage adult
♻️ recycle
🆕 new
🆗 ok
🆒 cool
🆙 up
🔝 top
🔜 soon
🔙 back
🔚 end
🔁 repeat loop
🔂 repeat_one
▶️ arrow_forward play
⏸️ pause_button pause
⏹️ stop_button stop
⏭️ next_track_button next skip
⏮️ previous_track_button previous
⏩ fast_forward
⏪ rewind
🔀 twisted_rightwards_arrows shuffle
🔊 loud_sound volume
🔇 mute silence
🔔 bell notification
🔕 no_bell mute
📣 mega announcement
📢 loudspeaker announcement
🏁 checkered_flag finish race
🚩 triangular_flag_on_post red_flag
🏳️‍🌈 rainbow_flag pride
🇫🇷 fr france french
🇮🇹 it italy italian
🇬🇧 gb uk british
🇺🇸 us usa american
🇯🇵 jp japan japanese
🇰🇷 kr korea korean
🇪🇸 es spain spanish
🇩🇪 de germany german
`;

export interface Emoji {
  emoji: string;
  name: string;
  keywords: string[];
}

const EMOJI: Emoji[] = TABLE.trim()
  .split("\n")
  .map((line) => {
    const [emoji, name, ...keywords] = line.split(" ");
    return { emoji, name, keywords };
  });

const BY_NAME = new Map(EMOJI.map((e) => [e.name, e]));

// Among matches as good as each other, the ones people send most come first.
const POPULAR = [
  "joy",
  "heart",
  "fire",
  "thumbsup",
  "sob",
  "heart_eyes",
  "eyes",
  "skull",
  "pray",
  "sparkles",
  "tada",
  "popcorn",
  "scream",
  "clap",
  "thinking",
  "see_no_evil",
];

const popularity = (e: Emoji) => {
  const index = POPULAR.indexOf(e.name);
  return index === -1 ? POPULAR.length : index;
};

/** Shown at once, at most. */
const EMOJI_RESULTS = 8;

const NAME = "[a-z0-9_+-]";
// Two characters at least: `:)` or the `:` of a time stays text.
const OPEN = new RegExp(`(?:^|\\s):(${NAME}{2,})$`, "i");
const CLOSED = new RegExp(`(?:^|\\s)(:(${NAME}+):)$`, "i");

/**
 * The emoji whose name or words start with the query: the name's own start
 * first, then one of its words, then a keyword, then anywhere in the name.
 */
export function findEmoji(query: string, limit = EMOJI_RESULTS): Emoji[] {
  const q = query.toLowerCase();

  const rank = (e: Emoji) => {
    if (e.name.startsWith(q)) return 0;
    if (e.name.split("_").some((word) => word.startsWith(q))) return 1;
    if (e.keywords.some((word) => word.startsWith(q))) return 2;
    return e.name.includes(q) ? 3 : null;
  };

  return EMOJI.flatMap((e) => {
    const r = rank(e);
    return r === null ? [] : [{ e, r }];
  })
    .sort(
      (a, b) =>
        a.r - b.r ||
        popularity(a.e) - popularity(b.e) ||
        a.e.name.length - b.e.name.length,
    )
    .slice(0, limit)
    .map(({ e }) => e);
}

/** The `:query` being typed right before the caret, if any. */
export function emojiAtCaret(
  value: string,
  caret: number,
): { start: number; query: string } | null {
  const typed = OPEN.exec(value.slice(0, caret));
  if (!typed) return null;
  return { start: caret - typed[1].length - 1, query: typed[1] };
}

/**
 * A known `:name:` just closed before the caret, turned into its emoji —
 * typing the whole code is as good as picking it.
 */
export function completeShortcode(
  value: string,
  caret: number,
): { value: string; caret: number } | null {
  const typed = CLOSED.exec(value.slice(0, caret));
  const emoji = typed && BY_NAME.get(typed[2].toLowerCase());
  if (!typed || !emoji) return null;

  const start = caret - typed[1].length;
  return {
    value: value.slice(0, start) + emoji.emoji + value.slice(caret),
    caret: start + emoji.emoji.length,
  };
}
