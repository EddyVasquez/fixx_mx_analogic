/**
 * FIXX Standard checklist (generic). TODO(decision P5): category-specific checklists and the standards behind them.
 * The FIXX Standard always wins over a professional's usual method.
 */
export const CHECKLIST_ITEMS = ["protect", "standard", "clean", "walkthrough"] as const;
export type ChecklistItem = (typeof CHECKLIST_ITEMS)[number];
export const checklistFor = (_categoryId: string): readonly ChecklistItem[] => CHECKLIST_ITEMS;
