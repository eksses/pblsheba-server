require('dotenv').config();
const { Pool } = require('pg');

let pool = null;

function getPool() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!connectionString) {
    console.warn('[Neon Postgres] DATABASE_URL is not set!');
  }

  pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000
  });

  pool.on('error', (err) => {
    console.error('[Neon Postgres] Unexpected pool error:', err.message);
  });

  return pool;
}

// Helper to determine if a value should be stringified for JSON/JSONB
const isJsonObject = (val) => {
  if (val === null || val === undefined) return false;
  if (val instanceof Date) return false;
  return typeof val === 'object';
};

class NeonQueryBuilder {
  constructor(pool, tableName) {
    this.pool = pool;
    this.tableName = tableName;
    this.operation = 'select'; // select, insert, update, delete, upsert
    this.selectFields = '*';
    this.selectOptions = {};
    this.whereClauses = [];
    this.values = [];
    this.orderClause = null;
    this.limitVal = null;
    this.offsetVal = null;
    this.recordsToInsert = [];
    this.fieldsToUpdate = null;
    this.upsertConflictTarget = 'id';
    this.isSingle = false;
    this.isMaybeSingle = false;
  }

  select(fields = '*', options = {}) {
    this.selectFields = fields;
    this.selectOptions = options || {};
    return this;
  }

  insert(data) {
    this.operation = 'insert';
    this.recordsToInsert = Array.isArray(data) ? data : [data];
    return this;
  }

