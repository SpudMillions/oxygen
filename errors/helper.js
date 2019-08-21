/*
 * Copyright (C) 2015-2018 CloudBeat Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
 
/**
 * Helper module for handling and converting various error types
 */

const OxError = require('../errors/OxygenError');
const OxScriptError = require('../errors/ScriptError');
const Failure = require('../model/failure');
const util = require('util');
const stackTrace = require('stack-trace');

const ERROR_CODES = {
    SCRIPT_ERROR: 'SCRIPT_ERROR',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR',
    ASSERT_ERROR: 'ASSERT_ERROR',
    VERIFY_ERROR: 'VERIFY_ERROR',
    ELEMENT_NOT_FOUND: 'ELEMENT_NOT_FOUND',
    FRAME_NOT_FOUND: 'FRAME_NOT_FOUND',
    UNKNOWN_COMMAND_ERROR: 'UNKNOWN_COMMAND_ERROR',
    STALE_ELEMENT_REFERENCE: 'STALE_ELEMENT_REFERENCE',
    ELEMENT_NOT_VISIBLE: 'ELEMENT_NOT_VISIBLE',
    LOCATOR_MATCHES_MULTIPLE_ELEMENTS: 'LOCATOR_MATCHES_MULTIPLE_ELEMENTS',
    ELEMENT_STILL_EXISTS: 'ELEMENT_STILL_EXISTS',
    BROWSER_JS_EXECUTE_ERROR: 'BROWSER_JS_EXECUTE_ERROR',
    TIMEOUT: 'TIMEOUT',
    WINDOW_NOT_FOUND: 'WINDOW_NOT_FOUND',
    UNEXPECTED_ALERT_OPEN: 'UNEXPECTED_ALERT_OPEN',
    NO_ALERT_OPEN_ERROR: 'NO_ALERT_OPEN_ERROR',
    MAILINATOR_ERROR: 'MAILINATOR_ERROR',
    APPIUM_UNREACHABLE_ERROR: 'APPIUM_UNREACHABLE_ERROR',
    SELENIUM_UNREACHABLE_ERROR: 'SELENIUM_UNREACHABLE_ERROR',
    CHROME_BINARY_NOT_FOUND: 'CHROME_BINARY_NOT_FOUND',
    DB_CONNECTION_ERROR: 'DB_CONNECTION_ERROR',
    DB_QUERY_ERROR: 'DB_QUERY_ERROR',
    SOAP_ERROR: 'SOAP_ERROR',
    NOT_IMPLEMENTED_ERROR: 'NOT_IMPLEMENTED_ERROR',
    SERIAL_PORT_ERROR: 'SERIAL_PORT_ERROR',
    HTTP_ERROR: 'HTTP_ERROR',
    EMAIL_ERROR: 'EMAIL_ERROR',
    MODULE_NOT_INITIALIZED_ERROR: 'MODULE_NOT_INITIALIZED_ERROR',
    TEXT_DOESNT_MATCH_ERROR: 'TEXT_DOESNT_MATCH_ERROR',
    VALUE_DOESNT_MATCH_ERROR: 'VALUE_DOESNT_MATCH_ERROR',
    DEVICE_NOT_FOUND: 'DEVICE_NOT_FOUND',
    PARAMETERS_ERROR: 'PARAMETERS_ERROR',
    INVALID_CAPABILITIES: 'INVALID_CAPABILITIES',
    BROWSER_CONFIGURATION_ERROR: 'BROWSER_CONFIGURATION_ERROR',
    APPIUM_RUNTIME_ERROR: 'APPIUM_RUNTIME_ERROR',
    SELENIUM_RUNTIME_ERROR: 'SELENIUM_RUNTIME_ERROR',
    RUNTIME_ERROR: 'RUNTIME_ERROR'
};

