const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const routes = require('./routes');
const logger = require('./utils/logger');

const app = express();

app.use(helmet());
app.use(compression());
// 64kb is plenty for our payloads (FCM token register = a few hundred
// bytes). The previous 10mb let an attacker cheaply pressure memory.
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: true, limit: '64kb' }));

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (origin === 'https://localhost' || origin === 'capacitor://localhost' || origin === 'http://localhost') {
      return callback(null, true);
    }
    const allowed = (process.env.CORS_ORIGIN || 'http://localhost:5173')
      .split(',')
      .map((s) => s.trim());
    // Wildcard combined with credentials:true is unsafe and forbidden by
    // the CORS spec — explicitly refuse it so a misconfigured env var
    // can't silently expose authenticated endpoints to any origin.
    if (allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-scan-key'],
  credentials: true,
};

app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

// Backend rate limit per IP — effectively disabled for a single-user app.
// Hardcoded to 100_000/15min so any env var override (older Render config)
// can't reintroduce the 200-cap that was blocking pronostics page loads.
// Real protection sits one layer up in apiFootball.js (upstream quota
// short-circuit) and at the API-Football provider level.
// Trust the first proxy in front (Render's load balancer) so
// express-rate-limit can correctly read X-Forwarded-For for IP
// identification. Avoids ERR_ERL_UNEXPECTED_X_FORWARDED_FOR warning.
app.set('trust proxy', 1);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Tight per-IP cap on unauthenticated mutation endpoints (FCM token
// register/unregister). Real users hit /register once per app launch;
// 30/15min/IP gives ample room while making a token-flood attack costly.
const mutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/notifications/register', mutationLimiter);
app.use('/api/notifications/unregister', mutationLimiter);

app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

app.get('/version', (req, res) => {
  res.json({ version: '1.1.0', deployed: new Date().toISOString() });
});

app.get('/api/quota', (req, res) => {
  const apiFootball = require('./services/apiFootball');
  res.json(apiFootball.getQuotaInfo());
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  // Rate limit from API-Football → return a clear 429 so the frontend can
  // show a 'try again in X seconds' message instead of looking broken.
  if (err.code === 'RATE_LIMITED') {
    return res.status(429).json({
      error: 'API momentanément saturée. Réessaie dans quelques secondes.',
      code: 'RATE_LIMITED',
      retryAfterMs: err.retryAfterMs || 30_000,
    });
  }
  logger.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

module.exports = app;
