import type {
  AccountDeletionAnonymizedCategory,
  AccountDeletionDeletedCategory,
  AccountDeletionSummaryDto,
} from "@loomkeep/shared";

// `AccountDeletionCategoryCount<T>` itself isn't exported from
// packages/shared — pull the element type back out of the array field
// instead of needing the generic's name.
type DeletedCategoryCount = AccountDeletionSummaryDto["deleted"][number];
type AnonymizedCategoryCount = AccountDeletionSummaryDto["anonymized"][number];

class DeletedCategoryCountDto implements DeletedCategoryCount {
  category!: AccountDeletionDeletedCategory;
  count!: number;
}

class AnonymizedCategoryCountDto implements AnonymizedCategoryCount {
  category!: AccountDeletionAnonymizedCategory;
  count!: number;
}

export class AccountDeletionSummaryResponseDto implements AccountDeletionSummaryDto {
  deleted!: DeletedCategoryCountDto[];
  anonymized!: AnonymizedCategoryCountDto[];
}
