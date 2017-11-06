'use strict';

const array = require('postgres-array');
const parseInt8 = require('./parse-int8');

module.exports = text =>
	array.parse(text, parseInt8);
