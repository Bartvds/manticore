/// <reference path="../typings/tsd.d.ts" />

'use strict';

console.log('worker module read');

declare function setTimeout(callback: (...args: any[]) => void, ms: number, ...args: any[]): NodeJS.Timer;
declare function clearTimeout(timeoutId: NodeJS.Timer): void;

import fs = require('fs');
import path = require('path');
import util = require('util');
import assertMod = require('assert');
import typeOf = require('type-detect');
import JSONStream = require('JSONStream');

import lib = require('./lib');

var through2: any = require('through2');

var state = {
	id: 'worker.' + process.pid,
	tasks: <ITaskDict> Object.create(null),
	active: <IHandleDict> Object.create(null),
	isInit: false
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

var read = null;
var write = null;

function testFS(num: number) {
	console.log('test fs ' + num);
	try {
		console.log(fs.fstatSync(num));
	}
	catch (e) {
		console.log(e);
	}
}

function init(): void {
	if (state.isInit) {
		return;
	}
	state.isInit = true;

	console.log('init ' + state.id);

	var fdCheck = setInterval(() => {
		try {
			fs.fstatSync(lib.WORK_TO_CLIENT);
			fs.fstatSync(lib.CLIENT_TO_WORK);
		}
		catch (e) {
			console.log('skip fd');
			return;
		}
		console.log('got fd');

		clearInterval(fdCheck);

		read = fs.createReadStream(null, {fd: lib.WORK_TO_CLIENT});

		var objects = read.pipe(JSONStream.parse(true));

		objects.on('data', (msg) => {
			console.log('client objects data');
			console.log(msg);
			if (msg.type === lib.TASK_RUN) {
				process.nextTick(() => {
					runFunc(<lib.IStartMessage> msg);
				});
			}
			else {
				console.log('client unknown data');
				console.log(msg);
			}
		});

		read.on('data', function (data) {
			console.log('r data');
			console.log(String(data));
		});

		read.on('error', function (err) {
			console.error(err);
			console.error(err);
			console.error(err.stack);
		});

		read.on('close', (msg) => {
			console.error('r closed read stream');
		});

		read.on('end', (msg) => {
			console.error('r ended read stream');
		});

		write = JSONStream.stringify(false);
		write.pipe(through2()).pipe(fs.createWriteStream(null, {fd: lib.CLIENT_TO_WORK}));

		process.send({type: lib.WORKER_READY});

	}, 10);

	process.on('uncaughtException', (err: any) => {
		abortAll();
		console.error(err.stack);
		// rethrow
		throw err;
	});
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

export function registerTasks(map: any): void {
	if (!state.isInit) {
		init();
	}
	if (typeOf(map) === 'array') {
		map.forEach(registerTask);
	}
	else if (typeOf(map) === 'object') {
		Object.keys(map).forEach((name) => {
			var func = map[name];
			lib.assertType(func, 'function', name);
			defineTask(name, func);
		});
	}
}

export function registerTask(arg: any, func?: ITaskFunc): void {
	if (!state.isInit) {
		init();
	}
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
				// process.send(res, null);
				console.log('client send');
				console.log(res);
				write.write(res);
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
