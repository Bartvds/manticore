/// <reference path="../typings/tsd.d.ts" />

'use strict';

import fs = require('fs');
import path = require('path');
import events = require('events');
import assertMod = require('assert');
import child_process = require('child_process');

import typeOf = require('type-detect');
import Promise = require('bluebird');
import buffo = require('buffo');

import lib = require('./lib');

var jobI: number = 0;

export class Job {
	id: string;
	task: string;
	params: any;
	attempts: number = 1;
	send: boolean = false;
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

	private options: lib.IOptions;
	private child: child_process.ChildProcess;
	private read: NodeJS.ReadWriteStream;
	private write: NodeJS.ReadWriteStream;
	private ready: boolean = false;
	private jobs: JobDict = Object.create(null);
	private idleTimer: lib.BumpTimeout;
	private _activeCount: number = 0;

	kill: () => void;

	constructor(options: lib.IOptions) {
		super();

		this.options = options;

		this.idleTimer = new lib.BumpTimeout(this.options.idleTimeout, () => {
			if (this.activeCount === 0) {
				this.status('idle timeout');
				this.kill();
			}
			else {
				this.idleTimer.next();
			}
		});

		var args: any[] = [
			this.options.worker
		];
		var opts = {
			cwd: process.cwd(),
			stdio: ['ignore', process.stdout, process.stderr, 'pipe', 'pipe', 'ipc']
		};

		this.child = child_process.spawn(process.execPath, args, opts);
		this.id = 'worker.' + this.child.pid;

		this.write = buffo.encodeStream();
		this.write.pipe(this.child.stdio[lib.WORK_TO_CLIENT]);

		this.read = this.child.stdio[lib.CLIENT_TO_WORK].pipe(buffo.decodeStream());
		this.read.on('data', (msg) => {
			if (msg.type === lib.TASK_RESULT) {
				if (msg.id in this.jobs) {
					var job = this.jobs[msg.id];
					this._activeCount--;
					delete this.jobs[msg.id];

					// upfix Error
					if (msg.error) {
						msg.error.toString = () => {
							return msg.message;
						};
					}

					this.status('completed', job, Math.round(msg.duration) + 'ms');

					job.callback(msg.error, msg.result);

					this.emit(lib.TASK_RESULT, job);

					this.idleTimer.next();
				}
			}
		});

		this.child.stdio[lib.WORK_TO_CLIENT].on('close', () => {
			this.status('client closed WORK_TO_CLIENT stream');
			this.kill();
		});

		this.child.stdio[lib.CLIENT_TO_WORK].on('close', () => {
			this.status('client closed CLIENT_TO_WORK stream');
			this.kill();
		});

		this.child.send({a: 1}, null);

		var onMessage = (msg: lib.IResultMessage) => {
			if (msg.type === lib.WORKER_READY) {
				this.status('ready');
				this.ready = true;

				this.flushWaiting();
			}
			else {
				this.status('unknown message', typeOf(msg), JSON.stringify(msg, null, 3));
			}
		};
		var onError = (error: any) => {
			this.status('job error', error);
			this.kill();
		};
		var onClose = (code: number) => {
			this.status('job close', code);
			this.kill();
		};

		this.child.on('message', onMessage);
		this.child.on('error', onError);
		this.child.on('close', onClose);

		this.kill = () => {
			this.status('kill');
			this.write.removeAllListeners();
			this.read.removeAllListeners();

			if (this.child) {
				this.child.stdio[lib.WORK_TO_CLIENT].removeAllListeners();
				this.child.stdio[lib.CLIENT_TO_WORK].removeAllListeners();
				this.child.removeAllListeners();
				this.child.kill('SIGKILL');
				this.child = null;
			}
			this.ready = false;

			this.emit(lib.WORKER_DOWN);

			for (var id in this.jobs) {
				var job = this.jobs[id];
				this._activeCount--;
				delete this.jobs[id];
				this.emit(lib.TASK_ABORT, job);
			}

			this.idleTimer.clear();

			this.removeAllListeners();
		};
	}

	run(job: Job): void {
		if (!this.child) {
			this.emit(lib.TASK_ABORT, job);
			this.kill();
			return;
		}
		this.jobs[job.id] = job;
		this._activeCount++;
		this.idleTimer.next();

		if (this.ready) {
			this.send(job);
		}
	}

	private send(job: Job): void {
		if (job.send) {
			return;
		}
		this.status('started', job);

		var msg: lib.IStartMessage = {
			type: lib.TASK_RUN,
			task: job.task,
			id: job.id,
			params: job.params
		};
		job.send = true;

		// this.child.send(msg, null);
		this.write.write(msg);
	}

	private flushWaiting(): void {
		this.idleTimer.next();

		for (var id in this.jobs) {
			var job = this.jobs[id];
			if (!job.send) {
				this.send(job);
			}
		}
	}

	private status(...message: any[]): void {
		if (this.options.emit) {
			this.emit(lib.STATUS, this + '; ' + message.join('; '));
		}
	}

	get activeCount(): number {
		return this._activeCount;
	}

	toString(): string {
		return this.id + ' <' + (this.child ? (this.activeCount + '/' + this.options.paralel) : 'killed') + '>';
	}
}
