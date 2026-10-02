import { Equals } from "class-validator";

export class OneClickUnsubscribeDto {
  @Equals("One-Click")
  "List-Unsubscribe"!: string;
}
