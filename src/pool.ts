/// <reference path="../typings/tsd.d.ts" />

'use strict';

import os = require('os');
import path = require('path');
import events = require('events');
import assertMod = require('assert');

import Promise = require('bluebird');

import lib = require('./lib');

import _worker = require('./worker');
import Worker = _worker.Worker;
import Job = _worker.Job;

export interface IPool extends NodeJS.EventEmitter {
	run(task: string, params: any): Promise<any>;
	curried(task: string): (params: any) => Promise<any>;
}

export function createPool(options: lib.IOptions): IPool {
	return new Pool(options);
}

interface WorkerDict {
	[id: string]: Worker;
}

class Pool extends events.EventEmitter implements IPool {
	private options: lib.IOptions;
	private queuedJobs: Job[] = [];
	private workers: WorkerDict = Object.create(null);
	private checksNext: boolean = false;

	constructor(options: lib.IOptions) {
		super();

		this.options = options;
		this.options.worker = path.resolve(this.options.worker);
		this.options.concurrent = lib.optValue(this.options.concurrent, os.cpus().length);
		this.options.paralel = lib.optValue(this.options.paralel, 1);
		this.options.harmony = lib.optValue(this.options.harmony, 3);
		this.options.attempts = lib.optValue(this.options.attempts, 3);
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
		return new Promise<any>((resolve, reject) => {
			var job = new Job(task, params, (err, res) => {
				if (err) {
					reject(err);
				}
				else {
					resolve(res);
				}
			});
			this.queuedJobs.push(job);

			this.status(job, 'added');

			this.checkQueue();
		});
	}

	curried(task: string): (params: any) => Promise<any> {
		return (params: any) => {
			return this.run(task, params);
		};
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
			var best: Worker = null;
			var count = 0;
			for (var id in this.workers) {
				var worker = this.workers[id];
				count++;
				if (worker.activeCount < this.options.paralel) {
					if (!best) {
						best = worker;
					}
					else if (worker.activeCount < best.activeCount) {
						best = worker;
					}
				}
			}

			if (count < this.options.concurrent && (!best || best.activeCount > 0)) {
				best = this.spawnWorker();
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
		delete this.workers[worker.id];
	}

	private spawnWorker(): Worker {
		var worker = new Worker(this.options);

		this.workers[worker.id] = worker;

		worker.on(lib.ERROR, (err: Error) => {
			this.status(worker, 'pool error', err);

			this.removeWorker(worker);
			worker.kill();
		});

		worker.on(lib.TASK_RESULT, (job: Job) => {
			this.checkQueue();
		});

		worker.on(lib.TASK_ABORT, (job: Job) => {
			if (job.attempts < this.options.attempts) {
				job.attempts++;
				this.queuedJobs.push(job);
				this.status(worker, 'requeue', job, job.attempts + ' of ' + this.options.attempts);
			}
			else {
				this.status(worker, 'abort', job);
				job.callback(new Error('job failed ' + job.attempts + ' attempts'), null);
			}
			this.checkQueue();
		});

		worker.on(lib.WORKER_DOWN, () => {
			this.status(worker, 'down');
			this.removeWorker(worker);
			this.checkQueue();
		});

		worker.on(lib.STATUS, (msg: any) => {
			this.emit(lib.STATUS, msg);
		});

		this.status(worker, 'spawn <' + this.workerCount + '/' + this.options.concurrent + '>');

		return worker;
	}

	get workerCount(): number {
		var num = 0;
		for (var id in this.workers) {
			num++;
		}
		return num;
	}
}
