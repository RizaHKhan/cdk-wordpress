import { StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { StackExtender } from "../utils/StackExtender";
import {
  Certificate,
  CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";
import { HostedZone } from "aws-cdk-lib/aws-route53";

export class DistributionStack extends StackExtender {
  public hostedZone: HostedZone;
  public certificate: Certificate;

  constructor(scope: Construct, props?: StackProps) {
    super(scope, "WordpressDistribution", props);

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
}
