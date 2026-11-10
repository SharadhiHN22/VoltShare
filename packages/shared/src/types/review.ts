// ── Review Types ─────────────────────────────────────

export interface Review {
  id: string;
  bookingId: string;
  reviewerId: string;
  revieweeId?: string;
  chargerId: string;
  rating: number; // 1-5
  comment?: string;
  createdAt: Date;
}

export interface CreateReviewInput {
  bookingId: string;
  chargerId?: string;
  rating: number;
  comment?: string;
}

export interface ReviewWithAuthor extends Review {
  reviewerName: string;
  reviewerAvatarUrl?: string;
}
