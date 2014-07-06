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

export var STATUS: string = 'status';

export interface IOptions {
	worker: string;
	concurrent?: number;
	paralel?: number;
	attempts?: number;
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
	if (typeOf(value) !== 'undefined') {
		return value;
	}
	return alt;
}

var timerIDI = 0;
var baseTime = Date.now();

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
	private _id: number = timerIDI++;

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
				// console.log('timeout #%s call %s %s', this._id, (now - this._prev), this._delay);
				this._call();
				this._prev = now;
				this._end = 0;
			}
		};

		this.next();
	}

	next(): void {
		var now = Date.now();
		var end = now + this._delay;

		// console.log('timeout #%s next %s %s', this._id, (now - this._bumped), this._delay);

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
