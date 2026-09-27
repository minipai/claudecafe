/** The two ways to take her home, drawn as line icons in the text's own
 * colour: a screen for the desktop app, a prompt for the terminal plugin. */
export type IconName = "desktop" | "terminal";

export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      class="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {name === "desktop" ? (
        <>
          <rect x="2.5" y="3.5" width="19" height="13" rx="2" />
          <path d="M8 20.5h8M12 16.5v4" />
        </>
      ) : (
        <>
          <rect x="2.5" y="3.5" width="19" height="17" rx="2" />
          <path d="m7 10 3 2.5L7 15M12.5 15H17" />
        </>
      )}
    </svg>
  );
}
