/**
 * The visitor's OpenRouter key and chosen model live only in this browser.
 * Storage can be blocked (private windows, strict settings); the assistant then
 * keeps the key for the session in memory and says nothing is saved.
 */

const KEY = "geografia.openrouter-key";
const MODEL = "geografia.openrouter-model";

function read(name: string): string | null {
  try {
    return window.localStorage.getItem(name);
  } catch {
    return null;
  }
}

function write(name: string, value: string | null): boolean {
  try {
    if (value === null) window.localStorage.removeItem(name);
    else window.localStorage.setItem(name, value);
    return true;
  } catch {
    return false;
  }
}

export const readKey = () => read(KEY);
export const saveKey = (key: string) => write(KEY, key);
export const clearKey = () => write(KEY, null);
export const readModel = () => read(MODEL);
export const saveModel = (model: string) => write(MODEL, model);