  update(data) {
    this.operation = 'update';
    this.fieldsToUpdate = data;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  upsert(data, options = {}) {
    this.operation = 'upsert';
    this.recordsToInsert = Array.isArray(data) ? data : [data];
    if (options && options.onConflict) {
      this.upsertConflictTarget = options.onConflict;
    }
    return this;
  }

  eq(column, value) {
    if (value === null || value === undefined) {
      this.whereClauses.push(`"${column}" IS NULL`);
    } else {
      this.values.push(value);
      this.whereClauses.push(`"${column}" = $${this.values.length}`);
    }
    return this;
  }

  neq(column, value) {
    if (value === null || value === undefined) {
      this.whereClauses.push(`"${column}" IS NOT NULL`);
    } else {
      this.values.push(value);
      this.whereClauses.push(`"${column}" != $${this.values.length}`);
    }
    return this;
  }

  in(column, array) {
    if (!Array.isArray(array) || array.length === 0) {
      this.whereClauses.push(`FALSE`);
      return this;
    }
    this.values.push(array);
    this.whereClauses.push(`"${column}" = ANY($${this.values.length})`);
    return this;
  }

  ilike(column, pattern) {
    this.values.push(pattern);
    this.whereClauses.push(`"${column}" ILIKE $${this.values.length}`);
    return this;
  }

  like(column, pattern) {
    this.values.push(pattern);
    this.whereClauses.push(`"${column}" LIKE $${this.values.length}`);
    return this;
  }

  gt(column, value) {
    this.values.push(value);
    this.whereClauses.push(`"${column}" > $${this.values.length}`);
    return this;
  }

  gte(column, value) {
    this.values.push(value);
    this.whereClauses.push(`"${column}" >= $${this.values.length}`);
    return this;
  }

  lt(column, value) {
    this.values.push(value);
    this.whereClauses.push(`"${column}" < $${this.values.length}`);
    return this;
  }

  lte(column, value) {
    this.values.push(value);
    this.whereClauses.push(`"${column}" <= $${this.values.length}`);
    return this;
  }

  order(column, { ascending = true } = {}) {
    const dir = ascending ? 'ASC' : 'DESC';
    this.orderClause = `"${column}" ${dir}`;
    return this;
  }

  limit(n) {
    this.limitVal = parseInt(n);
    return this;
  }

  offset(n) {
    this.offsetVal = parseInt(n);
    return this;
  }

  single() {
    this.isSingle = true;
    this.limitVal = 1;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    this.limitVal = 1;
    return this;
  }

  // Parse select fields into SQL string
  _formatSelectFields() {
    if (!this.selectFields || this.selectFields === '*') {
      return '*';
    }

    // Special handling for relation queries like '*, submittedBy:User(name, phone)'
    if (this.selectFields.includes('submittedBy:User')) {
      return `*, (SELECT json_build_object('name', u.name, 'phone', u.phone) FROM "User" u WHERE u.id = "${this.tableName}"."submittedById") AS "submittedBy"`;
    }

    // Standard comma-separated fields e.g. 'id, name, phone'
    const parts = this.selectFields.split(',').map(f => f.trim()).filter(Boolean);
    return parts.map(col => {
      // Don't quote if already has quotes or subexpression
      if (col.includes('"') || col.includes('(')) return col;
      return `"${col}"`;
    }).join(', ');
  }

  async execute() {
    try {
      const wherePart = this.whereClauses.length > 0 
        ? `WHERE ${this.whereClauses.join(' AND ')}` 
        : '';

      // 1. SELECT Query
      if (this.operation === 'select') {
        const isHeadOnly = this.selectOptions && this.selectOptions.head;
        const wantExactCount = this.selectOptions && this.selectOptions.count === 'exact';

        let countResult = null;
        if (wantExactCount) {
          const countSql = `SELECT COUNT(*)::int as total FROM "${this.tableName}" ${wherePart}`;
          const cRes = await this.pool.query(countSql, this.values);
          countResult = cRes.rows[0]?.total || 0;
          if (isHeadOnly) {
            return { data: null, error: null, count: countResult };
          }
        }

        let sql = `SELECT ${this._formatSelectFields()} FROM "${this.tableName}" ${wherePart}`;

        if (this.orderClause) {
          sql += ` ORDER BY ${this.orderClause}`;
        }
        if (this.limitVal !== null && this.limitVal !== undefined) {
          sql += ` LIMIT ${this.limitVal}`;
        }
        if (this.offsetVal !== null && this.offsetVal !== undefined) {
          sql += ` OFFSET ${this.offsetVal}`;
        }

        const res = await this.pool.query(sql, this.values);
        let rows = res.rows;

        if (this.isSingle) {
          if (rows.length === 0) {
            return { data: null, error: { message: 'Row not found', code: 'PGRST116' }, count: countResult };
          }
          return { data: rows[0], error: null, count: countResult };
        }

        if (this.isMaybeSingle) {
          return { data: rows[0] || null, error: null, count: countResult };
        }

        return { data: rows, error: null, count: wantExactCount ? countResult : rows.length };
      }

      // 2. INSERT Query
      if (this.operation === 'insert') {
        if (!this.recordsToInsert.length) {
          return { data: [], error: null };
        }

        const insertedRows = [];
        for (const record of this.recordsToInsert) {
          const keys = Object.keys(record);
          const cols = keys.map(k => `"${k}"`).join(', ');
          const valPlaceholders = [];
          const queryVals = [];

          keys.forEach(k => {
            queryVals.push(isJsonObject(record[k]) ? JSON.stringify(record[k]) : record[k]);
            valPlaceholders.push(`$${queryVals.length}`);
          });

          const sql = `INSERT INTO "${this.tableName}" (${cols}) VALUES (${valPlaceholders.join(', ')}) RETURNING *`;
          const res = await this.pool.query(sql, queryVals);
          insertedRows.push(res.rows[0]);
        }

        const resultData = this.isSingle || !Array.isArray(this.recordsToInsert) || this.recordsToInsert.length === 1
          ? insertedRows[0]
          : insertedRows;

        return { data: resultData, error: null };
      }

      // 3. UPSERT Query
      if (this.operation === 'upsert') {
        if (!this.recordsToInsert.length) {
          return { data: null, error: null };
        }

        const upsertedRows = [];
        for (const record of this.recordsToInsert) {
          const keys = Object.keys(record);
          const cols = keys.map(k => `"${k}"`).join(', ');
          const valPlaceholders = [];
          const queryVals = [];

          keys.forEach(k => {
            queryVals.push(isJsonObject(record[k]) ? JSON.stringify(record[k]) : record[k]);
            valPlaceholders.push(`$${queryVals.length}`);
          });

          // Build DO UPDATE SET "col" = EXCLUDED."col"
          const updateCols = keys
            .filter(k => k !== this.upsertConflictTarget)
            .map(k => `"${k}" = EXCLUDED."${k}"`)
            .join(', ');

          const conflictClause = updateCols 
            ? `ON CONFLICT ("${this.upsertConflictTarget}") DO UPDATE SET ${updateCols}` 
            : `ON CONFLICT ("${this.upsertConflictTarget}") DO NOTHING`;

          const sql = `INSERT INTO "${this.tableName}" (${cols}) VALUES (${valPlaceholders.join(', ')}) ${conflictClause} RETURNING *`;
          const res = await this.pool.query(sql, queryVals);
          upsertedRows.push(res.rows[0]);
        }

        const resultData = this.isSingle || this.recordsToInsert.length === 1
          ? upsertedRows[0]
          : upsertedRows;

        return { data: resultData, error: null };
      }

      // 4. UPDATE Query
      if (this.operation === 'update') {
        if (!this.fieldsToUpdate || Object.keys(this.fieldsToUpdate).length === 0) {
          return { data: null, error: null };
        }

        const updateKeys = Object.keys(this.fieldsToUpdate);
        const setClauses = [];
        const updateVals = [];

        updateKeys.forEach(k => {
          const val = this.fieldsToUpdate[k];
          updateVals.push(isJsonObject(val) ? JSON.stringify(val) : val);
          setClauses.push(`"${k}" = $${updateVals.length}`);
        });

        // Offset the existing WHERE parameters
        let sqlWhere = '';
        if (this.whereClauses.length > 0) {
          const reindexedWhere = this.whereClauses.map(clause => {
            return clause.replace(/\$(\d+)/g, (match, num) => `$${parseInt(num) + updateVals.length}`);
          });
          sqlWhere = `WHERE ${reindexedWhere.join(' AND ')}`;
        }

        const fullVals = [...updateVals, ...this.values];
        const sql = `UPDATE "${this.tableName}" SET ${setClauses.join(', ')} ${sqlWhere} RETURNING *`;

        const res = await this.pool.query(sql, fullVals);
        const rows = res.rows;

        if (this.isSingle) {
          return { data: rows[0] || null, error: rows.length ? null : { message: 'Row not found' } };
        }

        return { data: rows[0] || null, error: null };
      }

      // 5. DELETE Query
      if (this.operation === 'delete') {
        const sql = `DELETE FROM "${this.tableName}" ${wherePart} RETURNING *`;
        const res = await this.pool.query(sql, this.values);
        return { data: res.rows, error: null };
      }

      return { data: null, error: new Error(`Unsupported operation: ${this.operation}`) };

    } catch (err) {
      console.error(`[Neon Postgres] Query Error on "${this.tableName}" (${this.operation}):`, err.message);
      return { data: null, error: err };
    }
  }

  // Makes the query builder thenable so `await supabase.from(...)` executes directly!
  then(onFulfilled, onRejected) {
    return this.execute().then(onFulfilled, onRejected);
  }

  catch(onRejected) {
    return this.execute().catch(onRejected);
  }
}

class NeonClient {
  from(tableName) {
    return new NeonQueryBuilder(getPool(), tableName);
  }

  // Quick connectivity test
  async ping() {
    try {
      const res = await getPool().query('SELECT 1 as connected');
      return res.rows[0]?.connected === 1;
    } catch (err) {
      return false;
    }
  }

  get pool() {
    return getPool();
  }
}

const neon = new NeonClient();

module.exports = neon;
module.exports.getPool = getPool;
module.exports.NeonClient = NeonClient;
