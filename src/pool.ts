/// <reference path="../typings/tsd.d.ts" />

'use strict';

declare function setTimeout(callback: (...args: any[]) => void, ms: number, ...args: any[]): NodeJS.Timer;
declare function clearTimeout(timeoutId: NodeJS.Timer): void;

import os = require('os');
import path = require('path');
import events = require('events');
import assertMod = require('assert');
import child_process = require('child_process');

import Promise = require('es6-promises');

import lib = require('./lib');

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

export interface IPool extends NodeJS.EventEmitter {
	run(task: string, params: any): Promise<any>;
	curried(task: string): (params: any) => Promise<any>;
	shutdown(): void;
}

export function createPool(options: IOptions): IPool {
	return new Pool(options);
}

class Pool extends events.EventEmitter implements IPool {
	private options: IOptions;
	private queuedJobs: Job[] = [];
	private workers: Worker[] = [];
	private checksNext: boolean = false;

	constructor(options: IOptions) {
		super();

		this.options = options;
		this.options.modulePath = path.resolve(this.options.modulePath);
		this.options.concurrent = lib.optValue(this.options.concurrent, os.cpus().length);
		this.options.paralel = lib.optValue(this.options.paralel, 1);
		this.options.attempts = lib.optValue(this.options.attempts, 3);
		this.options.timeout = lib.optValue(this.options.timeout, 0);
		this.options.idleTimeout = lib.optValue(this.options.idleTimeout, 500);
		this.options.log = lib.optValue(this.options.log, false);
		this.options.emit = lib.optValue(this.options.emit, false || this.options.log);

		if (this.options.log) {
			this.on(lib.STATUS, (msg: string) => {
				console.log(msg);
			});
		}
	}

	run(task: string, params: any): Promise<any> {
		return new Promise((resolve: (res: any) => void, reject: (err: Error) => void) => {
			var job = new Job(task, params, (err, res) => {
				if (err) {
					reject(err);
				}
				else {
					resolve(res);
				}
			});
			this.queuedJobs.push(job);

			this.status('add', job);

			this.checkQueue();
		});
	}

	curried(task: string): (params: any) => Promise<any> {
		return (params: any) => {
			return this.run(task, params);
		};
	}

	shutdown(): void {
		this.status('shutdown');
	}

	private status(...message: any[]): void {
		if (this.options.emit) {
			this.emit(lib.STATUS, message.join('; '));
		}
	}

	private checkQueue(): void {
		// debounce
		if (!this.checksNext) {
			this.checksNext = true;
			process.nextTick(() => {
				this.checksNext = false;
				this.procQueue();
			});
		}
	}

	private procQueue(): void {
		while (this.queuedJobs.length > 0) {
			var best: Worker;
			for (var i = 0, ii = this.workers.length; i < ii; i++) {
				var worker = this.workers[i];
				if (worker.active < this.options.paralel) {
					if (!best || worker.active < best.active) {
						best = worker;
					}
				}
			}
			if (this.workers.length < this.options.concurrent) {
				if (!best || best.active > 0) {
					best = this.spawnWorker();
				}
			}
			if (best) {
				best.run(this.queuedJobs.shift());
			}
			else {
				break;
			}
		}
	}

	private removeWorker(worker: Worker): void {
		var i = this.workers.indexOf(worker);
		if (i > -1) {
			this.workers.splice(i, 1);
		}
	}

	private spawnWorker(): Worker {
		var worker = new Worker(this.options);

		worker.on(lib.ERROR, (err: Error) => {
			this.status('pool error', worker, err);

			this.removeWorker(worker);
			worker.kill();
			this.checkQueue();
		});

		worker.on(lib.TASK_RESULT, (job: Job) => {
			this.status('job complete', worker, job);
			this.checkQueue();
		});

		worker.on(lib.TASK_ABORT, (job: Job) => {
			if (job.attempts < this.options.attempts) {
				job.attempts++;
				this.queuedJobs.push(job);
				this.status('job requeue', worker, job, job.attempts + ' of ' + this.options.attempts);
			}
			else {
				this.status('job abort', worker, job);
				job.callback(new Error('job failed ' + job.attempts + ' attempts'), null);
			}
			this.checkQueue();
		});

		worker.on(lib.WORKER_DOWN, () => {
			this.status('worker down', worker);
			this.removeWorker(worker);
			this.checkQueue();
		});

		worker.on(lib.STATUS, (args: any[]) => {
			this.status.apply(this, args);
		});

		this.workers.push(worker);

		this.status('spawn worker', this.workers.length + ' of ' + this.options.concurrent, worker);

		return worker;
	}
}

var jobI: number = 0;

class Job {
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

class Worker extends events.EventEmitter {
	options: IOptions;
	child: child_process.ChildProcess;
	jobs: JobDict = Object.create(null);
	active: number = 0;
	idleTimer: NodeJS.Timer;
	id: string;

	kill: () => void;

	constructor(options: IOptions) {
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
