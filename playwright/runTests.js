/**
 * Runs Playwright end-to-end tests.
 *
 * - Adds system32 to PATH for Windows compatibility if missing.
 * - Switches to the highest installed Node version using nvm.
 * - Runs Playwright tests via npm script.
 * - Restores the Node version to 10.18.1 after tests.
 *
 * @module runTests
 */
const execAsync = require( '../utilities/execAsync' );




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
