/** Sub-steps of "Request sent" while the customer is still placing the job. */
export const REQUEST_SUBSTEP_COUNT = 4;

export interface RequestProgressDraft {
  categoryId: string;
  description: string;
  photos: number;
  emergency: boolean;
  street: string;
}

/**
 * Completed sub-steps divided by four:
 * trade chosen, details described, photos and address, review screen.
 * The review sub-step counts once the customer is confirming the request.
 */
export function requestSubProgress(draft: RequestProgressDraft, atReview = false): number {
  const trade = draft.categoryId.trim().length > 0;
  const details = draft.description.trim().length > 0;
  const photosAndAddress = (draft.photos > 0 || draft.emergency) && draft.street.trim().length > 0;
  const done = [trade, details, photosAndAddress, atReview].filter(Boolean).length;
  return done / REQUEST_SUBSTEP_COUNT;
}
