/* global loadPyodide, importScripts */
// Classic worker (served straight from /public) that runs the player's Python
// against a problem's test cases via Pyodide. The main thread enforces the
// per-run timeout by terminating this worker — Pyodide can't be interrupted
// mid-execution — so keep NO state here that can't be rebuilt by a respawn.

const PYODIDE_VERSION = 'v0.26.4';
const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/`;

importScripts(`${PYODIDE_BASE}pyodide.js`);

// Python-side harness: exec the player's code as file "<solution>" (so
// tracebacks point at their line numbers), run each test, and compare results
// after a JSON round-trip (normalizes tuples/sets to lists). Comparison
// happens in Python because Python equality already treats lists/dicts/None
// the way the problems expect.
const HARNESS = `
import json, io, traceback, contextlib

def _format_error(exc):
    try:
        te = traceback.TracebackException.from_exception(exc)
        frames = [f for f in te.stack if f.filename == '<solution>']
        if frames:
            te.stack = traceback.StackSummary.from_list(frames)
        return ''.join(te.format()).strip()
    except Exception:
        return repr(exc)

def _normalize(value):
    def coerce(o):
        if isinstance(o, (set, frozenset)):
            return sorted(o, key=repr)
        return repr(o)
    return json.loads(json.dumps(value, default=coerce))

def run_tests(user_code, function_name, tests_json):
    tests = json.loads(tests_json)
    out = io.StringIO()
    ns = {}
    try:
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
            exec(compile(user_code, '<solution>', 'exec'), ns)
    except Exception as e:
        return json.dumps({'setupError': _format_error(e), 'stdout': out.getvalue(), 'results': []})
    fn = ns.get(function_name)
    if not callable(fn):
        return json.dumps({
            'setupError': "Your code must define a function named '%s'." % function_name,
            'stdout': out.getvalue(), 'results': []})
    results = []
    for t in tests:
        entry = {'pass': False,
                 'input': ', '.join(repr(a) for a in t['args']),
                 'expected': repr(t['expected'])}
        try:
            args = json.loads(json.dumps(t['args']))  # fresh copy: solutions may mutate inputs
            with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
                got = fn(*args)
            got_norm = _normalize(got)
            exp = t['expected']
            if t.get('unordered') and isinstance(got_norm, list) and isinstance(exp, list):
                key = lambda v: json.dumps(v, sort_keys=True)
                ok = sorted(got_norm, key=key) == sorted(exp, key=key)
            else:
                ok = got_norm == exp
            entry['pass'] = bool(ok)
            entry['actual'] = repr(got)
        except Exception as e:
            entry['error'] = _format_error(e)
        results.append(entry)
    return json.dumps({'results': results, 'stdout': out.getvalue()})
`;

let pyodideReady = (async () => {
  const pyodide = await loadPyodide({ indexURL: PYODIDE_BASE });
  pyodide.runPython(HARNESS);
  postMessage({ type: 'ready' });
  return pyodide;
})();

pyodideReady.catch((err) => {
  postMessage({ type: 'boot-error', error: String(err) });
});

self.onmessage = async (e) => {
  const { type, id, code, functionName, tests } = e.data;
  if (type !== 'run') return;
  try {
    const pyodide = await pyodideReady;
    const runTests = pyodide.globals.get('run_tests');
    const resultJson = runTests(code, functionName, JSON.stringify(tests));
    if (runTests.destroy) runTests.destroy();
    postMessage({ type: 'result', id, payload: JSON.parse(resultJson) });
  } catch (err) {
    postMessage({
      type: 'result',
      id,
      payload: { setupError: String(err), results: [] },
    });
  }
};
