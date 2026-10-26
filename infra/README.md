# Sati Infrastructure (AWS CDK)

One-command deploy of the whole system for a single hospital.

```
Frontend : https://hr-mnrh.app.sati.co.th      (S3 + CloudFront)
API      : https://api-hr-mnrh.app.sati.co.th  (API Gateway HTTP API + Lambda in VPC)
           CloudFront also proxies /api/* to the same Lambda, so the SPA works same-origin.
Database : Amazon Aurora PostgreSQL Serverless v2  (private subnets, encrypted)
Secrets  : DB credentials + JWT secret in AWS Secrets Manager
Auth     : Cognito user pool (reserved for staff SSO / LINE federation)
Region   : us-east-1 (so the CloudFront certificate is in-region)
```

## Prerequisites

1. **AWS credentials.** The deploy uses the `sati-poc` profile in this repo's history:
   ```bash
   aws configure --profile sati-poc     # never paste keys into chat or commit them
   export AWS_PROFILE=sati-poc
   ```
   Rotate access keys periodically and keep only the keys you actually use
   (`aws iam list-access-keys`). If a key is ever exposed, delete it in IAM
   immediately and create a new one — do not record key IDs in this file.
2. The `sati.co.th` hosted zone must exist in Route 53 in the target account.
3. A JavaScript runtime. **Either** Node 20+ with npm, **or** Bun (see below).
   Docker is **not** required — `NodejsFunction` bundles with local esbuild.

## Deploy

### With Node + npm (standard)

```bash
export AWS_PROFILE=sati-poc
cd infra && npm install
npx cdk bootstrap          # first time per account/region only
(cd .. && bun run build)   # build the SPA so CloudFront has content to serve
npx cdk deploy
```

### With Bun only (no Node installed)

`cdk.json` sets the app command to `npx tsx bin/sati.ts`, which needs Node. With
Bun you must override it and run the CDK CLI through Bun. `NodejsFunction`
bundling also shells out to `npx`, so provide a small shim for it:

```bash
export AWS_PROFILE=sati-poc
cd infra && bun install

# shim: CDK's esbuild bundling calls `npx`
mkdir -p /tmp/nodeshim
cat > /tmp/nodeshim/npx <<'SH'
#!/bin/sh
args=""
for a in "$@"; do
  case "$a" in --no-install|--yes|-y) ;; *) args="$args \"$a\"" ;; esac
done
eval exec bunx $args
SH
chmod +x /tmp/nodeshim/npx

(cd .. && bun run build)
PATH=/tmp/nodeshim:$PATH bun node_modules/aws-cdk/bin/cdk diff   --app "bun bin/sati.ts"
PATH=/tmp/nodeshim:$PATH bun node_modules/aws-cdk/bin/cdk deploy --app "bun bin/sati.ts"
```

Always run `cdk diff` first and read it — this stack contains the production
Aurora database. A content-only release should touch just two resources:
`AWS::Lambda::Function ApiFn` (new code S3Key) and `Custom::CDKBucketDeployment
DeploySite` (new SPA asset). Anything touching Aurora, the VPC, CloudFront or
Route 53 deserves a second look before you proceed.

Outputs print the Frontend URL, API URL, and the DB secret ARN.

## Notes

- **No `VITE_API_URL` is needed for production.** CloudFront defines an
  `/api/*` behaviour pointing at the API, so the SPA calls the API same-origin.
  A plain `bun run build` is correct. Set `VITE_API_URL` only in
  `.env.development` for local dev, where the API runs on `localhost:4000`
  and there is no dev proxy.
- **Database migrations run automatically.** `server/src/lambda.ts` awaits
  `runMigrations()` (idempotent DDL) and `seed()` on cold start before serving
  any request, so a successful `GET /api/health` after deploy means the schema
  applied cleanly.
- **Lambda runtime** is `nodejs24.x`. Keep `bundling.target` in
  `lib/sati-stack.ts` in sync with it. AWS disables updates for deprecated
  runtimes, so do not let this drift.
- `HostedZone.fromLookup` and the asset bundling need valid AWS credentials at
  synth time.
- Costs (approved): Aurora Serverless v2 (min 0.5 ACU), Lambda, 1× NAT gateway,
  CloudFront, API Gateway. Scale-down settings keep idle cost modest.
- Running the app closer to Thailand (e.g. `ap-southeast-1`) requires creating
  the CloudFront certificate in `us-east-1` separately — a small follow-up
  change.
