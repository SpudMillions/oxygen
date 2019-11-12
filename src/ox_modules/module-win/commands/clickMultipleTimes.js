/*
 * Copyright (C) 2015-present CloudBeat Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * @summary Performs tap on an element multiple times in quick succession.
 * @function clickMultipleTimes
 * @param {String|Element} locator - Element locator.
 * @param {Number} taps - Number of taps.
 * @param {Number=} timeout - Timeout in milliseconds. Default is 60 seconds.
 * @for android, ios, hybrid, web
 * @example <caption>[javascript] Usage example</caption>
 * win.init(caps);//Starts a mobile session and opens app from desired capabilities
 * win.clickMultipleTimes("id=Mark",4);// Clicks an element certain amount of times.
 */
module.exports = function(locator, taps, timeout) {
    this.helpers.assertArgumentNumberNonNegative(taps, 'taps');
    this.helpers.assertArgumentTimeout(timeout, 'timeout');

    var el = this.helpers.getElement(locator, false, timeout);

    var actions = [];
    for (var i = 0; i < taps; i++) {
        actions.push('tap');
    }

    el.touchAction(actions);
};
