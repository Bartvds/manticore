/// <reference path="../../_ref.d.ts" />

'use strict';

import Manticore = require('manticore');
import Promise = require('bluebird');
import chai = require('chai');
var assert = chai.assert;

var mc: typeof Manticore = require('../../../dist/index');

var pool = mc.createPool({
	log: true,
	worker: require.resolve('../worker'),
	concurrent: 2
});


Promise.all([
	pool.run('sumNodeAsync', [1, 2]),
	pool.run('sumNodeAsync', [5, 5]),
	pool.run('sumNodeAsync', [10, 20 , 30]),
	pool.run('sumNodeAsync', [1, 2, 3, 4, 5, 6, 7, 8, 9])

]).then((res: any[]) => {
	assert.deepEqual(res, [3, 10, 60, 45]);

	// process.exit(0);
}).then((err) => {
	if (err) {
		throw err;
	}
});
