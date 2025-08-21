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

let envPath;

// Load environment variables.
if ( process.env.SO_TESTS_ENV_PATH ) {
	envPath = process.env.SO_TESTS_ENV_PATH;
} else {
	envPath = path.resolve( process.cwd(), 'tests', 'so-tests.env' );
}
const envDir = path.dirname( envPath );
dotenv.config( { path: envPath } );

const config = defineConfig( {
	testDir: './tests/e2e',
	testResultsDir: path.join( envDir, 'results', 'report' ),
	fullyParallel: true,
	forbidOnly: !! process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: [
		[ 'list' ],
		[ 'html', { outputFolder: path.join( envDir, 'results', 'report' ) } ],
	],
	globalSetup: require.resolve( './globalSetup.js' ),
	timeout: 60_000, // 60 seconds.
	use: {
		// Playwright.
		baseURL: process.env.WP_BASE_URL,
		ignoreHTTPSErrors: true,
		headless: true,
		actionTimeout: 10_000, // 10 seconds.
		outputDir: path.join( envDir, 'results', 'report' ),

		// Logging.
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		video: 'on-first-retry',

		// WP Testing.
		storageState: path.join( envDir, 'cache', 'storageState.json' ),

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
