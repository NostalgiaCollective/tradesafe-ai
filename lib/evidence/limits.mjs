// Raw input is never stored: normalization must still meet the existing private
// storage/database limit. Keep this browser-safe module free of server imports.
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_NORMALIZED_IMAGE_BYTES = 3 * 1024 * 1024
