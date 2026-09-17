// The search query, shared between the field (in the rail, or above the
// content on a phone) and the results, which take over the content column.
// Two components on opposite sides of the layout read and write it, so it
// can't live in either of them.
class SettingsSearchState {
  query = $state("");

  get active(): boolean {
    return this.query.trim().length > 0;
  }

  clear(): void {
    this.query = "";
  }
}

export const settingsSearch = new SettingsSearchState();
