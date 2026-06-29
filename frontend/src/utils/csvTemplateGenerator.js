/**
 * Triggers a file download from a blob response.
 * @param {any} data - raw response from axiosInstance (already unwrapped)
 * @param {string} filename
 */
export const downloadBlob = (data, filename) => {
  // axiosInstance interceptor returns response.data directly
  // For blob responses, we need to handle both cases
  const blob = data instanceof Blob
    ? data
    : new Blob([data], { type: 'text/csv' });

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};