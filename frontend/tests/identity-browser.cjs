// Optional browser QA: PLAYWRIGHT_MODULE=/path/to/playwright node tests/identity-browser.cjs
// Uses synthetic fixtures and intercepted APIs; never contacts a verification provider.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const origin = process.env.IDENTITY_QA_ORIGIN || "http://localhost:3107";
const headers = { "access-control-allow-origin": origin, "access-control-allow-headers": "authorization,content-type", "access-control-allow-methods": "GET,POST,OPTIONS" };
const baseAttempt = {
  id: "synthetic-attempt", state: "IN_PROGRESS", environment: "live", document_result: "NOT_COMPLETED",
  face_result: "NOT_COMPLETED", liveness_result: "NOT_COMPLETED", provider_reference: "synthetic-session",
  updated_at: "2026-10-20T12:00:00Z", consent_at: "2026-10-20T11:59:00Z", policy_version: "qa-only",
  manual_review_at: null, manual_review_reason: "", assessment_current: false, events: [],
};

async function run() {
  const browser = await chromium.launch({ channel: process.env.IDENTITY_QA_BROWSER || "chrome", headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  let current = { ...baseAttempt };
  let unavailable = false;
  let expired = false;
  let starts = [];
  let registrations = 0;
  await context.addInitScript(() => sessionStorage.setItem("registration-identity-session", "synthetic-test-token"));
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const respond = (status, data) => route.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify(data) });
    if (url.pathname.includes("/api/users/identity/")) {
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
      if (url.pathname.endsWith("/config/")) return respond(200, { enabled: true, available: true, provider: "Didit", environment: "live", policy_version: "qa-only", retention_notice: "Synthetic QA policy; no real data collected.", privacy_contact: "Synthetic support desk" });
      if (expired) return respond(401, {});
      if (url.pathname.endsWith("/status/")) return respond(200, { attempt: current });
      if (url.pathname.endsWith("/start/")) { starts.push(request.postDataJSON()); return respond(201, { url: "https://verify.didit.me/session/synthetic" }); }
      if (unavailable) return respond(503, { secret: "PRIVATE-PAYLOAD-MUST-NOT-RENDER" });
      return respond(200, { attempt: current });
    }
    if (url.hostname === "verify.didit.me") return route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Mock external capture destination</h1>" });
    if (url.pathname === "/api/users/register/") {
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
      registrations += 1;
      return respond(201, { identity_verification: { required: true, access_token: "synthetic-issued-token" } });
    }
    if (url.pathname.endsWith("/livestock/barangays/")) return respond(200, [{ id: 1, barangay_name: "Synthetic Barangay" }]);
    return route.continue();
  });
  const artifacts = path.join(__dirname, "../test-artifacts/identity");
  fs.mkdirSync(artifacts, { recursive: true });
  try {
    for (const width of [375, 390, 414, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(origin + "/farmer-registration/identity");
      await page.getByRole("heading", { name: "ID and selfie capture with Didit" }).waitFor();
      assert.equal(await page.getByRole("button", { name: "Resume / retake capture" }).isDisabled(), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `No horizontal overflow at ${width}px`);
      await page.getByText(/If camera access is denied/).waitFor();
      await page.screenshot({ path: path.join(artifacts, `capture-${width}.png`), fullPage: true });
    }
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Resume / retake capture" }).click();
    await page.waitForURL("https://verify.didit.me/session/synthetic");
    assert.equal(starts.at(-1).consent, true);
    assert.equal(starts.at(-1).retry, false);

    current = { ...baseAttempt, state: "RETRY_REQUIRED" };
    await page.goto(origin + "/farmer-registration/identity");
    await page.getByRole("button", { name: "Retry ID and selfie capture" }).waitFor();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Retry ID and selfie capture" }).click();
    await page.waitForURL("https://verify.didit.me/session/synthetic");
    assert.equal(starts.at(-1).retry, true);

    for (const state of ["COMPLETED", "REVIEW_REQUIRED"]) {
      current = { ...baseAttempt, state, face_result: "PASSED", liveness_result: state === "COMPLETED" ? "PASSED" : "INCONCLUSIVE" };
      await page.goto(origin + "/farmer-registration/identity");
      await page.getByRole("heading", { name: "ID and selfie capture with Didit" }).waitFor();
      await page.getByText(state === "COMPLETED" ? /MAO must still assess/ : /does not mean your registration was rejected/).waitFor();
    }
    unavailable = true;
    await page.getByRole("button", { name: "Check provider result" }).click();
    await page.getByRole("alert").filter({ hasText: /unavailable or interrupted/ }).waitFor();
    assert.equal((await page.textContent("body")).includes("PRIVATE-PAYLOAD-MUST-NOT-RENDER"), false);
    expired = true;
    await page.reload();
    await page.getByText(/Registration session expired/).waitFor();
    expired = false;
    unavailable = false;
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(origin + "/farmer-registration");
    await page.locator("#firstName").fill("Synthetic");
    await page.locator("#lastName").fill("Applicant");
    await page.locator("#email").fill("synthetic@example.test");
    await page.getByPlaceholder("912 345 6789").fill("9123456789");
    await page.locator("#password").fill("SyntheticPassword123!");
    await page.locator("#confirmPassword").fill("SyntheticPassword123!");
    await page.getByRole("button", { name: "Proceed to Farm Details" }).click();
    await page.locator("#barangay").selectOption("1");
    await page.locator("#farmSize").fill("1.5");
    await page.locator("#address").fill("Synthetic test location");
    await page.getByRole("button", { name: "Proceed to Documents & Consent" }).click();
    await page.locator("#governmentIdType").selectOption("PASSPORT");
    const photos = page.locator('input[type="file"][accept="image/jpeg,image/png,image/webp"]');
    await photos.nth(0).setInputFiles({ name: "bad.exe", mimeType: "application/octet-stream", buffer: Buffer.from("not-image") });
    await page.getByText("Front and back ID uploads must be image files.").waitFor();
    const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ3sAAAAASUVORK5CYII=", "base64");
    await photos.nth(0).setInputFiles({ name: "synthetic-front.png", mimeType: "image/png", buffer: image });
    await photos.nth(1).setInputFiles({ name: "synthetic-back.png", mimeType: "image/png", buffer: image });
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Complete Registration" }).click();
    await page.waitForURL(origin + "/farmer-registration/identity");
    assert.equal(registrations, 1);
    assert.equal(await page.evaluate(() => sessionStorage.getItem("registration-identity-session")), "synthetic-issued-token");
    console.log("PASS: registration progression and upload validation, consent gate, capture/resume link, retake retry, human-review outcomes, safe failure/expiry messaging, and 375/390/414/1280px layouts (mocked APIs).");
  } finally {
    await context.close();
    await browser.close();
  }
}
run().catch((error) => { console.error(error.message); process.exitCode = 1; });
