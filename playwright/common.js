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

const path = require( 'path' );

/**
 * Retrieves the Playwright configuration from the current working directory.
 *
 * @returns {Object} The Playwright configuration object.
 */
const getPlaywrightConfig = () => {
	const configPath = path.resolve(process.cwd(), 'playwright.config.js');
	try {
		const config = require(configPath); // Dynamically require the config file
		return config;
	} catch (error) {
		console.error(`Failed to load Playwright config from ${configPath}:`, error);
		throw error;
	}
};

/**
 * Sets up the WordPress RequestUtils instance.
 *
 * @param {Object} config The Playwright configuration object.
 * @returns {Promise<RequestUtils>} The initialized RequestUtils instance.
 * @throws {Error} If the baseURL is invalid or missing.
 */
const setupRequestUtils = async ( config = {} ) => {
	config = await getPlaywrightConfig( config );

	const {
		storageState,
		baseURL,
		ignoreHTTPSErrors,
	} = config.use ?? config.projects[ 0 ].use;

	if ( ! baseURL || ! baseURL.startsWith( 'http' ) ) {
		throw new Error( 'Invalid or missing baseURL in the configuration.' );
	}

	const storageStatePath = typeof storageState === 'string' ? storageState : undefined;

	const requestContext = await request.newContext( {
		baseURL,
		ignoreHTTPSErrors,
		storageState: storageStatePath
	} );

	const requestUtils = await RequestUtils.setup( requestContext, {
		storageStatePath,
	} );

	await requestUtils.setupRest();

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
 * Navigates to a URL relative to the WordPress base URL.
 * Ensures no double slashes in the final URL.
 *
 * @param {import('@playwright/test').Page} page - Playwright page object.
 * @param {string} url - Relative URL to navigate to.
 *
 * @returns {Promise<void>} Resolves when navigation completes.
 */
const soGoTo = async ( page, url ) => {
	let siteURL = `${ process.env.WP_BASE_URL }`;

	// Ensure siteURL ends with a single slash.
	if ( ! siteURL.endsWith( '/' ) ) {
		siteURL += '/';
	}

	// Remove leading slash from url if it exists.
	if ( url.startsWith( '/' ) ) {
		url = url.substring( 1 );
	}

	await page.goto( siteURL + url );
};

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

	await soGoTo( page, 'wp-login.php' );

	await page.waitForSelector( '#user_login', { timeout: 10000 } );

	// wp-login.php focuses and selects #user_login 200ms after its inline
	// script runs. If that lands while the password is being filled, the
	// password replaces the username and the empty, required #user_pass
	// blocks the submit. Wait for the autofocus first. It doesn't run on
	// error pages or when enable_login_autofocus is false, so don't require it.
	await page.waitForFunction(
		() => document.activeElement?.id === 'user_login',
		null,
		{ timeout: 2000 }
	).catch( () => {} );

	await expect( async () => {
		await page.fill( '#user_login', username );
		await page.fill( '#user_pass', password );
		await expect( page.locator( '#user_login' ) ).toHaveValue( username, { timeout: 500 } );
		await expect( page.locator( '#user_pass' ) ).toHaveValue( password, { timeout: 500 } );
	} ).toPass( { timeout: 10000 } );

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

	// Wait for the redirect to wp-admin, so a failed submit fails here
	// rather than as "Not logged in" in a later step.
	await Promise.all( [
		page.waitForURL( /\/wp-admin/, { waitUntil: 'commit' } ),
		page.click( '#wp-submit' ),
	] );

	page.off( 'framenavigated', navHandler );

	return true;
};

/**
 * Initializes the WordPress Admin instance.
 *
 * @param {Object} page The Playwright page object.
 * @returns {Promise<Admin>} The initialized Admin instance.
 */
