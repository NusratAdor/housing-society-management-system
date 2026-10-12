// Cross-browser file download from a Blob.
//  - Older iOS Safari ignores the `download` attribute, so it opens in a new tab.
//  - The object URL is released late: releasing it immediately breaks the
//    download in Safari and Firefox.
export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  if (!("download" in anchor)) {
    window.open(url, "_blank", "noopener");
  } else {
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }

  setTimeout(() => URL.revokeObjectURL(url), 30_000);
};

export const filenameFromResponse = (response, fallback) =>
  response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] || fallback;