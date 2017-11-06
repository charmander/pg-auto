'use strict';

const Promise = require('bluebird');
const tap = require('tap');

const {Pool, sql} = require('../');
const UnsafeQuery = require('../unsafe-query');

const getPool = () =>
	Promise.resolve(new Pool())
		.disposer(pool => {
			pool.end();
		});

tap.test('simple queries', t =>
	Promise.using(getPool(), db =>
		Promise.join(
			db.query(sql`SELECT 1 AS x`),
			db.query(sql`SELECT ${'test'}::text AS x`),
			db.query(sql`SELECT ${{x: 1}}::jsonb`),
			(a, b, c) => {
				t.same(a.rows, [{x: 1}]);
				t.is(a.rows[0].x, 1);

				t.same(b.rows, [{x: 'test'}]);
				t.is(b.rows[0].x, 'test');

				t.same(c.rows, [{jsonb: {x: 1}}]);
				t.strictSame(c.rows[0].jsonb, {x: 1});
			}
		)
	)
);

tap.test('unsafe queries', t =>
	Promise.using(getPool(), db =>
		db.query(new UnsafeQuery('SELECT 1 AS x')).then(result => {
			t.same(result.rows, [{x: 1}]);
			t.is(result.rows[0].x, 1);
		})
	)
);

tap.test('type-unsafe queries', t =>
	Promise.using(getPool(), db => {
		t.throws(
			() => { db.query('SELECT 1 AS x'); },
			{constructor: TypeError, message: 'Query must be a Query object'}
		);

		t.throws(
			() => { db.query({text: 'SELECT 1 AS x', values: []}); },
			{constructor: TypeError, message: 'Query must be a Query object'}
		);
	})
);

tap.test('pool events', t =>
	Promise.using(getPool(), db =>
		Promise.using(db.acquire(), Promise.coroutine(function* (client) {
			const result = yield db.query(sql`SELECT pg_backend_pid()`);
			const pid = result.rows[0].pg_backend_pid;

			const idleErrorPromise = new Promise(resolve => {
				db.on('error', resolve);
			});

			yield client.query(sql`SELECT pg_terminate_backend(${pid})`);

			const idleError = yield idleErrorPromise;

			t.matches(idleError, {code: '57P01'});
		}))
	)
);

tap.test('Pool#query returns a Bluebird promise', t =>
	Promise.using(getPool(), db => {
		const queryPromise = db.query(sql`SELECT`);

		t.type(queryPromise, Promise);

		return queryPromise;
	})
);

tap.test('clients are returned to the pool', t =>
	Promise.using(getPool(), db =>
		Promise.using(db.acquire(), () => {})
			.then(() => {
				t.is(db._pool.idleCount, 1);
			})
	)
);

tap.test('failed clients are removed from the pool', t =>
	Promise.using(getPool(), db => {
		const testError = new Error();

		return Promise.using(db.acquire(), () => Promise.reject(testError))
			.catch(error => error === testError, () => {})
			.then(() => {
				t.is(db._pool.totalCount, 0);
			});
	})
);

tap.test('clients cannot be used once returned to the pool', t => {
	t.test('with acquire', t =>
		Promise.using(getPool(), db => {
			let client;

			return Promise.using(db.acquire(), client_ => {
				client = client_;
			})
				.then(() => {
					t.throws(
						() => { client.query(sql`SELECT 1`); },
						{constructor: Error, message: 'A query cannot be executed through a released client'}
					);
				});
		})
	);

	t.test('with transaction', t =>
		Promise.using(getPool(), db => {
			let client;

			return db.transaction(client_ => {
				client = client_;
			})
				.then(() => {
					t.throws(
						() => { client.query(sql`SELECT 1`); },
						{constructor: Error, message: 'A query cannot be executed through a released client'}
					);
				});
		})
	);

	t.end();
});

tap.test('big integers are returned as integers when still safe integers', t =>
	Promise.using(getPool(), db =>
		db.query(sql`SELECT ${Number.MAX_SAFE_INTEGER}::int8, ARRAY[${Number.MAX_SAFE_INTEGER}::int8, NULL]`).then(result => {
			t.is(result.rows[0].int8, Number.MAX_SAFE_INTEGER);
			t.is(result.rows[0].array[0], Number.MAX_SAFE_INTEGER);
			t.is(result.rows[0].array[1], null);
		})
	)
);

tap.test('big integers are returned as integers when still safe integers', t =>
	Promise.using(getPool(), db =>
		Promise.all([
			db.query(sql`SELECT ${Number.MAX_SAFE_INTEGER}::int8 + 1`).reflect(),
			db.query(sql`SELECT ARRAY[${Number.MAX_SAFE_INTEGER}::int8 + 1]`).reflect(),
		]).then(inspections => {
			inspections.forEach(inspection => {
				t.matches(
					inspection.reason(),
					{
						constructor: RangeError,
						message: 'Integer value not representable as a JavaScript number; select it as text',
					}
				);
			});
		})
	)
);
