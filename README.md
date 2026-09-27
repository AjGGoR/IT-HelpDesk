# IT HelpDesk

> Aplikacja webowa wspierająca obsługę zgłoszeń IT — od rejestracji incydentu lub usługi po rozwiązanie, kontrolę SLA i zamknięcie sprawy.

## O projekcie

IT HelpDesk jest projektem inżynierskim przedstawiającym kompletny system obsługi zgłoszeń technicznych. Aplikacja łączy potrzeby osób zgłaszających problemy z operacyjnym widokiem pracy zespołu wsparcia. Użytkownik może szybko utworzyć zgłoszenie, śledzić jego status i poznać rozwiązanie, a serwisant oraz administrator otrzymują narzędzia do priorytetyzacji, kontroli terminów i zarządzania obsługą.

Projekt został zaprojektowany jako aplikacja typu client-server. Frontend działa jako responsywna aplikacja SPA, backend udostępnia REST API, a dane są przechowywane w relacyjnej bazie PostgreSQL.

## Cel i zakres

Głównym celem projektu było zbudowanie systemu, który:

- porządkuje zgłoszenia według typu, priorytetu i stanu;
- rozdziela dostęp zgodnie z rolą użytkownika;
- wspiera codzienną pracę zespołu wsparcia przez pulpity operacyjne;
- kontroluje terminy realizacji za pomocą SLA;
- zachowuje historię zmian i umożliwia przekazanie opisu rozwiązania;
- działa poprawnie na ekranach desktopowych i mobilnych.

## Najważniejsze funkcjonalności

- logowanie użytkowników i administracyjne zarządzanie kontami;
- role: **Użytkownik**, **Serwisant** i **Administrator**;
- zgłoszenia typu **Usługa** oraz **Incydent**;
- priorytety, kategorie, przypisanie serwisanta i przejścia statusów;
- komentarze oraz pełna historia zmian zgłoszenia;
- obowiązkowy opis rozwiązania widoczny w osobnej sekcji;
- obsługa SLA z ostrzeżeniami i oznaczeniem przekroczeń;
- dashboard operacyjny z wykresem i kolejkami wymagającymi uwagi;
- wyszukiwanie, filtry, sortowanie i paginacja;
- jasny/ciemny motyw oraz responsywny interfejs.

## Role w systemie

| Rola | Zakres działania |
| --- | --- |
| **Użytkownik** | Tworzy usługę lub incydent, obserwuje własne zgłoszenia, dodaje komentarze, widzi opis rozwiązania i zamyka rozwiązane zgłoszenie. |
| **Serwisant** | Widzi wszystkie zgłoszenia, przejmuje je, zmienia status i priorytet, wpisuje rozwiązanie oraz korzysta z operacyjnych kolejek SLA. |
| **Administrator** | Ma uprawnienia serwisanta oraz zarządza kontami użytkowników i ich rolami. |

## Proces obsługi zgłoszenia

~~~text
Nowe → W trakcie → Oczekujące → Rozwiązane → Zamknięte
~~~

Zgłoszenie może zostać utworzone jako usługa lub incydent. Serwisant przejmuje je, aktualizuje status i przekazuje opis rozwiązania. Użytkownik widzi cały przebieg sprawy, a po rozwiązaniu może ją zamknąć.

## SLA

Termin realizacji jest obliczany na serwerze dla każdego aktywnego zgłoszenia.

| Typ zgłoszenia | Niski | Średni | Wysoki | Krytyczny |
| --- | ---: | ---: | ---: | ---: |
| Usługa | 10 dni roboczych | 5 dni roboczych | 3 dni robocze | — |
| Incydent | 7 dni roboczych | 5 dni roboczych | 3 dni robocze | 24 godziny robocze |

SLA jest liczone dla strefy Europe/Warsaw, od poniedziałku do piątku w godzinach 08:00–16:00. Licznik nie biegnie w weekendy ani polskie dni ustawowo wolne od pracy. System wyróżnia zgłoszenia zagrożone przekroczeniem terminu, zgłoszenia wygasające w bieżącym dniu roboczym oraz zgłoszenia już po terminie.

## Architektura

| Warstwa | Zastosowane technologie |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS, TanStack Query |
| Backend | Node.js, Express, TypeScript, Prisma |
| Baza danych | PostgreSQL |
| Konteneryzacja | Docker Compose |
| Testy | Vitest, Supertest, React Testing Library |

~~~text
Przeglądarka
     │
     ▼
Frontend React
     │ REST API
     ▼
Backend Express
     │ Prisma ORM
     ▼
PostgreSQL
~~~

## Najważniejsze widoki

- **Pulpit użytkownika** — dwa czytelne wejścia: „Nowa usługa” i „Nowy incydent”, z listą bieżących zgłoszeń poniżej.
- **Pulpit serwisanta i administratora** — podsumowania aktywnych zgłoszeń, wykres statusów, incydenty/usługi, kolejka wymagająca uwagi i informacje o SLA.
- **Lista zgłoszeń** — filtrowanie po statusie, typie, priorytecie i SLA; na desktopie przejrzysta tabela, a na telefonie układ kart.
- **Szczegóły zgłoszenia** — metadane, status SLA, komentarze, historia i osobna sekcja opisu rozwiązania.
- **Panel administratora** — tworzenie kont oraz zarządzanie rolami i aktywnością użytkowników.

## Uruchomienie lokalne

Najprostszy sposób uruchomienia projektu wymaga Docker Desktop.

1. Skopiuj .env.example do .env.
2. Ustaw lokalne wartości wymaganych zmiennych środowiskowych.
3. Uruchom:

~~~bash
docker compose up --build
~~~

Po uruchomieniu aplikacja jest dostępna pod adresem http://localhost:5173.

## Konta demonstracyjne

Poniższe konta są tworzone wyłącznie przez lokalny seed bazy danych i służą do prezentacji różnych ról systemowych.

| Rola | E-mail | Hasło |
| --- | --- | --- |
| Administrator | admin@helpdesk.test | Helpdesk123! |
| Serwisant | technician@helpdesk.test | Helpdesk123! |
| Użytkownik | user@helpdesk.test | Helpdesk123! |

## Weryfikacja

Projekt obejmuje testy backendu i frontendu, w tym scenariusze autoryzacji, obsługi ról, cyklu życia zgłoszeń, komentarzy, SLA, walidacji danych oraz responsywnego interfejsu.

W ostatnim cyklu weryfikacyjnym wykonano:

| Obszar | Wynik |
| --- | --- |
| Testy backendu | 146/146 poprawnych |
| Testy frontendu | 160/160 poprawnych |
| Typecheck, lint i build | poprawne dla obu aplikacji |
| Migracje i seed PostgreSQL | zweryfikowane w Dockerze |
| Kontrole end-to-end API | 24/24 poprawnych |

## Struktura katalogów

~~~text
backend/              REST API, logika biznesowa, Prisma i testy
frontend/             aplikacja React oraz testy interfejsu
docker-compose.yml    środowisko lokalne z PostgreSQL
~~~

