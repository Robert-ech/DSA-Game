import arraysHashing from './arrays-hashing.json';

export interface ProblemExample {
  input: string;
  output: string;
}

export interface ProblemTestCase {
  args: unknown[];
  expected: unknown;
  /** When true, compare `expected` and the result as unordered lists. */
  unordered?: boolean;
}

export interface Problem {
  id: string;
  category: string;
  title: string;
  difficulty: string;
  statement: string;
  functionName: string;
  starterCode: string;
  examples: ProblemExample[];
  testCases: ProblemTestCase[];
  hint: string;
  timeLimitMs: number;
}

/**
 * Problems per category, 10 per castle (node index -> problem). Categories
 * without a file yet are stubs: their castles show as "under construction"
 * until the JSON lands (Phase 5/7).
 */
const PROBLEMS: Record<string, Problem[]> = {
  'arrays-hashing': arraysHashing as Problem[],
};

export function getProblems(categoryId: string): Problem[] {
  return PROBLEMS[categoryId] ?? [];
}
