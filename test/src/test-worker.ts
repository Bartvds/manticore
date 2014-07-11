/// <reference path="../_ref.d.ts" />

'use strict';

import Manticore = require('manticore');
import Promise = require('bluebird');

var mc: typeof Manticore = require('../../dist/index');

function reduce<T, U>(nums: T[], call: (memo: U, value: T) => U, memo: U): U {
	return Array.prototype.reduce.call(nums, call, memo);
}

export function sumSync(params: number[]): any {
	mc.assertType(params, 'arraylike');

	return reduce(params, (memo: number, value: number) => {
		return memo + value;
	}, 0);
}

export function sumNodeSync(params: number[], callback: Manticore.ICallback): void {
	mc.assertType(params, 'arraylike');

	callback(null, reduce(params, (memo: number, value: number) => {
		return memo + value;
	}, 0));
}

export function sumNodeAsync(params: number[], callback: Manticore.ICallback): void {
	mc.assertType(params, 'arraylike');

	setTimeout(() => {
		callback(null, reduce(params, (memo: number, value: number) => {
			return memo + value;
		}, 0));
	}, 10);
}

export function sumPromise(params: number[]): any {
	mc.assertType(params, 'arraylike');

	return new Promise((resolve, reject) => {
		resolve(reduce(params, (memo: number, value: number) => {
			return memo + value;
		}, 0));
	});
}

export function echo(params: string[]): any {
	return new Promise((resolve, reject) => {
		resolve(params);
	});
}

export function assertionError(params: number[]): any {
	mc.assertType(params, 'string');
}

export function errorSync(params: number[]): any {
	throw new Error('foo');
}

export function errorNodeSync(params: number[], callback: Manticore.ICallback): void {
	callback(new Error('foo'), null);
}

export function errorNodeAsync(params: number[], callback: Manticore.ICallback): void {
	setTimeout(() => {
		callback(new Error('foo'), null);
	}, 50);
}

export function errorPromise(params: number[]): any {
	return new Promise((resolve, reject) => {
		reject(new Error('foo'));
	});
}

mc.registerTasks(module.exports);

mc.registerTasks([
	function arrayA(params) {
		return params;
	},
	function arrayB(params) {
		return params;
	}
]);

mc.registerTask('anon', function (params) {
	return params;
});

function named(params) {
	return params;
}

mc.registerTask(named);
