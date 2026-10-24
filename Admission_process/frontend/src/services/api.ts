import axios from 'axios';
import { store } from '../store/store';
import { startLoading, stopLoading } from '../store/uiSlice';
import { forceLogout } from '../utils/auth.utils';

const baseURL = import.meta.env.VITE_API_URL;

if (!baseURL) {
  throw new Error('VITE_API_URL is not configured');
}

console.log('API URL =', baseURL);

let startLoadingCallback: () => void = () => {};
let stopLoadingCallback: () => void = () => {};

export const registerLoadingCallbacks = (
  start: () => void,
  stop: () => void
) => {
  startLoadingCallback = start;
  stopLoadingCallback = stop;
};

const API = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
API.interceptors.request.use(
  (config) => {
    startLoadingCallback();

    if (store && typeof store.dispatch === 'function') {
      store.dispatch(startLoading());
    }

    const token = localStorage.getItem('token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    return config;
  },
  (error) => {
    stopLoadingCallback();

    if (store && typeof store.dispatch === 'function') {
      store.dispatch(stopLoading());
    }

    return Promise.reject(error);
  }
);

// Response interceptor
API.interceptors.response.use(
  (response) => {
    stopLoadingCallback();

    if (store && typeof store.dispatch === 'function') {
      store.dispatch(stopLoading());
    }

    return response;
  },

  async (error) => {
    stopLoadingCallback();

    if (store && typeof store.dispatch === 'function') {
      store.dispatch(stopLoading());
    }

    const originalRequest = error.config;

    if (
      error.response &&
      error.response.status === 401
    ) {
      // If session expired due to inactivity, force logout immediately with inactive reason
      if (error.response.data?.code === 'SESSION_INACTIVE') {
        forceLogout(true, 'inactive');
        return Promise.reject(error);
      }

      if (originalRequest && !originalRequest._retry) {
        // Don't refresh for login/register/status/activity
        if (
          originalRequest.url?.includes('/auth/login') ||
          originalRequest.url?.includes('/auth/register') ||
          originalRequest.url?.includes('/auth/status') ||
          originalRequest.url?.includes('/auth/activity')
        ) {
          return Promise.reject(error);
        }

        // Refresh endpoint itself failed
        if (originalRequest.url?.includes('/auth/refresh-token')) {
          forceLogout(true);
          return Promise.reject(error);
        }

        originalRequest._retry = true;

        try {
          const refreshResponse = await axios.post(
            `${baseURL}/auth/refresh-token`,
            {},
            {
              withCredentials: true,
            }
          );

          const { token, user } = refreshResponse.data.data;

          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(user));

          originalRequest.headers.Authorization = `Bearer ${token}`;

          return API(originalRequest);
        } catch (refreshError) {
          forceLogout(true);
          return Promise.reject(refreshError);
        }
      }
    }

    return Promise.reject(error);
  }
);

export default API;

/**
 * Returns the backend server base URL (without /api), used to build absolute
 * URLs for /uploads/ static file paths returned by the server.
 * e.g. https://example.com/api -> https://example.com
 */
export function getBaseHostURL(): string {
  return baseURL.replace(/\/api(\/v\d+)?$/, '').replace(/\/+$/, '');
}