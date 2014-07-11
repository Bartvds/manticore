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
import multiplexMod = require('multiplex');

import lib = require('./lib');
import streams = require('./streams');

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
interface StreamDict {
	[id: string]: StreamJob;
}

interface StreamJob {
	id: string;
	job: Job;
	objectMode: boolean;
	stream?: NodeJS.ReadWriteStream;
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
	private multiplex: multiplexMod.Multiplex;
	private _activeCount: number = 0;
	private returnStreams: StreamDict = Object.create(null);

	kill: () => void;

	constructor(options: lib.IOptions) {
		super();

		this.options = options;

		this.idleTimer = new lib.BumpTimeout(this.options.idleTimeout, () => {
			if (this.activeCount === 0 && !this.haveActiveStreams()) {
				this.status('idle timeout');
				this.kill();
			}
			else {
				this.idleTimer.next();
			}
		});

		this.multiplex = multiplexMod((stream, id) => {
			// this.status('received stream ' + id);
			if (id === lib.CLIENT) {
				this.status('client stream open', id);
				stream.pipe(this.read);
			}
			else if (id in this.returnStreams) {
				var info = this.returnStreams[id];
				this.status('return stream open', id, info.job.id);

				if (info.objectMode) {
					stream = stream.pipe(buffo.decodeStream());
				}
				info.stream = stream;
				info.job.callback(null, stream);

				stream.on('end', () => {
					this.status('return stream end', id, info.job.id);
					this.idleTimer.next();
					this.multiplex.destroyStream(id);
					delete this.returnStreams[id];
				});
				stream.on('error', (err) => {
					this.status('return stream error', id, info.job.id);
					this.idleTimer.next();
					delete this.returnStreams[id];
				});
			}
		});
		this.multiplex.on('error', () => {
			console.log('worker multiplex error');
			this.kill();
		});
		this.multiplex.on('end', () => {
			console.log('worker multiplex end');
			this.kill();
		});

		var args: any[] = [];
		if (this.options.harmony) {
			args.push('--harmony');
		}
		args.push(this.options.worker);

		var opts = {
			cwd: process.cwd(),
			stdio: ['ignore', process.stdout, process.stderr, 'pipe', 'pipe', 'ipc']
		};

		this.child = child_process.spawn(process.execPath, args, opts);
		this.id = 'worker.' + this.child.pid;

		this.write = buffo.encodeStream();
		this.write.pipe(this.child.stdio[lib.WORK_TO_CLIENT]);

		this.child.stdio[lib.CLIENT_TO_WORK].pipe(this.multiplex);

		this.read = buffo.decodeStream();
		this.read.on('data', (msg: lib.IResultMessage) => {
			if (msg.type === lib.TASK_RESULT) {
				if (msg.id in this.jobs) {
					var job = this.jobs[msg.id];
					this._activeCount--;
					delete this.jobs[msg.id];

					// upfix Error
					if (msg.error) {
						msg.error.toString = () => {
							return msg.error.message;
						};
						this.status('completed with error', job, Math.round(msg.duration) + 'ms');
						job.callback(msg.error, null);
					}
					else if (msg.stream) {
						this.status('return stream expected', msg.stream, job);
						this.returnStreams[msg.stream] = {
							objectMode: !!msg.objectMode,
							id: msg.stream,
							job: job
						};
					}
					else {
						this.status('completed', job, Math.round(msg.duration) + 'ms');
						job.callback(msg.error, msg.result);
					}
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

	haveActiveStreams(): boolean {
		for (var n in this.returnStreams) {
			return true;
		}
		return false;
	}

	toString(): string {
		return this.id + ' <' + (this.child ? (this.activeCount + '/' + this.options.paralel) : 'killed') + '>';
	}
}
