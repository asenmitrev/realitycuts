export async function convertToBlobUrl(url: string) {
  try {
    // Fetch the data from the URL
    const response = await fetch(url);

    // Ensure the request was successful
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Get the content type from the response
    const contentType =
      response.headers.get('content-type') === 'application/octet-stream'
        ? 'video/mp4'
        : response.headers.get('content-type');
    // Get the data as a Blob with the correct content type
    const data = await response.blob();
    const blob = new Blob([data], { type: contentType ?? undefined });

    // Create a Blob URL from the Blob
    const blobUrl = URL.createObjectURL(blob);

    // Return the Blob URL
    return blobUrl;
  } catch (error) {
    console.error('Error occurred while converting to Blob URL:', error);
    throw error;
  }
}
