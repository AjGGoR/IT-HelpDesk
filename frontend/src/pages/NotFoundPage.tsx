import { Link } from 'react-router-dom';

import { useDocumentTitle } from '../hooks/useDocumentTitle';

export function NotFoundPage() {
  useDocumentTitle('Nie znaleziono strony');
  return (
    <div className="flex min-h-screen items-start justify-center bg-slate-50 px-6 dark:bg-slate-950">
      <section className="mx-auto mt-24 max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Nie znaleziono strony</h1>
        <p className="mt-4 text-slate-600 dark:text-slate-300">Podany adres nie istnieje.</p>
        <Link to="/" className="mt-6 inline-block text-sm font-medium text-blue-700 hover:underline dark:text-blue-400">
          Wróć do pulpitu
        </Link>
      </section>
    </div>
  );
}
