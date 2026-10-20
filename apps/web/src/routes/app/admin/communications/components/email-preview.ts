type EmailPreviewRequestCallbacks<Result> = {
  onStart: () => void;
  onSuccess: (result: Result) => void;
  onError: (error: unknown) => void;
  onSettled: () => void;
};

export function createLatestEmailPreviewRequest<Args extends unknown[], Result>(
  request: (...args: Args) => Promise<Result>,
  callbacks: EmailPreviewRequestCallbacks<Result>,
) {
  let latestRequestId = 0;

  return async (...args: Args): Promise<void> => {
    const requestId = ++latestRequestId;
    callbacks.onStart();

    try {
      const result = await request(...args);
      if (requestId === latestRequestId) callbacks.onSuccess(result);
    } catch (error) {
      if (requestId === latestRequestId) callbacks.onError(error);
    } finally {
      if (requestId === latestRequestId) callbacks.onSettled();
    }
  };
}
