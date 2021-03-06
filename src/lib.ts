/// <reference path="../typings/tsd.d.ts" />

'use strict';

declare function setTimeout(callback: (...args: any[]) => void, ms: number, ...args: any[]): NodeJS.Timer;
declare function clearTimeout(timeoutId: NodeJS.Timer): void;

import assertMod = require('assert');
import typeOf = require('type-detect');

export var TASK_RUN: string = 'task_run';
export var TASK_RESULT: string = 'task_result';
export var TASK_ABORT: string = 'task_abort';
export var WORKER_DOWN: string = 'worker_down';
export var WORKER_READY: string = 'worker_ready';
export var ERROR: string = 'error';

export var WORK_TO_CLIENT: number = 3;
export var CLIENT_TO_WORK: number = 4;

export var CLIENT: string = 'c';
export var CLIENT_RETURN: string = 'cr';

export var STATUS: string = 'status';

export var ARG_STREAMS: string = 'mc-streams';

export interface IOptions {
	worker: string;
	concurrent?: number;
	paralel?: number;
	attempts?: number;
	idleTimeout?: number;
	streams?: boolean;
	harmony?: boolean;
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
	error?: any;
	result: any;
	duration: number;
	stream?: string;
	objectMode?: boolean;
}

export interface IResultCallback {
	(err: Error, result: any): void;
}

function strim(str: any, len: number): string {
	str = String(str);
	if (str.length > len) {
		str = str.substr(0, len) + '<...>';
	}
	return str;
}

export function assertProp(value: any, prop: string, type: string): void {
	assertMod(typeOf(value) === 'object', 'expected value to be an object');
	assertMod(typeOf(value[prop]) === type, 'expected value.' + prop + ' to be a ' + type);
}

export function assertType(value: any, type: string, label?: string): void {
	var msg = 'expected ' + (label || strim(value, 40)) + ' to be a ' + type;
	switch (type) {
		case 'arraylike':
			assertMod(typeof value === 'object' && value, msg);
			assertMod(typeof value.length === 'number', msg);
			break;
		default:
			assertMod(typeOf(value) === type, msg);
	}
}

export function optValue<T>(value: T, alt: T): T {
	if (typeOf(value) !== 'undefined') {
		return value;
	}
	return alt;
}

export function jsonError(error: any): any {
	var ret: any = {
		name: error.name,
		message: error.message,
		stack: error.stack
	};
	if (typeof error.code !== 'undefined') {
		ret.code = error.code;
	}
	if (error.name === 'AssertionError') {
		error.actual = error.actual;
		error.expected = error.expected;
		error.showDiff = error.showDiff;
	}
	return ret;
}

export class BumpTimeout {
	// setTimeout that gets reaised a lot so limit resets on bumps

	private _end: number = 0;
	private _delay: number = 0;

	private _call: () => void;
	private _check: () => void;

	private _timer: NodeJS.Timer = null;
	private _unRef: boolean;

	private _bumped: number = Date.now();
	private _prev: number = Date.now();

	constructor(delay: number, call: () => void, unRef: boolean = true) {
		this._delay = delay;
		this._call = call;
		this._unRef = unRef;
		this._check = () => {
			var now = Date.now();
			if (now < this._end) {
				clearTimeout(this._timer);
				this._timer = setTimeout(this._check, this._end - now);
				if (this._unRef) {
					this._timer.unref();
				}
			}
			else {
				this._call();
				this._prev = now;
				this._end = 0;
			}
		};

		this.bump();
	}

	bump(): void {
		var now = Date.now();
		var end = now + this._delay;

		this._bumped = now;

		if (end < this._end || this._end === 0) {
			clearTimeout(this._timer);

			this._timer = setTimeout(this._check, this._delay);
			this._timer.unref();
			if (this._unRef) {
				this._timer.unref();
			}
		}
		this._end = end;
	}

	clear(): void {
		clearTimeout(this._timer);
		this._timer = null;
		this._end = 0;
	}
}
