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

  driver({
    ...config,
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
  }).drive();
}
