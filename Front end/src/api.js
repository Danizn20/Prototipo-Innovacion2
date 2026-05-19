export async function apiJson(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'No fue posible completar la solicitud');
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function downloadFile(path, filename) {
  const response = await fetch(path);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'No fue posible descargar el archivo');
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

export async function uploadFormData(path, formData) {
  const response = await fetch(path, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'No fue posible subir el archivo');
  }

  return response.json();
}