/// <reference path="../_ref.d.ts" />

'use strict';

import Manticore = require('manticore');
import Promise = require('bluebird');

import helper = require('./helper');

var mc: typeof Manticore = require('../../dist/index');

export function numbers(params: number): any {
	var list = new Set();
	for (var i = 0; i < 10; i++) {
		list.add(i);
	}
	return list.size;
}

mc.registerTasks(exports);
