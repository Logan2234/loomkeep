<script lang="ts">
  // One widget of the home grid, picked by kind. Each kind fetches its own
  // data, so one failing endpoint only empties its own widget.
  import type { BoxSize } from "$lib/home/sizing";
  import type { HomeWidgetDto } from "@loomkeep/shared";
  import ActivityWidget from "./widgets/ActivityWidget.svelte";
  import BooksReadingWidget from "./widgets/BooksReadingWidget.svelte";
  import GamesPlayingWidget from "./widgets/GamesPlayingWidget.svelte";
  import ListContentWidget from "./widgets/ListContentWidget.svelte";
  import MusicToListenWidget from "./widgets/MusicToListenWidget.svelte";
  import MyListsWidget from "./widgets/MyListsWidget.svelte";
  import QuickLinksWidget from "./widgets/QuickLinksWidget.svelte";
  import ReadingGoalWidget from "./widgets/ReadingGoalWidget.svelte";
  import ResumeWidget from "./widgets/ResumeWidget.svelte";
  import ThisWeekWidget from "./widgets/ThisWeekWidget.svelte";
  import ToWatchWidget from "./widgets/ToWatchWidget.svelte";

  let { widget, size }: { widget: HomeWidgetDto; size: BoxSize } = $props();
</script>

{#if widget.type === "toWatch"}
  <ToWatchWidget {size} />
{:else if widget.type === "thisWeek"}
  <ThisWeekWidget {size} />
{:else if widget.type === "resume"}
  <ResumeWidget {size} />
{:else if widget.type === "gamesPlaying"}
  <GamesPlayingWidget {size} />
{:else if widget.type === "booksReading"}
  <BooksReadingWidget {size} />
{:else if widget.type === "readingGoal"}
  <ReadingGoalWidget {size} />
{:else if widget.type === "musicToListen"}
  <MusicToListenWidget {size} />
{:else if widget.type === "activity"}
  <ActivityWidget {size} />
{:else if widget.type === "quickLinks"}
  <QuickLinksWidget {widget} {size} />
{:else if widget.type === "myLists"}
  <MyListsWidget {size} />
{:else if widget.type === "listContent"}
  <ListContentWidget {widget} {size} />
{/if}
