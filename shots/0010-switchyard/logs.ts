/* Job logs, authored per station. Each job returns its body (streamed while
   the train dwells) and a tail that only prints when the job ends. */

import { LINE, RELEASE, type LineId } from "./data";

export type Tone = "cmd" | "dim" | "ok" | "fail" | "warn";
export type LogLine = { text: string; tone?: Tone };
export type Log = { body: LogLine[]; tail: LogLine[] };

export type JobCtx = {
  line: LineId;
  station: string;
  sha: string;
  branch: string;
  message: string;
  attempt: number;
  failed: boolean;
  tests?: number;
};

const cmd = (text: string): LogLine => ({ text: `$ ${text}`, tone: "cmd" });
const dim = (text: string): LogLine => ({ text, tone: "dim" });
const ok = (text: string): LogLine => ({ text, tone: "ok" });
const bad = (text: string): LogLine => ({ text, tone: "fail" });
const warn = (text: string): LogLine => ({ text, tone: "warn" });
const out = (text: string): LogLine => ({ text });

const REGISTRY = "registry.atlas.internal";

function checkout(c: JobCtx): Log {
  const scope = LINE[c.line].scope;
  return {
    body: [
      cmd(`git fetch --depth=50 origin ${c.branch}`),
      dim("From github.com:atlas-eng/atlas"),
      dim(` * branch            ${c.branch} -> FETCH_HEAD`),
      cmd(`git checkout --force ${c.sha}`),
      out(`HEAD is now at ${c.sha} ${c.message}`),
      cmd(`git sparse-checkout set ${scope}`),
      dim(`sparse checkout: ${scope.split(" ").length} paths, 2,318 files`),
    ],
    tail: [ok("checkout finished")],
  };
}

function registry(c: JobCtx): Log {
  const img = `${REGISTRY}/${c.line}:${c.sha}`;
  return {
    body: [
      cmd(`crane push dist/${c.line}.tar ${img}`),
      dim("pushing 7 layers, 4 already present"),
      out(`${img}: digest sha256:4e0b7c1a9df3 size 2417`),
      cmd(`cosign sign --yes ${img}`),
      dim("tlog entry created with index 148230917"),
      cmd(`syft ${img} -o spdx-json | cosign attach sbom --sbom - ${img}`),
    ],
    tail: [ok(`published ${c.line}:${c.sha}, signed, SBOM attached (1,128 packages)`)],
  };
}

function staging(c: JobCtx): Log {
  if (c.line === "infra") {
    return {
      body: [
        cmd("terraform -chdir=infra/terraform/envs/staging apply -auto-approve tfplan"),
        out("aws_db_parameter_group.api: Modifying... [id=api-pg16-staging]"),
        out("aws_db_parameter_group.api: Modifications complete after 4s"),
        out("aws_db_instance.api: Modifying... [id=api-staging]"),
        dim("aws_db_instance.api: Still modifying... [40s elapsed]"),
        out("aws_db_instance.api: Modifications complete after 52s"),
      ],
      tail: [ok("Apply complete! Resources: 0 added, 2 changed, 0 destroyed.")],
    };
  }
  return {
    body: [
      cmd(`helm upgrade --install ${c.line} charts/${c.line} -n staging --set image.tag=${c.sha} --wait`),
      out(`Release "${c.line}" has been upgraded.`),
      dim("REVISION: 1873"),
      out(`Waiting for deployment "${c.line}" rollout to finish: 4 of 6 updated replicas are available...`),
      out(`deployment "${c.line}" successfully rolled out`),
      cmd(`./scripts/smoke staging ${c.line}`),
      dim("GET /healthz 200 · GET /v2/merchants/me 200 · POST /v2/payment_intents 201"),
    ],
    tail: [ok("smoke: 24 of 24 checks passed")],
  };
}

function canary(): Log {
  return {
    body: [
      out(`canary analysis: ${RELEASE.name} against ${RELEASE.previous} (baseline)`),
      dim(`window ${RELEASE.canarySince} to now, 10% of production traffic`),
      out("http_error_rate      0.21%   limit 1.00%   pass"),
      out("latency_p99          184 ms  limit 250 ms  pass"),
      out("latency_p50           41 ms  limit  60 ms  pass"),
      out("pod_restarts             0   limit     2   pass"),
      out("payment_capture_rate 99.4%   floor 99.0%   pass"),
    ],
    tail: [ok("canary healthy: promotion waits on release checks")],
  };
}

