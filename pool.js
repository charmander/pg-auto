'use strict';

const Promise = require('bluebird');
const pg = require('pg');
const TypeOverrides = require('pg/lib/type-overrides');

const Client = require('./internal/client');
const Query = require('./internal/query');
const parseInt8 = require('./internal/parse-int8');
const parseInt8Array = require('./internal/parse-int8-array');

const OID_INT8 = 20;
const OID_INT8_ARRAY = 1016;

const defaultTypes = new TypeOverrides();
defaultTypes.setTypeParser(OID_INT8, parseInt8);
defaultTypes.setTypeParser(OID_INT8_ARRAY, parseInt8Array);

class Pool {
	constructor(options) {
		const pgOptions = {Promise};
		Object.assign(pgOptions, options);

		if (!('types' in pgOptions)) {
			pgOptions.types = defaultTypes;
		}

		this._pool = new pg.Pool(pgOptions);
	}

	query(query) {
		if (!(query instanceof Query)) {
			throw new TypeError('Query must be a Query object');
		}

		return this._pool.query(query);
	}

	acquire() {
		return this._pool.connect()
			.then(client => new Client(client))
			.disposer((client, useOutcome) => {
				const error = useOutcome.isRejected() ?
					useOutcome.reason() :
					null;

				client._release(error);
			});
	}

	transaction(action, options) {
		return Promise.using(
			this.acquire(),
			client => client.transaction(
				() => action(client),
				options
			)
		);
	}

	end() {
		this._pool.end();
	}

	on(eventName, listener) {
		this._pool.on(eventName, listener);
		return this;
	}

	once(eventName, listener) {
		this._pool.once(eventName, listener);
		return this;
	}

	prependListener(eventName, listener) {
		this._pool.prependListener(eventName, listener);
		return this;
	}

	prependOnceListener(eventName, listener) {
		this._pool.prependOnceListener(eventName, listener);
		return this;
	}

	removeListener(eventName, listener) {
		this._pool.removeListener(eventName, listener);
		return this;
	}
}

Object.defineProperty(Pool.prototype, 'addListener', Object.getOwnPropertyDescriptor(Pool.prototype, 'on'));

module.exports = Pool;
