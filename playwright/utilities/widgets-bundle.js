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
export const getField = async ( widget, fieldName, initCheck = true ) => {
	const field = widget.locator( `.siteorigin-widget-field-type-${ fieldName }` );

	await expect( field ).toBeVisible();

	if ( initCheck ) {
		await expect( field ).toHaveAttribute( 'data-initialized', 'true' );
	}

	return field;
};

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
export const switchWidgetMode = async( admin, widget, mode = 'edit' ) => {
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
