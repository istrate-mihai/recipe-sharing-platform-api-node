// scripts/migrate-mysql-to-postgres.js
// Node.js 22, ESM
// Run ONCE: node scripts/migrate-mysql-to-postgres.js
// Reads from Railway MySQL (prod), writes to Railway PostgreSQL (new)

import mysql from 'mysql2/promise';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.migration' });

// ── Connections ───────────────────────────────────────────────────────────────

const mysqlConn = await mysql.createConnection({
  host:     process.env.MYSQL_HOST,
  port:     Number(process.env.MYSQL_PORT),
  user:     process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  ssl:      { rejectUnauthorized: false },
});

const pgPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

console.log('✅ Connected to MySQL and PostgreSQL');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Temporarily disable FK checks in PG so we can insert in any order.
 * Re-enable after all inserts.
 */
async function withDeferredConstraints(pgClient, fn) {
  await pgClient.query('SET session_replication_role = replica');
  await fn(pgClient);
  await pgClient.query('SET session_replication_role = DEFAULT');
}

/** Reset a PostgreSQL sequence to the max id in the table */
async function resetSequence(pgClient, table, column = 'id') {
  await pgClient.query(
    `SELECT setval(pg_get_serial_sequence('${table}', '${column}'), COALESCE(MAX(${column}), 1)) FROM "${table}"`
  );
}

// ── Migration functions ───────────────────────────────────────────────────────

async function migrateUsers(pgClient) {
  console.log('→ Migrating users...');
  const [rows] = await mysqlConn.query('SELECT * FROM users');

  for (const row of rows) {
    await pgClient.query(
      `INSERT INTO users (id, name, email, email_verified_at, password, avatar, bio,
        remember_token, stripe_customer_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO NOTHING`,
      [
        row.id, row.name, row.email, row.email_verified_at,
        row.password, row.avatar, row.bio, row.remember_token,
        row.stripe_customer_id, row.created_at, row.updated_at,
      ]
    );
  }

  await resetSequence(pgClient, 'users');
  console.log(`   ✅ ${rows.length} users migrated`);
}

async function migrateRecipes(pgClient) {
  console.log('→ Migrating recipes...');
  const [rows] = await mysqlConn.query('SELECT * FROM recipes');

  for (const row of rows) {
    // MySQL steps is JSON string, parse to ensure valid JSON in PG
    const steps = typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps;
    const nutritionalInfo = row.nutritional_info
      ? (typeof row.nutritional_info === 'string' ? JSON.parse(row.nutritional_info) : row.nutritional_info)
      : null;

    await pgClient.query(
      `INSERT INTO recipes (id, user_id, status, title, description, category, difficulty,
        prep_time, cook_time, servings, steps, likes_count, nutritional_info, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (id) DO NOTHING`,
      [
        row.id, row.user_id, row.status ?? 'published', row.title, row.description,
        row.category, row.difficulty, row.prep_time, row.cook_time,
        row.servings ?? 4, JSON.stringify(steps), row.likes_count ?? 0,
        nutritionalInfo ? JSON.stringify(nutritionalInfo) : null,
        row.created_at, row.updated_at,
      ]
    );
  }

  await resetSequence(pgClient, 'recipes');
  console.log(`   ✅ ${rows.length} recipes migrated`);
}

async function migrateIngredients(pgClient) {
  console.log('→ Migrating ingredients...');
  const [rows] = await mysqlConn.query('SELECT * FROM ingredients');

  for (const row of rows) {
    await pgClient.query(
      `INSERT INTO ingredients (id, recipe_id, quantity, unit, name, "order", created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO NOTHING`,
      [row.id, row.recipe_id, row.quantity, row.unit, row.name, row.order, row.created_at, row.updated_at]
    );
  }

  await resetSequence(pgClient, 'ingredients');
  console.log(`   ✅ ${rows.length} ingredients migrated`);
}

