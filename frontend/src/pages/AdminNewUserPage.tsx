import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';

import { ApiError } from '../api/client';
import { createUser } from '../api/users';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { USER_ROLES, type SessionUser } from '../types/auth';
import { userCreateSchema, type UserCreateFormValues } from '../schemas/user.schema';
import { ROLE_LABELS } from '../utils/roleLabels';
import { CARD_CLASSES, SUCCESS_PANEL_CLASSES, SUCCESS_PRIMARY_BUTTON_CLASSES, SUCCESS_SECONDARY_BUTTON_CLASSES } from '../utils/surfaceStyles';
import { FORM_ALERT_CLASSES, FORM_FIELD_ERROR_CLASSES, FORM_INPUT_CLASSES, FORM_LABEL_CLASSES, PRIMARY_BUTTON_CLASSES, SECONDARY_LINK_CLASSES } from '../utils/formStyles';
import { displayName } from '../utils/person';

export function AdminNewUserPage() {
  useDocumentTitle('Nowy użytkownik');
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<SessionUser | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UserCreateFormValues>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: { email: '', password: '', firstName: '', lastName: '', role: 'USER' },
  });

  if (created) {
    return (
      <section className={SUCCESS_PANEL_CLASSES}>
        <h1 className="text-xl font-semibold text-green-900 dark:text-green-100">Użytkownik został utworzony</h1>
        <p className="mt-2 text-sm text-green-800 dark:text-green-300">
          {displayName(created)} ({created.email}) — {ROLE_LABELS[created.role]}
        </p>
        <div className="mt-6 flex gap-3">
          <Link to="/admin/users" className={SUCCESS_PRIMARY_BUTTON_CLASSES}>
            Wróć do listy użytkowników
          </Link>
          <button
            type="button"
            onClick={() => {
              setCreated(null);
              reset();
            }}
            className={SUCCESS_SECONDARY_BUTTON_CLASSES}
          >
            Utwórz kolejnego użytkownika
          </button>
        </div>
      </section>
    );
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const { user } = await createUser(values);
      setCreated(user);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.');
    }
  });

  return (
    <section className={`max-w-lg p-8 ${CARD_CLASSES}`}>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Nowy użytkownik</h1>

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
        <div className="flex gap-4">
          <div className="min-w-0 flex-1">
            <label htmlFor="firstName" className={FORM_LABEL_CLASSES}>
              Imię
            </label>
            <input
              id="firstName"
              type="text"
              aria-required="true"
              aria-invalid={errors.firstName ? 'true' : 'false'}
              aria-describedby={errors.firstName ? 'firstName-error' : undefined}
              className={FORM_INPUT_CLASSES}
              {...register('firstName')}
            />
            {errors.firstName && (
              <p id="firstName-error" role="alert" className={FORM_FIELD_ERROR_CLASSES}>
                {errors.firstName.message}
              </p>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <label htmlFor="lastName" className={FORM_LABEL_CLASSES}>
              Nazwisko
            </label>
            <input
              id="lastName"
              type="text"
              aria-required="true"
              aria-invalid={errors.lastName ? 'true' : 'false'}
              aria-describedby={errors.lastName ? 'lastName-error' : undefined}
              className={FORM_INPUT_CLASSES}
              {...register('lastName')}
            />
            {errors.lastName && (
              <p id="lastName-error" role="alert" className={FORM_FIELD_ERROR_CLASSES}>
                {errors.lastName.message}
              </p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="email" className={FORM_LABEL_CLASSES}>
            Adres e-mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="off"
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
            Hasło tymczasowe
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
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

        <div>
          <label htmlFor="role" className={FORM_LABEL_CLASSES}>
            Rola
          </label>
          <select id="role" className={FORM_INPUT_CLASSES} {...register('role')}>
            {USER_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>

        {formError && (
          <p role="alert" className={FORM_ALERT_CLASSES}>
            {formError}
          </p>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={isSubmitting} className={PRIMARY_BUTTON_CLASSES}>
            {isSubmitting ? 'Zapisywanie…' : 'Utwórz użytkownika'}
          </button>
          <Link to="/admin/users" className={SECONDARY_LINK_CLASSES}>
            Anuluj
          </Link>
        </div>
      </form>
    </section>
  );
}
