/// <reference path="../_ref.d.ts" />

'use strict';

import path = require('path');
import chai = require('chai');
import child_process = require('child_process');
var assert = chai.assert;

function testMantiSub(main: string) {
	var script = path.resolve(main);

	it(path.relative(__dirname, script), (done) => {
		var args = [];
		args.push(script);

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

describe('cases', () => {
	testMantiSub(path.join(__dirname, 'simple', 'main.js'));
});