function production(promoted: boolean): Log {
  const name = promoted ? RELEASE.name : RELEASE.previous;
  return {
    body: [
      out(`production is serving ${name}`),
      dim(promoted ? "promoted from Canary today" : `live since ${RELEASE.previousLive}`),
      cmd(`kubectl -n production get rollout web api workers`),
      out("NAME      DESIRED   CURRENT   UP-TO-DATE   AVAILABLE"),
      out("web       24        24        24           24"),
      out("api       36        36        36           36"),
      out("workers   18        18        18           18"),
    ],
    tail: [ok(`${name} healthy in all three regions`)],
  };
}

function e2e(c: JobCtx): Log {
  const failing = c.failed;
  const body: LogLine[] = [
    cmd("make e2e SUITE=api TARGET=ephemeral"),
    dim(`attempt ${c.attempt} · starting ephemeral env e2e-${c.sha} (postgres 16.4, redis 7.2, stripe-mock 0.188)`),
    out(`waiting for api-${c.sha}.e2e.atlas.internal/healthz ... ok (11.2s)`),
    out("Running 148 tests using 6 workers"),
    ok("  ✓  payments/capture.spec.ts:18:3 › captures an authorised intent (842ms)"),
    ok("  ✓  payments/capture.spec.ts:41:3 › rejects capture above the authorised amount (390ms)"),
    ok("  ✓  payments/refund.spec.ts:12:3 › full refund settles the same day (1.1s)"),
    ok("  ✓  disputes/list.spec.ts:9:3 › paginates with a cursor (604ms)"),
  ];
  if (failing) {
    body.push(
      bad("  ✘  payments/idempotency.spec.ts:62:5 › replays a 409 with the original response (30.0s)"),
      ok("  ✓  payments/idempotency.spec.ts:44:5 › accepts a repeated key with the same body (712ms)"),
      bad("  ✘  payments/idempotency.spec.ts:88:5 › does not double-capture after a client retry (30.0s)"),
      bad("  ✘  refunds/partial.spec.ts:27:3 › refunds the remainder after a 409 retry (12.4s)"),
      ok("  ✓  webhooks/delivery.spec.ts:15:3 › signs every delivery (288ms)"),
    );
  } else {
    body.push(
      ok("  ✓  payments/idempotency.spec.ts:44:5 › accepts a repeated key with the same body (701ms)"),
      ok("  ✓  payments/idempotency.spec.ts:62:5 › replays a 409 with the original response (1.4s)"),
      ok("  ✓  payments/idempotency.spec.ts:88:5 › does not double-capture after a client retry (1.9s)"),
      ok("  ✓  refunds/partial.spec.ts:27:3 › refunds the remainder after a 409 retry (2.2s)"),
      ok("  ✓  webhooks/delivery.spec.ts:15:3 › signs every delivery (276ms)"),
    );
  }
  body.push(dim("  ... 134 more"));
  const tail: LogLine[] = failing
    ? [
        out(""),
        bad("  1) payments/idempotency.spec.ts:62:5 › replays a 409 with the original response"),
        out("     Error: apiRequestContext.post: read ECONNRESET"),
        out("       POST http://stripe-mock.e2e.svc:12111/v1/payment_intents/pi_3Q8x/capture"),
        dim("       at payments/idempotency.spec.ts:71:31"),
        bad("  2) payments/idempotency.spec.ts:88:5 › does not double-capture after a client retry"),
        out("     Error: apiRequestContext.post: read ECONNRESET"),
        bad("  3) refunds/partial.spec.ts:27:3 › refunds the remainder after a 409 retry"),
        out("     Error: expect(received).toBe(expected)  Expected: 409  Received: 502"),
        warn("stripe-mock e2e-4be1d07: container restarted at 14:05:41 (OOMKilled, limit 256Mi)"),
        out(""),
        bad(`  ${c.tests ?? 3} failed`),
        ok("  145 passed (2.9m)"),
        dim(`traces: s3://atlas-ci-artifacts/api/${c.sha}/e2e/attempt-${c.attempt}/`),
        bad(`error: e2e failed, ${c.tests ?? 3} of 148 tests`),
      ]
    : [out(""), ok("  148 passed (2.6m)"), ok("e2e passed")];
  return { body, tail };
}

type Job = (c: JobCtx) => Log;

