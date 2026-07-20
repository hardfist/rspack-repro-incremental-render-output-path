globalThis.load = () => import('./lazy.js'); console.log(new URL('./asset.txt', import.meta.url));
