[![Build status][ci image]][ci]

pg-auto is a wrapper around [pg][] that enforces type safety with queries and defaults to returning [Bluebird][bluebird] promises.


## Installation

```shellsession
$ npm install pg-auto
```


## Usage

Import pg-auto’s main tools:

```js
const {Pool, sql} = require('pg-auto');
```

Create a connection pool (the options are the same as pg’s [client][pg-client-options] and [pool][pg-pool-options] options):

```js
const db = new Pool({
    host: '/var/run/postgresql',
    database: 'example',
});
```

Add an error listener to avoid exiting when a pooled client not currently in use encounters an error:

```js
db.on('error', error => {
    console.error('Idle client error:', error);
});
```

Create queries with the `sql` template literal tag and run them through the pool:

```js
const language = 'en';
const result = await db.query(sql`SELECT greeting FROM greetings WHERE language = ${language}`);
console.log(result.rows[0].greeting);  // Hello, world!
```


## API

### <code>sql\`…\`</code>

A template literal tag for SQL. Converts interpolated values to query parameters.

### ``sql`…`.concat(sql`…`)``

Returns the concatenation of two pieces of SQL. For more complex dynamic queries, consider using a query builder (like [Knex][knex] or [node-sql][]) instead.

```js
let query = sql`SELECT greeting FROM greetings`;

if (searchPattern) {
    query = query.concat(sql` WHERE language ILIKE '%' || ${searchPattern} || '%'`);
}

await db.query(query);
```

### `new Pool([options])`

Constructs a connection pool. The options are the same as pg’s [client][pg-client-options] and [pool][pg-pool-options] options, and the pool emits the same events as the pg pool.

### `Pool#query(query)`

Runs a query using a client from the pool, returning a Bluebird promise that will resolve to a [pg result][pg-result].

### `Pool#transaction(action, [options])`

Runs the function `action` in a transaction, passing the client in which the transaction is active as an argument to `action`. `action` should return a promise. The transaction will be committed if the returned promise resolves, and rolled back if it rejects.

The available options, which reflect [the options to `BEGIN`][begin-options], are:

- `isolationLevel`: Controls the transaction’s isolation level. One of `'read committed'`, `'repeatable read'`, or `'serializable'`.
- `readOnly`: Whether the transaction should be read-only.
- `deferrable`: Whether the transaction should be deferrable.

```js
await db.transaction(async client => {
    await client.query(sql`INSERT INTO a VALUES ('a')`);
    await client.query(sql`INSERT INTO b VALUES ('b')`);
});
```

### `Pool#acquire()`

For other, non-[transaction](#pool-transaction-action-options) cases when multiple queries have to be run in the same client. Returns a [Bluebird-managed][bluebird-resources] client object that provides a `query()` and `transaction()` respectively equivalent to [`Pool#query`](#pool-query-query) and [`Pool#transaction`](#pool-transaction-action-options), and emits the same events as a pg client.

### `Pool#end()`

Closes pool connections and invalidates the pool, like [`pg.Pool#end()`][pg-pool-end].


## FAQ

### How do I use a variable number of values with `IN`?

Use an array parameter with [the `= ANY` operator][any-array-operator] instead:

```js
const names = ['a', 'b', 'c'];

db.query(sql`SELECT id FROM tags WHERE name = ANY (${names})`)
```

### Why isn’t my server exiting?

pg-auto uses a connection pool, which keeps connections alive for a while to avoid the overhead of creating new connections. Use [`db.end()`](#pool-end) to close idle connections and allow Node to exit.


  [any-array-operator]: https://www.postgresql.org/docs/10/static/functions-comparisons.html#idm46046882500112
  [begin-options]: https://www.postgresql.org/docs/10/static/sql-begin.html
  [bluebird]: https://github.com/petkaantonov/bluebird
  [bluebird-resources]: http://bluebirdjs.com/docs/api/resource-management.html
  [knex]: http://knexjs.org/
  [node-sql]: https://github.com/brianc/node-sql
  [pg]: https://github.com/brianc/node-postgres
  [pg-client-options]: https://node-postgres.com/api/client#new-client-config-object-
  [pg-pool-end]: https://node-postgres.com/api/pool#pool-end
  [pg-pool-options]: https://node-postgres.com/api/pool#new-pool-config-object-
  [pg-result]: https://node-postgres.com/api/result

  [ci]: https://travis-ci.org/charmander/pg-auto
  [ci image]: https://api.travis-ci.org/charmander/pg-auto.svg
