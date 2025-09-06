const fs = require( 'fs' );
const path = require( 'path' );

const { parseOptionsAndRunCLI } = require( '@wp-playground/cli' );
const { getBuildDirectory } = require( '../utilities/builds' );

/**
 * Generates CLI arguments to mount the current directory, or build directory.
 *
 * @param {boolean} mountBuild Whether to include build arguments.
 *
 * @return {string[]} CLI arguments for mounting the relevant directory.
 */
const addMountDirectory = ( mountBuild ) => {
	let mountDir;
	let vfs = '/wordpress/wp-content/plugins/';

	if ( mountBuild ) {
		const buildDirectory = getBuildDirectory();
		mountDir = buildDirectory.path.replace( /\\/g, '/' );
		vfs += buildDirectory.name;
	} else {
		const currentDirectory = process.cwd();
		mountDir = currentDirectory.replace( /\\/g, '/' );
		vfs += path.basename( currentDirectory );
	}

	return [ '--mountDirBeforeInstall', mountDir, vfs ];
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
	if ( ! shouldRunPlayground() ) {
		return false;
	}

	const cliArgs = [
		'server',
		`--blueprint=${ getBlueprintPath( blueprint ) }`,
		'--port',
		port,
		...addMountDirectory( mountBuild )
	];

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