const JOBS: Record<LineId, Record<string, Job>> = {
  web: {
    install: () => ({
      body: [
        cmd("pnpm install --frozen-lockfile --filter @atlas/web..."),
        dim("Lockfile is up to date, resolution step is skipped"),
        out("Progress: resolved 1482, reused 1479, downloaded 3, added 1482"),
        dim("dependencies: + next 16.0.3  + react 19.2.0  + zod 3.25.4"),
      ],
      tail: [ok("Done in 41.8s")],
    }),
    eslint: () => ({
      body: [cmd("eslint apps/web packages/ui --max-warnings 0 --cache"), dim("cache hit for 388 of 412 files")],
      tail: [ok("412 files, 0 problems")],
    }),
    typecheck: () => ({
      body: [cmd("tsc --noEmit -p apps/web"), dim("checking 1,906 files across 3 project references")],
      tail: [ok("0 errors in 51.3s")],
    }),
    vitest: () => ({
      body: [
        cmd("vitest run --reporter=dot"),
        dim(" RUN  v3.2.4 /workspace/apps/web"),
        out(" ································································"),
        out(" ································································"),
        out(" ····························································"),
      ],
      tail: [ok(" Test Files  128 passed (128)"), ok("      Tests  1204 passed (1204)"), dim("   Duration  94.0s")],
    }),
    build: () => ({
      body: [
        cmd("next build"),
        out("   ▲ Next.js 16.0.3"),
        out("   Creating an optimized production build ..."),
        ok(" ✓ Compiled successfully in 1.4min"),
        ok(" ✓ Generating static pages (64/64)"),
        out("Route (app)                      Size   First Load JS"),
        out("┌ ○ /                           4.1 kB          142 kB"),
        out("├ ƒ /checkout                  18.7 kB          171 kB"),
        out("├ ƒ /orders/[id]               11.2 kB          158 kB"),
        out("└ ƒ /account/billing            6.9 kB          149 kB"),
      ],
      tail: [ok("build output: .next (51.2 MB), standalone image context written")],
    }),
  },
  api: {
    gomod: () => ({
      body: [cmd("go mod download -x"), dim("GOFLAGS=-mod=readonly GOPROXY=https://goproxy.atlas.internal")],
      tail: [ok("214 modules, 211 from cache")],
    }),
    lint: () => ({
      body: [cmd("golangci-lint run ./services/api/... ./pkg/..."), dim("enabled: errcheck govet staticcheck gosec revive")],
      tail: [ok("0 issues.")],
    }),
    test: () => ({
      body: [
        cmd("go test -race -count=1 ./services/api/... ./pkg/..."),
        ok("ok  	atlas/services/api/payments	14.212s"),
        ok("ok  	atlas/services/api/refunds	6.981s"),
        ok("ok  	atlas/services/api/disputes	3.402s"),
        ok("ok  	atlas/pkg/idempotency	2.117s"),
      ],
      tail: [ok("ok  	atlas/services/api/webhooks	5.660s"), dim("coverage: 81.4% of statements")],
    }),
    docker: (c) => ({
      body: [
        cmd(`docker buildx build -t ${c.line}:${c.sha} --platform linux/amd64,linux/arm64 services/api`),
        dim("#7 [build 4/6] RUN go build -trimpath -o /out/api ./cmd/api"),
        dim("#9 [runtime 2/2] COPY --from=build /out/api /usr/local/bin/api"),
      ],
      tail: [ok(`exported ${c.line}:${c.sha} (2 platforms, 38.4 MB)`)],
    }),
    integration: () => ({
      body: [
        cmd("go test -tags=integration ./services/api/integration/..."),
        dim("testcontainers: postgres:16.4 ready in 3.1s, redis:7.2 ready in 0.8s"),
        ok("ok  	atlas/services/api/integration/ledger	41.882s"),
      ],
      tail: [ok("ok  	atlas/services/api/integration/payouts	29.104s")],
    }),
    e2e,
  },
  workers: {
    install: () => ({
      body: [cmd("poetry install --no-root --only main,test"), dim("Installing dependencies from lock file")],
      tail: [ok("Package operations: 0 installs, 2 updates, 0 removals (celery 5.4.1, kombu 5.4.2)")],
    }),
    ruff: () => ({ body: [cmd("ruff check services/workers && ruff format --check services/workers")], tail: [ok("All checks passed! 311 files already formatted")] }),
    pytest: () => ({
      body: [
        cmd("pytest services/workers -n 8 -q"),
        out("........................................................................ [ 38%]"),
        out("........................................................................ [ 77%]"),
      ],
      tail: [ok("611 passed, 4 skipped in 88.21s")],
    }),
    image: (c) => ({
      body: [
        warn("waiting for a runner: image-build pool 8 of 8 busy"),
        dim("queued 5m 48s behind web e4a1f90, mobile c5e19a0"),
        cmd(`docker buildx build -t workers:${c.sha} services/workers`),
        dim("#11 [deps 3/3] RUN pip install --no-deps -r requirements.lock"),
      ],
      tail: [ok(`exported workers:${c.sha} (112 MB)`)],
    }),
    contract: () => ({
      body: [cmd("pact-verifier --provider workers --broker https://pact.atlas.internal"), dim("verifying 4 consumer contracts: api, web, mobile, ledger")],
      tail: [ok("4 of 4 pacts verified")],
    }),
  },
  mobile: {
    install: () => ({ body: [cmd("yarn install --immutable"), dim("➤ YN0000: · Yarn 4.5.1")], tail: [ok("➤ YN0000: · Done with warnings in 1m 12s")] }),
    tsc: () => ({ body: [cmd("tsc --noEmit -p apps/mobile")], tail: [ok("0 errors")] }),
    jest: () => ({ body: [cmd("jest --ci --shard=1/1"), dim("PASS src/orders/deepLink.test.ts")], tail: [ok("Tests: 412 passed, 412 total")] }),
    ios: () => ({
      body: [
        cmd("xcodebuild -workspace ios/Atlas.xcworkspace -scheme Atlas -configuration Release archive"),
        dim("▸ Compiling AppDelegate.mm"),
        dim("▸ Linking Atlas"),
        dim("▸ Running script '[CP] Embed Pods Frameworks'"),
      ],
      tail: [ok("** ARCHIVE SUCCEEDED ** (2 warnings)")],
    }),
    android: () => ({ body: [cmd("./gradlew :app:bundleRelease --build-cache"), dim("> Task :app:mergeReleaseResources FROM-CACHE")], tail: [ok("BUILD SUCCESSFUL in 2m 6s, 812 actionable tasks: 96 executed, 716 from cache")] }),
    detox: () => ({ body: [cmd("detox test -c ios.sim.release --headless"), ok(" PASS  e2e/checkout.e2e.ts (48.2 s)"), ok(" PASS  e2e/deepLink.e2e.ts (21.7 s)")], tail: [ok("Tests: 37 passed, 37 total")] }),
    testflight: (c) => ({ body: [cmd(`fastlane ios beta build_number:${c.sha}`), dim("Uploading Atlas.ipa to App Store Connect")], tail: [ok("Build processed, available to the internal testers group")] }),
  },
  infra: {
    fmt: () => ({ body: [cmd("terraform fmt -check -recursive infra/terraform")], tail: [ok("0 files need formatting")] }),
    validate: () => ({ body: [cmd("terraform -chdir=infra/terraform/envs/staging validate")], tail: [ok("Success! The configuration is valid.")] }),
    plan: () => ({
      body: [
        cmd("terraform -chdir=infra/terraform/envs/staging plan -out=tfplan"),
        dim("Refreshing state... 412 resources"),
        out("  # aws_db_parameter_group.api will be updated in-place"),
        warn('      ~ value = "200" -> "400"  (max_connections)'),
        out("  # aws_db_instance.api will be updated in-place"),
      ],
      tail: [ok("Plan: 0 to add, 2 to change, 0 to destroy.")],
    }),
    policy: () => ({ body: [cmd("conftest test tfplan.json -p policy/terraform"), dim("26 policies: tagging, encryption, public-access, cost")], tail: [ok("26 tests, 26 passed, 0 warnings, 0 failures")] }),
  },
  docs: {
    mdx: () => ({ body: [cmd("pnpm --filter @atlas/docs build"), dim("compiled 284 pages, 31 changed")], tail: [ok("built in 52.4s")] }),
    links: () => ({ body: [cmd("lychee --offline docs/out"), dim("checking 3,912 links")], tail: [ok("3,912 total, 3,912 OK, 0 errors")] }),
    pages: () => ({ body: [cmd("wrangler pages deploy docs/out --project-name atlas-docs")], tail: [ok("Deployed to https://docs.atlas.dev")] }),
  },
};

export function logFor(c: JobCtx, promoted: boolean): Log {
  if (c.station === "checkout") return checkout(c);
  if (c.station === "registry") return registry(c);
  if (c.station === "staging") return staging(c);
  if (c.station === "canary") return canary();
  if (c.station === "production") return production(promoted);
  const job = JOBS[c.line][c.station];
  return job ? job(c) : { body: [dim("no output")], tail: [] };
}
