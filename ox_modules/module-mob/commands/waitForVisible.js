/*
 * Copyright (C) 2015-2018 CloudBeat Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * @summary Wait for an element for the provided amount of milliseconds to be visible.
 * @function waitForVisible
 * @param {String|WebElement} locator - Element locator.
 * @param {Number=} wait - Time in milliseconds to wait for the element. Default is 60 seconds.
 * @for android, ios, hybrid, web
 * @example <caption>[javascript] Usage example</caption>
 * mob.init(caps);//Starts a mobile session and opens app from desired capabilities
 * mob.waitForVisible('id=Element');//Wait for an element for the provided amount of milliseconds to be visible.
 */
module.exports = function(locator, wait) {
    this.helpers._assertArgument(locator, 'locator');
    this.helpers._assertArgumentTimeout(wait, 'wait');
    wait = wait || this.waitForTimeout;

    // when locator is an element object
    if (typeof locator === 'object' && locator.waitForVisible) {
        return locator.waitForVisible(wait);
    }
    // when locator is string
    locator = this.helpers.getWdioLocator(locator);
    return this.driver.waitForVisible(locator, wait);
};
