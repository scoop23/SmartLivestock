import { driver, type Config } from "driver.js";
import { toast } from "sonner";

const AUTO_TUTORIALS_KEY = "smartlivestock-auto-tutorials";
const TUTORIAL_PREFERENCE_EVENT = "smartlivestock:tutorial-preference-change";
const TUTORIALS_OFF_NOTICE_KEY = "smartlivestock-tutorials-off-notice-shown";

export function getAutomaticTutorialsEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(AUTO_TUTORIALS_KEY) !== "off";
}

export function setAutomaticTutorialsEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTO_TUTORIALS_KEY, enabled ? "on" : "off");
  window.dispatchEvent(new Event(TUTORIAL_PREFERENCE_EVENT));
}

export function shouldAutoStartTutorial(tutorialKey: string): boolean {
  if (typeof window === "undefined") return false;
  return (
    getAutomaticTutorialsEnabled() &&
    window.localStorage.getItem(tutorialKey) !== "done"
  );
}

export function markTutorialSeen(tutorialKey: string): void {
  window.localStorage.setItem(tutorialKey, "done");
}

export function startGuidedTutorial(config: Config): void {
  if (!getAutomaticTutorialsEnabled()) {
    if (window.localStorage.getItem(TUTORIALS_OFF_NOTICE_KEY) !== "shown") {
      window.localStorage.setItem(TUTORIALS_OFF_NOTICE_KEY, "shown");
      toast("Tutorials are turned off", {
        description: "Turn tutorials on to start a guide.",
      });
    }
    return;
  }

  const onDestroyed = config.onDestroyed;
  const userOnPopoverRender = config.onPopoverRender;

  const existingButtons = config.showButtons ?? ["next", "previous"];
  const showButtons = Array.from(new Set([...existingButtons, "close" as const]));

  const steps = config.steps?.map((step) => {
    if (!step.popover) return step;
    return {
      ...step,
      popover: {
        ...step.popover,
        showButtons: Array.from(
          new Set([...(step.popover.showButtons ?? ["next", "previous"]), "close" as const])
        ),
      },
    };
  });

  let skipTriggered = false;
  const triggerSkipTutorial = (e?: Event) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (skipTriggered) return;
    skipTriggered = true;
    setAutomaticTutorialsEnabled(false);
    driverInstance.destroy();
    toast("Tutorial skipped", {
      description: "Automatic tutorials turned off.",
      action: {
        label: "Undo",
        onClick: () => {
          setAutomaticTutorialsEnabled(true);
          toast.success("Automatic tutorials turned on");
        },
      },
    });
  };

  const driverInstance = driver({
    allowClose: true,
    ...config,
    steps,
    showButtons,
    onCloseClick: () => {
      triggerSkipTutorial();
    },
    onPopoverRender: (popover, opts) => {
      userOnPopoverRender?.(popover, opts);

      if (popover.footer) {
        popover.footer.style.display = "grid";
      }

      if (popover.closeButton) {
        popover.closeButton.textContent = "Skip";
        popover.closeButton.classList.add("driver-popover-skip-btn");
        popover.closeButton.style.display = "inline-flex";
        popover.closeButton.setAttribute("aria-label", "Skip tutorial");
        popover.closeButton.setAttribute("title", "Skip tutorial");
        popover.closeButton.onclick = triggerSkipTutorial;
        popover.closeButton.onpointerdown = triggerSkipTutorial;
      }

      if (popover.footer && popover.previousButton) {
        popover.footer.insertBefore(popover.previousButton, popover.footer.firstChild);
      }
    },
    onDestroyed: (element, step, options) => {
      onDestroyed?.(element, step, options);
      if (options.reason !== "done") return;

      const isEnabled = getAutomaticTutorialsEnabled();
      toast("Tutorial finished", {
        description: isEnabled
          ? "This tutorial will not repeat automatically. Turn tutorials off for this browser if you prefer."
          : "Tutorials are off. You can turn them back on from here.",
        duration: 7000,
        action: {
          label: isEnabled ? "Turn off" : "Turn on",
          onClick: () => {
            setAutomaticTutorialsEnabled(!isEnabled);
            toast.success(isEnabled ? "Automatic tutorials turned off" : "Automatic tutorials turned on");
          },
        },
      });
    },
  });

  driverInstance.drive();
}
