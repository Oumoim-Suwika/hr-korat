import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsp from 'aws-cdk-lib/aws-ecs-patterns';
import * as sm from 'aws-cdk-lib/aws-secretsmanager';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cf from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as r53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Full production stack for Sati (single hospital / single tenant).
 *
 *   Frontend : hr-mnrh.app.sati.co.th      (S3 + CloudFront)
 *   API      : api-hr-mnrh.app.sati.co.th  (ALB + ECS Fargate)
 *   Database : Amazon Aurora PostgreSQL Serverless v2 (private subnets)
 *
 * NOTE: deploy in us-east-1 so the CloudFront ACM certificate is in-region
 * (single-command deploy). Region is configurable in bin/sati.ts.
 */
export class SatiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const ctx = (k: string, d: string) => (this.node.tryGetContext(k) as string) ?? d;
    const baseZoneName = ctx('baseZoneName', 'sati.co.th');
    const domainName = ctx('domainName', 'hr-mnrh.app.sati.co.th');
    const apiDomainName = ctx('apiDomainName', 'api-hr-mnrh.app.sati.co.th');

    const zone = r53.HostedZone.fromLookup(this, 'Zone', { domainName: baseZoneName });

    // TLS certificates (DNS-validated against the hosted zone)
    const siteCert = new acm.Certificate(this, 'SiteCert', {
      domainName, validation: acm.CertificateValidation.fromDns(zone),
    });
    const apiCert = new acm.Certificate(this, 'ApiCert', {
      domainName: apiDomainName, validation: acm.CertificateValidation.fromDns(zone),
    });

    // ---- network ----------------------------------------------------------
    const vpc = new ec2.Vpc(this, 'Vpc', { maxAzs: 2, natGateways: 1 });

    // ---- database: Aurora PostgreSQL Serverless v2 ------------------------
    const db = new rds.DatabaseCluster(this, 'Db', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({ version: rds.AuroraPostgresEngineVersion.VER_16_4 }),
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

    // JWT signing secret (kept out of code/repo)
    const jwtSecret = new sm.Secret(this, 'JwtSecret', {
      generateSecretString: { passwordLength: 48, excludePunctuation: true },
    });

    // ---- API: ECS Fargate behind ALB -------------------------------------
    const cluster = new ecs.Cluster(this, 'Cluster', { vpc });
    const apiService = new ecsp.ApplicationLoadBalancedFargateService(this, 'Api', {
      cluster,
      cpu: 512,
      memoryLimitMiB: 1024,
      desiredCount: 2,
      taskImageOptions: {
        image: ecs.ContainerImage.fromAsset(path.join(__dirname, '..', '..', 'server')),
        containerPort: 4000,
        environment: {
          DB_DRIVER: 'pg',
          PORT: '4000',
          CORS_ORIGIN: `https://${domainName}`,
        },
        secrets: {
          // node-postgres reads these PG* vars automatically
          PGHOST: ecs.Secret.fromSecretsManager(dbSecret, 'host'),
          PGPORT: ecs.Secret.fromSecretsManager(dbSecret, 'port'),
          PGUSER: ecs.Secret.fromSecretsManager(dbSecret, 'username'),
          PGPASSWORD: ecs.Secret.fromSecretsManager(dbSecret, 'password'),
          PGDATABASE: ecs.Secret.fromSecretsManager(dbSecret, 'dbname'),
          JWT_SECRET: ecs.Secret.fromSecretsManager(jwtSecret),
        },
      },
      publicLoadBalancer: true,
      domainName: apiDomainName,
      domainZone: zone,
      certificate: apiCert,
      redirectHTTP: true,
    });
    apiService.targetGroup.configureHealthCheck({ path: '/api/health', healthyHttpCodes: '200' });
    db.connections.allowDefaultPortFrom(apiService.service, 'API -> Aurora');

    // Autoscale API on CPU
    const scaling = apiService.service.autoScaleTaskCount({ minCapacity: 2, maxCapacity: 10 });
    scaling.scaleOnCpuUtilization('Cpu', { targetUtilizationPercent: 60 });

    // ---- frontend: S3 + CloudFront ---------------------------------------
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    const distribution = new cf.Distribution(this, 'Cdn', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
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

    // Deploy the built SPA (run `bun run build` at repo root first)
    new s3deploy.BucketDeployment(this, 'DeploySite', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '..', '..', 'dist'))],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ['/*'],
    });

    // ---- Cognito (future: staff SSO / LINE federation) --------------------
    new cognito.UserPool(this, 'UserPool', {
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      passwordPolicy: { minLength: 10, requireDigits: true, requireLowercase: true, requireUppercase: true },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ---- outputs ----------------------------------------------------------
    new cdk.CfnOutput(this, 'FrontendUrl', { value: `https://${domainName}` });
    new cdk.CfnOutput(this, 'ApiUrl', { value: `https://${apiDomainName}` });
    new cdk.CfnOutput(this, 'DbSecretArn', { value: dbSecret.secretArn });
  }
}
