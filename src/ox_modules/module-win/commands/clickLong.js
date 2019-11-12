/*
 * Copyright (C) 2015-present CloudBeat Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * @summary Performs a long click/touch on an element.
 * @function clickLong
 * @param {String|Element} locator - Element locator.
 * @param {Number} duration - Touch duration in milliseconds.
 * @param {Number=} timeout - Timeout in milliseconds. Default is 60 seconds.
 * @for android, ios, hybrid, web
 * @example <caption>[javascript] Usage example</caption>
 * win.init(caps);//Starts a mobile session and opens app from desired capabilities
 * win.clickLong("id=Mark",6000);// Clicks an element for a certain duration.
 */
module.exports = function(locator, duration, timeout) {
    this.helpers.assertArgumentNumberNonNegative(duration, 'duration');
    this.helpers.assertArgumentTimeout(timeout, 'timeout');

    var el = this.helpers.getElement(locator, false, timeout);

    el.touchAction([
        'press',
        { action: 'wait', ms: duration },
        'release'
    ]);
};
