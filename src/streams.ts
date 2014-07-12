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

export class ChunkyStream extends stream.Transform {
	private length: number = 0;
	private target: number;
	private buffers: Buffer[] = [];
	private flushAll: () => void;
	private next: boolean = false;

	constructor(target: number) {
		super({objectMode: false});
		this.target = target;

		this.flushAll = () => {
			this.next = false;
			if (this.length > 0) {
				var buf = Buffer.concat(this.buffers);
				this.buffers = [];
				this.length = 0;
				this.push(buf);
			}
		};
	}

	_transform(chunk, encoding, done) {
		console.log('%s %s', chunk.length, this.length);

		if (this.length + chunk.length >= this.target) {
			if (this.length > 0) {
				this.push(Buffer.concat(this.buffers));
				this.buffers = [];
				this.length = 0;
			}
			this.push(chunk);
		}
		else {
			this.length += chunk.length;
			this.buffers.push(chunk);
			if (!this.next) {
				this.next = true;
				process.nextTick(this.flushAll);
			}
		}
		done();
	}

	_flush(done) {
		this.flushAll();
		done();
	}
}
