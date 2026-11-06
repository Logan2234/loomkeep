import type { HomeLayoutDto, HomePhoneLayoutDto } from "@loomkeep/shared";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import "reflect-metadata";
import { isJsonObject, toJsonInput } from "../common/json.util";
import { HomeLayoutBody, HomePhoneLayoutBody } from "./dto/home-layout.dto";

export function readHomeLayout(value: unknown): HomeLayoutDto | null {
  if (!isJsonObject(value)) return null;
  const layout = plainToInstance(HomeLayoutBody, value);
  return validateSync(layout).length === 0 ? layout : null;
}

export function readHomePhoneLayout(value: unknown): HomePhoneLayoutDto | null {
  if (!isJsonObject(value)) return null;
  const layout = plainToInstance(HomePhoneLayoutBody, value);
  return validateSync(layout).length === 0 ? layout : null;
}

export function toHomeLayoutJson(layout: HomeLayoutDto | HomePhoneLayoutDto) {
  return toJsonInput(layout);
}
