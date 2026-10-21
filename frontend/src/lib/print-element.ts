export function printElement(target: HTMLElement | null, extraClassName?: string) {
  if (!target) {
    window.print();
    return;
  }

  // Use a plain wrapper for Radix dialogs instead of cloning their fixed,
  // animated dialog root. That lets the browser paginate the content in normal
  // document flow and avoids duplicating dialog semantics in the print tree.
  const isDialogContent = target.getAttribute("data-slot") === "dialog-content";
  const printTarget = document.createElement("div");
  printTarget.className = isDialogContent ? "app-print-target-active" : `${target.className} app-print-target-active`;
  if (target.id && (!isDialogContent || target.id === "livestock-identity-pass")) {
    printTarget.id = target.id;
  }
  if (!isDialogContent && target.hasAttribute("style")) {
    printTarget.setAttribute("style", target.getAttribute("style") ?? "");
  }
  for (const child of Array.from(target.childNodes)) {
    printTarget.append(child.cloneNode(true));
  }
  if (extraClassName) printTarget.classList.add(extraClassName);
  document.body.classList.add("app-print-isolation-active");
  document.body.append(printTarget);

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    window.removeEventListener("afterprint", cleanup);
    if (document.body.contains(printTarget)) {
      printTarget.remove();
    }
    document.body.classList.remove("app-print-isolation-active");
  };
  window.addEventListener("afterprint", cleanup, { once: true });

  // Safety fallback cleans up if afterprint is cancelled or not dispatched by the browser
  const fallbackTimer = window.setTimeout(cleanup, 4000);
  window.addEventListener("afterprint", () => window.clearTimeout(fallbackTimer), { once: true });

  try {
    window.print();
  } catch (error) {
    cleanup();
    throw error;
  }
}
