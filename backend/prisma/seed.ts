import {
  TicketCategory,
  TicketHistoryAction,
  TicketPriority,
  TicketStatus,
  TicketType,
} from '@prisma/client';
import bcrypt from 'bcrypt';

import { prisma } from '../src/config/prisma.js';
import { calculateSlaDueAt } from '../src/services/sla.service.js';

type DemoTicket = {
  title: string;
  description: string;
  type: TicketType;
  // How many calendar days before seeding the ticket was opened, so a fresh
  // demo database shows a mix of on-track, warning and breached SLAs.
  ageDays: number;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assignee: 'technician' | undefined;
  resolved: boolean;
  closed: boolean;
  comment: string | undefined;
  resolutionNote?: string;
};

const testPassword = 'Helpdesk123!';

const demoTickets: DemoTicket[] = [
  {
    title: '[DEMO] Monitor nie wyświetla obrazu',
    description: 'Po uruchomieniu komputera monitor pozostaje czarny, mimo że dioda zasilania świeci.',
    type: TicketType.INCIDENT,
    ageDays: 0,
    category: TicketCategory.HARDWARE,
    priority: TicketPriority.HIGH,
    status: TicketStatus.NEW,
    assignee: undefined,
    resolved: false,
    closed: false,
    comment: undefined,
  },
  {
    title: '[DEMO] Instalacja aktualizacji systemu',
    description: 'Aktualizacja systemu zatrzymuje się na etapie instalacji i wymaga pomocy serwisu.',
    type: TicketType.SERVICE,
    ageDays: 9,
    category: TicketCategory.SOFTWARE,
    priority: TicketPriority.MEDIUM,
    status: TicketStatus.IN_PROGRESS,
    assignee: 'technician',
    resolved: false,
    closed: false,
    comment: 'Zgłoszenie zostało przejęte. Analizuję logi aktualizacji.',
  },
  {
    title: '[DEMO] Brak dostępu do folderu zespołowego',
    description: 'Użytkownik nie może otworzyć folderu współdzielonego działu projektowego.',
    type: TicketType.SERVICE,
    ageDays: 3,
    category: TicketCategory.ACCOUNTS_ACCESS,
    priority: TicketPriority.HIGH,
    status: TicketStatus.WAITING_FOR_USER,
    assignee: 'technician',
    resolved: false,
    closed: false,
    comment: 'Proszę potwierdzić nazwę folderu i moment ostatniego poprawnego dostępu.',
  },
  {
    title: '[DEMO] Niestabilne połączenie z siecią Wi-Fi',
    description: 'Połączenie z firmową siecią Wi-Fi jest okresowo zrywane w sali konferencyjnej.',
    type: TicketType.INCIDENT,
    ageDays: 2,
    category: TicketCategory.NETWORK,
    priority: TicketPriority.CRITICAL,
    status: TicketStatus.RESOLVED,
    assignee: 'technician',
    resolved: true,
    closed: false,
    comment: 'Zmieniono konfigurację punktu dostępowego. Proszę obserwować działanie sieci.',
    resolutionNote: 'Zmieniono kanał i moc nadawania punktu dostępowego w sali konferencyjnej; połączenie jest stabilne.',
  },
  {
    title: '[DEMO] Archiwizacja wiadomości e-mail',
    description: 'Skrzynka pocztowa osiągnęła limit i wymaga uporządkowania archiwum.',
    type: TicketType.SERVICE,
    ageDays: 12,
    category: TicketCategory.EMAIL,
    priority: TicketPriority.LOW,
    status: TicketStatus.CLOSED,
    assignee: 'technician',
    resolved: true,
    closed: true,
    comment: 'Archiwum zostało skonfigurowane, a skrzynka odzyskała wolne miejsce.',
    resolutionNote: 'Włączono archiwizację online i przeniesiono wiadomości starsze niż 2 lata do archiwum.',
  },
  {
    title: '[DEMO] Podejrzana wiadomość phishingowa',
    description: 'Użytkownik otrzymał wiadomość z prośbą o podanie hasła do konta firmowego.',
    type: TicketType.INCIDENT,
    ageDays: 0,
    category: TicketCategory.SECURITY,
    priority: TicketPriority.CRITICAL,
    status: TicketStatus.NEW,
    assignee: undefined,
    resolved: false,
    closed: false,
    comment: undefined,
  },
  {
    title: '[DEMO] Dostęp do aplikacji księgowej',
    description: 'Nowa osoba w dziale finansów potrzebuje dostępu do aplikacji księgowej w trybie odczytu.',
    type: TicketType.SERVICE,
    ageDays: 1,
    category: TicketCategory.ACCOUNTS_ACCESS,
    priority: TicketPriority.LOW,
    status: TicketStatus.NEW,
    assignee: undefined,
    resolved: false,
    closed: false,
    comment: undefined,
  },
];