const setupAdminE2E = async ( page ) => {
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
 * Opens the Site Editor canvas and dismisses the onboarding guide if present.
 *
 * This is a faster alternative to admin.visitSiteEditor() as it skips the initial
 * site editor load by navigating directly to the Site Editor canvas.
 *
 * This function also dismisses the onboarding guide modal.
 *
 * @async
 * @param {import('@playwright/test').Page} page - Playwright Page instance.
 * @param {import('@wordpress/e2e-test-utils-playwright').Admin} admin - Initialized Admin instance (used for editor.canvas).
 * @returns {Promise<void>} Resolves once the editor is ready and the guide (if any) has been dismissed.
 */
const openSiteEditorCanvas = async ( page, admin ) => {
	await soGoTo( page, 'wp-admin/site-editor.php?p=%2F&canvas=edit' );
	await admin.editor.canvas.locator( '.block-editor-iframe__body' ).waitFor( { timeout: 20000 } );

	await maybeCloseSiteEditorModal( page, '.edit-site-welcome-guide' );

	await disableBlockSettingsMenu( page );
};

/**
 * Neutralizes the Site Editor sticky header to prevent it from blocking interactions.
 *
 * Injects a style element into the Site Editor iframe that disables sticky positioning
 * and pointer events on the template part header so fields remain accessible during tests.
 *
 * @async
 * @param {import('@wordpress/e2e-test-utils-playwright').Admin} admin - Initialized Admin instance.
 * @returns {Promise<void>} Resolves once the style tag has been injected (or already exists).
 */
const neutralizeSiteEditorStickyHeader = async ( admin ) => {
	await admin.page.evaluate( () => {
		const iframe = document.querySelector( 'iframe[name="editor-canvas"]' );
		if ( ! iframe || ! iframe.contentDocument || ! iframe.contentDocument.head ) {
			return;
		}

		const doc = iframe.contentDocument;
		const styleId = 'sow-tests-neutralize-sticky-header';
		if ( doc.getElementById( styleId ) ) {
			return;
		}

		const style = doc.createElement( 'style' );
		style.id = styleId;
		style.textContent = `
			header.wp-block-template-part,
			header.wp-block-template-part > .is-position-sticky {
				position: static !important;
			}

			header.wp-block-template-part {
				pointer-events: none !important;
				z-index: 0 !important;
			}
		`;

		doc.head.appendChild( style );
	} );
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
 * @param {number} offset - The vertical offset to apply when scrolling.
 * @param {boolean} [isWb=true] - Whether the block is a Widgets Bundle block.
 * @returns {Promise<Locator>} The Playwright locator for the widget container.
 */
const addBlock = async( admin, blockName, offset, isWb = true ) => {
	await admin.editor.insertBlock( { name: blockName } );
	if ( isWb ) {
		// WB Forms require a server side request before they're rendered.
		await waitForRequestToFinish( admin.page, '/wp-json/sowb/v1/widgets/forms', 20000 );
	}

	const widget = admin.editor.canvas.locator( `.wp-block[data-type="${ blockName }"]` );

	if ( isWb ) {
		// Wait for the form to be ready.
		const blockLoader = widget.locator( '.so-widgets-spinner-container' );
		await expect( blockLoader ).toBeHidden( { timeout: 15000 } );
	}

	await admin.editor.selectBlocks( widget );

	await ensureElementVisible( widget, offset );

	// Ensure the block is active, and setup.
	await widget.click();
	await widget.hover();
	await expect( widget ).toHaveClass( /is-selected/ );
	await expect( widget ).toHaveClass( /is-hovered/ );

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

	await ensureElementVisible( widget, offset );

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

/**
 * Ensures the specified locator is visible by checking its visibility and scrolling to it if necessary.
 *
 * This function first checks if the element is visible. If not, it calculates the position of the element
 * relative to the viewport, scrolls the page to bring the element into view, and verifies its visibility.
 * Useful for handling cases where sticky headers or other UI elements obstruct the view.
 *
 * @async
 * @param {import('@playwright/test').Locator} locator - The Playwright locator for the element to ensure visibility.
 * @param {number} offset - The vertical offset to apply when scrolling (default is 100px).
 * @param {number} timeout - The timeout for the visibility check (default is 5000ms).
 *
 * @returns {Promise<void>} Resolves when the element is visible.
 */
const ensureElementVisible = async ( locator, offset, timeout = 5000 ) => {
	// Check if the element is already visible.
	const isVisible = await locator.isVisible();
	if ( isVisible ) {
		return;
	}

	// Scroll to the element with the specified offset.
	await locator.evaluate( ( element, offset ) => {
		const rect = element.getBoundingClientRect();
		window.scrollBy( 0, rect.top - offset );
	}, offset );

	await expect( locator ).toBeVisible( { timeout } );
};

/**
 * Calculates the vertical offset of a DOM element relative to the viewport.
 *
 * This function determines the vertical offset of a specified DOM element
 * and adds predefined toolbar sizes to account for the block editor's UI.
 * The calculated offset is doubled to ensure proper positioning during
 * automated tests.
 *
 * @param {import('@playwright/test').Page} page - The Playwright page object.
 * @param {string} selector - The CSS selector for the element to measure.
 * @param {boolean} [canvas=true] - Whether the calculation is for the editor canvas.
 *
 * @returns {Promise<number>} The calculated offset in pixels, doubled.
 */
const calculateOffset = async ( page, selector, canvas = true ) => {
	const element = page.locator( selector );
	const blockEditorBlockToolbarSize = 48;
	const blockEditorHeaderToolbarSize = 60;
	const blockEditorOffset = blockEditorBlockToolbarSize + blockEditorHeaderToolbarSize;

	if ( element ) {
		const rect = await element.boundingBox();
		return ( rect.height + rect.y ) * 2 + blockEditorOffset;
	}

	return blockEditorOffset;
};

/**
 * Disables the block settings menu in the WordPress editor.
 *
 * This function hides the block settings menu by injecting a style tag into the page.
 * The settings menu can sometimes accidentally be triggered during automated tests,
 * so this ensures it remains hidden to prevent interference.
 *
 * @async
 * @param {import('@playwright/test').Page} page - The Playwright page object.
 *
 * @returns {Promise<void>} Resolves when the style tag is added.
 */
const disableBlockSettingsMenu = async ( page ) => {
	await page.addStyleTag( {
		content: `
			.components-popover__content .block-editor-block-settings-menu {
				display: none !important;
			}
		`,
	} );
};

module.exports = {
	addBlock,
	calculateOffset,
	doLogin,
	ensureElementVisible,
	handleDialog,
	openSiteEditorCanvas,
	neutralizeSiteEditorStickyHeader,
	setupAdminE2E,
	setupRequestUtils,
	soGoTo,
	waitForRequestToFinish,
};
