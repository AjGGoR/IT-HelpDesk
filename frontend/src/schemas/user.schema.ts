import { z } from 'zod';

import { USER_ROLES } from '../types/auth';

// Mirrors backend/src/validators/api.ts's `userCreateSchema` bounds exactly.
export const userCreateSchema = z.object({
  email: z.string().trim().min(1, 'Podaj adres e-mail.').email('Podaj poprawny adres e-mail.').max(320),
  password: z
    .string()
    .min(8, 'Hasło musi mieć co najmniej 8 znaków.')
    .max(128, 'Hasło może mieć maksymalnie 128 znaków.'),
  firstName: z.string().trim().min(1, 'Podaj imię.').max(100, 'Imię może mieć maksymalnie 100 znaków.'),
  lastName: z.string().trim().min(1, 'Podaj nazwisko.').max(100, 'Nazwisko może mieć maksymalnie 100 znaków.'),
  role: z.enum(USER_ROLES, { errorMap: () => ({ message: 'Wybierz rolę.' }) }),
});

export type UserCreateFormValues = z.infer<typeof userCreateSchema>;
