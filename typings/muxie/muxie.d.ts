/// <reference path="../node/node.d.ts" />

declare module 'muxie' {
	function muxer(): Muxer;
	function demuxer(handler: (stream: NodeJS.ReadWriteStream, name: string) => void): NodeJS.WritableStream;

	interface Muxer extends NodeJS.ReadableStream {
		create(name: string): NodeJS.WritableStream;
	}
}
