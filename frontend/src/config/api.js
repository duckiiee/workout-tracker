const LOCAL_API = 'http://localhost:5000/api';
const PRODUCTION_API = 'https://workout-tracker-mzcz.onrender.com/api';

/** Base URL cho mọi request API (kết thúc bằng /api). */
export const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? PRODUCTION_API : LOCAL_API);
