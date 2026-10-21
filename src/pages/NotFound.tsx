import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ink-100 text-ink-500">
        <Compass className="h-7 w-7" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink-900">Page not found</h1>
      <p className="mt-2 text-sm text-ink-600">
        The page you were looking for does not exist in this application.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Link to="/">
          <Button>Back to the dashboard</Button>
        </Link>
        <Link to="/records">
          <Button variant="outline">Open the employees</Button>
        </Link>
      </div>
    </div>
  );
}
