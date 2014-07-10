/// <reference path="../node/node.d.ts" />

declare module 'buffo' {
	function decodeStream(): NodeJS.ReadWriteStream;
	function encodeStream(): NodeJS.ReadWriteStream;
}
