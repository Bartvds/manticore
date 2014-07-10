/// <reference path="../_ref.d.ts" />

'use strict';

import path = require('path');
import util = require('util');
import child_process = require('child_process');

import Manticore = require('manticore');
import Promise = require('bluebird');

import chai = require('chai');
var assert = chai.assert;

var mc: typeof Manticore = require('../../dist/index');

describe('string', () => {
	it('simple', () => {
		var pool = mc.createPool({
			worker: require.resolve('./worker')
		});
		var value = Array(20).join('a');
		return pool.run('echo', value).then((res) => {
			assert.strictEqual(res, value);
		});
	});
	it('long', () => {
		var pool = mc.createPool({
			worker: require.resolve('./worker')
		});
		var value = Array(20).join('a');
		return pool.run('echo', value).then((res) => {
			assert.strictEqual(res, value);
		});
	});
	it('utf8', () => {
		var pool = mc.createPool({
			worker: require.resolve('./worker')
		});
		var value = '明日がある。';
		return pool.run('echo', value).then((res) => {
			assert.strictEqual(res, value);
		});
	});
});

describe('buffer', () => {
	it('simple', () => {
		var pool = mc.createPool({
			worker: require.resolve('./worker')
		});
		var value = new Buffer('abcdefg');
		return pool.run('echo', value).then((res) => {
			assert.deepEqual(res, value);
		});
	});
	it('kilo', () => {
		var pool = mc.createPool({
			worker: require.resolve('./worker')
		});
		var value = new Buffer(1024);
		return pool.run('echo', value).then((res) => {
			assert.deepEqual(res, value);
		});
	});
	it('mega', () => {
		var pool = mc.createPool({
			worker: require.resolve('./worker')
		});
		var value = new Buffer(1024 * 1024);
		return pool.run('echo', value).then((res) => {
			assert.deepEqual(res, value);
		});
	});
});

describe('json', () => {
	it('object', () => {
		var pool = mc.createPool({
			worker: require.resolve('./worker')
		});
		var value = {a: 1, b: 2, c: [1, 2]};
		return pool.run('echo', value).then((res) => {
			assert.deepEqual(res, value);
		});
	});
	it('array', () => {
		var pool = mc.createPool({
			worker: require.resolve('./worker')
		});
		var value = [1, 2, 3];
		return pool.run('echo', value).then((res) => {
			assert.deepEqual(res, value);
		});
	});
});

describe('core', () => {
	it('assertion', () => {
		var pool = mc.createPool({
			worker: require.resolve('./worker')
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
			worker: require.resolve('./worker')
		});
		return pool.run('anon', 123).then((res) => {
			assert.strictEqual(res, 123);
		});
	});
	it('named', () => {
		var pool = mc.createPool({
			worker: require.resolve('./worker')
		});
		return pool.run('named', 123).then((res) => {
			assert.strictEqual(res, 123);
		});
	});
	it('array', () => {
		var pool = mc.createPool({
			worker: require.resolve('./worker')
		});
		return Promise.all([
			pool.run('arrayA', 123),
			pool.run('arrayB', 321)
		]).then((res) => {
			assert.deepEqual(res, [123, 321]);
		});
	});
	it('curried', () => {
		var pool = mc.createPool({
			worker: require.resolve('./worker')
		});
		var curried = pool.curried('named');
		return curried(123).then((res) => {
			assert.strictEqual(res, 123);
		});
	});

	it('long', () => {
		var pool = mc.createPool({
			worker: require.resolve('./worker'),
			concurrent: 1
		});
		var nums = [];
		for (var i = 0; i < 10000; i++) {
			nums.push(i);
		}
		return pool.run('sumNodeAsync', nums);
	});

	it('many', () => {
		var pool = mc.createPool({
			worker: require.resolve('./worker'),
			concurrent: 2,
			paralel: 2
		});
		var work = [];
		for (var i = 0; i < 500; i++) {
			var nums = [];
			for (var j = i; j < i + 500; j++) {
				nums.push(j);
			}
			work.push(pool.run('sumNodeAsync', nums));
		}
		return Promise.all(work);
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
				worker: require.resolve('./worker'),
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
				worker: require.resolve('./worker'),
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

	testMantiSub(path.join(__dirname, 'many', 'main.js'));
});
