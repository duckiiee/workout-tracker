const LOCAL_API = 'http://localhost:5000/api';
const PRODUCTION_API = 'https://workout-tracker-mzcz.onrender.com/api';

/** Base URL cho mọi request API (kết thúc bằng /api). */
// Nếu đang chạy trên máy cá nhân -> dùng LOCAL_API
// Nếu đang chạy trên Vercel (Production) -> tự động dùng PRODUCTION_API
export const API_BASE = import.meta.env.PROD ? PRODUCTION_API : LOCAL_API;