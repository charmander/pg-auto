'use strict';

const Query = require('./internal/query');

module.exports = class UnsafeQuery extends Query {
	constructor(text, values) {
		if (typeof text !== 'string') {
			throw new TypeError('Query text must be a string');
		}

		if (values !== undefined && !Array.isArray(values)) {
			throw new TypeError('Query values must be an array if provided');
		}

		super();
		this.text = text;
		this.values = values;
	}
};