async function migrateRecipeImages(pgClient) {
  console.log('→ Migrating recipe_images...');
  const [rows] = await mysqlConn.query('SELECT * FROM recipe_images');

  for (const row of rows) {
    await pgClient.query(
      `INSERT INTO recipe_images (id, recipe_id, path, "order", is_primary, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO NOTHING`,
      [row.id, row.recipe_id, row.path, row.order, row.is_primary === 1, row.created_at, row.updated_at]
    );
  }

  await resetSequence(pgClient, 'recipe_images');
  console.log(`   ✅ ${rows.length} recipe images migrated`);
}

async function migrateLikes(pgClient) {
  console.log('→ Migrating likes...');
  const [rows] = await mysqlConn.query('SELECT * FROM likes');

  for (const row of rows) {
    await pgClient.query(
      `INSERT INTO likes (id, user_id, recipe_id, created_at)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (id) DO NOTHING`,
      [row.id, row.user_id, row.recipe_id, row.created_at]
    );
  }

  await resetSequence(pgClient, 'likes');
  console.log(`   ✅ ${rows.length} likes migrated`);
}

async function migrateFavourites(pgClient) {
  console.log('→ Migrating favourites...');
  const [rows] = await mysqlConn.query('SELECT * FROM favourites');

  for (const row of rows) {
    await pgClient.query(
      `INSERT INTO favourites (id, user_id, recipe_id, created_at)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (id) DO NOTHING`,
      [row.id, row.user_id, row.recipe_id, row.created_at]
    );
  }

  await resetSequence(pgClient, 'favourites');
  console.log(`   ✅ ${rows.length} favourites migrated`);
}

async function migrateCollections(pgClient) {
  console.log('→ Migrating collections...');
  const [rows] = await mysqlConn.query('SELECT * FROM collections');

  for (const row of rows) {
    await pgClient.query(
      `INSERT INTO collections (id, user_id, name, description, is_public, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO NOTHING`,
      [row.id, row.user_id, row.name, row.description, row.is_public === 1, row.created_at, row.updated_at]
    );
  }

  await resetSequence(pgClient, 'collections');
  console.log(`   ✅ ${rows.length} collections migrated`);
}

async function migrateCollectionRecipe(pgClient) {
  console.log('→ Migrating collection_recipe...');
  const [rows] = await mysqlConn.query('SELECT * FROM collection_recipe');

  for (const row of rows) {
    await pgClient.query(
      `INSERT INTO collection_recipe (id, collection_id, recipe_id, "order", created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (id) DO NOTHING`,
      [row.id, row.collection_id, row.recipe_id, row.order, row.created_at, row.updated_at]
    );
  }

  await resetSequence(pgClient, 'collection_recipe');
  console.log(`   ✅ ${rows.length} collection_recipe rows migrated`);
}

async function migrateSubscriptions(pgClient) {
  console.log('→ Migrating subscriptions...');
  const [rows] = await mysqlConn.query('SELECT * FROM subscriptions');

  for (const row of rows) {
    await pgClient.query(
      `INSERT INTO subscriptions (id, user_id, stripe_id, stripe_customer_id, stripe_price_id, status, ends_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO NOTHING`,
      [
        row.id, row.user_id, row.stripe_id, row.stripe_customer_id,
        row.stripe_price_id, row.status, row.ends_at, row.created_at, row.updated_at,
      ]
    );
  }

  await resetSequence(pgClient, 'subscriptions');
  console.log(`   ✅ ${rows.length} subscriptions migrated`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

const pgClient = await pgPool.connect();

try {
  await withDeferredConstraints(pgClient, async (client) => {
    // Order matters for FK dependencies
    await migrateUsers(client);
    await migrateRecipes(client);
    await migrateIngredients(client);
    await migrateRecipeImages(client);
    await migrateLikes(client);
    await migrateFavourites(client);
    await migrateCollections(client);
    await migrateCollectionRecipe(client);
    await migrateSubscriptions(client);
  });

  console.log('\n🎉 Migration complete!');
} catch (err) {
  console.error('❌ Migration failed:', err);
  process.exit(1);
} finally {
  pgClient.release();
  await mysqlConn.end();
  await pgPool.end();
}
