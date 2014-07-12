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
