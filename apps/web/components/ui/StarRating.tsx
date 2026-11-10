import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  rating: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

export default function StarRating({
  rating,
  size = 'md',
  className,
}: StarRatingProps) {
  const stars = [];

  for (let i = 1; i <= 5; i++) {
    const filled = i <= Math.floor(rating);
    const half = !filled && i - 0.5 <= rating;

    stars.push(
      <Star
        key={i}
        className={cn(
          sizeMap[size],
          filled || half ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300',
        )}
      />,
    );
  }

  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {stars}
      <span className="ml-1 text-sm text-gray-600">{rating.toFixed(1)}</span>
    </div>
  );
}
