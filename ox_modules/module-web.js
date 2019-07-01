/*
 * Copyright (C) 2015-2018 CloudBeat Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Provides methods for browser automation.
 * <br /><br />
 * <b><i>Notes:</i></b><br />
 * Commands which operate on elements such as click, assert, waitFor, type, select, and others will 
 * automatically wait for a period of time for the element to appear in DOM and become visible. By 
 * default this period equals to 60 seconds, but can be changed using the <code>setTimeout</code>
 * command.
 * <br /><br />
 * <div id="patterns">Commands which expect a string matching pattern in their arguments, support
 *  following patterns unless specified otherwise:
 *  <ul>
 *  <li><code>regex:PATTERN</code> - Match using regular expression.</li>
 *  <li><code>regexi:PATTERN</code> - Match using case-insensitive regular expression.</li>
 *  <li><code>exact:STRING</code> - Match the string verbatim.</li>
 *  <li><code>glob:PATTERN</code> - Match using case-insensitive glob pattern.
 *      <code>?</code> will match any single character except new line (\n).
 *      <code>*</code> will match any sequence (0 or more) of characters except new line. Empty
 *      PATTERN will match only other empty strings.</li>
 *  <li><code>PATTERN</code> - Same as glob matching.</li>
 *  </ul>
 * </div>
 * <div id="locators">Commands which expect an element locator in their arguments, support
 *  following locator types unless specified otherwise:
 *  <ul>
 *  <li><code>id=ID</code> - Locates element by its ID attribute.</li>
 *  <li><code>css=CSS_SELECTOR</code> - Locates element using a CSS selector.</li>
 *  <li><code>link=TEXT</code> - Locates link element whose visible text matches the given string.</li>
 *  <li><code>link-contains=TEXT</code> - Locates link element whose visible text contains the given string.</li>
 *  <li><code>name=NAME</code> - Locates element by its NAME attribute.</li>
 *  <li><code>/XPATH</code> - Locates element using an XPath 1.0 expression.</li>
 *  <li><code>(XPATH)[]</code> - Locates element using an XPath 1.0 expression.</li>
 *  </ul>
 * </div>
 */
