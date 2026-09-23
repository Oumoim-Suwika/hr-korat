#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { SatiStack } from '../lib/sati-stack.js';

const app = new cdk.App();

new SatiStack(app, 'SatiStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    // us-east-1 so the CloudFront ACM certificate is created in-region.
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
  description: 'Sati Shift/OT/Payroll — hr-mnrh.app.sati.co.th (frontend + API + Aurora)',
});
