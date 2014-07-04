# manticore

<img src="https://i.imgur.com/HFN1Nyi.jpg" title="μαρτιχώρα, martichora" />

[![Build Status](https://secure.travis-ci.org/Bartvds/manticore.svg?branch=master)](http://travis-ci.org/Bartvds/manticore) [![NPM version](https://badge.fury.io/js/manticore.svg)](http://badge.fury.io/js/manticore) [![Dependency Status](https://david-dm.org/Bartvds/manticore.svg)](https://david-dm.org/Bartvds/manticore) [![devDependency Status](https://david-dm.org/Bartvds/manticore/dev-status.svg)](https://david-dm.org/Bartvds/manticore#info=devDependencies)

> Mythical multi-process worker pool

Fork node.js multi-core workers and crunch legendary workloads.

The core concept is you got some code in a function that does some heavy work and you want to run it many times with maximum benefit of your multi-core CPU, and without the overhead of re-spawning piles single-use sub-processes.

:warning: Early release :sunglasses:


## Why yet another worker module?

The worker modules I found on npm all have their problems: they either lack functionality, require persistence dependencies, have strange API's or make all kinds of weird assumptions that get in the way.

Instead of trying to wrangle my app to fit those unsatisfactory modules I build Manticore to be simple and effective with the features you need to get big things done at hyperspeed without jumping through crazy hoops.


## So how do I use it?

You put your code in a function that accepts a single parameter, then add a bunch of them in a module. In this module you register the methods to expose them as tasks. Then in your main app you setup the pool for that module and execute the methods with your parameter object and Manticore will spawn (and despawn) workers as needed and distribute the work and return the result as a Promise. 

You can use a synchronous function that returns a result directly, use a node.js style callback or return a Promise. 

By default each worker work on one job at a time, but there is an option to allow workers to handle on multiple jobs simultaneously, which allows a extra boost for IO-bound tasks by keeping the node theads active during IO (of course assuming you use async IO).

## What do I get?

The return value of the pool is always a ES6-style Promise so you easily use fancy logic like Promise.all() or Promise.race(). For some next level setups you can leverage Promise-glue helpers from modules like Q, Bluebird etc. To get creative and pass the Promises into more exotic modules like React, Baconjs, Lazy.js, Highland and all the cool utility modules with Promise support.

Keep in mind the parameter object and return value are passed between different node forks using `process.send()` so you cannot pass functions or prototype based objects.


## What do you use this for?

All kinds of stuff; first use-case was bulk operations with various TypeScript related modules (processing 500+ file-sets). The TypeScript compiler is a huge JS file, fully synchronous and just very slow because it does so much work. So you'd want to use all CPU cores you got and crunch different file-sets simultaneously (one compiler per core works nicely). 

I used to run single-use sub-processes in parallel for every file-set, which was already a lot faster compared with serial execution on a single core. But the start-up time for every spawn was annoying: node takes time to start, and then it needs to load and compile the huge JavaScript file of the TS compiler. Using Manticore you can easily rig something to keep the worker processes alive for re-use and take maximum profit from V8's hot-code JIT.  


## Usage

Put slow methods in a worker module:

````js
var mc = require('manticore');

// run syncronous?
function myFunc1(params) {
    return bigOperation(params);
}

// maybe use the node-style callback?
function myFunc2(params, callback) {
    heavyWork(params, function(err, result) {
        callback(err, result);
    });
}

// or return a Promise?
function myFunc3(params) {
    return heavyWork(params).then(function(res) {
        return someMoreWork(res)
    };
}

// now register the methods as an object
mc.registerTasks({
    myFunc1: myFunc1
    myFunc2: myFunc2
    myFunc3: myFunc3
})
````


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


Pro-tip: for serious bulk processing use `Promise.all()` (in Bluebird have fun with `Promise.map()` etc).

````js
Promise.all(myArray.map(function(data) {
	return pool.run('myFunc1', data);
})).then(function(results) {
    // got all the results
});
````

That's it! :+1:


### Pool options

````ts
var pool = mc.createPool({
	// path to the worker module. pro-tip: use require.resolve()
	modulePath: string;
	
	// maximum amount of worker processes
	// - defaults: require('os').cpus().length -1
	concurrent?: number;	
	// maximum amount of jobs to pass to each worker
	// set this to a higher value if your jobs are async and IO-bound
	// - default: 1
	paralel?: number;	
	// maximum retries if a job (or worker) fails
	attempts?: number;

	// job timeout in miliseconds
	timeout?: number;
	// worker idle timeout in miliseconds, shuts down workers that are idling
	idleTimeout?: number;
	
	// emit 'status' events, handy for debugging
	emit?: boolean;
	// console.log status events for debugging
	log?: boolean;
});
````

## TypeScript

Manticore is written in TypeScript and compiled with Grunt. 

For TypeScript user there is a `.d.ts` file both in the repo and bundled in the npm package (exported in package.json).


## Build

Install development dependencies in your git checkout:

````bash
$ npm install
````

Build and run tests using [grunt](http://gruntjs.com):

````bash
$ npm test
````

See the `Gruntfile.js` for additional commands.


## History

- 0.0.1 - First release


## License

Copyright (c) 2014 Bart van der Schoor @ [Bartvds](https://github.com/Bartvds)

Licensed under the MIT license.