module.exports = function (options, context, rs, logger) {
    // this needs to be defined for wdio to work in sync mode
    global.browser = {
        options: {
            sync: true
        }
    };

    var wdioSync = require('wdio-sync');
    var wdio = require('webdriverio');
    var util = require('util');
    var _ = require('lodash');
    const { harFromMessages } = require('chrome-har');
    var utils = require('./utils');

    var _this = module._this = this;

    // properties exposed to external commands
    this.OxError = require('../errors/OxygenError');
    this.errHelper = require('../errors/helper');
    this.driver = null;
    this.helpers = {};
    this.logger = logger;
    this.caps = null; 
    this.waitForTimeout = 60 * 1000;            // default 60s wait timeout
    this.autoWait = true;

    // module's constructor scoped variables
    var helpers = this.helpers;
    var ctx = context;                          // context variables
    var opts = options;                         // startup options
    var isInitialized = false;
    var transactions = {};                      // transaction->har dictionary

    const DEFAULT_SELENIUM_URL = 'http://localhost:4444/wd/hub';
    const NO_SCREENSHOT_COMMANDS = ['init', 'assertAlert'];
    const ACTION_COMMANDS = ['open', 'click'];

    // expose wdio driver for debugging purposes
    module.driver = function() {
        return _this.driver;
    };

    module._isInitialized = function() {
        return isInitialized;
    };

    module._isAction = function(name) {
        return ACTION_COMMANDS.includes(name);
    };

    module._takeScreenshot = function(name) {
        if (!NO_SCREENSHOT_COMMANDS.includes(name)) {
            try {
                return module.takeScreenshot();
            } catch (e) {
                throw _this.errHelper.getOxygenError(e);
            }
        }
    };

    module._adjustBrowserLog = function(log) {
        if (!log || typeof log !== 'object') {
            return null;
        }
        // TODO: convert log.timestamp from the browser time zone to the local one (so we can later correlate between steps and logs)        
        return {
            time: log.timestamp,
            msg: log.message,
            // convert SEVERE log level to ERROR 
            level: log.level === 'SEVERE' ? 'ERROR' : log.level,
            src: 'browser'
        };
    };

    module._iterationStart = function() {
        // clear transaction name saved in previous iteration if any
        global._lastTransactionName = null;
    };

    module._iterationEnd = function() {
        if (!isInitialized) {
            return;
        }
        // collect browser logs for this session
        if (opts.collectBrowserLogs) {
            try {
                const logs = module.getBrowserLogs();
                if (logs && Array.isArray(logs)) {
                    for (var log of logs) {
                        rs.logs.push(module._adjustBrowserLog(log));
                    }                    
                }                
            }
            catch (e) {
                // ignore errors
                console.error('Cannot retrieve browser logs.', e);  
            }
        }
        // TODO: should clear transactions to avoid duplicate names across iterations
        // also should throw on duplicate names.
        if (opts.recordHAR && _this.caps.browserName === 'chrome') {
            // there might be no transactions set if test fails before web.transaction command
            if (global._lastTransactionName) {
                transactions[global._lastTransactionName] = harGet();
            }
        }

        rs.har = transactions;
    };

    /*
     * FIXME: There is a bug with IE. See the comment within function body.
     *
     *  domContentLoaded (aka First Visual Time)- Represents the difference between domContentLoadedEventStart and navigationStart.
     *  load (aka Full Load Time)               - Represents the difference between loadEventStart and navigationStart.
     *
     * The processing model:
     *
     *  1. navigationStart              - The browser has requested the document.
     *  2. ...                          - Not relevant to us. See http://www.w3.org/TR/navigation-timing/#process for more information.
     *  3. domLoading                   - The browser starts parsing the document.
     *  4. domInteractive               - The browser has finished parsing the document and the user can interact with the page.
     *  5. domContentLoadedEventStart   - The document has been completely loaded and parsed and deferred scripts, if any, have executed. 
     *                                    Async scripts, if any, might or might not have executed.
     *                                    Stylesheets[1], images, and subframes might or might not have finished loading.
     *                                      [1] - Stylesheets /usually/ defer this event! - http://molily.de/weblog/domcontentloaded
     *  6. domContentLoadedEventEnd     - The DOMContentLoaded event callback, if any, finished executing. E.g.
     *                                      document.addEventListener("DOMContentLoaded", function(event) {
     *                                          console.log("DOM fully loaded and parsed");
     *                                      });
     *  7. domComplete                  - The DOM tree is completely built. Async scripts, if any, have executed.
     *  8. loadEventStart               - The browser have finished loading all the resources like images, swf, etc.
     *  9. loadEventEnd                 - The load event callback, if any, finished executing.
     */
    module._getStats = function (commandName) {
        if (opts.fetchStats && isInitialized && module._isAction(commandName)) {
            var domContentLoaded = 0;
            var load = 0;

            // TODO: handle following situation:
            // if navigateStart equals to the one we got from previous attempt (we need to save it)
            // it means we are still on the same page and don't need to record load/domContentLoaded times
            try {
                _this.driver.waitUntil(() => {
                    var timingsJS = 'return {' +
                                   'navigationStart: window.performance.timing.navigationStart, ' +
                                   'domContentLoadedEventStart: window.performance.timing.domContentLoadedEventStart, ' +
                                   'loadEventStart: window.performance.timing.loadEventStart}';

                    // FIXME: there seems to be a bug in IE driver or WDIO. if execute is called on closed window (e.g. 
                    // clicking button in a popup that clsoes said popup) a number of exceptions gets thrown and 
                    // continues to be thrown for any future commands.
                    return _this.driver.execute(timingsJS).then((result) => {
                        var timings = result.value;
                        var navigationStart = timings.navigationStart;
                        var domContentLoadedEventStart = timings.domContentLoadedEventStart;
                        var loadEventStart = timings.loadEventStart;

                        domContentLoaded = domContentLoadedEventStart - navigationStart;
                        load = loadEventStart - navigationStart;

                        return domContentLoadedEventStart > 0 && loadEventStart > 0;
                    }).catch(() => true);
                }, 
                90 * 1000);
            } catch (e) {
                // couldn't get timings.
            }

            return { DomContentLoadedEvent: domContentLoaded, LoadEvent: load };
        }

        return {};
    };

    /**
     * @function getCaps
     * @summary Returns currently defined capabilities.
     * @return {Object} capabilities - Current capabilities object.
     */
    module.getCaps = function() {
        return _this.caps;
    };

    /**
     * @function init
     * @summary Initializes new Selenium session.
     * @param {String=} caps - Desired capabilities. If not specified capabilities will be taken from suite definition.
     * @param {String=} seleniumUrl - Remote server URL (default: http://localhost:4444/wd/hub).
     */
    module.init = function(caps, seleniumUrl) {
        if (isInitialized) {
            return;
        }

        if (!seleniumUrl) {
            seleniumUrl = opts.seleniumUrl;
        }

        // take capabilities either from init method argument or from context parameters passed in the constructor
        // merge capabilities from context and from init function argument, give preference to context-passed capabilities
        _this.caps = {};
        if (ctx.caps) {
            _.extend(_this.caps, ctx.caps);
        }
        if (caps) {
            _.extend(_this.caps, caps);
        }

        // populate browserName caps from options. FIXME: why is this even needed?
        if (!_this.caps.browserName) {
            _this.caps.browserName = opts.browserName;
        }
        // FIXME: shall we throw an exception if browserName is not specified, neither in caps nor in options?!
        if (!_this.caps.browserName) {
            throw new _this.OxError(_this.errHelper.errorCode.INVALID_CAPABILITIES,
                'Failed to initialize `web` module - browserName must be specified.');
        }
        // webdriver expects lower case names
        _this.caps.browserName = _this.caps.browserName.toLowerCase();
        // IE is specified as 'ie' through the command line and possibly suites but webdriver expects 'internet explorer'
        if (_this.caps.browserName === 'ie') {
            _this.caps.browserName = 'internet explorer';
        }

        if (opts.recordHAR && _this.caps.browserName === 'chrome') {
            _this.caps.loggingPrefs = {
                browser: 'ALL',
                performance: 'ALL'
            };
            _this.caps.chromeOptions = {
                perfLoggingPrefs: {
                    enableNetwork: true,
                    enablePage: false
                }
            };
        }

        // populate WDIO options
        var URL = require('url');
        var url = URL.parse(seleniumUrl || DEFAULT_SELENIUM_URL);
        var host = url.hostname;
        var port = parseInt(url.port);
        var path = url.pathname;
        var protocol = url.protocol.substr(0, url.protocol.length - 1);    // remove ':' character

        var wdioOpts = {
            protocol: protocol,
            host: host,
            port: port,
            path: path,
            desiredCapabilities: _this.caps
        };

        // initialize driver with either default or custom appium/selenium grid address
        _this.driver = wdio.remote(wdioOpts);
        wdioSync.wrapCommands(_this.driver);
        try {
            _this.driver.init();
        } catch (err) {
            throw _this.errHelper.getSeleniumInitError(err);
        }
        // reset browser logs if auto collect logs option is enabled
        if (opts.collectBrowserLogs) {
            try {
                // simply call this to clear the previous logs and start the test with the clean logs
                module.getBrowserLogs();     
            }
            catch (e) {
                console.error('Cannot retrieve browser logs.', e);  
            }
        }
        // maximize browser window
        try {
            _this.driver.windowHandleMaximize('current');
        } catch (err) {
            throw new _this.OxError(_this.errHelper.errorCode.UNKNOWN_ERROR, err.message, util.inspect(err));
        }

        isInitialized = true;
    };

    function harGet() {
        var logs = _this.driver.log('performance');

        var events = [];
        for (var log of logs.value) {
            var msgObj = JSON.parse(log.message);   // returned as string
            events.push(msgObj.message);
        }

        const har = harFromMessages(events);
        return JSON.stringify(har);
    }

    /**
     * @summary Opens new transaction.
     * @description The transaction will persist till a new one is opened. Transaction names must be
     *              unique.
     * @function transaction
     * @param {String} name - The transaction name.
     */
    module.transaction = function (name) {
        if (global._lastTransactionName) {
            transactions[global._lastTransactionName] = null;

            if (opts.recordHAR && isInitialized && _this.caps.browserName === 'chrome') {
                transactions[global._lastTransactionName] = harGet();
            }
        }

        global._lastTransactionName = name;
    };
    
    /**
     * @function dispose
     * @summary Ends the current session.
     */
    module.dispose = function() {
        if (_this.driver && isInitialized) {
            try {
                _this.driver.end();
            } catch (e) {
                logger.error(e);    // ignore any errors at disposal stage
            }
            isInitialized = false;
        }
    };

    helpers.getWdioLocator = function(locator) {
        if (!locator)
            throw new this.OxError(this.errHelper.errorCode.SCRIPT_ERROR, 'Invalid argument - locator not specified');
        else if (typeof locator === 'object')
            return locator;
        else if (locator.indexOf('/') === 0)
            return locator;                                 // leave xpath locator as is
        else if (locator.indexOf('id=') === 0)
            return '//*[@id="' + locator.substr('id='.length) + '"]';   // convert 'id=' to xpath (# wouldn't work if id contains colons)
        else if (locator.indexOf('name=') === 0)
            return '//*[@name="' + locator.substr('name='.length) + '"]';
        else if (locator.indexOf('link=') === 0)
            return '=' + locator.substr('link='.length);
        else if (locator.indexOf('link-contains=') === 0)
            return '*=' + locator.substr('link='.length);
        else if (locator.indexOf('css=') === 0)
            return locator.substr('css='.length);           // in case of css, just remove css= prefix
 
        return locator;
    };

    helpers.matchPattern = utils.matchPattern;
    
    helpers.assertArgument = utils.assertArgument;
    helpers.assertArgumentNonEmptyString = utils.assertArgumentNonEmptyString;
    helpers.assertArgumentNumber = utils.assertArgumentNumber;
    helpers.assertArgumentNumberNonNegative = utils.assertArgumentNumberNonNegative;
    helpers.assertArgumentBool = utils.assertArgumentBool;
    helpers.assertArgumentTimeout = utils.assertArgumentTimeout;

    return module;
};
