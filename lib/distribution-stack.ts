import { StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { StackExtender } from "../utils/StackExtender";
import {
  Certificate,
  CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { LoadBalancerV2Origin } from "aws-cdk-lib/aws-cloudfront-origins";
import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";
import {
  CachePolicy,
  Distribution,
  OriginProtocolPolicy,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { ApplicationLoadBalancer } from "aws-cdk-lib/aws-elasticloadbalancingv2";

export class DistributionStack extends StackExtender {
  public hostedZone: HostedZone;
  public certificate: Certificate;

  constructor(scope: Construct, props?: StackProps) {
    super(scope, "WordpressAcm", props);

    this.createHostedZone();
    this.createCertificate();
  }

  private createHostedZone(): void {
    this.hostedZone = new HostedZone(
      this,
      this.setConstructName("HostedZone"),
      {
        zoneName: this.domainName,
      },
    );
  }

  private createCertificate(): void {
    this.certificate = new Certificate(
      this,
      this.setConstructName("Certificate"),
      {
        domainName: this.domainName, // Root domain (modernartisans.xyz)
        subjectAlternativeNames: [`*.${this.domainName}`], // Wildcard domain (*.modernartisans.xyz)
        validation: CertificateValidation.fromDns(this.hostedZone),
      },
    );
  }

  public createCloudfrontDistributionAndARecord(
    alb: ApplicationLoadBalancer,
  ): void {
    const distribution = new Distribution(
      this,
      this.setConstructName("Distribution"),
      {
        defaultBehavior: {
          origin: new LoadBalancerV2Origin(alb, {
            protocolPolicy: OriginProtocolPolicy.HTTP_ONLY,
          }),
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: CachePolicy.CACHING_OPTIMIZED,
        },
        domainNames: [`www.${this.domainName}`, this.domainName],
        certificate: this.certificate,
      },
    );

    // A Record for www
    new ARecord(this, "ARecord", {
      zone: this.hostedZone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
      recordName: `www.${this.domainName}`,
    });

    // A Record for root domain
    new ARecord(this, "RootARecord", {
      zone: this.hostedZone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
      recordName: this.domainName, // root domain
    });
  }
}
