# manticore

<img src="https://i.imgur.com/HFN1Nyi.jpg" title="μαρτιχώρα, martichora" />

[![Build Status](https://secure.travis-ci.org/Bartvds/manticore.svg?branch=master)](http://travis-ci.org/Bartvds/manticore) [![NPM version](https://badge.fury.io/js/manticore.svg)](http://badge.fury.io/js/manticore) [![Dependency Status](https://david-dm.org/Bartvds/manticore.svg)](https://david-dm.org/Bartvds/manticore) [![devDependency Status](https://david-dm.org/Bartvds/manticore/dev-status.svg)](https://david-dm.org/Bartvds/manticore#info=devDependencies)

> Mythical multi-process worker pool

Fork node.js multi-core workers and crunch legendary workloads.

The core concept is you got some code in a function that does some heavy work and you want to run it many times with maximum benefit of your multi-core CPU and without the overhead of re-spawning piles single-use sub-processes.

:warning: Early release :sunglasses:


## Why yet another worker module?

The worker modules I found on npm all had their problems: they either lack functionality, use external dependencies or make all kinds of weird assumptions that get in the way.

Also I needed support for transfer of all standard JavaScript values, including Buffers, TypedArrays and Date's.


## How to use?

Put your code in a function that accepts a single parameter, then add a bunch of them in a module. In this module register the functions to expose them as tasks.

Setup the pool in the main app and execute the methods with your data parameter and Manticore will spawn (and despawn) workers as needed and distribute the work and return the result as a Promise. Tasks can also return a binary or object stream (by returning a stream-handle, see below).

The tasks van return a value synchronously, return a Promise or asynchronously use the node.js-style callback. 

Parameter and return value are serialised via [Buffo](https://github.com/Bartvds/buffo); so all standard JavaScript values can be transferred, including Buffers, TypedArrays, Date's etc.


## Concurreny

By default each worker works on only one job at a time, but there is an option to allow workers to process multiple jobs simultaneously, use this for IO-bound tasks (of course assuming you use async IO).


## Return value

When executing a task the pool's return value is always a ES6-style Promise. This works great with `Promise.all()` or `Promise.race()`.

For some next level setups you can leverage Promise-glue helpers from modules like Q, Bluebird etc. To get creative and pass the Promises into more exotic modules like React, Baconjs, Lazy.js, Highland and all the other cool utility modules with Promise support.

Workers can also return streams!


## Notes

- Return value is a ES6 Promise.
- Transfers data between threads using pipes (eg: non-blocking).
- Data gets serialised via [Buffo encoding](https://github.com/Bartvds/buffo).
- Workers can also return a binary or object stream.

## Advice

- Make sure to configure `concurrent` & `paralel` to suit your app for best performance.
- For best performance when transferring large amounts of data use String, Buffer or a TypedArray params. Regular Array has more encoding and bandwidth overhead (every element has its own type).
- For more speed and streamy processes return a stream, either binary or one of the above.


## Todo

- Separate settings per function.
- Allow sending streams to worker


## Install

````bash
$ npm install manticore
````

## Usage

### Setup worker tasks

Communication with the worker uses [Buffo encoding](https://github.com/Bartvds/buffo), check there for the supported native JavaScript types.

Put the worker methods in their own module where they are registered to Manticore:

````js
var mc = require('manticore');

// directly add named function
function myFunc1(params) {
	return heavyStuff(params);
}
mc.registerTask(myFunc1);

// add anonymous function
mc.registerTask('myFunc2', function(params) {
	return heavyStuff(params);
});
````

Register in bulk:

````js
// add named functions as array
mc.registerTasks([
    myFunc1,
    myFunc2,
    myFunc3
]);

// register the methods as an object to redefine the name
// - protip: use the module.exports object
mc.registerTasks({
    myFuncA: myFunc1
    myFuncB: myFunc2
    myFuncC: myFunc3
});
````

There are different ways to return values:

````js
// directly return a value from synchronous work
function myFunc1(params) {
    return heavyStuff(params);
}

// node-style: callback(error, result)
function myFunc2(params, callback) {
    heavyStuff(params, function(result) {
        callback(null, result);
    });
}

// return a Promise ('thenable')
function myFunc3(params) {
    return heavyStuff(params).then(function(res) {		
        return someMoreWork(res)
    };
}

// stream data amd pipe to a `returnStream`: choose either object or binary mode
// - note: stream support must be enabled in the pool options
function myFunc4(params) {
	// lets use object mode here
    return someStream(params).pipe(mc.returnStream(true));
}
````

### Use the pool

Create a pool in the main app:

````js
var mc = require('manticore');

var pool = mc.createPool({
	modulePath: require.resolve('./worker'),
	concurrent: 4,
	paralel: 2
});
````


Then run the methods by name, pass a parameter value and get a Promise:

````js
pool.run('myFunc1', myParams).then(function(res) {
    // got results
}, function(err) {
    // oops
});
````

For convenience get a curried function:

````js
var func1 = pool.curried('myFunc1');

func1(params).then(function(res) {
    // got results
});
````

Pro-tip: for serious bulk processing use `Promise.all()` (in Bluebird this is fun with `Promise.map()` etc).

````js
Promise.all(myArray.map(pool.curried('myFunc1'))).then(function(results) {
    // got all the results
});
````

### Pool options

````ts
var pool = mc.createPool({
	// path to the worker module. pro-tip: use require.resolve()
	worker: string;
	
	// maximum amount of worker processes
	// - defaults: require('os').cpus().length
	// tip: when running on many cores leave 1 core free for main process: require('os').cpus().length -1
	concurrent?: number;
	// maximum amount of jobs to pass to each worker
	// set this to a higher value if your jobs are async and IO-bound
	// - default: 1
	paralel?: number;
	// maximum retries if a worker fails
	attempts?: number;

	// enable stream support
	// - default: false
	streams?: boolean;

	// worker idle timeout in miliseconds, shuts down workers that are idling
	idleTimeout?: number;
	
	// emit 'status' events, handy for debugging
	emit?: boolean;
	// console.log status events
	log?: boolean;
});
````

That's it! :+1:

## Streams

To return a stream from a task create a 'return stream' via `mc.returnStream(objectMode)`, then pipe data (or objects) and return it. When using objectMode the objects get serialised via Buffo.

Multiplexing data over a pipe creates some overhead, so streams have to be explicitly enabled with the `streams` option.

````
var mc = require('manticore');
var pool = mc.createPool({
	modulePath: require.resolve('./worker'),
	streams: true
});
````

In the worker:

````js
var mc = require('manticore');

// return a binary stream
function objects(params) {
    return someBinaryStream(params).pipe(mc.returnStream(false));
}

// return an object stream
function bytes(params) {
    return someObjectStream(params).pipe(mc.returnStream(true));
}
ms.registerTasks([objects, bytes])
````

In the main application:

````js
var mc = require('manticore');
var pool = mc.createPool({
	modulePath: require.resolve('./worker'),
});
// promise resolves to a stream
pool.run('objects', params).then(function(stream) {
    stream.on('data', function(data) {
        // got data
    });
    stream.on('end', function(data) {
        // job done!
    });
});
pool.run('bytes', params).then(function(stream) {
    stream.pipe(myOutputStream);
});
````


## Development

Manticore is written in TypeScript and compiled with Grunt. 

For TypeScript user there is a `.d.ts` file both in the repo and bundled in the npm package (also exported in package.json).


## Build

Install development dependencies in your git checkout:

````bash
$ npm install
````

Build and run tests using [grunt](http://gruntjs.com):

````bash
$ grunt test
````

See the `Gruntfile.js` for additional commands.


## Contributions

They are welcome but please discuss in [the issues](https://github.com/Bartvds/manticore/issues) before you commit to large changes. If you send a PR make sure you code is idiomatic and linted.


## History

- 0.3.0 - Use [buffo](https://github.com/Bartvds/buffo) object streams, tasks can return a stream.
- 0.2.0 - Transfer data over non-blocking pipes, renamed `modulePath` option to `worker`.
- 0.1.0 - First release.


## License

Copyright (c) 2014 Bart van der Schoor @ [Bartvds](https://github.com/Bartvds)

Licensed under the MIT license.
