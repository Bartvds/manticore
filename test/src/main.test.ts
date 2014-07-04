/// <reference path="../_ref.d.ts" />

'use strict';

import path = require('path');
import util = require('util');
import child_process = require('child_process');

import Manticore = require('manticore');
import Promise = require('es6-promises');

import chai = require('chai');
var assert = chai.assert;

var mc: typeof Manticore = require('../../dist/index');

function testMantiSub(main: string) {
	var script = path.resolve(main);

	it(path.relative(__dirname, script), (done) => {
		var args = [script];
		var opts = {
			stdio: 'inherit'
		};
		var cp = child_process.spawn('node', args, opts);

		cp.on('close', (code: number) => {
			if (code) {
				done(new Error('bad exit code ' + code));
			}
			else {
				done();
			}
		});
	});
}

describe('core', () => {
	it('assertion', () => {
		var pool = mc.createPool({
			modulePath: require.resolve('./worker')
		});
		return pool.run('assertionError', 123).then((res) => {
			assert.fail('expected to fail');
		}, (err) => {
			assert.isObject(err);
			assert.strictEqual(err.message, 'expected 123 to be a string');
			assert.strictEqual(err.name, 'AssertionError');
		});
	});
	it('anon', () => {
		var pool = mc.createPool({
			modulePath: require.resolve('./worker')
		});
		return pool.run('anon', 123).then((res) => {
			assert.strictEqual(123, res);
		});
	});
	it('named', () => {
		var pool = mc.createPool({
			modulePath: require.resolve('./worker')
		});
		return pool.run('named', 123).then((res) => {
			assert.strictEqual(123, res);
		});
	});
	it('array', () => {
		var pool = mc.createPool({
			modulePath: require.resolve('./worker')
		});
		return Promise.all([
			pool.run('arrayA', 123),
			pool.run('arrayB', 321)
		]).then((res) => {
			assert.deepEqual(res, [123, 321]);
		});
	});
});

describe('resolution', () => {

	var data = [
		[1, 2, 3, 4],
		[1, 2, 3, 4],
		[11, 22, 33, 44],
		[11, 22, 33, 44],
		[111, 222, 333, 444],
		[111, 222, 333, 444],
	];

	var expected = [
		10,
		10,
		110,
		110,
		1110,
		1110
	];

	function testMethod(method: string) {
		it(method, () => {
			var pool = mc.createPool({
				modulePath: require.resolve('./worker'),
				concurrent: 2
			});

			return Promise.all(data.map((value) => {
				return pool.run(method, value);
			})).then((res) => {
				assert.deepEqual(res, expected);
			});
		});
	}

	testMethod('sumSync');
	testMethod('sumNodeSync');
	testMethod('sumNodeAsync');
	testMethod('sumPromise');
});

describe('errors', () => {
	function testError(method: string) {
		it(method, () => {
			var pool = mc.createPool({
				modulePath: require.resolve('./worker'),
				concurrent: 2
			});

			return pool.run(method, 123).then((res) => {
				assert.fail('expected to fail');
			}, (err) => {
				assert.isObject(err);
				assert.strictEqual(err.message, 'foo');
				assert.strictEqual(err.name, 'Error');
			});
		});
	}

	testError('errorSync');
	testError('errorNodeSync');
	testError('errorNodeAsync');
	testError('errorPromise');
});

describe('cases', () => {
	testMantiSub(path.join(__dirname, 'many', 'main.js'));
});
