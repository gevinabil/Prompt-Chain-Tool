export function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export function getOptionalString(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value ? value : null;
}

export function getNumber(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value ? Number(value) : null;
}

export function getFileList(formData: FormData, key: string) {
  return formData.getAll(key).filter((item): item is File => item instanceof File && item.size > 0);
}