const DAY_MS = 86_400_000;

async function main() {
  const passwordHash = await bcrypt.hash(testPassword, 12);

  const [admin, technician, user] = await Promise.all([
    prisma.user.upsert({
      where: { email: 'admin@helpdesk.test' },
      update: { firstName: 'Administrator', lastName: '', role: 'ADMIN', isActive: true, passwordHash },
      create: { email: 'admin@helpdesk.test', firstName: 'Administrator', lastName: '', role: 'ADMIN', isActive: true, passwordHash },
    }),
    prisma.user.upsert({
      where: { email: 'technician@helpdesk.test' },
      update: { firstName: 'Serwisant', lastName: '', role: 'TECHNICIAN', isActive: true, passwordHash },
      create: { email: 'technician@helpdesk.test', firstName: 'Serwisant', lastName: '', role: 'TECHNICIAN', isActive: true, passwordHash },
    }),
    prisma.user.upsert({
      where: { email: 'user@helpdesk.test' },
      update: { firstName: 'Użytkownik', lastName: '', role: 'USER', isActive: true, passwordHash },
      create: { email: 'user@helpdesk.test', firstName: 'Użytkownik', lastName: '', role: 'USER', isActive: true, passwordHash },
    }),
  ]);

  for (const demoTicket of demoTickets) {
    const existingTicket = await prisma.ticket.findFirst({
      where: { title: demoTicket.title, reporterId: user.id },
      select: { id: true },
    });

    if (existingTicket) {
      continue;
    }

    const actorId = demoTicket.assignee ? technician.id : user.id;
    const createdAt = new Date(Date.now() - demoTicket.ageDays * DAY_MS);
    const resolvedAt = demoTicket.resolved ? new Date() : undefined;
    const closedAt = demoTicket.closed ? new Date() : undefined;

    await prisma.ticket.create({
      data: {
        title: demoTicket.title,
        description: demoTicket.description,
        type: demoTicket.type,
        createdAt,
        slaDueAt: calculateSlaDueAt(createdAt, demoTicket.type, demoTicket.priority),
        resolutionNote: demoTicket.resolutionNote,
        category: demoTicket.category,
        priority: demoTicket.priority,
        status: demoTicket.status,
        reporterId: user.id,
        assigneeId: demoTicket.assignee ? technician.id : undefined,
        resolvedAt,
        closedAt,
        comments: demoTicket.comment
          ? {
              create: {
                authorId: technician.id,
                content: demoTicket.comment,
              },
            }
          : undefined,
        history: {
          create: [
            {
              actorId: user.id,
              action: TicketHistoryAction.TICKET_CREATED,
              description: 'Utworzono przykładowe zgłoszenie developerskie.',
            },
            ...(demoTicket.assignee
              ? [
                  {
                    actorId: technician.id,
                    action: TicketHistoryAction.ASSIGNEE_CHANGED,
                    description: 'Przypisano zgłoszenie do serwisanta.',
                    newValue: `${technician.firstName} ${technician.lastName}`.trim(),
                  },
                ]
              : []),
            ...(demoTicket.status !== TicketStatus.NEW
              ? [
                  {
                    actorId,
                    action: TicketHistoryAction.STATUS_CHANGED,
                    description: `Zmieniono status zgłoszenia na ${demoTicket.status}.`,
                    oldValue: TicketStatus.NEW,
                    newValue: demoTicket.status,
                  },
                ]
              : []),
            ...(demoTicket.comment
              ? [
                  {
                    actorId: technician.id,
                    action: TicketHistoryAction.COMMENT_ADDED,
                    description: 'Dodano przykładowy komentarz.',
                  },
                ]
              : []),
            ...(demoTicket.resolved
              ? [
                  {
                    actorId: technician.id,
                    action: TicketHistoryAction.TICKET_RESOLVED,
                    description: 'Oznaczono zgłoszenie jako rozwiązane.',
                  },
                ]
              : []),
            ...(demoTicket.closed
              ? [
                  {
                    actorId: technician.id,
                    action: TicketHistoryAction.TICKET_CLOSED,
                    description: 'Zamknięto zgłoszenie.',
                  },
                ]
              : []),
          ],
        },
      },
    });
  }

  console.info(`Seed completed for ${admin.email}, ${technician.email} and ${user.email}.`);
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
