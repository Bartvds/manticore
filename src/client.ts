/// <reference path="../typings/tsd.d.ts" />

'use strict';

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
	closing: false,
	isInit: false
};

var read: NodeJS.ReadableStream = null;
var write: NodeJS.WritableStream = null;
var objects: NodeJS.ReadWriteStream = null;

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

function init(): void {
	if (state.isInit || state.closing) {
		return;
	}
	state.isInit = true;
	var fdI = 0;
	var fdCheck = setInterval(() => {
		try {
			fs.fstatSync(lib.WORK_TO_CLIENT);
			fs.fstatSync(lib.CLIENT_TO_WORK);
		}
		catch (e) {
			if (fdI++ > 10) {
				bail('cannot locate file descriptors');
			}
			return;
		}

		clearInterval(fdCheck);

		read = fs.createReadStream(null, {fd: lib.WORK_TO_CLIENT});

		read.on('error', function (err) {
			bail('client intput stream errored', err);
		});

		read.on('close', () => {
			bail('client intput stream unexpectedly closed');
		});

		read.on('end', () => {
			bail('client intput stream unexpectedly ended');
		});

		write = JSONStream.stringify(false);
		write.pipe(through2()).pipe(fs.createWriteStream(null, {fd: lib.CLIENT_TO_WORK}));

		write.on('error', function (err) {
			state.closing = true;
			bail('object input stream errored', err);
		});

		objects = read.pipe(JSONStream.parse(true));

		objects.on('data', (msg) => {
			if (msg.type === lib.TASK_RUN) {
				process.nextTick(() => {
					runFunc(<lib.IStartMessage> msg);
				});
			}
			else {
				console.error('client unknown data');
				console.error(msg);
			}
		});

		objects.on('error', function (err) {
			state.closing = true;
			bail('object input stream errored', err);
		});

		process.send({type: lib.WORKER_READY});

	}, 10);

	process.on('uncaughtException', (err: any) => {
		bail('uncaughtException', err);
	});
}

function bail(message: any, ...messages: any[]): void {
	console.error.apply(console, arguments);
	abortAll();

	if (read) {
		read.removeAllListeners();
	}
	if (write) {
		write.removeAllListeners();
	}
	if (objects) {
		objects.removeAllListeners();
	}
	process.exit(1);
}

function abortAll(): void {
	if (!state.closing) {
		for (var id in state.active) {
			var info = state.active[id];
			info.res.type = lib.TASK_ABORT;
			info.send();
		}
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
				process.nextTick(() => {
					write.write(res);
				});
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

process.on('uncaughtException', (e) => {
	bail(e);
	throw e;
});
