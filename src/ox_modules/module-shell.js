/*
 * Copyright (C) 2015-2018 CloudBeat Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * @name shell
 * @description Provides methods for working with operating system shell.
 */
module.exports = function() {
    module.isInitialized = function() {
        return true;
    };

    /**
     * @summary Execute command
     * @description Spawn child process
     * @function exec
     * @return {executeResult} null | Error | execute result
     */

    module.exec = function(command, options = {}) {
        const { spawnSync } = require('child_process');
        options = { cwd: global.ox.ctx.cwd, ...options };
        const result = spawnSync(command, options);
        if (result.error) {
            throw new Error(result.error);
        }

        if (result.output) {
            return result.output.toString();
        }
        return null;
    };

    return module;
};