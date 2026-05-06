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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (origin === 'https://localhost' || origin === 'capacitor://localhost' || origin === 'http://localhost') {
      return callback(null, true);
    }
    const allowed = (process.env.CORS_ORIGIN || 'http://localhost:5173')
      .split(',')
      .map((s) => s.trim());
    if (allowed.includes('*') || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

// Backend rate limit per IP. Each match-detail page can fire 6-8 requests
// (fixture, predictions, odds, stats, events, lineups, scorers, h2h) and a
// single user navigating around easily blew through the previous 100/15min
// cap, blocking themselves entirely. The real bottleneck is upstream
// (API-Football per-min quota), already handled in apiFootball.js — this
// limiter only needs to catch runaway loops, not throttle normal use.
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

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
