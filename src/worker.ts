/// <reference path="../typings/tsd.d.ts" />

'use strict';

declare function setTimeout(callback: (...args: any[]) => void, ms: number, ...args: any[]): NodeJS.Timer;
declare function clearTimeout(timeoutId: NodeJS.Timer): void;

import path = require('path');
import events = require('events');
import assertMod = require('assert');
import child_process = require('child_process');

import Promise = require('es6-promises');
import JSONStream = require('JSONStream');

import lib = require('./lib');

var jobI: number = 0;

export class Job {
	id: string;
	task: string;
	params: any;
	attempts: number = 1;
	callback: lib.IResultCallback;

	constructor(task: string, params: any, callback: lib.IResultCallback) {
		this.id = 'job.' + jobI++;
		this.task = task;
		this.params = params;
		this.callback = callback;
	}

	toString(): string {
		return this.id + '-' + this.task;
	}
}

interface JobDict {
	[id: string]: Job;
}

export class Worker extends events.EventEmitter {
	id: string;
	active: number = 0;

	private options: lib.IOptions;
	private child: child_process.ChildProcess;
	private jobs: JobDict = Object.create(null);
	private idleTimer: NodeJS.Timer;

	kill: () => void;

	constructor(options: lib.IOptions) {
		super();

		this.options = options;

		var args: string[] = [
			this.options.modulePath
		];
		var opts = {
			cwd: process.cwd(),
			stdio: ['ignore', process.stdout, process.stderr, 'ipc']
		};

		this.child = child_process.spawn(process.execPath, args, opts);
		this.id = 'worker.' + this.child.pid;

		var onMsg = (msg: lib.IResultMessage) => {
			if (msg.type === lib.TASK_RESULT) {
				if (msg.id in this.jobs) {
					var job = this.jobs[msg.id];
					this.active--;
					delete this.jobs[msg.id];

					job.callback(msg.error, msg.result);
					this.emit(lib.TASK_RESULT, job);
					this.resetIdle();
				}
			}
		};
		var onError = (error: any) => {
			this.emit(lib.STATUS, ['job error', this, error]);
			this.kill();
		};
		var onClose = (code: number) => {
			this.emit(lib.STATUS, ['job close', this, code]);
			this.kill();
		};

		this.child.on('message', onMsg);
		this.child.on('error', onError);
		this.child.on('close', onClose);

		this.kill = () => {
			if (this.child) {
				this.child.removeAllListeners();
				this.child.kill('SIGKILL');
				this.child = null;
			}
			this.emit(lib.WORKER_DOWN);

			for (var id in this.jobs) {
				var job = this.jobs[id];
				this.active--;
				delete this.jobs[id];
				this.emit(lib.TASK_ABORT, job);
			}

			if (this.idleTimer) {
				clearTimeout(this.idleTimer);
			}
		};
	}

	run(job: Job): void {
		if (!this.child) {
			this.emit(lib.TASK_ABORT, job);
			return;
		}
		this.jobs[job.id] = job;
		this.active++;
		this.resetIdle();

		this.emit(lib.STATUS, ['job start', this, job]);

		var msg: lib.IStartMessage = {
			type: lib.TASK_RUN,
			task: job.task,
			id: job.id,
			params: job.params
		};
		this.child.send(msg, null);
	}

	resetIdle(): void {
		if (this.idleTimer) {
			clearTimeout(this.idleTimer);
		}
		if (this.options.idleTimeout > 0) {
			this.idleTimer = setTimeout(() => {
				if (this.active === 0) {
					this.emit(lib.STATUS, ['worker idle', this]);
					this.kill();
				}
			}, this.options.idleTimeout);
		}
	}

	toString(): string {
		return this.id + ' <' + (this.child ? (this.active + '/' + this.options.paralel) : 'killed') + '>';
	}
}
