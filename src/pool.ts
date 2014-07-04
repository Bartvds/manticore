/// <reference path="../typings/tsd.d.ts" />

'use strict';

declare function setTimeout(callback: (...args: any[]) => void, ms: number, ...args: any[]): NodeJS.Timer;
declare function clearTimeout(timeoutId: NodeJS.Timer): void;

import os = require('os');
import path = require('path');
import events = require('events');
import assertMod = require('assert');

import Promise = require('es6-promises');
import JSONStream = require('JSONStream');

import lib = require('./lib');

import _worker = require('./worker');
import Worker = _worker.Worker;
import Job = _worker.Job;

export interface IPool extends NodeJS.EventEmitter {
	run(task: string, params: any): Promise<any>;
	curried(task: string): (params: any) => Promise<any>;
	shutdown(): void;
}

export function createPool(options: lib.IOptions): IPool {
	return new Pool(options);
}

class Pool extends events.EventEmitter implements IPool {
	private options: lib.IOptions;
	private queuedJobs: Job[] = [];
	private workers: Worker[] = [];
	private checksNext: boolean = false;

	constructor(options: lib.IOptions) {
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
