'use strict';

const Query = require('./internal/query');

const extendFrom = (destination, source, offset) => {
	for (let i = offset; i < source.length; i++) {
		destination.push(source[i]);
	}
};

class QueryFragment extends Query {
	constructor(parts, values) {
		super();
		this._parts = parts;
		this.values = values;
	}

	concat(fragment) {
		if (!(fragment instanceof QueryFragment)) {
			throw new TypeError('Can only concatenate query fragments created with sql`…`');
		}

		const joinedParts = this._parts.slice();
		const extendParts = fragment._parts;
		joinedParts[joinedParts.length - 1] += extendParts[0];
		extendFrom(joinedParts, extendParts, 1);

		return new QueryFragment(
			joinedParts,
			this.values.concat(fragment.values)
		);
	}

	get text() {
		const parts = this._parts;
		let text = parts[0];

		for (let i = 1; i < parts.length; i++) {
			text += '$' + i + parts[i];
		}

		return text;
	}
}

const sql = (parts, ...values) => {
	if (!('raw' in parts)) {
		throw new TypeError('sql`…` must be used as a template string tag');
	}

	return new QueryFragment(parts, values);
};

module.exports = sql;
