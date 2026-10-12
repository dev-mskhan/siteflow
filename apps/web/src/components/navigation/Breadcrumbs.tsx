import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav className="flex items-center space-x-1.5 text-xs text-text-muted" aria-label="Breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <div key={index} className="flex items-center">
            {index > 0 && <span className="mx-1.5 text-text-dim">/</span>}
            {item.href && !isLast ? (
              <Link to={item.href} className="hover:text-text transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'text-text font-medium' : undefined}>{item.label}</span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
