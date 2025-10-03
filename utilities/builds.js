const path = require( 'path' );
const fs = require( 'fs' );
const execAsync = require( './execAsync' );

/**
 * Retrieves the build version from the command-line arguments.
 *
 * @return {string|null} The build version if provided, otherwise `null`.
 */
const getBuildVersion = () => {
	const args = process.argv.slice( 1 );
	let version = null;

	args.forEach( ( arg ) => {
		const [ key, value ] = arg.split( '=' );
		if ( key === 'v' ) {
			version = value;
		}
	} );

	// If no version was set, default to '2.0.0'. This will ensure compatibility
	// with all existing version checks.
	if ( ! version ) {
		version = '2.0.0';
	}

	return version;
};

/**
 * Runs the build process using gulp.
 *
 * @param {string} buildDir - The absolute path to the build directory.
 * @param {string} version - The build version to pass to the gulp command as an argument.
 *
 * @throws {Error} Throws an error if the build process fails.
 * @return {Promise<void>} Resolves when the build process completes successfully.
 */
const makeBuild = async ( buildDir, version ) => {
	await execAsync(
		'npm',
		[
			'run',
			'build:release',
		],
		{
			cwd: buildDir,
			env: { ...process.env,
				SKIP_I18N: '1',
				RELEASE_VERSION: version,
			},
		}
	);
};

/**
 * Checks if it's possible to make a build, and then makes one if it can.
 *
 * @param {boolean} isWindows - Indicates if the script is running on Windows.
 * @async
 *
 * @return {Promise<boolean>} Resolves to `true` if the build was successful, `false` otherwise.
 */
const maybeMakeBuild = async () => {
	const buildDir = path.resolve( process.cwd(), 'build' );

	// Detect if running in GitHub Actions. The build process is handled
	// separately in this environment, so we can assume it's successful.
	if ( process.env.GITHUB_ACTIONS === 'true' ) {
		return true;
	}

	// Check if the build direlctory exists.
	if ( ! fs.existsSync( buildDir ) ) {
		return false;
	}

	// Retrieve the build version from the command-line arguments.
	const version = getBuildVersion();
	if ( ! version ) {
		return false;
	}

	try {
		await makeBuild( buildDir, version );
		return true;
	} catch ( error ) {
		// Handle errors during the build process.
		console.error( 'Build process encountered an error:', error.message );
		return false;
	}
};

/**
 * Retrieves the build directory and the name of the build folder in the `dist` directory.
 *
 * This function assumes that the `dist` directory contains exactly one build folder.
 * It dynamically resolves the path to that folder and returns both the absolute path
 * and the folder name as an object.
 *
 * @throws {Error} Throws an error if no directories are found in the `dist` folder.
 *
 * @return {Object} An object containing:
 *   - `path` {string}: The absolute path to the first folder in the `dist` directory.
 *   - `name` {string}: The name of the first folder in the `dist` directory.
 */
const getBuildDirectory = () => {
	const distDir = path.resolve( process.cwd(), 'dist' );
	const folders = fs.readdirSync( distDir, { withFileTypes: true } )
		.filter( ( dirent ) => dirent.isDirectory() )
		.map( ( dirent ) => dirent.name );

	if ( folders.length === 0 ) {
		throw new Error( 'No build directory found in the dist folder.' );
	}

	return {
		path: path.join( distDir, folders[ 0 ] ),
		name: folders[ 0 ],
	};
};

module.exports = {
	maybeMakeBuild,
	getBuildDirectory,
};
