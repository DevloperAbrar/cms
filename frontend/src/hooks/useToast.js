import toast from 'react-hot-toast';

export const useToast = () => ({
  success: (msg) => toast.success(msg),
  error: (msg) => toast.error(msg),
  loading: (msg) => toast.loading(msg),
  dismiss: toast.dismiss,
  promise: (p, msgs) => toast.promise(p, msgs),
});