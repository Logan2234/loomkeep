import type { MyListDto } from "@loomkeep/shared";

export type ListTile =
  | { kind: "create"; key: "create" }
  | { kind: "list"; key: string; list: MyListDto };
