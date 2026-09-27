import { app } from './app.js';
import { env } from './config/env.js';
import { backfillMissingSlaDueDates } from './services/sla.service.js';

// Legacy tickets get their SLA deadline before traffic is served. SLA list
// filters and dashboard counts rely on the stored column, so a failure is
// fatal and the container restart policy retries instead of serving
// inconsistent SLA data.
try {
  const filled = await backfillMissingSlaDueDates();
  if (filled) console.info(`SLA deadlines backfilled for ${filled} ticket(s).`);
} catch (error) {
  console.error('SLA deadline backfill failed; refusing to start.', error);
  process.exit(1);
}

const server = app.listen(env.port, () => {
  console.info(`HelpDesk API listening on port ${env.port}`);
});

const shutdown = (signal: string) => {
  console.info(`${signal} received. Closing HTTP server.`);
  server.close((error) => {
    if (error) {
      console.error('Failed to close HTTP server.', error);
      process.exitCode = 1;
    }
    process.exit();
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
