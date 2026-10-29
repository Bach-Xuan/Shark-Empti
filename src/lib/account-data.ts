/** Deliberately scoped: this download is not a full account/community/AI export. */
export const ACCOUNT_EXPORT_DATASETS = ['profile', 'history', 'notes', 'activity', 'flashcards', 'practice'] as const;
export type AccountExportDataset = typeof ACCOUNT_EXPORT_DATASETS[number];
