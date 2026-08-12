import type { Problem } from '../data/problems';
import { GameEvents } from './events';

export const EVT_PYODIDE_READY = 'pyodide-ready';

export interface TestCaseResult {
  pass: boolean;
  /** repr() of the arguments — revealed to the player only after a failure. */
  input: string;
  expected: string;
  actual?: string;
  /** Python traceback trimmed to the player's own lines. */
  error?: string;
}

export interface RunOutcome {
  allPassed: boolean;
  timedOut: boolean;
  /** Error before any test ran (syntax error, missing function, worker crash). */
  setupError?: string;
  stdout: string;
  results: TestCaseResult[];
}

interface WorkerPayload {
  setupError?: string;
  stdout?: string;
  results: TestCaseResult[];
}

const TIMEOUT_GRACE_MS = 500; // headroom over the problem's own limit

/**
 * Wraps the Pyodide web worker. Warm it once at boot; run() executes the
 * player's Python against a problem's hidden tests. Pyodide can't be
 * interrupted mid-execution, so the timeout terminates the worker and
 * respawns a fresh one (the game stays responsive; the next run just pays
 * the summoning cost again).
 */
class TestRunnerImpl {
  private worker?: Worker;
  private ready = false;
  private readyWaiters: (() => void)[] = [];
  private nextRunId = 1;
  private activeRun?: { id: number; settle: (o: RunOutcome) => void; timer: number };

  get isReady(): boolean {
    return this.ready;
  }

  /** Spawn the worker and start loading Pyodide. Safe to call repeatedly. */
  warmUp(): void {
    if (this.worker) return;
    this.ready = false;
    const worker = new Worker('pyodide-worker.js');
    this.worker = worker;
    worker.onmessage = (e: MessageEvent) => this.onMessage(e.data);
    worker.onerror = (e: ErrorEvent) => {
      console.error('[TestRunner] Worker error:', e.message);
    };
  }

  private onMessage(msg: {
    type: string;
    id?: number;
    payload?: WorkerPayload;
    error?: string;
  }): void {
    if (msg.type === 'ready') {
      this.ready = true;
      this.readyWaiters.splice(0).forEach((fn) => fn());
      GameEvents.emit(EVT_PYODIDE_READY);
      return;
    }
    if (msg.type === 'boot-error') {
      console.error('[TestRunner] Pyodide failed to load:', msg.error);
      return;
    }
    if (msg.type === 'result' && this.activeRun && msg.id === this.activeRun.id) {
      const run = this.activeRun;
      this.activeRun = undefined;
      window.clearTimeout(run.timer);
      const p = msg.payload ?? { results: [] };
      run.settle({
        allPassed: !p.setupError && p.results.length > 0 && p.results.every((r) => r.pass),
        timedOut: false,
        setupError: p.setupError,
        stdout: p.stdout ?? '',
        results: p.results,
      });
    }
  }

  private whenReady(): Promise<void> {
    if (this.ready) return Promise.resolve();
    this.warmUp();
    return new Promise((resolve) => this.readyWaiters.push(resolve));
  }

  async run(problem: Problem, code: string): Promise<RunOutcome> {
    await this.whenReady();
    if (this.activeRun) {
      return {
        allPassed: false,
        timedOut: false,
        setupError: 'A run is already in progress.',
        stdout: '',
        results: [],
      };
    }
    const id = this.nextRunId++;
    return new Promise<RunOutcome>((settle) => {
      const timer = window.setTimeout(
        () => this.abortForTimeout(),
        problem.timeLimitMs + TIMEOUT_GRACE_MS,
      );
      this.activeRun = { id, settle, timer };
      this.worker!.postMessage({
        type: 'run',
        id,
        code,
        functionName: problem.functionName,
        tests: problem.testCases,
      });
    });
  }

  /** Kill the stuck worker, respawn a fresh one, and report the timeout. */
  private abortForTimeout(): void {
    const run = this.activeRun;
    if (!run) return;
    this.activeRun = undefined;
    this.worker?.terminate();
    this.worker = undefined;
    this.ready = false;
    this.warmUp(); // start re-summoning immediately so the next run is warm
    run.settle({
      allPassed: false,
      timedOut: true,
      setupError:
        'Time limit exceeded — your code ran too long (infinite loop?). The Python spirits are being re-summoned.',
      stdout: '',
      results: [],
    });
  }
}

export const TestRunner = new TestRunnerImpl();
