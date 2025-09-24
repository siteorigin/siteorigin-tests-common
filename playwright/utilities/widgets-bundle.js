const { expect } = require( '@playwright/test' );

/**
 * Gets a widget field by type and ensures it is visible and initialized.
 *
 * Finds the field within the widget using its type name, waits for it to be visible,
 * and optionally checks for the 'data-initialized' attribute.
 *
 * @async
 * @param {Locator} widget - The Playwright locator for the widget container.
 * @param {string} fieldName - The field type name (e.g., 'icon', 'color').
 * @param {boolean} [initCheck=true] - Whether to check for the 'data-initialized' attribute.
 * @returns {Promise<Locator>} The Playwright locator for the requested field.
 */
const getField = async ( widget, fieldName, initCheck = true ) => {
	const field = widget.locator( `.siteorigin-widget-field-type-${ fieldName }` );

	await expect( field ).toBeVisible();

	if ( initCheck ) {
		await expect( field ).toHaveAttribute( 'data-initialized', 'true' );
	}

	return field;
};

/**
 * Opens a section if it's not already open and returns the section locator.
 *
 * @async
 * @param {string} sectionId - The section name/identifier to open.
 * @param {Locator} widget - The Playwright locator for the widget container.
 * @throws {Error} Throws an error if the section cannot be found, is not visible, or fails to open within the timeout.
 *
 * @returns {Promise<Locator>} The Playwright locator for the opened section.
 */
const openSection = async ( sectionId, widget ) => {
	const section = widget.locator( `.siteorigin-widget-field-${ sectionId }` );
	await expect( section ).toBeVisible();

	widget.scrollIntoViewIfNeeded();

	let labelSelector = ' > .siteorigin-widget-field-label';
	if ( sectionId === 'posts' ) {
		labelSelector = ' > .posts-container-label-wrapper';
	}

	const sectionLabel = section.locator( labelSelector );
	await expect( sectionLabel ).toBeVisible();

	// Is the section already open?
	if ( await sectionLabel.evaluate( ( el ) => el.classList.contains( 'siteorigin-widget-section-visible' ) ) ) {
		return section;
	}

	// Section is not open, so open it
	await sectionLabel.click();
	await expect( sectionLabel ).toHaveClass( /siteorigin-widget-section-visible/, { timeout: 5000 } );

	return section;
}

/**
 * Switches a widget between edit and preview mode in the Site Editor.
 *
 * Shows the block toolbar for the widget, finds the appropriate toolbar button,
 * and clicks it to switch modes. Returns false if the button is not found.
 *
 * @async
 * @param {Admin} admin - The initialized Admin instance.
 * @param {Locator} widget - The Playwright locator for the widget container.
 * @param {'edit'|'preview'} [mode='edit'] - The mode to switch to.
 * @returns {Promise<boolean|void>} Returns false if the button is not found, otherwise void.
 */
const switchWidgetMode = async( admin, widget, mode = 'edit' ) => {
	const buttonText = mode === 'edit' ? 'Edit widget.' : 'Preview widget.';

	await admin.editor.showBlockToolbar( widget );

	const toolbarButton = admin.editor.page.getByRole( 'button', { name: buttonText } );

	if ( await toolbarButton.count() === 0 ) {
		return false;
	}

	await expect( toolbarButton ).toBeVisible();
	await expect( toolbarButton ).toBeEnabled();

	await admin.editor.clickBlockToolbarButton( buttonText );
};

module.exports = {
	getField,
	openSection,
	switchWidgetMode
};
