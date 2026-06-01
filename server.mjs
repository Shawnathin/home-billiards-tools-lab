import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderCustomersContactsPage } from './apps/customers-contacts/page.mjs';
import { customersContactsApiRouter } from './apps/customers-contacts/routes.mjs';
import { renderCueRepairsPage } from './apps/cue-repairs/page.mjs';
import { cueRepairsApiRouter } from './apps/cue-repairs/routes.mjs';
import { renderFeedbackPage } from './apps/feedback/page.mjs';
import { feedbackApiRouter } from './apps/feedback/routes.mjs';
import { renderJobsWorkOrdersPage } from './apps/jobs-work-orders/page.mjs';
import { jobsWorkOrdersApiRouter } from './apps/jobs-work-orders/routes.mjs';
import { renderProductsInventoryPage } from './apps/products-inventory/page.mjs';
import { productsInventoryApiRouter } from './apps/products-inventory/routes.mjs';
import { renderScheduleBoardPage } from './apps/schedule-board/page.mjs';
import { scheduleBoardApiRouter } from './apps/schedule-board/routes.mjs';
import { renderServicesAndQuotesPage } from './apps/services-and-quotes/page.mjs';
import { servicesAndQuotesApiRouter } from './apps/services-and-quotes/routes.mjs';
import { renderWarrantyServiceTicketsPage } from './apps/warranty-service-tickets/page.mjs';
import { warrantyServiceTicketsApiRouter } from './apps/warranty-service-tickets/routes.mjs';
import { getEnabledApps } from './src/app-registry.mjs';
import { pool } from './src/db.mjs';
import { requireAuth } from './src/middleware.mjs';
import { renderAppShell } from './src/utils/app-shell.mjs';
import { canReviewFeedback } from './src/utils/feedback-access.mjs';
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

app.get('/apps/jobs-work-orders', requireAuth, (req, res) => {
  res.send(renderJobsWorkOrdersPage({ user: req.session.user }));
});

app.use('/api/apps/jobs-work-orders', requireAuth, jobsWorkOrdersApiRouter);

app.get('/apps/schedule-board', requireAuth, (req, res) => {
  res.send(renderScheduleBoardPage({ user: req.session.user }));
});

app.use('/api/apps/schedule-board', requireAuth, scheduleBoardApiRouter);

app.get('/apps/customers-contacts', requireAuth, (req, res) => {
  res.send(renderCustomersContactsPage({ user: req.session.user }));
});

app.use('/api/apps/customers-contacts', requireAuth, customersContactsApiRouter);

app.get('/apps/feedback', requireAuth, (req, res) => {
  if (!canReviewFeedback(req.session.user)) {
    return res.status(403).send('Feedback Inbox is only available to reviewers.');
  }

  return res.send(renderFeedbackPage({ user: req.session.user }));
});

app.use('/api/apps/feedback', requireAuth, feedbackApiRouter);

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

  if (req.path.startsWith('/api/')) {
    return res.status(error.statusCode || 500).json({
      error: error.statusCode && error.statusCode < 500
        ? error.message || 'Request could not be completed.'
        : 'Server error. Check Render logs for details.'
    });
  }

  res.status(500).send('Server error. Check Render logs for details.');
});

app.listen(port, () => {
  console.log(`Home Billiards Tools Lab running on port ${port}`);
});

function renderDashboardPage({ user }) {
  const enabledApps = getEnabledApps({ user });

  return renderAppShell({
    title: 'Home Billiards Tools Lab',
    user,
    activePath: '/dashboard',
    mainLabel: 'Home Billiards Tools Lab dashboard',
    content: `
        <section class="ops-dashboard" aria-labelledby="dashboardTitle">
          <header class="ops-page-header">
            <p class="eyebrow">Internal operations</p>
            <h1 id="dashboardTitle">Home Billiards Tools Lab</h1>
            <p>Internal operations tools for quotes, repairs, products, service tickets, customers, and work orders.</p>
          </header>

          <div class="ops-dashboard-summary" aria-label="Platform summary">
            <article>
              <span>Active tools</span>
              <strong>${enabledApps.length}</strong>
            </article>
            <article>
              <span>Workspace</span>
              <strong>Staff operations</strong>
            </article>
            <article>
              <span>Status</span>
              <strong>Internal tools only</strong>
            </article>
          </div>

          <section class="ops-tool-section" aria-labelledby="activeToolsTitle">
            <div class="ops-section-heading">
              <div>
                <p class="eyebrow">Available now</p>
                <h2 id="activeToolsTitle">Active tools</h2>
              </div>
              <p>${enabledApps.length} module${enabledApps.length === 1 ? '' : 's'} ready for staff use.</p>
            </div>

            <div class="ops-tool-list" aria-label="Active internal tools">
              ${enabledApps.map(renderDashboardTool).join('')}
            </div>
          </section>

          <p class="ops-platform-note">Internal tools only. Some modules may contain demo/reference data until real-use rollout.</p>
        </section>`
  });
}

function renderDashboardTool(app) {
  return `<a class="ops-tool-row" href="${escapeHtml(app.path)}">
                <span class="ops-tool-status">Active</span>
                <span class="ops-tool-copy">
                  <strong>${escapeHtml(app.name)}</strong>
                  <small>${escapeHtml(app.description)}</small>
                </span>
                <span class="ops-tool-open">Open</span>
              </a>`;
}
