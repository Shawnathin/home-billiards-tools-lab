import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from '../src/db.mjs';

const users = [
  {
    username: 'shawn',
    displayName: 'Shawn',
    role: 'admin',
    pin: process.env.SEED_PIN_SHAWN || process.env.SEED_TEMP_PIN
  },
  {
    username: 'keith',
    displayName: 'Keith',
    role: 'staff',
    pin: process.env.SEED_PIN_KEITH || process.env.SEED_TEMP_PIN
  },
  {
    username: 'herlyn',
    displayName: 'Herlyn',
    role: 'staff',
    pin: process.env.SEED_PIN_HERLYN || process.env.SEED_TEMP_PIN
  },
  {
    username: 'diego',
    displayName: 'Diego',
    role: 'staff',
    pin: process.env.SEED_PIN_DIEGO || process.env.SEED_TEMP_PIN
  },
  {
    username: 'mark',
    displayName: 'Mark',
    role: 'staff',
    pin: process.env.SEED_PIN_MARK || process.env.SEED_TEMP_PIN
  }
];

const missing = users.filter((user) => !user.pin).map((user) => user.username);

if (missing.length > 0) {
  console.error(`Missing seed PIN for: ${missing.join(', ')}`);
  console.error('Set SEED_TEMP_PIN for all users or SEED_PIN_NAME for each user in your local .env file.');
  process.exit(1);
}

for (const user of users) {
  if (user.pin.length < 6) {
    console.error(`The seed PIN for ${user.username} is too short. Use at least 6 characters.`);
    process.exit(1);
  }
}

try {
  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.pin, 12);

    await pool.query(
      `
        insert into users (username, display_name, role, password_hash, is_active)
        values ($1, $2, $3, $4, true)
        on conflict (username)
        do update set
          display_name = excluded.display_name,
          role = excluded.role,
          password_hash = excluded.password_hash,
          is_active = true,
          updated_at = now()
      `,
      [user.username, user.displayName, user.role, passwordHash]
    );

    console.log(`Seeded user: ${user.displayName}`);
  }

  console.log('Done. Temporary user accounts are ready.');
} catch (error) {
  console.error('User seeding failed:', error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
