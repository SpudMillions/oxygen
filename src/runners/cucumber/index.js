/*
 * Copyright (C) 2019-present CloudBeat Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Based on:
 * Copyright (c) OpenJS Foundation and other contributors. Licensed under MIT.
 */

import glob from 'glob';
import isGlob from 'is-glob';
import path from 'path';

import oxutil from '../../lib/util';
import WorkerProcess from './WorkerProcess';


const DEFAULT_TIMEOUT = 30000;
const DEFAULT_OPTS = {
    backtrace: false, // <boolean> show full backtrace for errors
    compiler: [], // <string[]> ("extension:module") require files with the given EXTENSION after requiring MODULE (repeatable)
    failAmbiguousDefinitions: false, // <boolean> treat ambiguous definitions as errors
    failFast: false, // <boolean> abort the run on first failure
    ignoreUndefinedDefinitions: false, // <boolean> treat undefined definitions as warnings
    name: [], // <REGEXP[]> only execute the scenarios with name matching the expression (repeatable)
    profile: [], // <string> (name) specify the profile to use
    require: [], // <string> (file/dir/glob) require files before executing features
    order: 'defined', // <string> switch between deterministic  and random feature execution. Either "defined", "random" or "random:42" whereas 42 is the seed for randomization
    snippetSyntax: undefined, // <string> specify a custom snippet syntax
    snippets: true, // <boolean> hide step definition snippets for pending steps
    source: true, // <boolean> hide source uris
    strict: false, // <boolean> fail if there are any undefined or pending steps
    tagExpression: '', // <string> (expression) only execute the features or scenarios with tags matching the expression
    tagsInTitle: false, // <boolean> add cucumber tags to feature or scenario name
    timeout: DEFAULT_TIMEOUT // <number> timeout for step definitions in milliseconds
};

export default class CucumberRunner {
    constructor (debugMode = null, debugPort = null) {
        this.isInitialized = false;
        this.id = oxutil.generateUniqueId();
        const workerPath = path.join(__dirname, 'worker.js');
        this.worker = new WorkerProcess(this.id, workerPath, debugMode, debugPort);
    }

    async init(config, caps, reporter) {
        this.config = config;
        this.cwd = this.config.cwd || process.cwd();
        this.specs = this.resolveSpecFiles(config.specs || []);
        this.capabilities = caps;
        this.reporter = reporter;
        this.isInitialized = true;
        this.cucumberOpts = Object.assign(DEFAULT_OPTS, config.cucumberOpts);
        this.worker.start();
        this.worker.init(this.id, config);
    }

    async dispose() {
        await this.worker.dispose();
        this.isInitialized = false;
    }

    async run () {
        try {
            this.reporter.onRunnerStart(this.id, this.config, this.capabilities);
            const result = await this.worker.run(this.capabilities);
            this.reporter.onRunnerEnd(this.id, null);
    
            return result;
        }
        catch (e) {
            console.log('Fatal error in Cucumber runner:', e);
            this.reporter.onRunnerEnd(this.id, e);
        }
    }

    resolveSpecFiles (specs) {
        if (!Array.isArray(specs)) {
            return [];
        }
        return specs.reduce((files, specFile) => {
            const absolutePath = oxutil.resolvePath(specFile, this.cwd);
            if (isGlob(absolutePath)) {
                return files.concat(glob.sync(absolutePath));
            } else {
                return files.concat([absolutePath]);
            }
        }, []);
    }
}
