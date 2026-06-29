import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

axiosInstance.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.message ||
      error.message ||
      'Something went wrong';

    if (
      error.response?.status === 401 &&
      !error.config?.url?.includes('/auth/me') &&
      !error.config?.url?.includes('/auth/superadmin/login')
    ) {
      window.dispatchEvent(new Event('auth:logout'));
    }

    return Promise.reject(new Error(message));
  }
);

export default axiosInstance;