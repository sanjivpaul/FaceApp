# Android build failure: `generateCodegenSchemaFromJavaScript` / `node`

This note documents what failed when running `npm run android` (or `./gradlew app:installDebug`) for FaceApp, based on the Gradle error and a full `--stacktrace` run.

## What you see in the terminal (surface error)

```text
> Task :bam.tech_react-native-image-resizer:generateCodegenSchemaFromJavaScript FAILED

FAILURE: Build failed with an exception.

* What went wrong:
Execution failed for task ':bam.tech_react-native-image-resizer:generateCodegenSchemaFromJavaScript'.
> A problem occurred starting process 'command 'node''
```

The build stops during the **New Architecture codegen** step for the dependency **`@bam.tech/react-native-image-resizer`** (Gradle project name: `:bam.tech_react-native-image-resizer`).

## Actual root cause (from `--stacktrace`)

Gradle fails when it tries to **spawn the Node.js binary**. The nested exception is:

```text
Caused by: java.io.IOException: Cannot run program "node" (in directory ".../node_modules/@bam.tech/react-native-image-resizer/android"): error=2, No such file or directory
```

So:

- The task runs the executable named **`node`** (no absolute path), using whatever environment the **Gradle daemon** has.
- On macOS, **interactive shells** often put Node on `PATH` (e.g. Homebrew at `/opt/homebrew/bin`, or nvm/fnm under your home directory).
- The **Gradle daemon** is usually started by Android Studio or an earlier `gradlew` invocation with a **minimal `PATH`**, so `node` is not found → `error=2, No such file or directory`.

This is an **environment / PATH issue**, not a bug in your FaceApp JavaScript code. The app “crashes” at **install/build time** because the native build never completes.

## Why `NODE_BINARY` in `gradle.properties` may not fix it

This project sets `NODE_BINARY=/usr/local/bin/node` in `android/gradle.properties`. That variable is useful for **some** React Native / older tooling paths, but the **React Native Gradle plugin** codegen tasks use the `react { nodeExecutableAndArgs = [...] }` setting (default: `["node"]`). If that is left as the default, the plugin still invokes **`node`** by name and hits the same PATH problem unless the daemon can resolve it.

Similarly, `nodeExecutablesPath` in `android/build.gradle` does not automatically replace the codegen task’s command; the fix that aligns with the plugin is to set **`nodeExecutableAndArgs`** to the **full path** of your Node binary (see below).

## Other log lines (not the build breaker)

| Message | Meaning |
|--------|---------|
| `[VisionCamera] react-native-worklets-core not found, Frame Processors are disabled!` | Informational: frame processors off unless you add `react-native-worklets-core`. **Not** why the build failed. |
| `Deprecated Gradle features were used... incompatible with Gradle 10` | Warning about future Gradle versions. **Not** the immediate failure. |
| `[Incubating] Problems report... problems-report.html` | Gradle 9 problems report link. Optional extra detail. |

## How to fix (recommended)

1. In a terminal where `node` works, get the real path:

   ```bash
   which node
   ```

2. In **`android/app/build.gradle`**, inside the existing `react { ... }` block, set the executable explicitly (use **your** path from step 1):

   ```gradle
   react {
       nodeExecutableAndArgs = ["/opt/homebrew/bin/node"]  // example; use `which node` output
       autolinkLibrariesWithApp()
   }
   ```

3. Stop old daemons so they pick up a clean environment if needed:

   ```bash
   cd android && ./gradlew --stop
   ```

4. Run `npm run android` again.

**Note:** If you only install Node via **nvm**, the path may look like `/Users/<you>/.nvm/versions/node/vXX.X.X/bin/node`. That path is stable for a given version; update `nodeExecutableAndArgs` when you change Node versions.

## Quick verification

Re-run the failing task with stacktrace (optional):

```bash
cd android
./gradlew :bam.tech_react-native-image-resizer:generateCodegenSchemaFromJavaScript --stacktrace
```

After fixing `nodeExecutableAndArgs`, this task should succeed.

## References in this repo

- Dependency: `@bam.tech/react-native-image-resizer` (see `package.json`).
- New Architecture: `newArchEnabled=true` in `android/gradle.properties` — codegen runs for libraries that use the React Native `react` plugin on their Android library project.

---

*Document generated from analysis of FaceApp Android Gradle logs and React Native 0.83 Gradle plugin behavior.*
