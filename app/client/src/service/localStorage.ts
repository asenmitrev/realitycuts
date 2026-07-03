export const getItem = (key: string) => {
  const item = localStorage.getItem(key);
  try {
    return JSON.parse(item ?? '');
  } catch {
    return item;
  }
};
export const setItem = (key: string, item: string | number | object) => localStorage.setItem(key, JSON.stringify(item));
export const clear = () => localStorage.clear();
