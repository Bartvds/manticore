/// <reference path="../../_ref.d.ts" />

'use strict';

import Manticore = require('manticore');
import Promise = require('es6-promises');

var mc: typeof Manticore = require('../../../dist/index');

var pool = mc.createPool({
	log: true,
	modulePath: require.resolve('./worker'),
	concurrent: 1
});

Promise.all([
	pool.run('sum', [1, 2]),
	pool.run('sum', [10, 20 , 30]),
	pool.run('sum', [1, 2, 3, 4, 5, 6, 7, 8, 9])
])
	.then((res: any[]) => {
		console.log('done!');
		console.log(res);
		// process.exit(0);
	}, (err) => {
		if (err) {
			throw err;
		}
	});
