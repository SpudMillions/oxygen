/**
     * @summary Checks if element is visible on the screen.
     * @function isDisplayed
	 * @param {String} locator - Locator of element to be found. "id=" to search by ID or "//" to search by XPath.
*/
module.exports = function(locator) {
	if (!locator) 
		throw new Error('locator is empty or not specified');
	// when locator is an element object
	if (typeof locator === 'object' && locator.click) {
		return locator.isVisible();
	}
	// when locator is string
	locator = this._helpers.getWdioLocator(locator);
	return this._driver.isVisible(locator);
};
