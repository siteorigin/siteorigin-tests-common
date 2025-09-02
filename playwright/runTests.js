/**
 * Runs Playwright end-to-end tests.
 *
 * - Loads environment variables from so-tests.env.
 * - Ensures required environment variables are present.
 * - Switches to the highest installed Node version using nvm.
 * - Runs Playwright tests via npm script.
 * - Restores the Node version to 10.18.1 after tests.
 *
 * @module runTests
 */

const path = require( 'path' );
const dotenv = require( 'dotenv' );

const execAsync = require( '../utilities/execAsync' );




const {
	getCurrentNodeVersion,
	maybeSwitchToHighestNodeVersion,
} = require( '../utilities/node' );

const runTests = async () => {
	const envPath = path.resolve( process.cwd(), 'tests', 'so-tests.env' );
	dotenv.config( { path: envPath } );

	const isWindows = process.platform === 'win32';

	// Ensure system32 is in PATH for Windows compatibility.
	if ( isWindows && ! process.env.PATH.includes( 'C:\\WINDOWS\\system32' ) ) {
		process.env.PATH = `${ process.env.PATH };C:\\WINDOWS\\system32`;
	}

	// Ensure required environment variables are present.
	if (
		! process.env.WP_BASE_URL ||
		! process.env.WP_USERNAME ||
		! process.env.WP_PASSWORD
	) {
		throw new Error( 'Missing required environment variables in so-tests.env' );
	}

	const initialNodeVersion = await getCurrentNodeVersion();
	await maybeSwitchToHighestNodeVersion();


	await execAsync(
		'npx',
		['npm', 'run', 'test:e2e'],
		{
			shell: isWindows ? 'cmd.exe' : '/bin/sh',
		}
	);

	await maybeRevertNodeVersionChange( initialNodeVersion );
};

runTests().catch( ( error ) => {
	console.error( 'Error running tests:', error.message );
	process.exit( 1 );
} );
