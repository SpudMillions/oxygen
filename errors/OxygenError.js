/*
 * Copyright (C) 2015-2018 CloudBeat Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
 
/*
 * Oxygen Error class extension
 */
var util = require('util');
util.inherits(OxygenError, Error);

function OxygenError(type, message, data, isFatal, orgErr = null) {
    this.type = type || this.type || null;
    this.message = message || this.message || null;
    this.data = data || null;
    this.isFatal = (typeof isFatal === 'undefined') ? true : isFatal;
    
    var self = this;
    this.captureStackTrace = function() {
        if (orgErr && orgErr.stack) {
            self.stack = orgErr.stack;
        }
        else {
            try {
                var orig = Error.prepareStackTrace;
                Error.prepareStackTrace = function (_, stack) { return stack; };
                var err = new Error();
                Error.captureStackTrace(err, OxygenError);
                self.stack = err.stack;
                Error.prepareStackTrace = orig;
            }
            catch (e) {
                console.error(e.message)
            }
        }        
    };
    
    // don't generate stacktrace if OxygenError is used indirectly through inheritance
    if (type || message) {
        this.captureStackTrace();
    }
}

module.exports = OxygenError;
