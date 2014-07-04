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

You put your code in a function that accepts a single parameter, then add a bunch of them in a worker module. In this module you register the functions to expose them as tasks. In your main app you setup the pool for that module and execute the methods via the pool with your data parameter and Manticore will spawn (and despawn) workers as needed and distribute the work and return the result as a Promise. 

You can use a function that returns a value synchronously, or go asynchronous and either use the node.js-style callback or return a Promise. 

By default each worker works on only one job at a time, but there is an option to allow workers to process multiple jobs simultaneously, which allows a extra boost for IO-bound tasks by keeping the node threads active during IO (of course assuming you use async IO).


## What do I get?

The return value of the pool is always a ES6-style Promise so you easily use fancy logic like Promise.all() or Promise.race().

For some next level setups you can leverage Promise-glue helpers from modules like Q, Bluebird etc. To get creative and pass the Promises into more exotic modules like React, Baconjs, Lazy.js, Highland and all the cool utility modules with Promise support.

Keep in mind the parameter object and return value are passed between different node forks using `process.send()` so you cannot pass functions or prototype based objects.


## What do you use this for?

All kinds of stuff; first use-case was bulk operations with various TypeScript related modules (processing 500+ file-sets). The TypeScript compiler is a huge JS file, fully synchronous and just very slow because it does so much work. 

So you'd want to use all CPU cores you got and crunch different file-sets simultaneously (one compiler per core works nicely). I used to run single-use sub-processes in parallel for every file-set, which was already a lot faster compared with serial execution on a single core. 

But the start-up time for every spawn became annoying: node takes time to initialise and then it still needs to compile the huge JavaScript file of the TS compiler. Using Manticore you can easily rig something to keep the worker processes alive for re-use and take maximum profit from V8's hot-code JIT.  

This module is also handy for doing heavy data crunching like processing images in JavaScript.


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
