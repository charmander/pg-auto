'use strict';

const tap = require('tap');

const sql = require('../sql');

const queryMatches = (t, query, pattern) => {
	t.is(query.text, pattern.text);
	t.strictSame(query.values, pattern.values);
};

tap.test('basic queries', t => {
	queryMatches(t, sql`SELECT 1`, {text: 'SELECT 1', values: []});
	queryMatches(t, sql`SELECT ${1}`, {text: 'SELECT $1', values: [1]});
	queryMatches(t, sql`SELECT ${'one'}, ${'two'}`, {text: 'SELECT $1, $2', values: ['one', 'two']});
	t.end();
});

tap.test('concatentation', t => {
	queryMatches(t, sql`SELECT 1`.concat(sql` WHERE 1 = 1`), {text: 'SELECT 1 WHERE 1 = 1', values: []});
	queryMatches(t, sql`SELECT `.concat(sql`${1}`), {text: 'SELECT $1', values: [1]});
	queryMatches(t, sql`SELECT ${1}`.concat(sql` WHERE 1 = 1`), {text: 'SELECT $1 WHERE 1 = 1', values: [1]});
	queryMatches(t, sql`SELECT ${'one'}`.concat(sql`, ${'two'}`), {text: 'SELECT $1, $2', values: ['one', 'two']});

	t.throws(
		() => { sql`SELECT 1`.concat(' WHERE 1 = 1'); },
		{constructor: TypeError, message: 'Can only concatenate query fragments created with sql`…`'}
	);

	t.end();
});

tap.test('immutability', t => {
	const a = sql`SELECT `;
	const b = sql`${1}`;
	queryMatches(t, a.concat(b), {text: 'SELECT $1', values: [1]});
	queryMatches(t, a, {text: 'SELECT ', values: []});
	queryMatches(t, b, {text: '$1', values: [1]});

	t.end();
});

tap.test('query text is not based on raw text', t => {
	t.is(sql`SELECT '\\'`.text, "SELECT '\\'");
	t.end();
});

tap.test('template literal requirement', t => {
	t.throws(
		() => { sql(['SELECT 1']); },
		{constructor: TypeError, message: 'sql`…` must be used as a template string tag'}
	);

	t.end();
});
