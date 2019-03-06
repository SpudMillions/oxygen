/*
 * Copyright (C) 2015-present CloudBeat Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Provides methods for printing user defined messages to test results.
 */
module.exports = function (options, context, rs, logger) {
    var _this = module._this = this;
    this.logger = logger;

    module._isInitialized = function() {
        return true;
    };
    
    /**
     * @summary Print an INFO message.
     * @function info
     * @param {String} msg - Message to print.
     */
    module.info = function(msg) { _this.logger.info(msg); };
    /**
     * @summary Print an ERROR message.
     * @function error
     * @param {String} msg - Message to print.
     */
    module.error = function(msg) { _this.logger.error(msg); };
    /**
     * @summary Print a DEBUG message.
     * @function debug
     * @param {String} msg - Message to print.
     */
    module.debug = function(msg) { _this.logger.debug(msg); };
    /**
     * @summary Print a WARN message.
     * @function warn
     * @param {String} msg - Message to print.
     */
    module.warn = function(msg) { _this.logger.warn(msg); };

    return module;
};
