'use strict';

module.exports = text => {
	const result = Number(text);

	if (!Number.isSafeInteger(result)) {
		throw new RangeError('Integer value not representable as a JavaScript number; select it as text');
	}

	return result;
};
