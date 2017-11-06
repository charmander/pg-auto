'use strict';

const tap = require('tap');

const UnsafeQuery = require('../unsafe-query');

tap.test('correct construction', t => {
	t.matches(new UnsafeQuery('SELECT 1'), {text: 'SELECT 1', values: undefined});
	t.matches(new UnsafeQuery('SELECT 1', undefined), {text: 'SELECT 1', values: undefined});
	t.matches(new UnsafeQuery('SELECT $1', []), {text: 'SELECT $1', values: []});
	t.matches(new UnsafeQuery('SELECT $1', [1]), {text: 'SELECT $1', values: [1]});
	t.end();
});

// For consistency with pg’s `query`.
tap.test('no value copying', t => {
	const values = [1];
	const query = new UnsafeQuery('SELECT $1', values);
	t.is(query.values, values);
	t.end();
});

tap.test('incorrect construction', t => {
	const queryTextError = {constructor: TypeError, message: 'Query text must be a string'};
	const queryValuesError = {constructor: TypeError, message: 'Query values must be an array if provided'};

	t.throws(
		() => { void new UnsafeQuery(); },
		queryTextError
	);

	t.throws(
		() => { void new UnsafeQuery({ toString: () => 'SELECT 1' }); },
		queryTextError
	);

	t.throws(
		() => { void new UnsafeQuery(new String('SELECT 1')); },  // eslint-disable-line no-new-wrappers
		queryTextError
	);

	t.throws(
		() => { void new UnsafeQuery('SELECT 1', null); },
		queryValuesError
	);

	t.throws(
		() => { void new UnsafeQuery('SELECT $1', {0: 1, length: 1}); },
		queryValuesError
	);

	t.throws(
		() => { void new UnsafeQuery('SELECT $1', new Set([1])); },
		queryValuesError
	);

	t.end();
});
