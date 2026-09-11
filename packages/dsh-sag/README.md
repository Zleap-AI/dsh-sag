# @zleap-ai/dsh-sag

dsh-sag lets DeepSeek Harness use the local SAG personal knowledge base for search, reading, upload, note ingestion, and document management.

Compatible with DeepSeek Harness `0.1.x`, starting at `0.1.1-rc.2`. SAG must include the Connect dsh setting and local connector API. The unmodified SAG `1.8.3` release does not include this capability; use the build from [SAG PR #154](https://github.com/Zleap-AI/SAG/pull/154), or a later SAG release that includes it.

## Quick start

Install and start SAG first, then install the plugin:

```sh
dsh plugin --profile web add @zleap-ai/dsh-sag
dsh plugin --profile web exec dsh-sag doctor
```

You can start using the plugin when `doctor` reports that SAG is connected. The command runs inside the `web` profile, so `dsh-sag` does not need to be on the system PATH. The plugin discovers common local addresses automatically; the normal setup does not require Python or manual credentials.

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

## Update or remove

```sh
dsh plugin --profile web update @zleap-ai/dsh-sag
dsh plugin --profile web remove @zleap-ai/dsh-sag
```

## Connection recovery

Make sure SAG is running, then run `dsh plugin --profile web exec dsh-sag setup` and `dsh plugin --profile web exec dsh-sag doctor`. If automatic discovery fails, export `sag-dsh.json` from SAG or connect with the local-address command above.

To let dsh manage the Python engine directly, see [advanced embedded mode](docs/embedded.md).
