/// <reference path="../_ref.d.ts" />

'use strict';

import Manticore = require('manticore');
import Promise = require('bluebird');

import helper = require('./helper');

var mc: typeof Manticore = require('../../dist/index');

export function alphabet(params: number): any {
	return new helper.WordStream().pipe(mc.returnStream(false));
}

export function counter(params: number): any {
	return new helper.CountStream(params).pipe(mc.returnStream(true));
}

mc.registerTasks(exports);
