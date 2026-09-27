// Shared class strings for the hand-rolled forms across LoginPage,
// NewTicketPage, and AdminNewUserPage - kept in one place instead of
// repeating the same (light + dark) Tailwind classes in each file.
export const FORM_LABEL_CLASSES = 'block text-sm font-medium text-slate-700 dark:text-slate-300';

export const FORM_INPUT_CLASSES =
  'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';

export const FORM_FIELD_ERROR_CLASSES = 'mt-1 text-sm text-red-600 dark:text-red-400';

export const FORM_ALERT_CLASSES = 'rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300';

export const PRIMARY_BUTTON_CLASSES =
  'rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500';

export const SECONDARY_LINK_CLASSES =
  'rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800';
