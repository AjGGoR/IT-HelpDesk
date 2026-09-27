import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().min(1, 'Podaj adres e-mail.').email('Podaj poprawny adres e-mail.'),
  password: z.string().min(1, 'Podaj hasło.'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
