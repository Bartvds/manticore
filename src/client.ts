/// <reference path="../typings/tsd.d.ts" />

'use strict';

import fs = require('fs');
import path = require('path');
import util = require('util');
import stream = require('stream');
import assertMod = require('assert');
import typeOf = require('type-detect');
import buffo = require('buffo');
import multiplexMod = require('multiplex');
import minimist = require('minimist');

import lib = require('./lib');
import streams = require('./streams');

var argv = minimist(process.argv.slice(2), {
	boolean: [lib.ARG_STREAMS]
});

var state = {
	id: 'worker.' + process.pid,
	tasks: <ITaskDict> Object.create(null),
	active: <HandleDict> Object.create(null),
	closing: false,
	isInit: false
};

var read: NodeJS.ReadableStream = null;
var write: NodeJS.WritableStream = null;
var objects: NodeJS.ReadWriteStream = null;

var multiplex: multiplexMod.Multiplex;

export interface ITaskFunc {
	(params: any, callback: lib.IResultCallback): any;
}

export interface ITaskDict {
	[name: string]: ITaskFunc;
}

interface HandleDict {
	[id: string]: Handle;
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

		write = buffo.encodeStream();

		if (argv[lib.ARG_STREAMS]) {
			multiplex = multiplexMod();
			multiplex.pipe(fs.createWriteStream(null, {fd: lib.CLIENT_TO_WORK}));
			write.pipe(multiplex.createStream(lib.CLIENT));
		}
		else {
			write.pipe(fs.createWriteStream(null, {fd: lib.CLIENT_TO_WORK}));
		}

		write.on('error', function (err) {
			state.closing = true;
			bail('object input stream errored', err);
		});

		objects = read.pipe(buffo.decodeStream());

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
	read.removeAllListeners();
	write.removeAllListeners();
	objects.removeAllListeners();
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

export function returnStream(objectMode: boolean): NodeJS.ReadWriteStream {
	return streams.createClientReturn(objectMode);
}

class Handle {
	private start = Date.now();
	public hasSent: boolean = false;

	constructor(private msg: lib.IStartMessage, public res: lib.IResultMessage) {

	}

	send(): void {
		delete state.active[this.msg.id];
		if (this.hasSent) {
			return;
		}
		this.res.duration = Date.now() - this.start;

		// detect stream
		if (this.res.result && this.res.result.owner === streams.ident) {
		if (!argv[lib.ARG_STREAMS]) {
			this.res.error = new Error('enable stream support in pool options');
			this.res.result = null;
		}
		else {
			var stream = <streams.IDStream> this.res.result;
			this.res.stream = stream.id;
			this.res.objectMode = stream.objectMode;
			this.res.result = null;
			process.nextTick(() => {
				var out = multiplex.createStream(stream.id);
				stream.on('end', () => {
					// multiplex.destroyStream(stream.id);
				});
				stream.pipe(out);
			});
		}
		}
		// Errors don't serialise well
		if (typeOf(this.res.error) === 'object') {
			this.res.error = lib.jsonError(this.res.error);
		}
		this.hasSent = true;
		write.write(this.res);
	}
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

	var info = new Handle(msg, res);
	var result: any = null;

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
		if (typeOf(result) !== 'undefined' && !info.hasSent) {
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

process.on('exit', () => {
	console.log('exit %s', state.id);
});
