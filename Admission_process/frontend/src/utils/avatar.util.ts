import API from '../services/api';

/**
 * Resolves an avatar URL to a complete, accessible URL.
 * Handles:
 *  - Fully qualified URLs (https://..., http://...)
 *  - Data URIs (data:image/...)
 *  - Backend relative paths (/uploads/avatars/...)
 *  - Empty / null / undefined values
 */
export const getAvatarUrl = (url?: string | null): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const base = API.defaults.baseURL || '/api';
  const host = base.replace(/\/api\/?$/, '');
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${host}${cleanPath}`;
};

/**
 * Extracts initials from a name (e.g. "Aditya Kulkarni" -> "AK", "HOD CSE" -> "HC").
 */
export const getInitials = (name?: string | null, fallback = 'U'): string => {
  if (!name || !name.trim()) return fallback;
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};
