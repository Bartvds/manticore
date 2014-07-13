/// <reference path="../typings/tsd.d.ts" />

'use strict';

import stream = require('stream');
import buffo = require('buffo');
import lib = require('./lib');

var clientReturnI: number = 0;

export var ident = {};

export interface IDStream extends NodeJS.ReadWriteStream {
	id: string;
	owner: any;
	objectMode: boolean;
}

export function createClientReturn(objectMode: boolean): IDStream {
	var stream: IDStream;
	if (objectMode) {
		stream = <IDStream> buffo.encodeStream();
		stream.objectMode = true;
	}
	else {
		stream = new PassStream(false);
	}
	stream.id = lib.CLIENT_RETURN + clientReturnI++;
	stream.owner = ident;
	return stream;
}

class PassStream extends stream.Transform implements IDStream {
	id: string;
	owner: any;
	objectMode: boolean;

	constructor(objectMode: boolean) {
		super({objectMode: objectMode});
		this.objectMode = objectMode;
	}

	_transform(chunk, encoding, done) {
		this.push(chunk);
		done();
	}
}

export interface IRateReport {
	step: number;
	byteCount: number;
	chunkCount: number;
	byteRate: number;
	chunkRate: number;
}

export class StatsStream extends stream.Transform {
	label: string;
	objectMode: boolean;

	chunkCount: number = 0;
	byteCount: number = 0;
	chunkTotal: number = 0;
	byteTotal: number = 0;

	prevTime: number = Date.now();
	startTime: number = Date.now();
	report: () => void;
	interval: any;

	constructor(label: string, delay: number = 1000) {
		super({objectMode: false});

		this.label = label;
		/*this.interval = setInterval(() => {
		 if (this.chunkCount > 0) {
		 console.log(this.getReport());
		 }
		 }, delay);*/
		this.on('end', () => {
			console.log(this.getTotal());
		});
		this.on('finish', () => {
			console.log(this.getTotal());
		});
	}

	getReport(): IRateReport {
		var stepDuration = (Date.now() - this.prevTime) / 1000;
		var ret = {
			label: this.label + ' step',
			step: stepDuration,
			byteCount: this.byteCount,
			chunkCount: this.chunkCount,
			byteRate: this.byteCount / stepDuration,
			chunkRate: this.chunkCount / stepDuration
		};
		this.prevTime = Date.now();
		this.byteCount = 0;
		this.chunkCount = 0;
		return ret;
	}

	getTotal(): IRateReport {
		var totalDuration = (Date.now() - this.startTime) / 1000;
		var ret = {
			label: this.label + 'total',
			step: totalDuration,
			byteCount: this.byteTotal,
			chunkCount: this.chunkTotal,
			byteRate: this.byteTotal / totalDuration,
			chunkRate: this.chunkTotal / totalDuration
		};
		this.byteTotal = 0;
		this.chunkCount = 0;
		return ret;
	}

	_transform(chunk, encoding, done): void {
		this.chunkCount++;
		this.byteCount += chunk.length;
		this.chunkCount++;
		this.byteTotal += chunk.length;
		this.push(chunk);
		done();
	}

	_flush(done): void {
		this.interval = clearInterval(this.interval);
		this.byteTotal += this.byteCount;
		this.chunkCount += this.chunkCount;
		console.log(this.getTotal());
		done();
	}
}

