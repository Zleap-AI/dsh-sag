# Publishing dsh-sag 0.1.1

This checklist prepares the public `@zleap-ai/dsh-sag` package. It does not publish automatically.

## Release requirements

- Node.js `^22.19.0` or `>=24.0.0`
- pnpm `11.7.0`
- a working dsh `0.1.x` host available as `dsh`, or selected with `DSH_BIN`
- npm access to the `@zleap-ai` organization

## Verify the release candidate

```sh
pnpm install --frozen-lockfile
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run test:python
pnpm run check:pack
```

`check:pack` builds the package twice, verifies the file allowlist and third-party notices, installs the generated archive into an isolated dsh Web profile, exercises `setup` and `doctor`, boots the selected dsh host, checks invalid configuration failure, and verifies that the plugin shares the host Cordis runtime. Set `DSH_BIN` when validating a dsh upgrade; the smoke test must run against that exact host.

Inspect the generated manifest before publishing:

```sh
pnpm --filter @zleap-ai/dsh-sag pack --dry-run
npm view @zleap-ai/dsh-sag@0.1.1 version
```

The `npm view` command should report that the version does not exist. If it already exists, stop: npm versions are immutable.

## Publish

After the release commit and tag have been reviewed:

```sh
npm whoami
pnpm --filter @zleap-ai/dsh-sag publish --access public --no-git-checks
```

Verify the registry package from a clean dsh profile using the Quick start commands in the package README. Record the published package URL and the exact dsh version used for acceptance.
