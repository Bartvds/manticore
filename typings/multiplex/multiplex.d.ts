/// <reference path="../node/node.d.ts" />

declare module 'multiplex' {
	function multiplex(onStream?: (stream: NodeJS.ReadWriteStream, id: string) => void): multiplex.Multiplex;

	module multiplex {
		interface Multiplex extends NodeJS.ReadWriteStream {
			createStream(id?: string): NodeJS.ReadWriteStream;
			destroyStream(id: string): void;
		}
	}
	export = multiplex;
}
