# IT HelpDesk

Nowoczesna aplikacja webowa do obsługi zgłoszeń IT. Umożliwia użytkownikom szybkie zgłaszanie incydentów i usług, a zespołowi wsparcia priorytetyzację pracy, kontrolę SLA i bezpieczne prowadzenie zgłoszeń od utworzenia do zamknięcia.

## Najważniejsze funkcje

- role: Użytkownik, Serwisant i Administrator;
- uwierzytelnianie JWT oraz autoryzacja po stronie serwera;
- zgłoszenia typu Usługa i Incydent;
- priorytety, kategorie, przypisanie serwisanta, komentarze i historia zmian;
- obowiązkowy opis rozwiązania, dostępny w osobnej sekcji zgłoszenia;
- SLA liczone wyłącznie w godzinach pracy wraz z ostrzeżeniami i oznaczeniem przekroczeń;
- pulpity operacyjne dla serwisantów i administratorów;
- filtrowanie, wyszukiwanie, sortowanie i paginacja zgłoszeń;
- jasny i ciemny motyw oraz responsywny interfejs.

## Stos technologiczny

| Warstwa | Technologia |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS, TanStack Query |
| Backend | Node.js, Express, TypeScript, Prisma |
| Baza danych | PostgreSQL |
| Uruchamianie lokalne | Docker Compose |
| Testy | Vitest, Supertest, React Testing Library |

## Szybki start z Dockerem

### Wymagania

- Docker Desktop z Docker Compose.

### Konfiguracja

1. Utwórz plik .env na podstawie .env.example.
2. Ustaw własne wartości POSTGRES_PASSWORD, DATABASE_URL oraz JWT_SECRET.
3. Uruchom środowisko:

~~~bash
docker compose up --build
~~~

4. Otwórz aplikację pod adresem http://localhost:5173.

Kontenery backendu wykonują migracje przy uruchomieniu. Usługa seedująca tworzy lokalne dane demonstracyjne.

## Konta demonstracyjne

Te konta są przeznaczone wyłącznie do lokalnego środowiska demonstracyjnego.

| Rola | E-mail | Hasło |
| --- | --- | --- |
| Administrator | admin@helpdesk.test | Helpdesk123! |
| Serwisant | technician@helpdesk.test | Helpdesk123! |
| Użytkownik | user@helpdesk.test | Helpdesk123! |

Nie używaj tych poświadczeń ani kont demonstracyjnych w środowisku produkcyjnym.

## Typy zgłoszeń i SLA

Każde zgłoszenie jest usługą lub incydentem. Usługi nie mogą otrzymać priorytetu krytycznego.

| Typ | Niski | Średni | Wysoki | Krytyczny |
| --- | ---: | ---: | ---: | ---: |
| Usługa | 10 dni roboczych | 5 dni roboczych | 3 dni robocze | — |
| Incydent | 7 dni roboczych | 5 dni roboczych | 3 dni robocze | 24 godziny robocze |

SLA jest liczone w strefie Europe/Warsaw, od poniedziałku do piątku w godzinach 08:00–16:00. Zegar nie biegnie w weekendy ani w polskie dni ustawowo wolne od pracy. Aplikacja wyróżnia zgłoszenia zagrożone przekroczeniem oraz zgłoszenia po terminie.

## Role i dostęp

### Użytkownik

- tworzy usługę lub incydent;
- widzi wyłącznie własne zgłoszenia;
- dodaje komentarze;
- przegląda rozwiązanie, historię i stan SLA;
- zamyka własne rozwiązane zgłoszenie.

### Serwisant

- widzi wszystkie zgłoszenia;
- przejmuje i obsługuje zgłoszenia;
- zmienia status oraz priorytet aktywnego zgłoszenia;
- wpisuje opis rozwiązania;
- korzysta z pulpitu operacyjnego i kolejek SLA.

### Administrator

Administrator ma wszystkie uprawnienia serwisanta oraz zarządza kontami użytkowników.

## Uruchomienie bez Dockera

Wymagane są Node.js 20+ i PostgreSQL.

~~~bash
# backend
cd backend
npm ci
npm run build
npm run prisma:deploy
npm run prisma:seed
npm run dev

# frontend, w drugim terminalu
cd frontend
npm ci
npm run dev
~~~

Utwórz backend/.env na podstawie backend/.env.example i skonfiguruj połączenie z PostgreSQL przed wykonaniem migracji.

## Testy i kontrola jakości

~~~bash
# backend
cd backend
npm test
npm run typecheck
npm run lint
npm run build

# frontend
cd frontend
npm test
npm run typecheck
npm run lint
npm run build
~~~

## Struktura projektu

~~~text
backend/              API, Prisma, migracje i testy backendu
frontend/             aplikacja React i testy interfejsu
docker-compose.yml    lokalne środowisko aplikacji i PostgreSQL
~~~

## Bezpieczeństwo

- Nie dodawaj plików .env, haseł, tokenów ani kluczy do repozytorium.
- W produkcji użyj silnego JWT_SECRET, indywidualnych haseł oraz zarządzanej bazy PostgreSQL.
- Konta demonstracyjne i seed są przeznaczone wyłącznie dla środowiska lokalnego.

