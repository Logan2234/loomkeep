import {
  type Domain,
  Domain as DomainEnum,
  type ProfileAccess,
  ProfileAccess as ProfileAccessEnum,
  type VisibilityAudience,
  VisibilityAudience as VisibilityAudienceEnum,
  type VisibilityFacet,
  VisibilityFacet as VisibilityFacetEnum,
} from "@loomkeep/shared";
import { Type } from "class-transformer";
import { IsArray, IsIn, IsOptional, ValidateNested } from "class-validator";

class VisibilitySettingItem {
  @IsIn(Object.values(DomainEnum))
  domain!: Domain;

  @IsIn(Object.values(VisibilityFacetEnum))
  facet!: VisibilityFacet;

  @IsIn(Object.values(VisibilityAudienceEnum))
  audience!: VisibilityAudience;
}

export class UpdateVisibilitySettingsBody {
  @IsOptional()
  @IsIn(Object.values(ProfileAccessEnum))
  profileAccess?: ProfileAccess;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VisibilitySettingItem)
  settings?: VisibilitySettingItem[];
}
