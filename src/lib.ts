/// <reference path="../typings/tsd.d.ts" />

'use strict';

import assertMod = require('assert');
import typeOf = require('type-detect');

export var TASK_RUN: string = 'task_run';
export var TASK_RESULT: string = 'task_result';
export var TASK_ABORT: string = 'task_abort';
export var WORKER_DOWN: string = 'worker_down';
export var ERROR: string = 'error';

export var STATUS: string = 'status';

export interface IOptions {
	modulePath: string;
	concurrent?: number;
	paralel?: number;
	attempts?: number;
	timeout?: number;
	idleTimeout?: number;
	log?: boolean;
	emit?: boolean;
}

export interface IStartMessage {
	id: string;
	type: string;
	task: string;
	params: any;
}

export interface IResultMessage {
	id: string;
	type: string;
	worker: string;
	error: any;
	result: any;
	duration: number;
}

export interface IResultCallback {
	(err: Error, result: any): void;
}

export function assertProp(value: any, prop: string, type: string): void {
	assertMod(typeOf(value) === 'object', 'expected value to be an object');
	assertMod(typeOf(value[prop]) === type, 'expected value.' + prop + ' to be a ' + type);
}

export function assertType(value: any, type: string, label?: string): void {
	assertMod(typeOf(value) === type, 'expected ' + (label || value) + ' to be a ' + type);
}

export function optValue<T>(value: T, alt: T): T {
	if (typeof value !== 'undefined') {
		return value;
	}
	return alt;
}
