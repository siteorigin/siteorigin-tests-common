/**
 * Playwright configuration for end-to-end tests.
 *
 * Loads environment variables from so-tests.env (path can be set
 * via SO_TESTS_ENV_PATH). Exports a Playwright config object for
 * use in other repositories.
 *
 * @see https://playwright.dev/docs/test-configuration
 */

const { defineConfig, devices } = require( '@playwright/test' );
const dotenv = require( 'dotenv' );
const path = require( 'path' );
const fs = require( 'fs' );

let envPath = path.resolve( process.cwd(), 'tests', 'so-tests.env' );

// Check if a config file present.
if ( fs.existsSync( envPath ) ) {
	dotenv.config( { path: envPath } );
} else {
	envPath = path.dirname(require.main.filename);
}

// Set default values for any missing environment variables.
process.env.WP_BASE_URL = process.env.WP_BASE_URL || 'http://127.0.0.1:1129';
process.env.WP_USERNAME = process.env.WP_USERNAME || 'admin';
process.env.WP_PASSWORD = process.env.WP_PASSWORD || 'password';
const envDir = path.dirname( envPath );

const config = defineConfig( {
	testDir: './tests/e2e',
	outputDir: './tests/results/reports',
	testResultsDir: './tests/results/reports',
	fullyParallel: true,
	forbidOnly: !! process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: [
		[ 'list' ],
		[ 'html', {
			outputFolder: './results/report'
		} ],
	],
	globalSetup: require.resolve( './globalSetup.js' ),
	timeout: 60_000, // 60 seconds.
	use: {
		// Playwright.
		baseURL: process.env.WP_BASE_URL,
		ignoreHTTPSErrors: true,
		headless: true,
		actionTimeout: 10_000, // 10 seconds.

		// Logging.
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		video: 'on-first-retry',

		// WP Testing.
		storageState: './tests/cache/storageState.json',

		// Browser.
		viewport: {
			width: 960,
			height: 700,
		},
		contextOptions: {
			reducedMotion: 'reduce',
			strictSelectors: true,
		},
	},

	projects: [
		{
			name: 'Google Chrome',
			use: {
				...devices[ 'Desktop Chrome' ],
				channel: 'chrome',
			},
		},
	],
} );

module.exports = config;
