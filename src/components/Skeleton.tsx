'use client'
import styles from './Skeleton.module.css'

interface SkeletonProps {
  width?: string | number
  height?: string | number
  borderRadius?: string | number
  className?: string
}

export function Skeleton({ width, height, borderRadius, className = '' }: SkeletonProps) {
  return (
    <div
      className={`${styles.skeleton} ${className}`}
      style={{
        width: width ?? '100%',
        height: height ?? '16px',
        borderRadius: borderRadius ?? '8px',
      }}
    />
  )
}

export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={styles.statsGrid}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles.statsCard}>
          <Skeleton width="40px" height="40px" borderRadius="10px" />
          <Skeleton width="60%" height="14px" />
          <Skeleton width="80%" height="22px" />
        </div>
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className={styles.tableWrap}>
      <div className={styles.tableHeaderRow}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} height="14px" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={styles.tableRow}>
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} height="12px" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function CardsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className={styles.cardsGrid}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles.card}>
          <Skeleton height="180px" borderRadius="10px" />
          <Skeleton width="70%" height="14px" />
          <Skeleton width="40%" height="16px" />
        </div>
      ))}
    </div>
  )
}

export function PageSkeleton({ variant = 'table' }: { variant?: 'table' | 'stats' | 'cards' }) {
  if (variant === 'stats') return <StatsSkeleton />
  if (variant === 'cards') return <CardsSkeleton />
  return <TableSkeleton />
}
