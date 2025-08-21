const path = require( 'path' );

/**
 * Gets the media library modal element.
 *
 * Opens the media modal and optionally switches to the upload tab.
 *
 * @async
 * @param {Admin} admin - The Site Editor admin instance.
 * @param {string} [view='media'] - The view to open ('media' or 'upload').
 * @returns {Promise<Locator>} The Playwright locator for the media modal.
 */
const getMediaLibraryModal = async( admin, view = 'media' ) => {
	const mediaModal = admin.page.locator( '.media-modal' );
	await expect( mediaModal ).toBeVisible();

	if ( view === 'upload' ) {
		const uploadTab = mediaModal.locator( '#menu-item-upload' );
		await expect( uploadTab ).toBeVisible();
		await uploadTab.click();

		const uploaderUi = mediaModal.locator( '.upload-ui' );
		await expect( uploaderUi ).toBeVisible();
	}

	return mediaModal;
};

/**
 * Uploads an image to the WordPress media library via the media modal.
 *
 * This function opens the media library modal in upload mode, uploads a test image,
 * waits for the image thumbnail to appear, and then inserts the uploaded image.
 *
 * @async
 * @param {Admin} admin - The initialized Admin instance.
 * @returns {Promise<void>} Resolves when the image is uploaded and inserted.
 */
const uploadImageToMediaLibrary = async ( admin ) => {
	const mediaModal = await getMediaLibraryModal( admin, 'upload' );

	// Upload an image to the media library.
	const fileInput = mediaModal.locator( 'input[type="file"]' );
	const testImagePath = path.resolve(__dirname, 'assets/test-image.png');
	await fileInput.setInputFiles( testImagePath );

	// Wait for the upload to finish by detecting the uploaded image in the media library grid.
	const uploadedImage = mediaModal.locator( '.attachments .attachment' ).first();

	// Wait for the image thumbnail to appear inside the uploaded attachment.
	const uploadedImageThumb = uploadedImage.locator( 'img' );
	await expect( uploadedImageThumb ).toBeVisible( { timeout: 15000 } );

	// Insert the uploaded image.
	const insertionButton = mediaModal.locator( '.media-toolbar-primary .media-button-select' );
	await expect( insertionButton ).toBeVisible();
	await expect( insertionButton ).toBeEnabled();
	await insertionButton.click( { force: true } );
};

module.exports = {
	getMediaLibraryModal,
	uploadImageToMediaLibrary
};
