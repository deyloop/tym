export type Theme = "light" | "dark" | "system";

export const THEME_KEY = "tym_theme_v1";

const THEMES: Theme[] = ["light", "dark", "system"];

function isTheme(value: string | null): value is Theme {
	return value === "light" || value === "dark" || value === "system";
}

function getSystemDark(): boolean {
	if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
		return false;
	}
	return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export class ThemeState {
	current = $state<Theme>("system");
	systemDark = $state<boolean>(false);

	resolved = $derived< "light" | "dark">(
		this.current === "system" ? (this.systemDark ? "dark" : "light") : this.current,
	);

	constructor() {
		this.systemDark = getSystemDark();
		try {
			const stored = localStorage.getItem(THEME_KEY);
			if (isTheme(stored)) {
				this.current = stored;
			}
		} catch {
			// Private mode / unavailable storage: fall back to system.
		}
	}

	apply() {
		if (typeof document === "undefined") return;
		const dark = this.resolved === "dark";
		document.documentElement.classList.toggle("dark", dark);
		document.documentElement.style.colorScheme = dark ? "dark" : "light";
	}

	set(theme: Theme) {
		this.current = theme;
		try {
			localStorage.setItem(THEME_KEY, theme);
		} catch {
			// Ignore persistence failures.
		}
		this.apply();
	}

	next(): Theme {
		const idx = THEMES.indexOf(this.current);
		return THEMES[(idx + 1) % THEMES.length];
	}

	cycle() {
		this.set(this.next());
	}

	init(): () => void {
		this.systemDark = getSystemDark();
		this.apply();
		if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
			return () => {};
		}
		const mq = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = (e: MediaQueryListEvent) => {
			this.systemDark = e.matches;
			this.apply();
		};
		mq.addEventListener("change", onChange);
		return () => mq.removeEventListener("change", onChange);
	}
}

export const theme = new ThemeState();
