import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Moon, Sun } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate, type Location } from 'react-router-dom';

import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { loginSchema, type LoginFormValues } from '../schemas/auth.schema';
import { FORM_ALERT_CLASSES, FORM_FIELD_ERROR_CLASSES, FORM_INPUT_CLASSES, FORM_LABEL_CLASSES, PRIMARY_BUTTON_CLASSES } from '../utils/formStyles';

type LocationState = { from?: Location };

// Mirrors AppLayout.tsx's icon-button toggle so the theme control looks and
// behaves the same whether or not the person is logged in yet.
const THEME_TOGGLE_BUTTON_CLASSES =
  'rounded-md border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800';

export function LoginPage() {
  useDocumentTitle('Logowanie');
  const { login, status } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  if (status === 'authenticated') {
    const redirectTo = (location.state as LocationState | null)?.from?.pathname ?? '/dashboard';
    return <Navigate to={redirectTo} replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login(values.email, values.password);
      const redirectTo = (location.state as LocationState | null)?.from?.pathname ?? '/dashboard';
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.');
    }
  });

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-slate-50 px-6 dark:bg-slate-950">
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Przełącz na motyw jasny' : 'Przełącz na motyw ciemny'}
        className={`absolute right-4 top-4 ${THEME_TOGGLE_BUTTON_CLASSES}`}
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>
      <section className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-medium text-blue-700 dark:text-blue-400">IT HelpDesk</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Zaloguj się</h1>

        <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className={FORM_LABEL_CLASSES}>
              Adres e-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              aria-required="true"
              aria-invalid={errors.email ? 'true' : 'false'}
              aria-describedby={errors.email ? 'email-error' : undefined}
              className={FORM_INPUT_CLASSES}
              {...register('email')}
            />
            {errors.email && (
              <p id="email-error" role="alert" className={FORM_FIELD_ERROR_CLASSES}>
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className={FORM_LABEL_CLASSES}>
              Hasło
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-required="true"
              aria-invalid={errors.password ? 'true' : 'false'}
              aria-describedby={errors.password ? 'password-error' : undefined}
              className={FORM_INPUT_CLASSES}
              {...register('password')}
            />
            {errors.password && (
              <p id="password-error" role="alert" className={FORM_FIELD_ERROR_CLASSES}>
                {errors.password.message}
              </p>
            )}
          </div>

          {formError && (
            <p role="alert" className={FORM_ALERT_CLASSES}>
              {formError}
            </p>
          )}

          <button type="submit" disabled={isSubmitting} className={`w-full ${PRIMARY_BUTTON_CLASSES}`}>
            {isSubmitting ? 'Logowanie…' : 'Zaloguj się'}
          </button>
        </form>
      </section>
    </main>
  );
}
