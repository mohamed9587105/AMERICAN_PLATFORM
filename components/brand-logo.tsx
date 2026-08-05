import Link from 'next/link';

type BrandLogoProps = {
  compact?: boolean;
  light?: boolean;
  className?: string;
  href?: string;
};

export default function BrandLogo({ compact = false, light = false, className = '', href = '/' }: BrandLogoProps) {
  const content = (
    <span className={`mastery-brand ${compact ? 'mastery-brand-compact' : ''} ${light ? 'mastery-brand-light' : ''} ${className}`.trim()} aria-label="Mastery">
      <svg className="mastery-mark" viewBox="0 0 120 88" role="img" aria-hidden="true">
        <defs>
          <linearGradient id="masteryGradient" x1="8" y1="78" x2="112" y2="8" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#0A3DFF" />
            <stop offset="1" stopColor="#00C2FF" />
          </linearGradient>
        </defs>
        <circle cx="16" cy="72" r="10" fill="url(#masteryGradient)" />
        <path d="M16 68V29C16 20 26 15 33 21L58 44L99 8L72 53C68 60 59 62 53 56L34 38V68" fill="none" stroke="url(#masteryGradient)" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M100 8L91 31L112 18Z" fill="#00C2FF" />
      </svg>
      {!compact && (
        <span className="mastery-wording">
          <strong>MASTERY</strong>
          <small>MASTER YOUR FUTURE</small>
        </span>
      )}
    </span>
  );
  return href ? <Link href={href} className="mastery-brand-link">{content}</Link> : content;
}
