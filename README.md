# manticore

<img src="https://i.imgur.com/HFN1Nyi.jpg" title="μαρτιχώρα, martichora" />

[![Build Status](https://secure.travis-ci.org/Bartvds/manticore.svg?branch=master)](http://travis-ci.org/Bartvds/manticore) [![NPM version](https://badge.fury.io/js/manticore.svg)](http://badge.fury.io/js/manticore) [![Dependency Status](https://david-dm.org/Bartvds/manticore.svg)](https://david-dm.org/Bartvds/manticore) [![devDependency Status](https://david-dm.org/Bartvds/manticore/dev-status.svg)](https://david-dm.org/Bartvds/manticore#info=devDependencies)

> Mythical multi-process worker pool

Fork node.js multi-core workers and crunch legendary workloads.

The core concept is you got some code in a function that does some heavy work and you want to run it many times with maximum benefit of your multi-core CPU, and without the overhead of re-spawning piles single-use sub-processes.

:warning: Early release :sunglasses:


## Why yet another worker module?

The worker modules I found on npm all have their problems: they either lack functionality, use external dependencies or make all kinds of weird assumptions that get in the way.

Instead of trying to wrangle my app to fit those unsatisfactory modules I build Manticore to be simple and effective with the features you need to get big things done at hyperspeed without jumping through crazy hoops.


## How to use?

You put your code in a function that accepts a single parameter, then add a bunch of them in a worker module. In this module you register the functions to expose them as tasks.

In your main app you setup the pool for that module and execute the methods via the pool with your data parameter and Manticore will spawn (and despawn) workers as needed and distribute the work and return the result as a Promise.

You can use a function that returns a value synchronously, or go asynchronous and either use the node.js-style callback or return a Promise. 

By default each worker works on only one job at a time, but there is an option to allow workers to process multiple jobs simultaneously that allows a extra boost for IO-bound tasks (of course assuming you use async IO).


## Return value

The return value of the pool is always a ES6-style Promise so you easily use fancy logic like Promise.all() or Promise.race().

For some next level setups you can leverage Promise-glue helpers from modules like Q, Bluebird etc. To get creative and pass the Promises into more exotic modules like React, Baconjs, Lazy.js, Highland and all the other cool utility modules with Promise support.

Keep in mind the parameter object and return value are serialised so you cannot pass functions or prototype based objects, only simple JSON-like data.


## Notes

- Returns a ES6 Promise.
- Transfers data between threads using pipes (eg: non-blocking).
- Data gets serialised so only primitive JSON-like data can be transferred.
- Makes sure you configure concurrent/paralel to suit your app for best performance

## Todo

- Swap JSON serialisation for something that supports Buffers.
- Separate settings per function.

## Usage

### Setup worker

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

There are different ways to return values:

````js
// does it run syncronous?
function myFunc1(params) {
    return heavyStuff(params);
}

// maybe use the node-style callback?
function myFunc2(params, callback) {
    heavyStuff(params, function(err, result) {
        callback(err, result);
    });
}

// or return a Promise?
function myFunc3(params) {
    return heavyStuff(params).then(function(res) {
        return someMoreWork(res)
    };
}
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

## Use the pool

Create a pool in the main app:

````js
var mc = require('manticore');

var pool = mc.createPool({
	modulePath: require.resolve('./worker'),
	concurrent: 4
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

That's it! :+1:


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

	// worker idle timeout in miliseconds, shuts down workers that are idling
	idleTimeout?: number;
	
	// emit 'status' events, handy for debugging
	emit?: boolean;
	// console.log status events for debugging
	log?: boolean;
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

- 0.2.0 - Transfer data over non-blocking pipes, renamed `modulePath` option to `worker`.
- 0.1.0 - First release.


## License

Copyright (c) 2014 Bart van der Schoor @ [Bartvds](https://github.com/Bartvds)

Licensed under the MIT license.
