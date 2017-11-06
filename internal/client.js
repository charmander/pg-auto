'use strict';

const Promise = require('bluebird');
const pg = require('pg');
const {inspect} = require('util');
const Query = require('./query');
const UnsafeQuery = require('../unsafe-query');
const sql = require('../sql');

const QUERY_BEGIN = sql`BEGIN`;
const QUERY_COMMIT = sql`COMMIT`;
const QUERY_ROLLBACK = sql`ROLLBACK`;

const ISOLATION_LEVELS = new Set([
	'read committed',
	'repeatable read',
	'serializable',
]);

const bracket = (begin, commit, rollback, action) =>
	begin().then(
		() =>
			Promise.try(action)
				.tap(commit)
				.tapCatch(rollback)
	);

const queryAsync = Promise.promisify(pg.Client.prototype.query);

const releasedQuery = () => {
	throw new Error('A query cannot be executed through a released client');
};

const getTransactionBegin = options => {
	if (!options) {
		return QUERY_BEGIN;
	}

	const modes = [];
	const isolationLevel = options.isolationLevel;

	if (options.readOnly) {
		modes.push('READ ONLY');
	}

	if (options.deferrable) {
		modes.push('DEFERRABLE');
	}

	if (isolationLevel) {
		if (!ISOLATION_LEVELS.has(isolationLevel)) {
			throw new Error('Invalid transaction isolation level ' + inspect(isolationLevel));
		}

		modes.push('ISOLATION LEVEL ' + isolationLevel);
	}

	return new UnsafeQuery('BEGIN ' + modes.join(', '));
};

class Client {
	constructor(client) {
		this._client = client;
	}

	query(query) {
		if (!(query instanceof Query)) {
			throw new TypeError('Query must be a Query object');
		}

		return queryAsync.call(this._client, query);
	}

	transaction(action, options) {
		const beginQuery = getTransactionBegin(options);

		return bracket(
			() => this.query(beginQuery),
			() => this.query(QUERY_COMMIT),
			() => this.query(QUERY_ROLLBACK),
			action
		);
	}

	_release(error) {
		this._client.release(error);
		this.query = releasedQuery;
	}

	on(eventName, listener) {
		this._client.on(eventName, listener);
		return this;
	}

	once(eventName, listener) {
		this._client.once(eventName, listener);
		return this;
	}

	prependListener(eventName, listener) {
		this._client.prependListener(eventName, listener);
		return this;
	}

	prependOnceListener(eventName, listener) {
		this._client.prependOnceListener(eventName, listener);
		return this;
	}

	removeListener(eventName, listener) {
		this._client.removeListener(eventName, listener);
		return this;
	}
}

Object.defineProperty(Client.prototype, 'addListener', Object.getOwnPropertyDescriptor(Client.prototype, 'on'));

module.exports = Client;
