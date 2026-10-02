// Run with node --test tests/user-management.test.cjs.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const calls = [];
const api = {
  get: async (...args) => { calls.push(args); return { data: [] }; },
  patch: async (...args) => { calls.push(args); return { data: { id: 7 } }; },
};
const exportsObject = {};
const filename = path.join(__dirname, "../src/app/(admin)/user-management/user-management.ts");
vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, {
  exports: exportsObject,
  require: (id) => {
    if (id === "@/lib/axios") return { default: api };
    if (id === "@tanstack/react-query") return { useMutation: (options) => options, useQueryClient: () => ({}) };
    if (id === "sonner") return { toast: {} };
    return require(id);
  },
});
test("SIBAT labels use staff assignment, even if a stale farmer field exists", () => {
  assert.equal(exportsObject.userBarangayLabel({ role: "SIBAT", assigned_barangay_name: "Manggas", barangay: "Other" }), "Manggas");
  assert.equal(exportsObject.userBarangayLabel({ role: "SIBAT", assigned_barangay_name: null, barangay: "Other" }), "Unassigned");
});
test("Farmer and municipal labels do not fabricate barangays", () => {
  assert.equal(exportsObject.userBarangayLabel({ role: "FARMER", barangay: "Banaba" }), "Banaba");
  assert.equal(exportsObject.userBarangayLabel({ role: "FARMER", barangay: "" }), "Unassigned");
  assert.equal(exportsObject.userBarangayLabel({ role: "MAO", barangay: "" }), "Municipal / no barangay assignment");
});
test("filters use supported server parameters", async () => {
  const filters = { role: "SIBAT", barangay_id: "2", account_status: "APPROVED", search: "Test" };
  await exportsObject.fetchUsersDirectory(filters);
  assert.equal(calls.at(-1)[0], "/api/users/directory/");
  assert.equal(calls.at(-1)[1].params, filters);
});
test("assignment mutation submits jurisdiction only and supports clearing", async () => {
  const mutation = exportsObject.useUpdateSibatAssignment();
  await mutation.mutationFn({ userId: 7, barangayId: 2 });
  assert.equal(calls.at(-1)[0], "/api/users/7/assignment/");
  assert.equal(JSON.stringify(calls.at(-1)[1]), '{"assigned_barangay_id":2}');
  await mutation.mutationFn({ userId: 7, barangayId: null });
  assert.equal(JSON.stringify(calls.at(-1)[1]), '{"assigned_barangay_id":null}');
});
