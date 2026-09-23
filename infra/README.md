# Sati Infrastructure (AWS CDK)

One-command deploy of the whole system for a single hospital.

```
Frontend : https://hr-mnrh.app.sati.co.th      (S3 + CloudFront)
API      : https://api-hr-mnrh.app.sati.co.th  (ALB + ECS Fargate)
Database : Amazon Aurora PostgreSQL Serverless v2  (private subnets, encrypted)
Secrets  : DB credentials + JWT secret in AWS Secrets Manager
Auth     : Cognito user pool (reserved for staff SSO / LINE federation)
```

## ⚠️ Before you deploy
1. **Rotate the leaked access key** `AKIA4WHCPYOG4COGDCVQ` (delete it in IAM) and create a NEW one.
2. Configure it locally **without pasting into any chat**:
   ```bash
   aws configure --profile sati        # enter the NEW key + secret
   export AWS_PROFILE=sati
   ```
3. Requirements: Docker running (for the API container image build), Node 20+, and
   the `sati.co.th` hosted zone must exist in Route 53 in this AWS account.

## Deploy
```bash
cd infra
npm install
npx cdk bootstrap            # first time per account/region
# build the frontend so CloudFront has content to serve:
(cd .. && bun run build)
npx cdk deploy               # region defaults to us-east-1 (CloudFront cert)
```
Outputs print the Frontend URL, API URL, and the DB secret ARN.

## Notes
- Region defaults to **us-east-1** so the CloudFront certificate is in-region and
  the whole thing deploys in one command. To run the app closer to Thailand
  (e.g. `ap-southeast-1`), the CloudFront cert must be created in `us-east-1`
  separately (cross-region) — a small follow-up change.
- Costs (approved): Aurora Serverless v2 (min 0.5 ACU), 2× Fargate tasks,
  1× NAT gateway, CloudFront, ALB. Scale-down settings keep idle cost modest.
- `HostedZone.fromLookup` and the container image build require valid AWS
  credentials at synth/deploy time — this stack has been type-checked but not
  synthesized here (no credentials on the build machine, by design).
- Frontend build must set `VITE_API_URL=https://api-hr-mnrh.app.sati.co.th`
  before `bun run build` (see repo `.env`).
