<script lang="ts">
  // One widget of the home grid, picked by kind. Each kind fetches its own
  // data, so one failing endpoint only empties its own widget.
  import type { BoxSize } from "$lib/home/sizing";
  import type { HomeWidgetDto } from "@loomkeep/shared";
  import ActivityWidget from "./widgets/ActivityWidget.svelte";
  import BooksReadingWidget from "./widgets/BooksReadingWidget.svelte";
  import DividerWidget from "./widgets/DividerWidget.svelte";
  import FavoritesWidget from "./widgets/FavoritesWidget.svelte";
  import FriendsPodiumWidget from "./widgets/FriendsPodiumWidget.svelte";
  import LevelStreakWidget from "./widgets/LevelStreakWidget.svelte";
  import GamesPlayingWidget from "./widgets/GamesPlayingWidget.svelte";
  import ListContentWidget from "./widgets/ListContentWidget.svelte";
  import MusicToListenWidget from "./widgets/MusicToListenWidget.svelte";
  import MyListsWidget from "./widgets/MyListsWidget.svelte";
  import NoteWidget from "./widgets/NoteWidget.svelte";
  import OnThisDayWidget from "./widgets/OnThisDayWidget.svelte";
  import TonightPickWidget from "./widgets/TonightPickWidget.svelte";
  import QuickLinksWidget from "./widgets/QuickLinksWidget.svelte";
  import QuickSearchWidget from "./widgets/QuickSearchWidget.svelte";
  import ReadingGoalWidget from "./widgets/ReadingGoalWidget.svelte";
  import ResumeWidget from "./widgets/ResumeWidget.svelte";
  import SavedViewWidget from "./widgets/SavedViewWidget.svelte";
  import ThisWeekWidget from "./widgets/ThisWeekWidget.svelte";
  import ToWatchWidget from "./widgets/ToWatchWidget.svelte";

  let { widget, size }: { widget: HomeWidgetDto; size: BoxSize } = $props();
</script>

{#if widget.type === "toWatch"}
  <ToWatchWidget {widget} {size} />
{:else if widget.type === "thisWeek"}
  <ThisWeekWidget {size} />
{:else if widget.type === "resume"}
  <ResumeWidget {size} />
{:else if widget.type === "gamesPlaying"}
  <GamesPlayingWidget {widget} {size} />
{:else if widget.type === "booksReading"}
  <BooksReadingWidget {widget} {size} />
{:else if widget.type === "readingGoal"}
  <ReadingGoalWidget {size} />
{:else if widget.type === "musicToListen"}
  <MusicToListenWidget {widget} {size} />
{:else if widget.type === "activity"}
  <ActivityWidget {widget} {size} />
{:else if widget.type === "quickLinks"}
  <QuickLinksWidget {widget} {size} />
{:else if widget.type === "myLists"}
  <MyListsWidget {widget} {size} />
{:else if widget.type === "listContent"}
  <ListContentWidget {widget} {size} />
{:else if widget.type === "savedView"}
  <SavedViewWidget {widget} {size} />
{:else if widget.type === "dividerHorizontal"}
  <DividerWidget />
{:else if widget.type === "dividerVertical"}
  <DividerWidget vertical />
{:else if widget.type === "note"}
  <NoteWidget {widget} />
{:else if widget.type === "friendsPodium"}
  <FriendsPodiumWidget {widget} />
{:else if widget.type === "levelStreak"}
  <LevelStreakWidget {size} />
{:else if widget.type === "favorites"}
  <FavoritesWidget {widget} {size} />
{:else if widget.type === "tonightPick"}
  <TonightPickWidget {widget} {size} />
{:else if widget.type === "onThisDay"}
  <OnThisDayWidget {size} />
{:else if widget.type === "quickSearch"}
  <QuickSearchWidget {size} />
{/if}
