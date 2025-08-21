const {
	expect,
	request
} = require( '@playwright/test' );

const {
	Admin,
	RequestUtils,
	PageUtils,
	Editor
} = require( '@wordpress/e2e-test-utils-playwright' );


/**
 * Retrieves the Playwright configuration, importing it if necessary.
 *
 * @param {Object} config The current configuration object.
 * @returns {Promise<Object>} The resolved configuration object.
 */
const maybeGetConfig = async ( config ) => {
	if ( Object.keys( config ).length === 0 ) {
		const importedConfig = await import( '../../playwright.config.js' );
		config = importedConfig.default.default;
	}

	return config;
};

/**
 * Sets up the WordPress RequestUtils instance.
 *
 * @param {Object} config The Playwright configuration object.
 * @returns {Promise<RequestUtils>} The initialized RequestUtils instance.
 * @throws {Error} If the baseURL is invalid or missing.
 */
const setupRequestUtils = async ( config = {} ) => {
	config = await maybeGetConfig( config );

	const {
		storageState,
		baseURL,
		ignoreHTTPSErrors,
	} = config.use ?? config.projects[ 0 ].use;

	if ( ! baseURL || ! baseURL.startsWith( 'http' ) ) {
		throw new Error( 'Invalid or missing baseURL in the configuration.' );
	}

	const storageStatePath = typeof storageState === 'string' ? storageState : undefined;
	const requestUtils = await RequestUtils.setup( {
		baseURL,
		storageStatePath,
		ignoreHTTPSErrors
	} );

	requestUtils.request = await request.newContext( {
		baseURL,
		ignoreHTTPSErrors,
		storageState: storageStatePath
	} );

	return requestUtils;
};

/**
 * Stops loading the current page to avoid unnecessary requests.
 *
 * This function checks if the main frame is still attached and,
 * if so, executes `window.stop()` in the browser context to
 * halt any further network activity or resource loading.
 *
 * @async
 * @param {import('@playwright/test').Page} page - The Playwright page object.
 */
const stopRequest = async ( page ) => {
	if ( page.mainFrame().isDetached() === false ) {
		try {
			await page.evaluate( () => window.stop() );
		} catch ( e ) {}
	}
}

/**
 * Logs in to WordPress as a specified user type using e2e test utilities.
 *
 * This function performs a manual login through the WordPress login page
 * for reliability. Attempts to log in via the REST API using RequestUtils
 * are intentionally avoided due to reliability issues with
 * requestUtils.login in some environments. Verifies successful login by checking access to the admin area.
 *
 * @async
 * @param {import('@playwright/test').Page} page - The Playwright page object.
 * @param {'admin'|'editor'|'subscriber'} [type='admin'] - The user type to log in as.
 * @returns {Promise<boolean>} Resolves to true if login is successful.
 * @throws {Error} If login fails or user type is invalid.
 */
const doLogin = async ( page, type = 'admin' ) => {
	const username = type === 'admin' ? process.env.WP_USERNAME : type;
	const password = process.env.WP_PASSWORD;

	await page.goto( '/wp-login.php' );
	await page.waitForSelector( '#user_login', { timeout: 10000 } );
	await page.fill( '#user_login', username );
	await page.fill( '#user_pass', password );

	// Listen for navigation to wp-admin and stop it asap.
	let navigationStopped = false;
	const navHandler = async ( frame ) => {
		if (
			frame === page.mainFrame() &&
			!navigationStopped &&
			/\/wp-admin/.test( frame.url() )
		) {
			navigationStopped = true;
			await stopRequest( page );
		}
	};

	page.on( 'framenavigated', navHandler );

	await page.click( '#wp-submit' );

	page.off( 'framenavigated', navHandler );

	return true;
};

/**
 * Initializes the WordPress Admin instance.
 *
 * @param {Object} page The Playwright page object.
 * @returns {Promise<Admin>} The initialized Admin instance.
 */
const initializeAdmin = async ( page ) => {
	const pageUtils = new PageUtils( { page } );
	const editor = new Editor( { page, pageUtils } );

	return new Admin( {
		page,
		pageUtils,
		editor,
	} );
};

/**
 * Closes a modal dialog in the Site Editor if it exists.
 *
 * This function checks for the presence of a modal dialog with the specified class
 * and attempts to close it by clicking the close button. If the modal has multiple
 * steps, it clicks the close button again to ensure it is fully dismissed.
 *
 * @async
 * @param {import('@playwright/test').Page} page - The Playwright page object.
 * @param {string} modalClass - The CSS class of the modal to locate.
 * @returns {Promise<void>} Resolves when the modal is closed or if no modal is found.
 */
