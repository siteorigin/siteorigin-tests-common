const fs = require( 'fs' );
const path = require( 'path' );

const { parseOptionsAndRunCLI } = require( '@wp-playground/cli' );
const { getBuildDirectory } = require( '../utilities/builds' );
const { describeMount } = require( './pluginMount' );

/**
 * Generates CLI arguments to mount the current directory, or build directory.
 *
 * The plugin mounts at its own slug, not the directory name, so a git
 * worktree replaces the plugin the blueprint would otherwise install.
 *
 * @param {boolean} mountBuild Whether to include build arguments.
 *
 * @return {Object} `{ args, expected }`: CLI arguments for mounting the
 *                  relevant directory, and the plugin WordPress should report.
 */
const addMountDirectory = ( mountBuild ) => {
	const directory = mountBuild ? getBuildDirectory().path : process.cwd();
	const mountDir = directory.replace( /\\/g, '/' );
	const { vfsPath, expected } = describeMount( directory );

	return {
		args: [ '--mountDirBeforeInstall', mountDir, vfsPath ],
		expected,
	};
};

/**
 * Resolves the absolute path to a blueprint JSON file.
 *
 * Validates the blueprint name to ensure it only contains alphanumeric
 * characters, hyphens, and underscores, preventing directory traversal attacks.
 *
 * @param {string} blueprint The name of the blueprint file (without extension).
 * @throws {Error} If the blueprint name contains invalid characters.
 *
 * @return {string} The absolute path to the blueprint JSON file.
 */
const getBlueprintPath = ( blueprint ) => {
	if ( ! /^[a-zA-Z0-9_-]+$/.test( blueprint ) ) {
		throw new Error(
			`Invalid blueprint name: "${ blueprint }". Only alphanumeric, hyphen, and underscore are allowed.`
		);
	}

	const blueprintDir = path.resolve( __dirname, 'blueprints' );
	return path.join( blueprintDir, `${ blueprint }.json` );
};

/**
 * Determines whether the playground should start based on `so-tests.env`
 * file existence.
 *
 *
 * @return {boolean} True if the configuration file exists, false otherwise.
 */
const shouldRunPlayground = () => {
	const config = path.resolve( process.cwd(), 'tests', 'so-tests.env' );
	return ! fs.existsSync( config );
};

/**
 * Starts the WordPress Playground server.
 *
 * This function initializes and starts a WordPress Playground instance
 * using the specified blueprint and optional build arguments. It
 * dynamically constructs CLI arguments to configure the server and
 * ensures the process is properly cleaned up after execution.
 *
 * The function removes any 'v=' arguments from process.argv to prevent
 * a potential collision with the Playwright CLI.
 *
 * @async
 * @param {boolean} [mountBuild=false] Whether to include build arguments
 *                                     for mounting the build directory.
 * @param {number} [port=1129] The port number on which the Playground
 *                             server will run.
 * @param {string} [blueprint='core'] The name of the blueprint to use
 *                                   (without the `.json` extension).
 *
 * @throws {Error} If the blueprint name is invalid or the server fails to start.
 * @return {Promise<void>} Resolves when the server starts successfully.
 */
const startPlayground = async (
	mountBuild = false,
	port = 1129,
	blueprint = 'core'
) => {
	// Global setup checks the plugin recorded here, so clear any earlier one.
	delete process.env.SO_TESTS_MOUNTED_PLUGIN;

	if ( ! shouldRunPlayground() ) {
		return false;
	}

	const mount = addMountDirectory( mountBuild );
	const cliArgs = [
		'server',
		`--blueprint=${ getBlueprintPath( blueprint ) }`,
		'--port',
		port,
		...mount.args
	];

	process.env.SO_TESTS_MOUNTED_PLUGIN = JSON.stringify( mount.expected );

	const originalArgvLength = process.argv.length;

	// Prevent an argument collision with the Playwright CLI by
	// removing the version argument if it exists.
	process.argv = process.argv.filter( arg => ! arg.startsWith( 'v=' ) );

	process.argv.push( ...cliArgs );

	try {
		await parseOptionsAndRunCLI();
	} finally {
		process.argv.splice( originalArgvLength );
	}
};

module.exports = startPlayground;
