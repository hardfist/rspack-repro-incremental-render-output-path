# Rspack incremental chunk render cache output-path repro

Rspack issue: [web-infra-dev/rspack#14873](https://github.com/web-infra-dev/rspack/issues/14873)

`ChunkRenderCacheArtifact` is keyed only by content hash even though JavaScript chunk rendering also consumes the resolved output path.

```bash
npm install
npm test
```

The filename function moves an unchanged entry from `first.js` to `deep/nested/first.js`. A `new-url-relative` asset URL must therefore change from `./asset.txt` to `../../asset.txt`.

The hot compilation emits the chunk at the new filename but reuses source rendered for the old filename. A fresh build emits the correct relative URL.

To test it interactively, run `npm run dev`, change `SECOND-0` to `SECOND-1`
in `src/second.js`, then press Enter in the dev terminal. The reported hot URL
still starts with `./`, while the fresh-build URL starts with `../../`.
`npm run dev:watch` is also available for regular CLI watch mode.
