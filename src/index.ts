/// <reference path="../typings/tsd.d.ts" />

'use strict';

import os = require('os');

import worker = require('./worker');
import pool = require('./pool');
import lib = require('./lib');

export import registerTasks = worker.registerTasks;
export import createPool = pool.createPool;

// helpers
export import assertProp = lib.assertProp;
export import assertType = lib.assertType;

[worker, pool, lib];
