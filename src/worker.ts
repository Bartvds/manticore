/// <reference path="../typings/tsd.d.ts" />

'use strict';

import path = require('path');
import util = require('util');
import assertMod = require('assert');
import typeOf = require('type-detect');

import lib = require('./lib');

var state = {
	id: 'worker.' + process.pid,
	tasks: <ITaskDict> Object.create(null),
	active: <IHandleDict> Object.create(null)
};

export interface ITaskFunc {
	(params: any, callback: lib.IResultCallback): any;
}

export interface ITaskDict {
	[name: string]: ITaskFunc;
}

interface IHandle {
	msg: lib.IStartMessage;
	res: lib.IResultMessage;
	hasSent(): boolean;
	send(): void;
}

interface IHandleDict {
	[id: string]: IHandle;
}

function abortAll(): void {
	for (var id in state.active) {
		var info = state.active[id];
		info.res.type = lib.TASK_ABORT;
		info.send();
	}
}

function defineTask(name: string, func: ITaskFunc): void {
	lib.assertType(name, 'string', 'name');
	lib.assertType(func, 'function', 'func');
	assertMod(!(name in state.tasks), 'cannot redefine task ' + name + '');

	state.tasks[name] = func;
}

export function registerTasks(map: ITaskDict): void {
	Object.keys(map).forEach((name) => {
		var func = map[name];
		lib.assertType(func, 'function', name);
		defineTask(name, func);
	});
}

export function registerTask(arg: any, func: ITaskFunc): void {
	if (typeOf(arg) === 'function') {
		func = arg;
		arg = arg.name;
	}
	defineTask(arg, func);
}

function runFunc(msg: lib.IStartMessage): void {
	var res: lib.IResultMessage = {
		worker: state.id,
		type: lib.TASK_RESULT,
		id: msg.id,
		error: null,
		result: null,
		duration: null
	};

	var start = Date.now();
	var result: any = null;
	var hasSent: boolean = false;

	var info: IHandle = {
		msg: msg,
		res: res,
		hasSent: () => {
			return hasSent;
		},
		send: () => {
			delete state.active[msg.id];

			if (!hasSent) {
				// errors don't serialise well
				if (typeOf(res.error) === 'object') {
					var err = {
						name: res.error.name,
						message: res.error.message,
						stack: res.error.stack,
						// add some bling
						code: res.error.code,
						actual: res.error.actual,
						expected: res.error.expected
					};
					res.error = err;
				}
				res.duration = Date.now() - start;
				hasSent = true;
				process.send(res, null);
			}
		}
	};

	state.active[msg.id] = info;

	if (!(msg.task in state.tasks)) {
		res.type = lib.ERROR;
		res.error = new Error('unknown task ' + msg.task);
		info.send();
	}

	try {
		result = state.tasks[msg.task](msg.params, (error: Error, result: any) => {
			res.error = error;
			res.result = result;
			info.send();
		});
		if (typeOf(result) !== 'undefined' && !hasSent) {
			if (typeOf(result.then) === 'function') {
				result.then((result: any) => {
					res.result = result;
					info.send();
				}, (err: Error) => {
					res.error = err;
					info.send();
				});
			}
			else {
				res.result = result;
				info.send();
			}
		}
	}
	catch (e) {
		res.error = e;
		info.send();
	}
}

process.on('uncaughtException', (err: Error) => {
	abortAll();
	// rethrow
	throw err;
});

process.on('message', (msg: any) => {
	if (msg.type === lib.TASK_RUN) {
		runFunc(<lib.IStartMessage> msg);
	}
});
