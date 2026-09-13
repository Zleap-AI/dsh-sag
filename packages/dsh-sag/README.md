# @zleap-ai/dsh-sag

dsh-sag lets DeepSeek Harness use the local SAG personal knowledge base for search, reading, upload, note ingestion, and document management.

## Compatibility

- dsh-sag: `0.1.1`, the published compatibility fix. Do not use `0.1.0` with newer dsh hosts.
- DeepSeek Harness: reviewed against `0.1.5-rc.1` (npm `latest`) and `0.1.5-rc.2` (npm `next`) on 2026-09-13. The package declares a minimum of `0.1.1-rc.2`; its dependency range does not mean every future `0.1.x` release has been tested.
- Node.js: `^22.19.0` or `>=24.0.0`; both `dsh` and `pnpm` must be on PATH.
- SAG must include the Connect dsh setting and local connector API.

## Quick start

Install dsh and pnpm, then start SAG. Existing plugin users should follow “Upgrade and startup recovery” below first. Web does not need to be running to install the plugin:

```sh
dsh plugin --profile web add @zleap-ai/dsh-sag@0.1.1
dsh plugin --profile web exec dsh-sag doctor
dsh --profile web
```

After `doctor` reports that SAG is connected, start or restart Web to load the new plugin. The command runs inside the `web` profile, so `dsh-sag` does not need to be on the system PATH. The plugin discovers common local addresses automatically; the normal setup does not require Python or manual credentials.

## Connect SAG

If `doctor` cannot find SAG, save a connection with any one of these routes:

```sh
# Discover a running local SAG automatically
dsh plugin --profile web exec dsh-sag setup

# Use a connection file exported by SAG
dsh plugin --profile web exec dsh-sag setup ./sag-dsh.json

# Use the local SAG address directly
dsh plugin --profile web exec dsh-sag setup --url http://127.0.0.1:8000
```

Check the saved connection:

```sh
dsh plugin --profile web exec dsh-sag doctor
```

## Ask dsh naturally

- “Search my SAG knowledge base for the DW-2412P30 upload limit and cite the source text.”
- “Upload `/Users/me/Documents/product-manual.pdf` to SAG, then summarize it after processing finishes.”
- “Save the following meeting decisions as a note in SAG: …”

The plugin provides status checks, knowledge-source creation and listing, search and source-text reading, file upload, text ingestion, and document listing, reprocessing, and deletion. SAG advertises the operations available in the current installation; the plugin does not call capabilities that SAG has not enabled.

## Upgrade and startup recovery

If you installed `0.1.0`, stop Web and upgrade the plugin before upgrading dsh. The old plugin imports `settingsNamespace`, which newer dsh hosts no longer export, so loading it can prevent Web from starting. Version `0.1.1` removes that import and widens the host dependency range.

These management commands work without starting Web, including when the old plugin prevents startup:

```sh
# Explicitly replace the old version, including installations pinned to 0.1.0
dsh plugin --profile web add @zleap-ai/dsh-sag@0.1.1
dsh plugin --profile web list @zleap-ai/dsh-sag --depth 0
dsh plugin --profile web exec dsh-sag doctor
dsh --profile web
```

Confirm that the list shows `0.1.1`, then restart Web. An unversioned `update` follows the saved version range and can retain an installation pinned exactly to `0.1.0`. The `doctor` command checks SAG connectivity; verify Web startup separately.

If you cannot upgrade the plugin yet, remove it to recover Web:

```sh
dsh plugin --profile web remove @zleap-ai/dsh-sag
dsh --profile web
```

The management command also removes the bundle registration. Do not delete the whole dsh configuration directory. Removing the plugin does not call SAG's document deletion API; reinstall it and run `doctor` when ready.

Use the original profile and the same `DSH_HOME`, if configured, for every command. Replace `web` with your custom profile name where applicable. If you manually added dsh-sag entries to `cordis.patch.yml`, remove those entries when uninstalling and preserve other plugin configuration. Installing the new version does not replace old plugins in other profiles.

## Connection recovery

Make sure SAG is running, then run `dsh plugin --profile web exec dsh-sag setup` and `dsh plugin --profile web exec dsh-sag doctor`. If automatic discovery fails, export `sag-dsh.json` from SAG or connect with the local-address command above.

To let dsh manage the Python engine directly, see [advanced embedded mode](docs/embedded.md).
