import * as Sentry from '@sentry/node';

Sentry.init({
  dsn:
    process.env.SENTRY_DSN ||
    'https://429a5352fccf4cb87bc94d29cb42d188@o4510340404477952.ingest.us.sentry.io/4510340486201344',
  sendDefaultPii: true,
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '1.0'),

  environment: process.env.NODE_ENV || 'development',

  debug: process.env.NODE_ENV === 'development',
});

export default Sentry;
