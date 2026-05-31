import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './src/db.mjs';
import { requireAuth } from './src/middleware.mjs';

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
  const user = req.session.user;

  res.send(`<!doctype html>
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
          <h2>No tools installed yet.</h2>
          <p>The toolbox is empty, but at least the door works.</p>
        </div>

        <div class="tool-grid" aria-label="Future tools placeholder">
          <article class="tool-card muted-card">
            <span class="tool-status">Coming later</span>
            <h3>Cue Tracker</h3>
            <p>Not connected yet. The live staff tracker stays untouched.</p>
          </article>
          <article class="tool-card muted-card">
            <span class="tool-status">Coming later</span>
            <h3>Project Command Center</h3>
            <p>Future workspace for bigger operational projects.</p>
          </article>
          <article class="tool-card muted-card">
            <span class="tool-status">Coming later</span>
            <h3>Product Data Admin</h3>
            <p>Future home for product records, specs, and catalog data.</p>
          </article>
        </div>
      </section>
    </main>
  </body>
</html>`);
});

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

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
