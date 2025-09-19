export const checkHealth = async (url: string, timeout: number = 5000): Promise<boolean> => {
  return new Promise((resolve) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    fetch(url, { signal: controller.signal })
      .then(() => {
        clearTimeout(timeoutId);
        resolve(true);
      })
      .catch(() => {
        clearTimeout(timeoutId);
        resolve(false);
      });
  });
};