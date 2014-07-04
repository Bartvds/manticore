/// <reference path="../../_ref.d.ts" />

'use strict';

import Manticore = require('manticore');

var mc: typeof Manticore = require('../../../dist/index');

export function sum(params: number[], callback: (err: Error, result: any) => void): void {
	mc.assertType(params, 'array');
	setTimeout(() => {
		callback(null, params.reduce((memo: number, value: number) => {
			return memo + value;
		}, 0));
	}, 500);
}

mc.registerTasks(module.exports);
