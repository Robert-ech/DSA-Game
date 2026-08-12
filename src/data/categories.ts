/**
 * The 15 problem categories, in NeetCode roadmap order. Castle N maps to
 * CATEGORIES[N - 1]. Theme colors and castle metadata arrive with
 * castles.json in Phase 3; this list is the canonical ordering until then.
 */
export interface Category {
  id: string;
  name: string;
}

export const CATEGORIES: Category[] = [
  { id: 'arrays-hashing', name: 'Arrays & Hashing' },
  { id: 'two-pointers', name: 'Two Pointers' },
  { id: 'sliding-window', name: 'Sliding Window' },
  { id: 'stack', name: 'Stack' },
  { id: 'binary-search', name: 'Binary Search' },
  { id: 'linked-lists', name: 'Linked Lists' },
  { id: 'trees', name: 'Trees' },
  { id: 'tries', name: 'Tries' },
  { id: 'heaps', name: 'Heaps / Priority Queue' },
  { id: 'backtracking', name: 'Backtracking' },
  { id: 'graphs', name: 'Graphs' },
  { id: 'dp-1d', name: '1D Dynamic Programming' },
  { id: 'dp-2d', name: '2D Dynamic Programming' },
  { id: 'greedy', name: 'Greedy' },
  { id: 'intervals', name: 'Intervals' },
];
