/**
 * Runs Playwright end-to-end tests.
 *
 * - Adds system32 to PATH for Windows compatibility if missing.
 * - Sets up the test environment if no config file is present by
 *   creating a build if necessary, and starting the WordPress Playground environment.
 * - Runs Playwright tests via the npm script `test:e2e`.
 * - Exits with an error code if any step fails.
 */
const path = require( 'path' );
const fs = require( 'fs' );

const execAsync = require( '../utilities/execAsync' );
const startPlayground = require( '../playground/startPlayground' );
const { maybeMakeBuild } = require( '../utilities/builds' );

const runTests = async () => {
	const isWindows = process.platform === 'win32';

	// Ensure system32 is in PATH for Windows compatibility.
	if ( isWindows && ! process.env.PATH.includes( 'C:\\WINDOWS\\system32' ) ) {
		process.env.PATH = `${ process.env.PATH };C:\\WINDOWS\\system32`;
	}

	// Set up a test environment if a config file isn't present.
	const envPath = path.resolve( process.cwd(), 'tests', 'so-tests.env' );
	if ( ! fs.existsSync( envPath ) ) {
		const buildSuccessful = await maybeMakeBuild()
		await startPlayground( buildSuccessful );
	}

	await execAsync(
		'npx',
		['npm', 'run', 'test:e2e'],
		{
			shell: isWindows ? 'cmd.exe' : '/bin/sh',
		}
	);
};

runTests().catch( ( error ) => {
	console.error( 'Error running tests:', error.message );
	process.exit( 1 );
} );