// WebdriverIO to Oxygen error codes mapping
// https://github.com/webdriverio/webdriverio/blob/master/lib/helpers/constants.js
// https://github.com/webdriverio/webdriverio/blob/master/lib/utils/ErrorHandler.js
// TODO: codes not directly mapped to ERROR_CODES need to be reviewed specificly their behaviour in web/mob modes.
const WDIO_ERROR_CODES = {
    // selenium error codes https://w3c.github.io/webdriver/webdriver-spec.html#dfn-error-code
    Unknown: ERROR_CODES.UNKNOWN_ERROR,
    NoSuchDriver: 'NO_SUCH_DRIVER',
    NoSuchElement: ERROR_CODES.ELEMENT_NOT_FOUND,
    NoSuchFrame: ERROR_CODES.FRAME_NOT_FOUND,
    UnknownCommand: ERROR_CODES.UNKNOWN_COMMAND_ERROR,
    StaleElementReference: ERROR_CODES.STALE_ELEMENT_REFERENCE,
    ElementNotVisible: ERROR_CODES.ELEMENT_NOT_VISIBLE,
    InvalidElementState: 'INVALID_ELEMENT_STATE',
    UnknownError: ERROR_CODES.UNKNOWN_ERROR,
    ElementIsNotSelectable: 'ELEMENT_IS_NOT_SELECTABLE',
    JavaScriptError: ERROR_CODES.BROWSER_JS_EXECUTE_ERROR,
    XPathLookupError: ERROR_CODES.NO_SUCH_ELEMENT,
    Timeout: ERROR_CODES.TIMEOUT,
    NoSuchWindow: ERROR_CODES.WINDOW_NOT_FOUND,
    InvalidCookieDomain: 'INVALID_COOKIE_DOMAIN',
    UnableToSetCookie: 'UNABLE_TO_SET_COOKIE',
    UnexpectedAlertOpen: ERROR_CODES.UNEXPECTED_ALERT_OPEN,
    NoAlertOpenError: ERROR_CODES.NO_ALERT_OPEN_ERROR,
    ScriptTimeout: ERROR_CODES.UNKNOWN_ERROR,                       // FIXME
    InvalidElementCoordinates: 'INVALID_ELEMENT_COORDINATES',
    IMENotAvailable: 'IME_NOT_AVAILABLE',
    IMEEngineActivationFailed: 'IME_ENGINE_ACTIVATION_FAILED',
    InvalidSelector: 'INVALID_SELECTOR',
    SessionNotCreatedException: 'SESSION_NOT_CREATED_EXCEPTION',
    ElementNotScrollable: 'ELEMENT_NOT_SCROLLABLE',
    // WebdriverIO specific error codes
    SelectorTimeoutError: 'SELECTOR_TIMEOUT_ERROR',
    NoSessionIdError: 'NO_SESSION_ID_ERROR',
    GridApiError: 'GRID_API_ERROR',
    WaitForTimeoutError: ERROR_CODES.TIMEOUT,
    WaitUntilTimeoutError: ERROR_CODES.TIMEOUT
};

const JS_ERRORS_MAPPING = {
    ReferenceError: ERROR_CODES.SCRIPT_ERROR,
    TypeError: ERROR_CODES.SCRIPT_ERROR
};

// Chai to Oxygen error codes mapping
const CHAI_ERRORS_MAPPING = {
    AssertionError: ERROR_CODES.ASSERT_ERROR
};

