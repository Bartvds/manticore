// Generated by dts-bundle v0.2.0

declare module 'manticore' {
    import client = require('__manticore/client');
    import pool = require('__manticore/pool');
    import lib = require('__manticore/lib');
    export import registerTasks = client.registerTasks;
    export import registerTask = client.registerTask;
    export import createPool = pool.createPool;
    export import returnStream = client.returnStream;
    export import assertProp = lib.assertProp;
    export import assertType = lib.assertType;
    export import IPool = pool.IPool;
    export import IOptions = lib.IOptions;
    export import ICallback = lib.IResultCallback;
}

declare module '__manticore/client' {
    import lib = require('__manticore/lib');
    export interface ITaskFunc {
        (params: any, callback: lib.IResultCallback): any;
    }
    export interface ITaskDict {
        [name: string]: ITaskFunc;
    }
    export function registerTasks(map: any): void;
    export function registerTask(arg: any, func?: ITaskFunc): void;
    export function returnStream(objectMode: boolean): NodeJS.ReadWriteStream;
}

declare module '__manticore/pool' {
    import lib = require('__manticore/lib');
    export interface IPool extends NodeJS.EventEmitter {
        run(task: string, params?: any): Promise<any>;
        curried(task: string): (params?: any) => Promise<any>;
    }
    export function createPool(options: lib.IOptions): IPool;
}

declare module '__manticore/lib' {
    export var TASK_RUN: string;
    export var TASK_RESULT: string;
    export var TASK_ABORT: string;
    export var WORKER_DOWN: string;
    export var WORKER_READY: string;
    export var ERROR: string;
    export var WORK_TO_CLIENT: number;
    export var CLIENT_TO_WORK: number;
    export var CLIENT: string;
    export var CLIENT_RETURN: string;
    export var STATUS: string;
    export var ARG_STREAMS: string;
    export interface IOptions {
        worker: string;
        concurrent?: number;
        paralel?: number;
        attempts?: number;
        idleTimeout?: number;
        streams?: boolean;
        harmony?: boolean;
        log?: boolean;
        emit?: boolean;
    }
    export interface IStartMessage {
        id: string;
        type: string;
        task: string;
        params: any;
    }
    export interface IResultMessage {
        id: string;
        type: string;
        worker: string;
        error?: any;
        result: any;
        duration: number;
        stream?: string;
        objectMode?: boolean;
    }
    export interface IResultCallback {
        (err: Error, result: any): void;
    }
    export function assertProp(value: any, prop: string, type: string): void;
    export function assertType(value: any, type: string, label?: string): void;
    export function optValue<T>(value: T, alt: T): T;
    export function jsonError(error: any): any;
    export class BumpTimeout {
        constructor(delay: number, call: () => void, unRef?: boolean);
        bump(): void;
        clear(): void;
    }
}

