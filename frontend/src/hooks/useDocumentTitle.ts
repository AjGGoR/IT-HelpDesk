import { useEffect } from 'react';

// Sets document.title per page/route so screen reader users (and the
// browser tab) get a distinct, meaningful title instead of a static one
// that never changes across client-side navigation.
const SUFFIX = ' — HelpDesk';

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = `${title}${SUFFIX}`;
  }, [title]);
}