module.exports = {
    getFailureFromError: function(err) {
        if (!(err instanceof OxError)) {
            err = this.getOxygenError(err)            
        }
        return {
            type: err.type,
            message: err.message,
            data: err.data,
            location: this.getFailureLocation(err)
        }
    },
    getFailureLocation(err) {
        if (err.location) {
            return err.location;
        }
        else if (!err.stack) {
            return null;
        }
        let stack = err.stack;
        // check if err.stack is a string or an object
        if (typeof stack === 'string') {
            // convert string-based stack to CallSite object array
            stack = stackTrace.parse(err);
        }
        if (stack && stack.length && stack.length > 0) {
            // assume that the error occured in the top call of the stack trace array 
            return `${stack[0].getFileName()}:${stack[0].getLineNumber()}:${stack[0].getColumnNumber()}`;
        }
    },
    getOxygenError: function(err, module, cmd, args) {
        // return the error as is if it has been already processed
        if (err instanceof OxError) {
            return err;
        }
        // if error occured in module's init method, mark it as fatal because we can't continue with the test
        let isFatal = cmd === 'init';
        var errType = err.type || err.name || typeof err;
        
        // try to resolve WDIO error code 
        var oxErrorCode = WDIO_ERROR_CODES[errType];
        if (oxErrorCode) {
            // remove "Promise rejected..." from errors produced by waitUntil
            if (errType === 'WaitUntilTimeoutError' && 
                err.message.indexOf('Promise was rejected with the following reason: ') === 0) {
                err.message = err.message.substring('Promise was rejected with the following reason: '.length);
            }
            return new OxError(oxErrorCode, err.message, null, isFatal);
        }

        // try to resolve WDIO RuntimeError-s having seleniumStack
        if (errType === 'RuntimeError' && err.seleniumStack) {
            oxErrorCode = WDIO_ERROR_CODES[err.seleniumStack.type];
            if (err.message === 'unknown error: NoSuchElement') {
                return new OxError(ERROR_CODES.ELEMENT_NOT_FOUND, null, null, isFatal);
            } else if (err.message && err.message.startsWith('Element is not displayed')) { // IE specific
                return new OxError(ERROR_CODES.ELEMENT_NOT_VISIBLE, null, null, isFatal);
            } else if (oxErrorCode) {
                return new OxError(oxErrorCode, err.message, null, isFatal);
            }
        }
        // handle various types of RuntimeError(s)
        else if (errType === 'RuntimeError' && err.message) {
            const ORIGINAL_ERROR_MESSAGE = 'Original error: ';
            if (err.message.indexOf(ORIGINAL_ERROR_MESSAGE) > -1) {
                const originalError = err.message.substring(err.message.indexOf(ORIGINAL_ERROR_MESSAGE) + ORIGINAL_ERROR_MESSAGE.length);
                return new OxError(ERROR_CODES.RUNTIME_ERROR, originalError, null, isFatal);
            }
        }

        // try to resolve Chai error code
        oxErrorCode = CHAI_ERRORS_MAPPING[errType];
        if (oxErrorCode) {
            // throw non-fatal error if it's a "verify" module or method 
            if (oxErrorCode === ERROR_CODES.ASSERT && 
				(module && cmd && (module === 'verify' || cmd.indexOf('verify') === 0))) { // verify.*, *.verify*
                return new OxError(ERROR_CODES.VERIFY, err.message, null, false, err);
            }
            return new OxError(oxErrorCode, err.message, null, isFatal, err);
        }

        // try to resolve general JavaScript errors
        oxErrorCode = JS_ERRORS_MAPPING[errType];
        if (oxErrorCode) {
            if (oxErrorCode == ERROR_CODES.SCRIPT_ERROR) {
                return new OxScriptError(err)
            }
            return new OxError(oxErrorCode, err.message, null, isFatal);
        }
        
        return new OxError(ERROR_CODES.UNKNOWN_ERROR, err.type + ': ' + err.message, util.inspect(err), isFatal);
    },
    getSeleniumInitError: function(err) {
        if (err.message) {
            var ieZoomErrorMsg = err.message.match(/(Unexpected error launching Internet Explorer\. Browser zoom level was set to \d+%\. It should be set to \d+%)/gm);
            if (ieZoomErrorMsg) {
                return new OxError(ERROR_CODES.BROWSER_CONFIGURATION_ERROR, ieZoomErrorMsg.toString());
            }
        }

        if (err.type === 'RuntimeError') {
            if (err.message != null && err.message.indexOf('cannot find Chrome binary') > -1) {
                return new OxError(ERROR_CODES.CHROME_BINARY_NOT_FOUND, 'Cannot find Chrome binary');
            } else if (err.message != null && err.message.indexOf('ECONNREFUSED') > -1) {
                return new OxError(ERROR_CODES.SELENIUM_UNREACHABLE_ERROR, "Couldn't connect to Selenium server");
            } else if (err.message != null && err.message.indexOf('ENOTFOUND') > -1) {
                return new OxError(ERROR_CODES.SELENIUM_UNREACHABLE_ERROR, "Couldn't resolve Selenium server address");
            }
            else {
                return new OxError(ERROR_CODES.SELENIUM_RUNTIME_ERROR, err.message, null);
            }
        }
        
        return new OxError(ERROR_CODES.UNKNOWN_ERROR, err.type + ': ' + err.message, util.inspect(err));
    },
    getAppiumInitError: function(err) {
        if (err.type === 'RuntimeError') {
            if (err.message != null && err.message.indexOf('cannot find Chrome binary') > -1) {
                return new OxError(ERROR_CODES.CHROME_BINARY_NOT_FOUND, 'Cannot find Chrome binary');
            } else if (err.message != null && err.message.indexOf('ECONNREFUSED') > -1) {
                return new OxError(ERROR_CODES.APPIUM_UNREACHABLE_ERROR, "Couldn't connect to Appium server");
            } else if (err.message != null && err.message.indexOf('ENOTFOUND') > -1) {
                return new OxError(ERROR_CODES.APPIUM_UNREACHABLE_ERROR, "Couldn't resolve Appium server address");
            } else if (err.seleniumStack && err.seleniumStack.orgStatusMessage 
                && err.seleniumStack.orgStatusMessage.indexOf('Could not find a connected Android device') > -1) {
                return new OxError(ERROR_CODES.DEVICE_NOT_FOUND, 'Could not find a connected Android device');
            }
            else {
                const ORIGINAL_ERROR_MESSAGE = 'Original error: ';
                if (err.message.indexOf(ORIGINAL_ERROR_MESSAGE) > -1) {
                    const originalError = err.message.substring(err.message.indexOf(ORIGINAL_ERROR_MESSAGE) + ORIGINAL_ERROR_MESSAGE.length);
                    return new OxError(ERROR_CODES.APPIUM_RUNTIME_ERROR, originalError, null);
                }
                else {
                    return new OxError(ERROR_CODES.APPIUM_RUNTIME_ERROR, err.message, null);
                }
            }
        }
        return new OxError(ERROR_CODES.UNKNOWN_ERROR, err.type + ': ' + err.message, util.inspect(err));
    },
    
    errorCode: ERROR_CODES
};
