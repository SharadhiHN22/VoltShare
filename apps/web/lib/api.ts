import axios from 'axios';
import type {
  AuthResponse,
  CreateUserInput,
  LoginInput,
  User,
  Charger,
  ChargerSearchParams,
  ChargerSearchResult,
  CreateChargerInput,
  Booking,
  BookingWithDetails,
  CreateBookingInput,
  Payment,
  PaymentResponse,
  InitiatePaymentInput,
  ProcessCheckoutInput,
  EarningsSummary,
  Review,
  ReviewWithAuthor,
  CreateReviewInput,
  Vehicle,
  CreateVehicleInput,
  Notification,
  PlatformStats,
  ApiResponse,
  PaginatedResponse,
} from '@voltshare/shared';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach JWT
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('voltshare_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor — unwrap errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    let message = 'An unexpected error occurred';
    if (error.response?.data) {
      if (Array.isArray(error.response.data.details) && error.response.data.details.length > 0) {
        message = error.response.data.details.map((d: any) => d.message).join(', ');
      } else if (error.response.data.error) {
        message = error.response.data.error;
      } else if (error.response.data.message) {
        message = error.response.data.message;
      }
    } else if (error.message) {
      if (error.message.includes('Network Error') || error.code === 'ERR_NETWORK') {
        message = 'Cannot connect to backend server. Please verify the API is running on port 4000.';
      } else {
        message = error.message;
      }
    }
    const customErr: any = new Error(message);
    customErr.response = error.response;
    return Promise.reject(customErr);
  },
);

// ── Auth ──────────────────────────────────────────────
export const authApi = {
  register: (data: CreateUserInput) =>
    api.post<ApiResponse<AuthResponse>>('/auth/register', data).then((r) => r.data),

  login: (data: LoginInput) =>
    api.post<ApiResponse<AuthResponse>>('/auth/login', data).then((r) => r.data),

  getMe: () =>
    api.get<ApiResponse<User>>('/auth/me').then((r) => r.data),
};

// ── Chargers ──────────────────────────────────────────
export const chargersApi = {
  search: (params: ChargerSearchParams) =>
    api
      .get<PaginatedResponse<ChargerSearchResult>>('/chargers', { params })
      .then((r) => r.data),

  getById: (id: string) =>
    api.get<ApiResponse<Charger>>(`/chargers/${id}`).then((r) => r.data),

  create: (data: CreateChargerInput) =>
    api.post<ApiResponse<Charger>>('/chargers', data).then((r) => r.data),

  update: (id: string, data: Partial<CreateChargerInput>) =>
    api.put<ApiResponse<Charger>>(`/chargers/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    api.delete<ApiResponse<void>>(`/chargers/${id}`).then((r) => r.data),

  toggleStatus: (id: string) =>
    api.patch<ApiResponse<Charger>>(`/chargers/${id}/status`).then((r) => r.data),

  listMine: () =>
    api.get<ApiResponse<Charger[]>>('/chargers/mine').then((r) => r.data),
};

// ── Bookings ──────────────────────────────────────────
export const bookingsApi = {
  create: (data: CreateBookingInput) =>
    api.post<ApiResponse<Booking>>('/bookings', data).then((r) => r.data),

  list: (params?: { status?: string; page?: number }) =>
    api
      .get<PaginatedResponse<BookingWithDetails>>('/bookings', { params })
      .then((r) => r.data),

  getById: (id: string) =>
    api.get<ApiResponse<BookingWithDetails>>(`/bookings/${id}`).then((r) => r.data),

  updateStatus: (id: string, status: string) =>
    api.patch<ApiResponse<Booking>>(`/bookings/${id}/status`, { status }).then((r) => r.data),

  cancel: (id: string) =>
    api.patch<ApiResponse<Booking>>(`/bookings/${id}/cancel`).then((r) => r.data),

  checkIn: (id: string) =>
    api.post<ApiResponse<Booking>>(`/bookings/${id}/check-in`).then((r) => r.data),

  complete: (id: string) =>
    api.post<ApiResponse<Booking>>(`/bookings/${id}/complete`).then((r) => r.data),
};

// ── Payments ──────────────────────────────────────────
export const paymentsApi = {
  initiate: (data: InitiatePaymentInput) =>
    api.post<ApiResponse<PaymentResponse>>('/payments/initiate', data).then((r) => r.data),

  processCheckout: (data: ProcessCheckoutInput) =>
    api.post<ApiResponse<{ payment: any; booking: any }>>('/payments/process-checkout', data).then((r) => r.data),

  verify: (data: { paymentId: string; razorpayPaymentId?: string; razorpayOrderId?: string; razorpaySignature?: string }) =>
    api.post<ApiResponse<{ payment: any; booking: any }>>('/payments/verify', data).then((r) => r.data),

  history: (params?: { page?: number }) =>
    api
      .get<PaginatedResponse<Payment>>('/payments/history', { params })
      .then((r) => r.data),

  earnings: () =>
    api.get<ApiResponse<EarningsSummary>>('/payments/earnings').then((r) => r.data),
};

// ── Reviews ───────────────────────────────────────────
export const reviewsApi = {
  create: (data: CreateReviewInput) =>
    api.post<ApiResponse<Review>>('/reviews', data).then((r) => r.data),

  getByCharger: (chargerId: string, params?: { page?: number }) =>
    api
      .get<PaginatedResponse<ReviewWithAuthor>>(`/chargers/${chargerId}/reviews`, { params })
      .then((r) => r.data),

  getBookingReview: (bookingId: string) =>
    api
      .get<ApiResponse<{ canReview: boolean; hasReviewed: boolean; review: Review | null }>>(`/reviews/booking/${bookingId}`)
      .then((r) => r.data),
};

// ── Vehicles ──────────────────────────────────────────
export const vehiclesApi = {
  list: () =>
    api.get<ApiResponse<Vehicle[]>>('/vehicles').then((r) => r.data),

  create: (data: CreateVehicleInput) =>
    api.post<ApiResponse<Vehicle>>('/vehicles', data).then((r) => r.data),
};

// ── Notifications ─────────────────────────────────────
export const notificationsApi = {
  list: (params?: { limit?: number }) =>
    api
      .get<ApiResponse<Notification[]> & { unreadCount: number }>('/notifications', { params })
      .then((r) => r.data),

  unreadCount: () =>
    api
      .get<ApiResponse<{ unreadCount: number }>>('/notifications/unread-count')
      .then((r) => r.data),

  markAsRead: (id: string) =>
    api.patch<ApiResponse<Notification>>(`/notifications/${id}/read`).then((r) => r.data),

  markAllAsRead: () =>
    api.patch<ApiResponse<{ count: number }>>('/notifications/read-all').then((r) => r.data),
};

export const statsApi = {
  getPublicStats: () =>
    api.get<ApiResponse<PlatformStats>>('/stats').then((r) => r.data),
};

export const chargerApi = chargersApi;
export const bookingApi = bookingsApi;
export const paymentApi = paymentsApi;
export const reviewApi = reviewsApi;
export const vehicleApi = vehiclesApi;
export const notificationApi = notificationsApi;
export const statApi = statsApi;
export type { PlatformStats };

export default api;
