/// <reference path="../_ref.d.ts" />

'use strict';

import Manticore = require('manticore');
import Promise = require('bluebird');

var mc: typeof Manticore = require('../../dist/index');

export function sumSync(params: number[]): any {
	mc.assertType(params, 'array');

	return params.reduce((memo: number, value: number) => {
		return memo + value;
	}, 0);
}

export function sumNodeSync(params: number[], callback: (err: Error, result: any) => void): void {
	mc.assertType(params, 'array');

	callback(null, params.reduce((memo: number, value: number) => {
		return memo + value;
	}, 0));
}

export function sumNodeAsync(params: number[], callback: (err: Error, result: any) => void): void {
	mc.assertType(params, 'array');

	setTimeout(() => {
		callback(null, params.reduce((memo: number, value: number) => {
			return memo + value;
		}, 0));
	}, 10);
}

export function sumPromise(params: number[]): any {
	mc.assertType(params, 'array');

	return new Promise((resolve, reject) => {
		resolve(params.reduce((memo: number, value: number) => {
			return memo + value;
		}, 0));
	});
}

export function assertionError(params: number[]): any {
	mc.assertType(params, 'string');
}

export function errorSync(params: number[]): any {
	throw new Error('foo');
}

export function errorNodeSync(params: number[], callback: (err: Error, result: any) => void): void {
	callback(new Error('foo'), null);
}

export function errorNodeAsync(params: number[], callback: (err: Error, result: any) => void): void {
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

mc.registerTask('anon', function(params) {
	return params;
});

function named(params) {
	return params;
}

mc.registerTask(named);
