// Run with node --test tests/livestock-qr.test.cjs. Exercise real components and
// API functions, replacing HTTP and browser APIs so no server/camera is needed.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const auction = 'app/(auction)/auction-inspections/';
const record = { id: 17, tag_number: 'CATTLE-00123', livestock_type: 1, livestock_type_name: 'Cattle', breed: 'Brahman', sex: 'MALE', registration_status: 'APPROVED', operational_status: 'ACTIVE', eligible: true, ineligibility_reason: '', owner_id: 8, owner_name: 'Juan Dela Cruz', origin: 'Purok 2', barangay: 'Poblacion' };
const wrapper = ({ children, ...props }) => React.createElement('div', props, children);
function load(file, mocks = {}, globals = {}) {
  const output = {};
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  vm.runInNewContext(source, { exports: output, ...globals, require(id) {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id.startsWith('@/components/ui/')) return new Proxy({}, { get: () => wrapper });
    return require(id);
  }});
  return output;
}
const Identity = load('components/livestock-identity-result.tsx').LivestockIdentityResult;
test('identity card displays livestock and farmer separately and obeys server eligibility', () => {
  const render = animal => renderToStaticMarkup(React.createElement(Identity, { record: animal, onAdd() {} }));
  const html = render(record);
  for (const value of ['Farmer / Owner', 'CATTLE-00123', 'Juan Dela Cruz', 'Poblacion', 'Brahman', 'MALE', 'APPROVED', 'ACTIVE', 'Add to Movement Log']) assert.ok(html.includes(value));
  assert.doesNotMatch(html, /disabled=""/);
  const denied = render({ ...record, eligible: false, ineligibility_reason: 'Cannot link this animal.' });
  assert.match(denied, /disabled=""/);
  assert.match(denied, /Cannot link this animal/);
  assert.doesNotMatch(denied, /CLEARED/);
});
test('shared resolver calls authenticated API and preserves the returned identity', async () => {
  const calls = [];
  const api = load(auction + 'auction-analytics.ts', { '@/lib/axios': { get: async (...args) => { calls.push(args); return { data: record }; } } });
  const payload = 'https://example.test/?batchId=CATTLE-00123';
  assert.equal(await api.lookupRegisteredLivestock(payload), record);
  assert.equal(calls[0][0], '/inspections/livestock-lookup/');
  assert.equal(calls[0][1].params.code, payload);
});
// Minimal hook runner for component handlers; effect dependencies and cleanup
// are retained. This does not claim browser layout or camera hardware coverage.
function harness(file, name, mocks, props) {
  const slots = []; let cursor = 0; let effects = []; let tree;
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const hooks = { ...React,
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial }; },
    useMemo(fn, deps) { const i = cursor++; if (!same(slots[i]?.deps, deps)) slots[i] = { deps, value: fn() }; return slots[i].value; },
    useEffect(fn, deps) { const i = cursor++; if (!same(slots[i]?.deps, deps)) { const previous = slots[i]; slots[i] = { deps }; effects.push(() => { previous?.cleanup?.(); slots[i].cleanup = fn(); }); } },
  };
  hooks.useCallback = (fn, deps) => hooks.useMemo(() => fn, deps);
  const globals = { window: { localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout, confirm: () => true }, document: { addEventListener() {}, removeEventListener() {} }, navigator: {}, requestAnimationFrame: fn => { globals.frame = fn; return 1; }, cancelAnimationFrame() {}, HTMLMediaElement: { HAVE_CURRENT_DATA: 2 } };
  const Component = load(file, { react: hooks, ...mocks }, globals)[name];
  return {
    render() { cursor = 0; tree = Component(props); return tree; },
    async settle() { this.render(); const pending = effects; effects = []; for (const fn of pending) fn(); await new Promise(resolve => setTimeout(resolve, 5)); return this.render(); },
    find(predicate) { function walk(n) { if (!n || typeof n !== 'object') return; if (predicate(n)) return n; for (const child of [n.props?.children].flat(Infinity)) { const result = walk(child); if (result) return result; } } const result = walk(tree); assert.ok(result, 'element not found'); return result; },
    globals,
  };
}
const text = n => typeof n === 'string' ? n : [n?.props?.children].flat(Infinity).map(c => typeof c === 'object' ? text(c) : String(c ?? '')).join('');
function scanner(lookup, onFound = () => null) {
  return harness(auction + 'movement-livestock-qr-dialog.tsx', 'MovementLivestockQrDialog', { './auction-analytics': { lookupRegisteredLivestock: lookup }, '@/components/livestock-identity-result': { LivestockIdentityResult: Identity } }, { open: true, onOpenChange() {}, onFound });
}
async function enterAndLookup(h, code) {
  await h.settle();
  h.find(n => n.props?.placeholder?.startsWith('QR payload')).props.onChange({ target: { value: code } }); h.render();
  await h.find(n => n.props?.onClick && text(n).endsWith(' Lookup')).props.onClick(); await new Promise(resolve => setImmediate(resolve)); h.render();
}
test('scanner resolves handheld QR payload and requires explicit addition', async () => {
  const codes = []; const added = [];
  const h = scanner(async code => { codes.push(code); return record; }, animal => { added.push(animal); return null; });
  await enterAndLookup(h, 'CATTLE-00123');
  assert.deepEqual(codes, ['CATTLE-00123']); assert.equal(added.length, 0);
  const result = h.find(n => n.type === Identity);
  assert.equal(result.props.record.owner_name, 'Juan Dela Cruz');
  result.props.onAdd(); assert.equal(added[0].id, 17);
});
test('ineligible scanner result cannot be added', async () => {
  let added = 0;
  const h = scanner(async () => ({ ...record, eligible: false, operational_status: 'SOLD' }), () => { added++; return null; });
  await enterAndLookup(h, 'CATTLE-00123');
  h.find(n => n.type === Identity).props.onAdd(); assert.equal(added, 0);
});
test('unknown identifier shows an error instead of manufacturing identity or clearance', async () => {
  const h = scanner(async () => { throw new Error('unknown'); });
  await enterAndLookup(h, 'UNKNOWN');
  assert.match(text(h.find(n => n.props?.role === 'alert')), /Livestock record not found/);
});
test('decoded camera QR invokes the same backend lookup and stops the camera', async () => {
  const codes = []; let stopped = 0;
  const h = scanner(async code => { codes.push(code); return record; });
  h.globals.window.BarcodeDetector = class { async detect() { return [{ rawValue: 'CATTLE-00123' }]; } };
  h.globals.navigator.mediaDevices = { getUserMedia: async () => ({ getTracks: () => [{ stop() { stopped++; } }] }) };
  await h.settle();
  h.find(n => n.props?.onClick && text(n).endsWith('Camera')).props.onClick(); h.render();
  h.find(n => n.type === 'video').props.ref.current = { readyState: 2, play: async () => {} };
  await h.settle();
  await h.globals.frame(); await new Promise(resolve => setImmediate(resolve)); h.render();
  assert.deepEqual(codes, ['CATTLE-00123']);
  assert.equal(h.find(n => n.type === Identity).props.record.owner_name, 'Juan Dela Cruz');
  await h.settle();
  assert.equal(stopped, 1);
});
test('movement search previews the farmer, links inventory, keeps external intake and opens QR', async () => {
  const codes = []; const payloads = []; const Qr = () => null;
  const h = harness(auction + 'movement-log-form.tsx', 'NewInspectionForm', {
    'next/navigation': { useRouter: () => ({ push() {}, replace() {} }) }, '@/contexts/auth-context': { useAuth: () => ({ user: { email: 'auction@example.test' } }) },
    '@/lib/axios': { get: async () => ({ data: [{ id: 1, name: 'Cattle' }] }) },
    './auction-analytics': { lookupRegisteredLivestock: async code => { codes.push(code); return record; }, searchRegisteredShippers: async () => [], createInspection: async payload => { payloads.push(payload); } },
    './movement-livestock-qr-dialog': { MovementLivestockQrDialog: Qr }, '@/components/livestock-identity-result': { LivestockIdentityResult: Identity },
  }, { onSubmitSuccess() {} });
  await h.settle(); await h.settle();
  h.find(n => n.props?.placeholder === 'Search by tag or inventory ID').props.onChange({ target: { value: 'CATTLE-00123' } }); h.render();
  await h.find(n => n.props?.onClick && text(n).endsWith(' Search')).props.onClick(); await new Promise(resolve => setImmediate(resolve)); h.render();
  assert.deepEqual(codes, ['CATTLE-00123']);
  const found = h.find(n => n.type === Identity); assert.equal(found.props.record.owner_id, 8);
  found.props.onAdd(); h.render();
  assert.equal(h.find(n => n.props?.value === 'Juan Dela Cruz').props.value, 'Juan Dela Cruz');
  assert.match(text(h.find(n => n.props?.className === 'text-xs font-semibold text-emerald-800')), /CATTLE-00123/);
  h.find(n => n.props?.onClick && text(n).includes('Add External Livestock')).props.onClick(); await new Promise(resolve => setImmediate(resolve)); h.render();
  assert.match(text(h.find(n => n.type === 'form')), /Item #2.*External \/ unregistered/);
  let qrButtons = 0;
  h.find(n => n.props?.onClick && text(n).endsWith(' Scan QR') && ++qrButtons === 2).props.onClick(); h.render();
  const dialog = h.find(n => n.type === Qr);
  assert.equal(dialog.props.open, true);
  assert.match(dialog.props.onFound(record), /already included/);
  assert.match(dialog.props.onFound({ ...record, eligible: false, ineligibility_reason: 'Animal inactive.' }), /Animal inactive/);
  assert.match(dialog.props.onFound({ ...record, id: 18, owner_id: 9 }), /different shipper/);
  assert.equal(dialog.props.onFound({ ...record, id: 18, tag_number: 'CATTLE-00124' }), null);
  h.render();
  h.find(n => n.props?.onClick && text(n).includes('Add External Livestock')).props.onClick(); h.render();
  await h.find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(payloads[0].shipper, 8);
  assert.equal(payloads[0].shipper_name, 'Juan Dela Cruz');
  assert.deepEqual(Array.from(payloads[0].items, item => item.inventory), [17, 18, null]);
  assert.deepEqual(Array.from(payloads[0].items, item => item.quantity), [1, 1, 1]);
});
