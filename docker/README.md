# Docker images

These exist because Tauri 2 requires webkit2gtk-4.1 and libsoup3, which
Ubuntu 20.04 and older cannot provide. On such hosts the app can be neither
built nor run natively — see the README's "Running on Ubuntu 20.04 and other
older distributions" section for why copying a `.deb` from a newer machine
does not work either.

Both images are driven by the scripts in `../scripts/`; you rarely need to
invoke `docker` directly.

| File | Image | Purpose |
| --- | --- | --- |
| `Dockerfile.build` | `lighttranslator-build:jammy` | Rust + Node 18 + WebKitGTK dev libraries. Produces the `.deb`. Jammy fixes the artifact's floor at glibc 2.35, so it installs on Ubuntu 22.04/24.04 and Debian 12+. |
| `Dockerfile.run` | `lighttranslator-run:jammy` | Runtime libraries only. The app is *not* baked in — `entrypoint.sh` installs the `.deb` mounted at `/opt/deb` on start, so a new build costs a container restart instead of an image rebuild. |

## Notes

- `Dockerfile.run` takes `--build-arg WITH_OCR=0` to drop Tesseract and its
  language data (~250 MB). The app then shows its on-demand OCR install
  guidance instead of running OCR.
- Build artifacts stay out of the repo: the scripts mount named volumes for
  `CARGO_HOME` (`lighttranslator-cargo`) and `CARGO_TARGET_DIR`
  (`lighttranslator-target`), which also keep rebuilds incremental.
- App settings and API keys live in the `lighttranslator-data` volume, so they
  survive updates and container removal.

## Rebuilding by hand

```bash
docker build -t lighttranslator-build:jammy -f docker/Dockerfile.build docker/
docker build -t lighttranslator-run:jammy   -f docker/Dockerfile.run   docker/
```
