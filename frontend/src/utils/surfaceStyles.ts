// Shared "white card" surface classes repeated across every page (Dashboard
// sections, tickets table, ticket detail sections, admin tables, loading/
// error panels) - one place to keep the light+dark palette in sync instead
// of hand-editing the same string in a dozen files.
export const CARD_CLASSES = 'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900';

export const SECTION_HEADER_CLASSES =
  'border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-100';

export const LOADING_PANEL_CLASSES = `${CARD_CLASSES} p-8 text-sm text-slate-500 dark:text-slate-400`;

export const ERROR_PANEL_CLASSES =
  'rounded-xl border border-red-200 bg-red-50 p-8 text-sm text-red-700 shadow-sm dark:border-red-900 dark:bg-red-950 dark:text-red-300';

export const RETRY_BUTTON_CLASSES =
  'mt-4 rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900';

// The "creation succeeded" confirmation panel shared by NewTicketPage and
// AdminNewUserPage.
export const SUCCESS_PANEL_CLASSES = 'rounded-xl border border-green-200 bg-green-50 p-8 shadow-sm dark:border-green-900 dark:bg-green-950';

export const SUCCESS_PRIMARY_BUTTON_CLASSES =
  'rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 dark:bg-green-600 dark:hover:bg-green-500';

export const SUCCESS_SECONDARY_BUTTON_CLASSES =
  'rounded-md border border-green-300 px-4 py-2 text-sm font-medium text-green-800 transition hover:bg-green-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-900';
