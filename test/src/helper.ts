/// <reference path="../../typings/tsd.d.ts" />

import stream = require('stream');

export class CountStream extends stream.Readable {
	private _index: number = 0;
	private _max: number;

	constructor(max: number = 100) {
		super({objectMode: true});
		this._max = max;
	}

	_read(): void {
		var i = this._index++;
		if (i > this._max) {
			this.push(null);
		}
		else {
			this.push({num: i});
		}
	}
}

export class WordStream extends stream.Readable {
	private _index: number;
	private _end: number;

	constructor() {
		super({objectMode: false});
		this._index = 97;
		this._end = 122;
	}

	_read(): void {
		if (this._index > this._end) {
			this.push(null);
		}
		else {
			this.push(String.fromCharCode(this._index++));
		}
	}
}
