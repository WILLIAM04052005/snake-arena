import { buildServer } from './app';

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '0.0.0.0';
const CORS_ORIGIN = (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',');

const { app } = buildServer({ corsOrigin: CORS_ORIGIN, logger: true });

app.listen({ port: PORT, host: HOST }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
