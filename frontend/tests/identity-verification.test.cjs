// node --test tests/identity-verification.test.cjs
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const calls = [];
const exportsObject = {};
const clientFile = path.join(__dirname, "../src/lib/identity-verification.ts");
vm.runInNewContext(ts.transpileModule(fs.readFileSync(clientFile, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, {
  exports: exportsObject, URL, window: {}, localStorage: { getItem: () => "test-access" },
  require: (id) => {
    if (id === "axios") return { default: { create: (config) => { calls.push(config); return config; }, isAxiosError: (error) => Boolean(error?.isAxiosError) } };
    if (id === "@/lib/axios") return { getActiveApiUrl: () => "https://backend.example.test" };
    throw new Error(id);
  },
});

test("registration client scopes capability to the configured backend without fallbacks", () => {
  exportsObject.identityClient("test-registration-token");
  assert.equal(calls.at(-1).headers.Authorization, "Identity test-registration-token");
  assert.equal(calls.at(-1).baseURL, "https://backend.example.test");
  exportsObject.identityClient();
  assert.equal(calls.at(-1).headers.Authorization, "Bearer test-access");
});

test("provider destination blocks malicious origins, URL credentials and cleartext", () => {
  assert.match(exportsObject.providerCaptureUrl("https://verify.didit.me/session/test"), /^https:\/\/verify.didit.me\//);
  for (const url of ["http://verify.didit.me/test", "https://verify.didit.me.attacker.test/", "https://attacker.test/", "https://user:password@verify.didit.me/"]) {
    assert.throws(() => exportsObject.providerCaptureUrl(url));
  }
});

test("a completed check still requires human assessment; sandbox never claims real verification", () => {
  assert.match(exportsObject.identityMessage({ state: "COMPLETED", environment: "live" }), /MAO must still assess/);
  assert.match(exportsObject.identityMessage({ state: "COMPLETED", environment: "sandbox" }), /No real identity or liveness/);
  assert.match(exportsObject.identityMessage(null), /No identity-check result/);
  assert.match(exportsObject.identityMessage({ state: "NOT_STARTED", document_capture: "DIDIT_HOSTED" }), /capture have not started/);
  assert.doesNotMatch(exportsObject.identityMessage({ state: "NOT_STARTED", document_capture: "DIDIT_HOSTED" }), /ID uploaded/);
});

test("inconclusive, timeout and expired states give recovery without rejection", () => {
  assert.match(exportsObject.identityMessage({ state: "REVIEW_REQUIRED", environment: "live" }), /does not mean.*rejected/);
  assert.match(exportsObject.identityMessage({ state: "FAILED_TECHNICAL", environment: "live" }), /Retry later/);
  assert.match(exportsObject.identityMessage({ state: "RETRY_REQUIRED", environment: "live" }), /do not create another registration/);
});

test("errors never surface sensitive provider payloads", () => {
  const error = { isAxiosError: true, response: { status: 500, data: { secret: "sensitive provider response" } } };
  assert.doesNotMatch(exportsObject.identityError(error), /sensitive provider response/);
  const unauthenticated = exportsObject.identityError({ ...error, response: { status: 401, data: error.response.data } });
  assert.match(unauthenticated, /session could not be authenticated/);
  assert.match(unauthenticated, /do not register again/);
  assert.doesNotMatch(unauthenticated, /sensitive provider response/);
  assert.match(exportsObject.identityError({ ...error, response: { status: 429 } }), /Too many attempts/);
});