const maybeCloseSiteEditorModal = async ( page, modalClass ) => {
	const modal = page.locator( modalClass );
	if ( await modal.count() > 0 ) {
		const closeButton = modal.locator( 'button' );
		await closeButton.isVisible();
		await closeButton.click();
		// Sometimes the modal has two steps.
		if ( await closeButton.isVisible() ) {
			await closeButton.click();
		}
	}
};

/**
 * Inserts a block into the Site Editor and returns its widget container.
 *
 * This function:
 * - Inserts the specified block by name using the editor API.
 * - Waits for the block to appear and be visible in the editor canvas.
 * - Properly selects/activates the block to match real user interaction.
 * - Edits the first visible and editable field to trigger a change.
 * - Returns the widget container locator for further interaction in tests.
 *
 * @async
 * @param {Admin} admin - The initialized Admin instance with editor context.
 * @param {string} blockName - The block's full name.
 * @param {boolean} [isWb=true] - Whether the block is a Widgets Bundle block.
 * @returns {Promise<Locator>} The Playwright locator for the widget container.
 */
const addBlock = async( admin, blockName, isWb = true ) => {
	await admin.editor.insertBlock( { name: blockName } );
	await admin.page.waitForTimeout( 1000 );

	const widget = admin.editor.canvas.locator( `.wp-block[data-type="${ blockName }"]` );
	await expect( widget ).toBeVisible();
	await widget.scrollIntoViewIfNeeded();

	await admin.editor.selectBlocks( widget );

	// Ensure the block is active, and setup.
	await widget.click();
	await widget.hover();
	await expect( widget ).toHaveClass( /is-selected/ );
	await expect( widget ).toHaveClass( /is-hovered/ );

	if ( isWb ) {
		// Wait for the form to be ready.
		const blockLoader = widget.locator( '.so-widgets-spinner-container' );
		await expect( blockLoader ).toBeHidden();
	}

	// To prevent a potential desync, we need to cause a change in the block.
	const editableFields = widget.locator( 'input[type="text"], textarea' );
	const count = await editableFields.count();
	for ( let i = 0; i < count; i++ ) {
		const field = editableFields.nth( i );
		if ( await field.isVisible() && await field.isEditable() ) {
			const value = await field.inputValue();
			await field.fill( 'test' );

			// Revert the edit, and validate that it has been reset.
			await field.fill( value );
			await expect( field ).toHaveValue( value );
			break;
		}
	}

	return widget;
};

/**
 * Handles browser dialogs (alerts, confirms, prompts) in Playwright.
 *
 * Listens for the next dialog event on the provided page and performs the specified action:
 * - 'accept': Accepts the dialog.
 * - 'dismiss': Dismisses the dialog.
 * Optionally executes a callback with the dialog object after handling.
 *
 * @param {import('@playwright/test').Page} page - The Playwright page object.
 * @param {'accept'|'dismiss'} [action='accept'] - The action to perform on the dialog.
 * @param {Function} [callback] - Optional callback to execute after handling the dialog.
 *
 * @returns {Promise<void>} Resolves when the dialog has been handled.
 */
const handleDialog = ( page, action = 'accept', callback ) => {
	return new Promise( ( resolve ) => {
		page.once( 'dialog', async ( dialog ) => {
			if ( action === 'accept' ) {
				await dialog.accept();
			} else {
				await dialog.dismiss();
			}

			if ( typeof callback === 'function' ) {
				await callback( dialog );
			}

			resolve();
		} );
	} );
};

/**
 * Waits for a network request matching the given action substring to finish with a 200 status.
 *
 * This function listens for a response whose URL includes the specified action string,
 * and resolves when the response status is 200. Throws an error if the request does not
 * complete within the given timeout.
 *
 * @async
 * @param {import('@playwright/test').Page} page - The Playwright page object.
 * @param {string} action - The substring to match in the request URL.
 * @param {number} [timeout=15000] - Timeout in milliseconds.
 * @throws {Error} If the request does not complete within the timeout.
 *
 * @returns {Promise<void>} Resolves when the request finishes successfully.
 */
const waitForRequestToFinish = async( page, action, timeout = 15000 ) => {
	try {
		await page.waitForResponse(
			( response ) => response.url().includes( action ) && response.status() === 200,
			{ timeout }
		);
	} catch ( error ) {
		throw new Error( `Request to ${ action } did not complete within ${ timeout }ms` );
	}
};

module.exports = {
	addBlock,
	doLogin,
	handleDialog,
	initializeAdmin,
	openSiteEditorCanvas,
	setupRequestUtils,
	waitForRequestToFinish,
};
