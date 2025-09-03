/**
 * Runs Playwright end-to-end tests.
 *
 * - Adds system32 to PATH for Windows compatibility if missing.
 * - Switches to the highest installed Node version using nvm.
 * - Builds the project if necessary.
 * - Starts the WordPress Playground environment.
 * - Runs Playwright tests via the npm script `test:e2e`.
 * - Restores the Node version to its initial state after tests.
 * - Exits with an error code if any step fails.
 */
const execAsync = require( '../utilities/execAsync' );
const startPlayground = require( '../playground/startPlayground' );

const {
	maybeMakeBuild
} = require( '../utilities/builds' );

const {
	getCurrentNodeVersion,
	maybeSwitchToHighestNodeVersion,
} = require( '../utilities/node' );

const runTests = async () => {
	const isWindows = process.platform === 'win32';

	// Ensure system32 is in PATH for Windows compatibility.
	if ( isWindows && ! process.env.PATH.includes( 'C:\\WINDOWS\\system32' ) ) {
		process.env.PATH = `${ process.env.PATH };C:\\WINDOWS\\system32`;
	}

	const initialNodeVersion = await getCurrentNodeVersion();
	const buildSuccessful = await maybeMakeBuild();
	await maybeSwitchToHighestNodeVersion();
	await startPlayground( buildSuccessful );

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
