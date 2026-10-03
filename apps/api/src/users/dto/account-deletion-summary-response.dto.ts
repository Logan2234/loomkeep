import type {
  AccountDeletionAnonymizedCategory,
  AccountDeletionDeletedCategory,
  AccountDeletionKeptCategory,
  AccountDeletionSummaryDto,
  AccountDeletionTransferredListDto,
} from "@loomkeep/shared";

// `AccountDeletionCategoryCount<T>` itself isn't exported from
// packages/shared — pull the element type back out of the array field
// instead of needing the generic's name.
type DeletedCategoryCount = AccountDeletionSummaryDto["deleted"][number];
type AnonymizedCategoryCount = AccountDeletionSummaryDto["anonymized"][number];
type KeptCategoryCount = AccountDeletionSummaryDto["kept"][number];

class DeletedCategoryCountDto implements DeletedCategoryCount {
  category!: AccountDeletionDeletedCategory;
  count!: number;
}

class AnonymizedCategoryCountDto implements AnonymizedCategoryCount {
  category!: AccountDeletionAnonymizedCategory;
  count!: number;
}

class KeptCategoryCountDto implements KeptCategoryCount {
  category!: AccountDeletionKeptCategory;
  count!: number;
}

class TransferredListDto implements AccountDeletionTransferredListDto {
  title!: string;
  newOwner!: string;
}

export class AccountDeletionSummaryResponseDto implements AccountDeletionSummaryDto {
  sessions!: number;
  deleted!: DeletedCategoryCountDto[];
  anonymized!: AnonymizedCategoryCountDto[];
  transferredLists!: TransferredListDto[];
  kept!: KeptCategoryCountDto[];
}
