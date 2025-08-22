/**
 * Global setup for Playwright end-to-end tests.
 *
 * Ensures required directories and files exist, and resets the test environment.
 */

const { setupRequestUtils } = require('./common.js');
const fs = require('fs');
const path = require('path');

/**
 * Ensures required storage and results directories exist for Playwright tests.
 *
 * @returns {Promise<void>} Resolves when all required directories and files are ensured.
 */
const setupEnvironment = async () => {
	const storageStatePath = path.resolve( process.cwd(), 'tests/cache', 'storageState.json' );
	fs.mkdirSync( path.dirname( storageStatePath ), { recursive: true } );
	if ( ! fs.existsSync( storageStatePath ) ) {
		fs.writeFileSync( storageStatePath, '{"cookies":[],"origins":[]}' );
	}

	// Create results directory, and screenshots and reports subdirectories.
	const resultsDir = path.resolve( process.cwd(), 'tests/results' );
	if ( ! fs.existsSync( resultsDir ) ) {
		fs.mkdirSync( resultsDir, { recursive: true } );
	}
	const screenshotsDir = path.resolve( resultsDir, 'tests/screenshots' );
	if ( ! fs.existsSync( screenshotsDir ) ) {
		fs.mkdirSync( screenshotsDir, { recursive: true } );
	}
	const reportsDir = path.resolve( resultsDir, 'tests/reportst' );
	if ( ! fs.existsSync( reportsDir ) ) {
		fs.mkdirSync( reportsDir, { recursive: true } );
	}
	console.log( `Ensured results directory structure at ${ resultsDir }` );
};

/**
 * Confirms that the WP_BASE_URL environment variable is set and reachable.
 *
 * Throws an error if WP_BASE_URL is not set or not reachable.
 *
 * @returns {Promise<void>} Resolves if the base URL is reachable.
 * @throws {Error} If WP_BASE_URL is not set or not reachable.
 */
const confirmBaseUrlActive = async () => {
	if ( ! process.env.WP_BASE_URL ) {
		throw new Error( 'WP_BASE_URL environment variable is not set.' );
	}

	try {
		const url = process.env.WP_BASE_URL;
		const isHttps = url.startsWith( 'https://' );
		const fetchOptions = {};

		if ( isHttps ) {
			// Bypass SSL verification for HTTPS URLs.
			process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
		}

		const response = await fetch( url, fetchOptions );
		if ( ! response.ok ) {
			throw new Error( `Failed to reach the base URL: ${ response.statusText }` );
		}
	} catch ( error ) {
		console.error( 'Fetch error details:', error );
		throw new Error( `Error reaching the base URL: ${ error.message }` );
	}
};

/**
 * Prepares the WordPress test environment by resetting content and creating test users.
 *
 * @param {object} requestUtils Utilities for making requests to the WP test environment.
 * @returns {Promise<void>} Resolves when the environment is prepared.
 */
const wpPrep = async ( requestUtils ) => {
	await Promise.all( [
		requestUtils.deleteAllPosts(),
		requestUtils.deleteAllBlocks(),
		requestUtils.resetPreferences(),
		await requestUtils.deleteAllUsers(),

		// Setup test users.
		requestUtils.createUser( {
			username: 'editor',
			password: process.env.WP_PASSWORD,
			role: 'editor',
			email: 'test+editor@siteorigin.com',
		} ),

		requestUtils.createUser( {
			username: 'subscriber',
			password: process.env.WP_PASSWORD,
			role: 'subscriber',
			email: 'test+subscriber@siteorigin.com',
		} ),

		requestUtils.createUser( {
			username: 'author',
			password: process.env.WP_PASSWORD,
			role: 'author',
			email: 'test+author@siteorigin.com',
		} ),
	] );
};

/**
 * Playwright global setup function.
 *
 * Called once before all tests are run to ensure the environment is set up correctly.
 *
 * @param {import('@playwright/test').FullConfig} config Playwright config object.
 * @returns {Promise<void>} Resolves when setup is complete.
 */
const globalSetup = async ( config ) => {
	await setupEnvironment();
	await confirmBaseUrlActive();

	const requestUtils = await setupRequestUtils( config );

	if ( process.env.clear_env ?? false ) {
		await wpPrep( requestUtils );
	}

	await requestUtils.request.dispose();
};

module.exports = globalSetup;
