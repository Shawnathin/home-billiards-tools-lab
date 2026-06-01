import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderCueRepairsPage } from './apps/cue-repairs/page.mjs';
import { cueRepairsApiRouter } from './apps/cue-repairs/routes.mjs';
import { renderProductsInventoryPage } from './apps/products-inventory/page.mjs';
import { productsInventoryApiRouter } from './apps/products-inventory/routes.mjs';
import { renderServicesAndQuotesPage } from './apps/services-and-quotes/page.mjs';
import { servicesAndQuotesApiRouter } from './apps/services-and-quotes/routes.mjs';
import { renderWarrantyServiceTicketsPage } from './apps/warranty-service-tickets/page.mjs';
import { warrantyServiceTicketsApiRouter } from './apps/warranty-service-tickets/routes.mjs';
import { appRegistry, getEnabledApps } from './src/app-registry.mjs';
import { pool } from './src/db.mjs';
import { requireAuth } from './src/middleware.mjs';
import { escapeHtml } from './src/utils/html.mjs';

const requiredEnv = ['DATABASE_URL', 'SESSION_SECRET'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  console.error(`Missing required environment variable(s): ${missingEnv.join(', ')}`);
  console.error('Create a .env file locally or add these values in Render environment variables.');
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');

const app = express();
const PgSession = connectPgSimple(session);
const isProduction = process.env.NODE_ENV === 'production';
const port = process.env.PORT || 3000;

// Render sits behind a proxy. This lets secure cookies work correctly in production.
app.set('trust proxy', 1);

app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: '32kb' }));

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: 'session',
      createTableIfMissing: true
    }),
    name: 'hbtl.sid',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

app.use(express.static(publicDir, { index: false }));

app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }

  return res.sendFile(path.join(publicDir, 'index.html'));
});

app.post('/login', async (req, res, next) => {
  try {
    const username = String(req.body.user || '').trim().toLowerCase();
    const submittedPin = String(req.body.pin || '');

    if (!username || !submittedPin) {
      return res.redirect('/?error=missing');
    }

    const result = await pool.query(
      `
        select id, username, display_name, role, password_hash, is_active
        from users
        where username = $1
        limit 1
      `,
      [username]
    );

    const foundUser = result.rows[0];
    const passwordMatches = foundUser
      ? await bcrypt.compare(submittedPin, foundUser.password_hash)
      : false;

    const loginSucceeded = Boolean(foundUser && foundUser.is_active && passwordMatches);

    await pool
      .query(
        `
          insert into login_events (user_id, username_attempted, success, ip_address, user_agent)
          values ($1, $2, $3, $4, $5)
        `,
        [
          foundUser?.id || null,
          username,
          loginSucceeded,
          req.ip,
          req.get('user-agent') || null
        ]
      )
      .catch((error) => {
        console.warn('Login event failed to save:', error.message);
      });

    if (!loginSucceeded) {
      return res.redirect('/?error=login');
    }

    req.session.regenerate((error) => {
      if (error) {
        return next(error);
      }

      req.session.user = {
        id: foundUser.id,
        username: foundUser.username,
        displayName: foundUser.display_name,
        role: foundUser.role
      };

      return res.redirect('/dashboard');
    });
  } catch (error) {
    return next(error);
  }
});

app.get('/dashboard', requireAuth, (req, res) => {
  res.send(renderDashboardPage({ user: req.session.user }));
});

app.get('/apps/services-and-quotes', requireAuth, (req, res) => {
  res.send(renderServicesAndQuotesPage({ user: req.session.user }));
});

app.use('/api/apps/services-and-quotes', requireAuth, servicesAndQuotesApiRouter);

app.get('/apps/cue-repairs', requireAuth, (req, res) => {
  res.send(renderCueRepairsPage({ user: req.session.user }));
});

app.use('/api/apps/cue-repairs', requireAuth, cueRepairsApiRouter);

app.get('/apps/products-inventory', requireAuth, (req, res) => {
  res.send(renderProductsInventoryPage({ user: req.session.user }));
});

app.use('/api/apps/products-inventory', requireAuth, productsInventoryApiRouter);

app.get('/apps/warranty-service-tickets', requireAuth, (req, res) => {
  res.send(renderWarrantyServiceTicketsPage({ user: req.session.user }));
});

app.use('/api/apps/warranty-service-tickets', requireAuth, warrantyServiceTicketsApiRouter);

app.post('/logout', requireAuth, (req, res, next) => {
  req.session.destroy((error) => {
    if (error) {
      return next(error);
    }

    res.clearCookie('hbtl.sid');
    return res.redirect('/');
  });
});

app.use((req, res) => {
  res.status(404).send('Not found');
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).send('Server error. Check Render logs for details.');
});

app.listen(port, () => {
  console.log(`Home Billiards Tools Lab running on port ${port}`);
});

function renderDashboardPage({ user }) {
  const enabledApps = getEnabledApps();
  const dashboardMessage =
    enabledApps.length > 0
      ? `${enabledApps.length} tool${enabledApps.length === 1 ? '' : 's'} ready.`
      : 'No tools installed yet.';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Home Billiards Tools Lab</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <main class="dashboard-shell">
      <section class="dashboard-panel glass-panel" aria-label="Home Billiards Tools Lab dashboard">
        <header class="dashboard-header">
          <img src="/assets/home-billiards-logo-app.png" alt="Home Billiards" width="520" height="304" />
          <form method="post" action="/logout">
            <button class="secondary-action" type="submit">Log out</button>
          </form>
        </header>

        <p class="eyebrow">Internal tools</p>
        <h1>Home Billiards Tools Lab</h1>
        <p class="welcome-line">Welcome, ${escapeHtml(user.displayName)}.</p>

        <div class="empty-toolbox">
          <h2>${escapeHtml(dashboardMessage)}</h2>
          <p>Pick an available tool below.</p>
        </div>

        <div class="tool-grid" aria-label="Internal tools">
          ${appRegistry.map(renderToolCard).join('')}
        </div>
      </section>
    </main>
  </body>
</html>`;
}

function renderToolCard(app) {
  const status = escapeHtml(formatStatus(app.status));
  const content = `
    <span class="tool-status">${status}</span>
    <h3>${escapeHtml(app.name)}</h3>
    <p>${escapeHtml(app.description)}</p>
  `;

  if (app.enabled && app.path) {
    return `<a class="tool-card tool-card-link" href="${escapeHtml(app.path)}">${content}</a>`;
  }

  return `<article class="tool-card muted-card">${content}</article>`;
}

function formatStatus(status) {
  if (status === 'v1') {
    return 'v1';
  }

  return String(status || 'coming_later').replaceAll('_', ' ');
}
