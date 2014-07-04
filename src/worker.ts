/// <reference path="../typings/tsd.d.ts" />

'use strict';

import path = require('path');
import assertMod = require('assert');
import typeOf = require('type-detect');

import lib = require('./lib');

var state = {
	id: 'worker.' + process.pid,
	tasks: Object.create(null)
};

export interface ITaskFunc {
	(params: any, callback: lib.IResultCallback): any;
}

export interface ITaskDict {
	[name: string]: ITaskFunc;
}

export function registerTasks(map: ITaskDict): void {
	Object.keys(map).forEach((key) => {
		var func = map[key];
		assertMod(typeOf(func) === 'function', 'expected ' + key + ' to be a function');
		state.tasks[key] = func;
	});
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

	if (!(msg.task in state.tasks)) {
		res.type = lib.ERROR;
		res.error = new Error('unknown task ' + msg.task);
		return;
	}

	var start = Date.now();
	var hasSent = false;
	var result: any = null;

	var send = () => {
		if (!hasSent) {
			hasSent = true;
			res.duration = Date.now() - start;
			process.send(res, null);
		}
	};

	try {
		result = state.tasks[msg.task](msg.params, (error: Error, result: any) => {
			res.error = error;
			res.result = result;
			send();
		});
		if (typeOf(result) !== 'undefined' && !hasSent) {
			if (typeOf(result.then) === 'function') {
				result.then((res: any) => {
					res.result = result;
					send();
				}, (err: Error) => {
					res.error = err;
					send();
				});
			}
			else {
				res.result = result;
				send();
			}
		}
	}
	catch (e) {
		res.type = lib.TASK_ABORT;
		res.error = e;
		send();
	}
}

process.on('message', (msg: any) => {
	if (msg.type === lib.TASK_RUN) {
		runFunc(<lib.IStartMessage> msg);
	}
});
