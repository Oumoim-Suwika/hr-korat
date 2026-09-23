import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as sm from 'aws-cdk-lib/aws-secretsmanager';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cf from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as r53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as apigw from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..', '..');

/**
 * Sati production stack — Lambda architecture (no Docker required).
 *
 *   Frontend : hr-mnrh.app.sati.co.th      (S3 + CloudFront)
 *   API      : api-hr-mnrh.app.sati.co.th  (API Gateway HTTP API -> Lambda)
 *   Database : Amazon Aurora PostgreSQL Serverless v2 (private subnets)
 *
 * Deploy region: us-east-1 (CloudFront + API certs both in-region).
 */
export class SatiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const ctx = (k: string, d: string) => (this.node.tryGetContext(k) as string) ?? d;
    const baseZoneName = ctx('baseZoneName', 'app.sati.co.th');
    const hostedZoneId = ctx('hostedZoneId', 'Z03244883NK891J4KR7RI');
    const domainName = ctx('domainName', 'hr-mnrh.app.sati.co.th');
    const apiDomainName = ctx('apiDomainName', 'api-hr-mnrh.app.sati.co.th');

    const zone = r53.HostedZone.fromHostedZoneAttributes(this, 'Zone', {
      hostedZoneId, zoneName: baseZoneName,
    });

    const siteCert = new acm.Certificate(this, 'SiteCert', {
      domainName, validation: acm.CertificateValidation.fromDns(zone),
    });
    const apiCert = new acm.Certificate(this, 'ApiCert', {
      domainName: apiDomainName, validation: acm.CertificateValidation.fromDns(zone),
    });

    // ---- network ----------------------------------------------------------
    const vpc = new ec2.Vpc(this, 'Vpc', { maxAzs: 2, natGateways: 1 });

    // ---- database ---------------------------------------------------------
    const db = new rds.DatabaseCluster(this, 'Db', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({ version: rds.AuroraPostgresEngineVersion.of('16.8', '16') }),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 8,
      writer: rds.ClusterInstance.serverlessV2('writer'),
      defaultDatabaseName: 'sati',
      credentials: rds.Credentials.fromGeneratedSecret('sati_admin'),
      storageEncrypted: true,
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
    });
    const dbSecret = db.secret!;

    const jwtSecret = new sm.Secret(this, 'JwtSecret', {
      generateSecretString: { passwordLength: 48, excludePunctuation: true },
    });

    // ---- API Lambda (in VPC) ---------------------------------------------
    const apiFn = new NodejsFunction(this, 'ApiFn', {
      entry: path.join(repoRoot, 'server', 'src', 'lambda.ts'),
      projectRoot: repoRoot,
      depsLockFilePath: path.join(repoRoot, 'server', 'package-lock.json'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      environment: {
        DB_DRIVER: 'pg',
        DB_SECRET_ARN: dbSecret.secretArn,
        JWT_SECRET_ARN: jwtSecret.secretArn,
        CORS_ORIGIN: `https://${domainName}`,
        NODE_OPTIONS: '--enable-source-maps',
      },
      bundling: {
        format: OutputFormat.ESM,
        target: 'node20',
        sourceMap: true,
        // In Lambda runtime / not needed in prod:
        // Dev-only DB driver (PGlite) must stay external so its static import
        // of @electric-sql/pglite is never linked in the prod (pg) bundle.
        externalModules: ['@aws-sdk/*', '@electric-sql/pglite', 'drizzle-orm/pglite', 'pg-native'],
        // esbuild banner so ESM can use require() if any dep needs it
        banner: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
      },
    });
    dbSecret.grantRead(apiFn);
    jwtSecret.grantRead(apiFn);
    db.connections.allowDefaultPortFrom(apiFn, 'API Lambda to Aurora');

    // ---- HTTP API + custom domain ----------------------------------------
    const apiDomain = new apigw.DomainName(this, 'ApiDomain', {
      domainName: apiDomainName,
      certificate: apiCert,
    });
    const httpApi = new apigw.HttpApi(this, 'HttpApi', {
      defaultIntegration: new HttpLambdaIntegration('ApiIntegration', apiFn),
      defaultDomainMapping: { domainName: apiDomain },
    });
    new r53.ARecord(this, 'ApiAlias', {
      zone, recordName: apiDomainName,
      target: r53.RecordTarget.fromAlias(new targets.ApiGatewayv2DomainProperties(
        apiDomain.regionalDomainName, apiDomain.regionalHostedZoneId,
      )),
    });

    // ---- frontend: S3 + CloudFront ---------------------------------------
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    // API origin = the HTTP API execute-api endpoint (so the whole app lives on
    // ONE domain: the SPA is served from S3, and /api/* is proxied to Lambda).
    const apiOrigin = new origins.HttpOrigin(`${httpApi.apiId}.execute-api.${this.region}.amazonaws.com`);
    const apiBehavior: cf.BehaviorOptions = {
      origin: apiOrigin,
      viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: cf.AllowedMethods.ALLOW_ALL,
      cachePolicy: cf.CachePolicy.CACHING_DISABLED,
      originRequestPolicy: cf.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
    };

    const distribution = new cf.Distribution(this, 'Cdn', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      additionalBehaviors: { '/api/*': apiBehavior },
      domainNames: [domainName],
      certificate: siteCert,
      defaultRootObject: 'index.html',
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
    });
    new r53.ARecord(this, 'SiteAlias', {
      zone, recordName: domainName,
      target: r53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
    });
    new s3deploy.BucketDeployment(this, 'DeploySite', {
      sources: [s3deploy.Source.asset(path.join(repoRoot, 'dist'))],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ['/*'],
    });

    // ---- Cognito (reserved for staff SSO / LINE federation) --------------
    new cognito.UserPool(this, 'UserPool', {
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      passwordPolicy: { minLength: 10, requireDigits: true, requireLowercase: true, requireUppercase: true },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    new cdk.CfnOutput(this, 'FrontendUrl', { value: `https://${domainName}` });
    new cdk.CfnOutput(this, 'ApiUrl', { value: `https://${apiDomainName}` });
    new cdk.CfnOutput(this, 'DbSecretArn', { value: dbSecret.secretArn });
  }
}
