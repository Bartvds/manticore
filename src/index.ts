/// <reference path="../typings/tsd.d.ts" />

'use strict';

import os = require('os');

import client = require('./client');
import pool = require('./pool');
import lib = require('./lib');

export import registerTasks = client.registerTasks;
export import registerTask = client.registerTask;
export import createPool = pool.createPool;

// helpers
export import assertProp = lib.assertProp;
export import assertType = lib.assertType;

// types
export import IOptions = lib.IOptions;
export import IPool = pool.IPool;

[client, pool, lib];
