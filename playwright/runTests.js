/**
 * Runs Playwright end-to-end tests.
 *
 * - Adds system32 to PATH for Windows compatibility if missing.
 * - Starts the WordPress Playground environment.
 * - Runs Playwright tests via the npm script `test:e2e`.
 * - Exits with an error code if any step fails.
 */
const execAsync = require( '../utilities/execAsync' );
const startPlayground = require( '../playground/startPlayground' );
const {
	maybeSwitchToHighestNodeVersion,
} = require( '../utilities/node' );

const runTests = async () => {
	const isWindows = process.platform === 'win32';

	// Ensure system32 is in PATH for Windows compatibility.
	if ( isWindows && ! process.env.PATH.includes( 'C:\\WINDOWS\\system32' ) ) {
		process.env.PATH = `${ process.env.PATH };C:\\WINDOWS\\system32`;
	}
	
	await maybeSwitchToHighestNodeVersion();

	await startPlayground();

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
