'use strict';

const Promise = require('bluebird');
const tap = require('tap');

const {Pool, sql} = require('../');

const ERROR_INVALID_TEXT_REPRESENTATION = '22P02';
const ERROR_IN_FAILED_TRANSACTION = '25P02';
const ERROR_READ_ONLY_TRANSACTION = '25006';

const getPool = () =>
	Promise.resolve(new Pool())
		.disposer(pool => {
			pool.end();
		});

// Bluebird.delay doesn’t unref the timer, and tap waits for ref-ed timers
const delay = ms =>
	new Promise(resolve => {
		setTimeout(resolve, ms).unref();
	});

tap.test('type-unsafe queries', t =>
	Promise.using(getPool(), db =>
		Promise.using(db.acquire(), client => {
			t.throws(
				() => { client.query('SELECT 1 AS x'); },
				{constructor: TypeError, message: 'Query must be a Query object'}
			);

			t.throws(
				() => { client.query({text: 'SELECT 1 AS x', values: []}); },
				{constructor: TypeError, message: 'Query must be a Query object'}
			);
		})
	)
);

tap.test('transactions', t => {
	t.test('default', t =>
		Promise.using(getPool(), db =>
			db.transaction(client =>
				client.query(sql`SELECT 'a'::int`)
					.catch({code: ERROR_INVALID_TEXT_REPRESENTATION}, () => {})
					.then(() => client.query(sql`SELECT 1`).reflect())
					.then(inspection => {
						t.is(inspection.reason().code, ERROR_IN_FAILED_TRANSACTION);
						return 'action return value';
					})
			)
		)
			.then(x => {
				t.is(x, 'action return value');
			})
	);

	t.test('commit', t =>
		Promise.using(getPool(), db =>
			Promise.using(db.acquire(), Promise.coroutine(function* (client) {
				yield client.query(sql`CREATE TEMPORARY TABLE test (x integer NOT NULL)`);

				yield client.transaction(() =>
					client.query(sql`INSERT INTO test (x) VALUES (1)`)
				);

				const result = yield client.query(sql`SELECT count(*) FROM test`);
				t.is(result.rows[0].count, 1);

				yield client.query(sql`DISCARD TEMPORARY`);
			}))
		)
	);

	t.test('rollback', t =>
		Promise.using(getPool(), db =>
			Promise.using(db.acquire(), Promise.coroutine(function* (client) {
				yield client.query(sql`CREATE TEMPORARY TABLE test (x integer NOT NULL)`);

				const testError = new Error();

				yield (
					client.transaction(() =>
						client.query(sql`INSERT INTO test (x) VALUES (1)`)
							.throw(testError)
					)
						.catch(error => error === testError, () => {})
				);

				const result = yield client.query(sql`SELECT count(*) FROM test`);
				t.is(result.rows[0].count, 0);

				yield client.query(sql`DISCARD TEMPORARY`);
			}))
		)
	);

	t.test('read-write', () =>
		Promise.using(getPool(), db =>
			db.transaction(
				client =>
					client.query(sql`CREATE TEMPORARY TABLE test (x integer NOT NULL) ON COMMIT DROP`),
				{readOnly: false}
			)
		)
	);

	t.test('read-only', t =>
		Promise.using(getPool(), db =>
			db.transaction(
				client =>
					client.query(sql`CREATE TEMPORARY TABLE test (x integer NOT NULL) ON COMMIT DROP`)
						.reflect()
						.then(inspection => {
							t.is(inspection.reason().code, ERROR_READ_ONLY_TRANSACTION);
						}),
				{readOnly: true}
			)
		)
	);

	// SET TRANSACTION ISOLATION LEVEL will fail after a query if it changes the isolation level
	t.test('read committed', () =>
		Promise.using(getPool(), db =>
			db.transaction(
				client =>
					client.query(sql`SELECT`)
						.then(() => client.query(sql`SET TRANSACTION ISOLATION LEVEL READ COMMITTED`)),
				{isolationLevel: 'read committed'}
			)
		)
	);

	t.test('repeatable read', () =>
		Promise.using(getPool(), db =>
			db.transaction(
				client =>
					client.query(sql`SELECT`)
						.then(() => client.query(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ`)),
				{isolationLevel: 'repeatable read'}
			)
		)
	);

	t.test('serializiable', () =>
		Promise.using(getPool(), db =>
			db.transaction(
				client =>
					client.query(sql`SELECT`)
						.then(() => client.query(sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`)),
				{isolationLevel: 'serializable'}
			)
		)
	);

	t.end();
});

tap.test('client events', t =>
	Promise.using(getPool(), db =>
		Promise.using(db.acquire(), client => {
			const notified = new Promise(resolve => {
				client.on('notification', resolve);
			});

			return client.query(sql`LISTEN test`)
				.then(() => db.query(sql`NOTIFY test, 'success'`))
				.then(() => Promise.race([
					delay(1000).throw(new Error('No message received within one second')),
					notified,
				]))
				.then(message => {
					t.matches(message, {channel: 'test', payload: 'success'});
				});
		})
	)
);

tap.test('Client#query returns a Bluebird promise', t =>
	Promise.using(getPool(), db =>
		Promise.using(db.acquire(), client => {
			const queryPromise = client.query(sql`SELECT`);

			t.type(queryPromise, Promise);

			return queryPromise;
		})
	)
);
